#!/usr/bin/env node
// Lazy relay of the MCP server "cv" (ADR 0026). Claude Code starts the MCP servers of .mcp.json with
// every session (new or reopened), Claude Desktop with the app: over SSH, every start asks for a touch
// of the YubiKey (ADR 0018), even in a session that never uses `cv`. The relay answers the handshake and
// the lists of tools and prompts itself, from the copy kept at the last connection (out/mcp-relay/), and
// starts the real server, the command given as its arguments, at the first request that needs it (a
// tool, a prompt). Without a copy (first use, other protocol version), it connects at `initialize`.
//   node apps/mcp/dist/relay.js <ssh program> <host> "<command that starts the MCP server remotely>"
// stdout carries only JSON-RPC messages; logs go to stderr (§7.6).
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Readable, Writable } from 'node:stream';
import { resolveRoot } from './root.js';

type Id = string | number;
type Json = Record<string, unknown>;

interface Message {
  jsonrpc: '2.0';
  id?: Id | null;
  method?: string;
  params?: Json;
  result?: Json;
  error?: { code: number; message: string; data?: unknown };
}

/** What the relay keeps of the last connection: static descriptions only, never a datum of the user. */
interface RelayCache {
  version: 1;
  savedAt: string;
  /** Result of `initialize`, by protocol version requested by the client. */
  initialize: Record<string, Json>;
  tools: unknown[] | null;
  prompts: unknown[] | null;
}

const RELAY_CACHE_DIR = 'mcp-relay';
const RELAY_ID = 'cv-relay-';
const METHOD_NOT_FOUND = -32601;
const CONNECTION_FAILED = -32000;
// Time left to the user to touch the key; ssh usually gives up before.
const CONNECT_TIMEOUT_MS = 120_000;
const MAX_PAGES = 50;
// As packages/store/src/atomic.ts: a rename refused by an antivirus or an indexer on Windows is retried.
const RETRYABLE = new Set(['EPERM', 'EACCES', 'EBUSY']);
const RENAME_DELAYS_MS = [20, 40, 80, 160, 320];

const NOT_STARTED =
  'Le serveur MCP « cv » n’a pas pu démarrer (clé de sécurité non touchée à temps, ou connexion refusée). Réessayez : la clé sera demandée de nouveau.';
const LOST =
  'La connexion au serveur MCP « cv » s’est fermée avant la réponse. Réessayez : une nouvelle connexion demandera la clé de sécurité.';

function relayLog(message: string): void {
  process.stderr.write(`[cv-relay] ${message}\n`);
}

function parse(line: string): Message | null {
  try {
    const msg = JSON.parse(line) as unknown;
    return msg && typeof msg === 'object' && !Array.isArray(msg) ? (msg as Message) : null;
  } catch {
    return null;
  }
}

/** Calls `onLine` with every complete line (newline-delimited JSON, as the stdio transport). */
function readLines(stream: Readable, onLine: (line: string) => void): void {
  let buffer = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk: string) => {
    buffer += chunk;
    let end: number;
    while ((end = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, end).replace(/\r$/, '');
      buffer = buffer.slice(end + 1);
      if (line.trim()) onLine(line);
    }
  });
}

/** The capability a method needs on the server; null for the methods every server answers or ignores. */
function capabilityOf(method: string): string | null {
  if (method.startsWith('tools/')) return 'tools';
  if (method.startsWith('prompts/')) return 'prompts';
  if (method.startsWith('resources/')) return 'resources';
  if (method === 'logging/setLevel') return 'logging';
  if (method === 'completion/complete') return 'completions';
  return null;
}

function emptyCache(): RelayCache {
  return { version: 1, savedAt: '', initialize: {}, tools: null, prompts: null };
}

function loadCache(file: string): RelayCache {
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as Partial<RelayCache>;
    const list = (value: unknown) => (Array.isArray(value) ? value : null);
    if (raw.version !== 1 || !raw.initialize || typeof raw.initialize !== 'object') return emptyCache();
    return {
      version: 1,
      savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : '',
      initialize: raw.initialize,
      tools: list(raw.tools),
      prompts: list(raw.prompts),
    };
  } catch {
    return emptyCache();
  }
}

