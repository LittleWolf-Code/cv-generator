// Lazy relay of the MCP server (ADR 0026): the handshake and the lists come from the copy of the last
// connection, the real server starts at the first tool; a refused connection is retried at the next
// request. The "remote" server is the built server on a temporary copy of the fictitious fixture
// « courte » (its stderr, `[cv-mcp] …`, shows when it starts). Requires `npm run build:mcp` (pretest).
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { installFixture } from '@cv/store';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const RELAY = path.join(ROOT, 'apps', 'mcp', 'dist', 'relay.js');
const SERVER = path.join(ROOT, 'apps', 'mcp', 'dist', 'index.js');
const SECRETS = ['camille.martin@example.com', '06 39 98 12 34'];
const CLIENT_INFO = { name: 'relay-test', version: '1' };

interface Message {
  jsonrpc: string;
  id?: string | number;
  method?: string;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

let tmp: string;

beforeAll(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'cv-relay-'));
  await installFixture(path.join(ROOT, 'fixtures', 'personas', 'courte'), path.join(tmp, 'data'));
});
afterAll(() => rm(tmp, { recursive: true, force: true }));

/** The relay in a subprocess, as Claude Code starts it, with the messages it writes on stdout. */
class RelayProcess {
  readonly messages: Message[] = [];
  stderr = '';
  private stdout = '';
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly closed: Promise<number | null>;
  private nextId = 100;

  constructor(remote: string[], outDir: string) {
    const env = { ...process.env, CV_DATA_DIR: path.join(tmp, 'data'), CV_OUT_DIR: outDir };
    delete env.CV_ROOT;
    delete env.CLAUDE_PROJECT_DIR;
    this.child = spawn(process.execPath, [RELAY, ...remote], { cwd: os.tmpdir(), env, stdio: 'pipe' });
    this.child.stdout.on('data', (d: Buffer) => {
      this.stdout += d.toString('utf8');
      const lines = this.stdout.split('\n');
      this.stdout = lines.pop()!;
      for (const line of lines.filter((l) => l.trim())) this.messages.push(JSON.parse(line) as Message);
    });
    this.child.stderr.on('data', (d: Buffer) => (this.stderr += d.toString('utf8')));
    this.closed = new Promise((resolve) => this.child.on('close', resolve));
  }

  /** True once the real server has started (its stderr goes through the relay's). */
  get remoteStarted(): boolean {
    return this.stderr.includes('[cv-mcp]');
  }

  notify(method: string): void {
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method })}\n`);
  }

  async request(method: string, params: Record<string, unknown> = {}): Promise<Message> {
    const id = ++this.nextId;
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    return this.waitFor((m) => m.id === id);
  }

  initialize(): Promise<Message> {
    return this.request('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: CLIENT_INFO });
  }

  async waitFor(match: (m: Message) => boolean, timeoutMs = 20_000): Promise<Message> {
    const end = Date.now() + timeoutMs;
    for (;;) {
      const found = this.messages.find(match);
      if (found) return found;
      if (Date.now() > end) throw new Error(`message attendu absent ; stderr :\n${this.stderr}`);
      await new Promise((r) => setTimeout(r, 25));
    }
  }

  async close(): Promise<number | null> {
    this.child.stdin.end();
    return this.closed;
  }
}

async function waitUntil(check: () => Promise<boolean>, relay: RelayProcess, timeoutMs = 10_000): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > end)
      throw new Error(`condition jamais remplie ; stderr :
${relay.stderr}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

async function cacheFile(outDir: string): Promise<string> {
  const dir = path.join(outDir, 'mcp-relay');
  const [file] = existsSync(dir) ? (await readdir(dir)).filter((f) => f.endsWith('.json')) : [];
  return file ? path.join(dir, file) : '';
}

async function cachedTools(outDir: string): Promise<number> {
  const file = await cacheFile(outDir);
  if (!file) return -1;
  try {
    return (JSON.parse(await readFile(file, 'utf8')) as { tools: unknown[] | null }).tools?.length ?? -1;
  } catch {
    return -1;
  }
}

/** Journal of the real server (ADR 0024): one session per start. */
async function journal(
  outDir: string,
): Promise<{ session: string; client: string; name: string | null; method: string }[]> {
  const dir = path.join(outDir, 'logs');
  if (!existsSync(dir)) return [];
  const raw = (await Promise.all((await readdir(dir)).map((f) => readFile(path.join(dir, f), 'utf8')))).join('');
  return raw
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { session: string; client: string; name: string | null; method: string });
}

describe('relais à la demande du serveur MCP (ADR 0026)', () => {
  const remote = [process.execPath, SERVER];

  it('le build existe (npm run build:mcp)', () => {
    expect(existsSync(RELAY)).toBe(true);
  });

  it('sans copie : se connecte dès l’initialisation, puis garde la copie, sans aucune donnée', async () => {
    const out = path.join(tmp, 'out-first');
    const relay = new RelayProcess(remote, out);
    const init = await relay.initialize();
    expect(relay.remoteStarted).toBe(true);
    expect((init.result!.serverInfo as { name: string }).name).toBe('cv');
    relay.notify('notifications/initialized');
    const tools = await relay.request('tools/list');
    expect((tools.result!.tools as unknown[]).length).toBe(22);
    await waitUntil(async () => (await cachedTools(out)) === 22, relay);
    expect(await relay.close()).toBe(0);
    for (const m of relay.messages) expect(m.jsonrpc).toBe('2.0');

    const copy = await readFile(await cacheFile(out), 'utf8');
    for (const secret of SECRETS) expect(copy).not.toContain(secret);
    expect(copy).not.toContain('Camille');
    const parsed = JSON.parse(copy) as { initialize: Record<string, unknown>; prompts: unknown[] };
    expect(Object.keys(parsed.initialize)).toEqual(['2025-11-25']);
    expect(parsed.prompts.length).toBeGreaterThan(0);
  });

  it('avec la copie : répond seul et ne lance le serveur qu’au premier outil', async () => {
    const out = path.join(tmp, 'out-first');
    const before = new Set((await journal(out)).map((e) => e.session));
    const relay = new RelayProcess(remote, out);
    // Version probe of a recent client, before `initialize`: unknown method, as the real server answers.
    const probe = await relay.request('server/discover');
    expect(probe.error!.code).toBe(-32601);
    const init = await relay.initialize();
    expect(init.result!.protocolVersion).toBe('2025-11-25');
    expect(init.result!.instructions).toEqual(expect.stringContaining('Aucune invention'));
    relay.notify('notifications/initialized');
    expect(((await relay.request('tools/list')).result!.tools as unknown[]).length).toBe(22);
    expect(((await relay.request('prompts/list')).result!.prompts as unknown[]).length).toBeGreaterThan(0);
    expect((await relay.request('ping')).result).toEqual({});
    expect((await relay.request('resources/list')).error!.code).toBe(-32601);
    expect(relay.remoteStarted).toBe(false);

    const overview = await relay.request('tools/call', { name: 'get_overview', arguments: {} });
    expect(overview.error).toBeUndefined();
    expect(JSON.stringify(overview.result)).toContain('Données');
    expect(relay.remoteStarted).toBe(true);
    expect(await relay.close()).toBe(0);
    for (const m of relay.messages) expect(m.jsonrpc).toBe('2.0');
    expect(JSON.stringify(relay.messages)).not.toContain(SECRETS[0]);

    // One new server session, with the client's name passed on by the relay.
    await waitUntil(async () => (await journal(out)).some((e) => e.name === 'get_overview'), relay);
    const added = (await journal(out)).filter((e) => !before.has(e.session));
    expect(new Set(added.map((e) => e.session)).size).toBe(1);
    expect(added.every((e) => e.client === 'relay-test 1')).toBe(true);
    expect(added.map((e) => e.name ?? e.method)).toContain('get_overview');
  });

  it('copie périmée : prévient le client quand la liste des outils a changé', async () => {
    const out = path.join(tmp, 'out-first');
    const file = await cacheFile(out);
    const copy = JSON.parse(await readFile(file, 'utf8')) as { tools: unknown[] };
    copy.tools = copy.tools.slice(1);
    await writeFile(file, JSON.stringify(copy));

    const relay = new RelayProcess(remote, out);
    await relay.initialize();
    relay.notify('notifications/initialized');
    expect(((await relay.request('tools/list')).result!.tools as unknown[]).length).toBe(21);
    await relay.request('tools/call', { name: 'get_overview', arguments: {} });
    await relay.waitFor((m) => m.method === 'notifications/tools/list_changed');
    expect(((await relay.request('tools/list')).result!.tools as unknown[]).length).toBe(22);
    await waitUntil(async () => (await cachedTools(out)) === 22, relay);
    expect(await relay.close()).toBe(0);
  });

  it('connexion refusée : erreur claire, puis nouvel essai à la requête suivante', async () => {
    // A server whose first start fails, as ssh when the key is not touched in time.
    const out = path.join(tmp, 'out-flaky');
    const marker = path.join(tmp, 'flaky-marker');
    const flaky = path.join(tmp, 'flaky.mjs');
    await writeFile(
      flaky,
      [
        "import { existsSync, writeFileSync } from 'node:fs';",
        'const [marker, entry] = process.argv.slice(2);',
        'if (!existsSync(marker)) {',
        "  writeFileSync(marker, '');",
        "  process.stderr.write('Connection closed by 192.0.2.1 port 22\\n');",
        '  process.exit(255);',
        '}',
        'await import(entry);',
      ].join('\n'),
    );
    const flakyRemote = [process.execPath, flaky, marker, pathToFileURL(SERVER).href];

    // No copy yet: the failure reaches `initialize`.
    let relay = new RelayProcess(flakyRemote, out);
    const refused = await relay.initialize();
    expect(refused.error!.code).toBe(-32000);
    expect(refused.error!.message).toContain('clé de sécurité');
    expect(await relay.close()).toBe(0);

    // The marker is there: the server starts and the copy is kept.
    relay = new RelayProcess(flakyRemote, out);
    expect((await relay.initialize()).result).toBeDefined();
    await waitUntil(async () => (await cachedTools(out)) === 22, relay);
    expect(await relay.close()).toBe(0);

    // With the copy: the first tool fails, the next one reconnects (no restart of the client).
    await rm(marker);
    relay = new RelayProcess(flakyRemote, out);
    await relay.initialize();
    relay.notify('notifications/initialized');
    const first = await relay.request('tools/call', { name: 'get_overview', arguments: {} });
    expect(first.error!.code).toBe(-32000);
    const second = await relay.request('tools/call', { name: 'get_overview', arguments: {} });
    expect(second.error).toBeUndefined();
    expect(JSON.stringify(second.result)).toContain('Données');
    expect(await relay.close()).toBe(0);
  });

  it('refuse de démarrer sans commande du serveur', async () => {
    const relay = new RelayProcess([], path.join(tmp, 'out-none'));
    expect(await relay.close()).toBe(2);
    expect(relay.messages).toHaveLength(0);
    expect(relay.stderr).toContain('usage');
  });
});