async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await rename(from, to);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (!code || !RETRYABLE.has(code) || attempt >= RENAME_DELAYS_MS.length) throw err;
      await new Promise((r) => setTimeout(r, RENAME_DELAYS_MS[attempt]));
    }
  }
}

/** One copy per server command: the local server and the one of the VPS never share theirs. */
function cacheFileFor(outDir: string, command: readonly string[]): string {
  const key = createHash('sha256').update(JSON.stringify(command)).digest('hex').slice(0, 16);
  return path.join(outDir, RELAY_CACHE_DIR, `${key}.json`);
}

interface Queued {
  msg: Message;
  line: string;
}

class Relay {
  private state: 'idle' | 'connecting' | 'connected' = 'idle';
  private child: ChildProcessByStdio<Writable, Readable, null> | null = null;
  private readonly cache: RelayCache;
  /** Parameters of the client's `initialize`, replayed to the real server at each connection. */
  private clientInit: Json | null = null;
  /** Capabilities announced to the client. */
  private capabilities: Json = {};
  /** `initialize` of the client waiting for the real server (no copy for its protocol version). */
  private pendingInit: Id | null = null;
  private readonly queue: Queued[] = [];
  /** Requests of the client sent to the real server and not answered yet. */
  private readonly inflight = new Set<Id>();
  private readonly own = new Map<string, { resolve: (result: Json) => void; reject: (err: Error) => void }>();
  private nextId = 0;
  /** Lists answered from the copy since the last connection, to warn the client if they changed. */
  private served: { tools?: string; prompts?: string } = {};
  private closing = false;
  /** Writes of the copy, one after the other. */
  private saving: Promise<void> = Promise.resolve();

  constructor(
    private readonly command: string,
    private readonly args: string[],
    private readonly cacheFile: string,
  ) {
    this.cache = loadCache(cacheFile);
  }

  start(): void {
    process.stdout.on('error', () => this.close());
    readLines(process.stdin, (line) => this.fromClient(line));
    process.stdin.on('end', () => this.close());
    const versions = Object.keys(this.cache.initialize);
    relayLog(
      versions.length
        ? `prêt ; serveur lancé à la première requête qui en a besoin (copie du ${this.cache.savedAt}, versions ${versions.join(', ')})`
        : 'prêt ; aucune copie : connexion au serveur dès l’initialisation',
    );
  }

  // --- Client side (Claude) ---

  private fromClient(line: string): void {
    const msg = parse(line);
    if (!msg) return relayLog('message illisible du client ignoré');
    if (msg.method === undefined) {
      // A response to a request of the server (roots, elicitation…): only a connected server sends any.
      if (this.state === 'connected') this.toRemote(line);
      return;
    }
    // The relay sends its own to the server at each connection.
    if (msg.method === 'notifications/initialized') return;
    if (msg.method === 'initialize' && msg.id != null) return this.initialize(msg.id, msg, line);
    if (this.state === 'connected') return this.forward(msg, line);
    if (this.state === 'connecting') {
      this.queue.push({ msg, line });
      return;
    }
    this.answerLocally(msg, line);
  }

  private initialize(id: Id, msg: Message, line: string): void {
    this.clientInit = msg.params ?? {};
    if (this.state === 'connected') return this.forward(msg, line);
    const cached = this.cache.initialize[String(this.clientInit.protocolVersion)];
    if (cached && this.state === 'idle') {
      this.capabilities = (cached.capabilities as Json | undefined) ?? {};
      return this.reply(id, cached);
    }
    this.pendingInit = id;
    this.connect('initialize');
  }

  /** Before any connection: what the copy answers, or the request that starts the real server. */
  private answerLocally(msg: Message, line: string): void {
    const method = msg.method!;
    // Notifications (cancelled, roots/list_changed…) mean nothing to a server that is not running.
    if (msg.id == null) return;
    if (method === 'ping') return this.reply(msg.id, {});
    // Before `initialize`, as the real server: version probes (server/discover…) are unknown methods.
    if (!this.clientInit) return this.replyError(msg.id, METHOD_NOT_FOUND, 'Method not found');
    const capability = capabilityOf(method);
    if (!capability || !(capability in this.capabilities)) {
      return this.replyError(msg.id, METHOD_NOT_FOUND, 'Method not found');
    }
    if (method === 'tools/list' && this.cache.tools) {
      this.served.tools = JSON.stringify(this.cache.tools);
      return this.reply(msg.id, { tools: this.cache.tools });
    }
    if (method === 'prompts/list' && this.cache.prompts) {
      this.served.prompts = JSON.stringify(this.cache.prompts);
      return this.reply(msg.id, { prompts: this.cache.prompts });
    }
    this.queue.push({ msg, line });
    this.connect(method === 'tools/call' ? `outil ${String(msg.params?.name)}` : method);
  }

  private toClient(line: string): void {
    if (!this.closing) process.stdout.write(`${line}\n`);
  }

  private reply(id: Id, result: Json): void {
    this.toClient(JSON.stringify({ jsonrpc: '2.0', id, result }));
  }

  private replyError(id: Id, code: number, message: string): void {
    this.toClient(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }));
  }

  // --- Server side (the real MCP server, over SSH) ---

  private connect(reason: string): void {
    if (this.state !== 'idle') return;
    this.state = 'connecting';
    relayLog(`démarrage du serveur (${reason}) : touchez la clé de sécurité si elle clignote`);
    let child: ChildProcessByStdio<Writable, Readable, null>;
    try {
      child = spawn(this.command, this.args, { stdio: ['pipe', 'pipe', 'inherit'], windowsHide: true });
    } catch (err) {
      this.state = 'idle';
      relayLog(`lancement impossible : ${(err as Error).message}`);
      return this.failWaiting(NOT_STARTED);
    }
    this.child = child;
    child.on('error', (err) => this.lost(child, `lancement impossible : ${err.message}`));
    child.on('exit', (code, signal) => this.lost(child, `serveur arrêté (${code ?? signal})`));
    // A closed pipe is reported by 'exit'.
    child.stdin.on('error', () => undefined);
    readLines(child.stdout, (line) => this.fromRemote(line));
    const timer = setTimeout(() => {
      relayLog('délai de connexion dépassé');
      child.kill();
    }, CONNECT_TIMEOUT_MS);
    this.request('initialize', this.clientInit ?? {}).then(
      (result) => {
        clearTimeout(timer);
        if (this.child === child) this.connected(result);
      },
      (err: Error) => {
        clearTimeout(timer);
        // An error answer: the process is still there; its end fails what waits for it.
        if (this.child === child) {
          relayLog(`initialisation refusée : ${err.message}`);
          child.kill();
        }
      },
    );
  }

  private connected(result: Json): void {
    this.cache.initialize[String(this.clientInit?.protocolVersion)] = result;
    this.capabilities = (result.capabilities as Json | undefined) ?? {};
    this.toRemote(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }));
    this.state = 'connected';
    relayLog('serveur connecté');
    if (this.pendingInit !== null) {
      this.reply(this.pendingInit, result);
      this.pendingInit = null;
    }
    for (const { msg, line } of this.queue.splice(0)) this.forward(msg, line);
    this.saveCache();
    this.refreshLists().catch((err: unknown) => relayLog(`listes non mises à jour : ${(err as Error).message}`));
  }

  /** Updates the copy, and tells the client when the lists it got from the copy were out of date. */
  private async refreshLists(): Promise<void> {
    const tools = 'tools' in this.capabilities ? await this.listAll('tools/list', 'tools') : null;
    const prompts = 'prompts' in this.capabilities ? await this.listAll('prompts/list', 'prompts') : null;
    const served = this.served;
    this.served = {};
    if (served.tools !== undefined && served.tools !== JSON.stringify(tools)) {
      this.toClient(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/tools/list_changed' }));
    }
    if (served.prompts !== undefined && served.prompts !== JSON.stringify(prompts)) {
      this.toClient(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/prompts/list_changed' }));
    }
    this.cache.tools = tools;
    this.cache.prompts = prompts;
    this.saveCache();
  }

  private async listAll(method: string, key: 'tools' | 'prompts'): Promise<unknown[]> {
    const items: unknown[] = [];
    let cursor: unknown;
    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await this.request(method, cursor ? { cursor } : {});
      items.push(...((result[key] as unknown[] | undefined) ?? []));
      cursor = result.nextCursor;
      if (!cursor) break;
    }
    return items;
  }

  /** A request of the relay itself; its answer never reaches the client. */
  private request(method: string, params: Json): Promise<Json> {
    const id = `${RELAY_ID}${++this.nextId}`;
    return new Promise((resolve, reject) => {
      this.own.set(id, { resolve, reject });
      this.toRemote(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    });
  }

  private forward(msg: Message, line: string): void {
    if (msg.id != null) this.inflight.add(msg.id);
    this.toRemote(line);
  }

  private toRemote(line: string): void {
    this.child?.stdin.write(`${line}\n`);
  }

  private fromRemote(line: string): void {
    const msg = parse(line);
    if (!msg) return relayLog('ligne illisible du serveur ignorée');
    if (msg.method === undefined && msg.id != null) {
      const own = typeof msg.id === 'string' ? this.own.get(msg.id) : undefined;
      if (own) {
        this.own.delete(msg.id as string);
        if (msg.error) own.reject(new Error(msg.error.message));
        else own.resolve(msg.result ?? {});
        return;
      }
      this.inflight.delete(msg.id);
    }
    this.toClient(line);
  }

  /** End of the server process: what waited for it gets an error; the next request reconnects. */
  private lost(child: ChildProcessByStdio<Writable, Readable, null>, reason: string): void {
    if (this.child !== child) return;
    this.child = null;
    const message = this.state === 'connected' ? LOST : NOT_STARTED;
    this.state = 'idle';
    if (!this.closing) relayLog(reason);
    for (const own of this.own.values()) own.reject(new Error(reason));
    this.own.clear();
    this.failWaiting(message);
  }

  private failWaiting(message: string): void {
    if (this.pendingInit !== null) this.replyError(this.pendingInit, CONNECTION_FAILED, message);
    this.pendingInit = null;
    for (const { msg } of this.queue.splice(0)) {
      if (msg.id != null) this.replyError(msg.id, CONNECTION_FAILED, message);
    }
    for (const id of this.inflight) this.replyError(id, CONNECTION_FAILED, message);
    this.inflight.clear();
  }

  private saveCache(): void {
    this.saving = this.saving
      .then(() => this.writeCache())
      .catch((err: unknown) => relayLog(`copie non enregistrée : ${(err as Error).message}`));
  }

  private async writeCache(): Promise<void> {
    // Another relay (Claude Desktop, another session) may have kept another protocol version.
    const onDisk = loadCache(this.cacheFile);
    const copy: RelayCache = {
      ...this.cache,
      savedAt: new Date().toISOString(),
      initialize: { ...onDisk.initialize, ...this.cache.initialize },
    };
    await mkdir(path.dirname(this.cacheFile), { recursive: true });
    const tmp = `${this.cacheFile}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
    await writeFile(tmp, `${JSON.stringify(copy, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    try {
      await renameWithRetry(tmp, this.cacheFile);
    } catch (err) {
      await unlink(tmp).catch(() => undefined);
      throw err;
    }
  }

  private close(): void {
    if (this.closing) return;
    this.closing = true;
    process.exitCode = 0;
    // End of input first: the server finishes writing its journal (ADR 0024), then stops.
    const child = this.child;
    child?.stdin.end();
    setTimeout(() => child?.kill(), 1_500).unref();
    setTimeout(() => process.exit(0), 3_000).unref();
  }
}

function main(): void {
  const [command, ...args] = process.argv.slice(2);
  if (!command) {
    relayLog('usage : node apps/mcp/dist/relay.js <commande du serveur MCP> [arguments…]');
    process.exit(2);
  }
  let outDir: string;
  try {
    outDir = resolveRoot().outDir;
  } catch (err) {
    relayLog((err as Error).message);
    process.exit(1);
  }
  new Relay(command, args, cacheFileFor(outDir, [command, ...args])).start();
}

main();
