// Journal of the MCP requests (ADR 0024). The transport is wrapped: every JSON-RPC request received
// becomes one line of out/logs/mcp-AAAA-MM.jsonl once answered, with the date and time, the address of
// the SSH client, the session (one per connection), the client, the tool and a summary of its
// arguments, the outcome, and the check that the response holds neither the e-mail nor the phone
// number of the identity (§7.5). Nothing changes on the wire, and a failure of the journal never stops
// the server: it is reported on stderr only.
import { randomBytes } from 'node:crypto';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import {
  CLIENT_INFO_META_KEY,
  isJSONRPCErrorResponse,
  isJSONRPCRequest,
  isJSONRPCResultResponse,
  type JSONRPCMessage,
  type MessageExtraInfo,
  type Transport,
  type TransportSendOptions,
} from '@modelcontextprotocol/server';
import { findContactLeaks, maskContacts, mcpLogFileName, type Identity, type McpLogEntry } from '@cv/core';
import { log } from './log.js';

export interface Peer {
  ip: string | null;
  via: McpLogEntry['via'];
}

const IP_RE = /^(?=.*[.:])[0-9a-f.:]{2,45}$/i;

/**
 * Who runs this server. `sudo` clears SSH_CONNECTION: the SSH command passes it on as
 * CV_SSH_CONNECTION (`sudo -n -u cv env CV_SSH_CONNECTION="$SSH_CONNECTION" sh …/mcp.sh`, ADR 0024).
 */
export function peerFromEnv(env: NodeJS.ProcessEnv): Peer {
  const raw = env.CV_SSH_CONNECTION || env.SSH_CONNECTION;
  if (raw) {
    const ip = raw.trim().split(/\s+/)[0] ?? '';
    return { via: 'ssh', ip: IP_RE.test(ip) ? ip : null };
  }
  // On the server of the online instance, Claude always comes over SSH: the address is then unknown.
  return { via: env.CV_PUBLIC_ORIGIN ? 'ssh' : 'local', ip: null };
}

const MAX_STRING = 80;
const MAX_ARGS = 2000;

/** Arguments as kept in the journal: short values as is, long texts and deep structures by their size. */
export function summarizeArgs(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.length <= MAX_STRING ? value : `‹texte de ${value.length} caractères›`;
  }
  if (Array.isArray(value)) {
    if (depth >= 2) return `‹liste de ${value.length}›`;
    const head = value.slice(0, 10).map((v) => summarizeArgs(v, depth + 1));
    return value.length > 10 ? [...head, `‹+${value.length - 10}›`] : head;
  }
  if (typeof value === 'object') {
    if (depth >= 2) return '‹objet›';
    const entries = Object.entries(value as Record<string, unknown>);
    const out = Object.fromEntries(entries.slice(0, 20).map(([k, v]) => [k.slice(0, 40), summarizeArgs(v, depth + 1)]));
    if (depth > 0) return out;
    const size = JSON.stringify(out).length;
    return size <= MAX_ARGS ? out : `‹arguments de ${size} caractères›`;
  }
  return null;
}

/** The response as scanned for contact details: the base64 data of the images (CV previews) left out. */
function scannedText(message: JSONRPCMessage): string {
  return JSON.stringify(message, function (this: unknown, key, value: unknown) {
    if (key === 'data' && (this as { type?: unknown }).type === 'image') return undefined;
    return value;
  });
}

function clientName(info: unknown): string | null {
  if (!info || typeof info !== 'object') return null;
  const { name, version } = info as { name?: unknown; version?: unknown };
  if (typeof name !== 'string') return null;
  return `${name}${typeof version === 'string' ? ` ${version}` : ''}`.slice(0, 80);
}

interface Pending {
  at: Date;
  seq: number;
  start: number;
  method: string;
  name: string | null;
  args: unknown;
}

export interface RequestJournalOptions {
  /** out/logs (CV_OUT_DIR on the server). */
  dir: string;
  peer: Peer;
  /** E-mail and phone of the identity, for the check of each response and the masking of the arguments. */
  identity(): Promise<Pick<Identity, 'email' | 'phone'> | null>;
  /** For the tests. */
  session?: string;
  now?: () => Date;
}

export class RequestJournal {
  readonly session: string;
  private client: string | null = null;
  private seq = 0;
  private readonly pending = new Map<string, Pending>();
  private queue: Promise<void> = Promise.resolve();
  private readonly now: () => Date;

  constructor(private readonly opts: RequestJournalOptions) {
    this.session = opts.session ?? randomBytes(4).toString('hex');
    this.now = opts.now ?? (() => new Date());
  }

  received(message: JSONRPCMessage): void {
    try {
      if (!isJSONRPCRequest(message)) return;
      const params = (message.params ?? {}) as Record<string, unknown>;
      if (message.method === 'initialize') this.client = clientName(params.clientInfo) ?? this.client;
      const meta = params._meta as Record<string, unknown> | undefined;
      if (!this.client && meta) this.client = clientName(meta[CLIENT_INFO_META_KEY]);
      const named = message.method === 'tools/call' || message.method === 'prompts/get';
      this.pending.set(String(message.id), {
        at: this.now(),
        seq: ++this.seq,
        start: performance.now(),
        method: message.method.slice(0, 80),
        name: named && typeof params.name === 'string' ? params.name.slice(0, 80) : null,
        args: named ? summarizeArgs(params.arguments ?? null) : null,
      });
    } catch (err) {
      log(`journal MCP : requête non journalisée (${(err as Error).message})`);
    }
  }

  sent(message: JSONRPCMessage): void {
    try {
      const error = isJSONRPCErrorResponse(message);
      if (!error && !isJSONRPCResultResponse(message)) return;
      const key = String(message.id);
      const request = this.pending.get(key);
      if (!request) return;
      this.pending.delete(key);
      let outcome: McpLogEntry['outcome'] = 'ok';
      let code: string | null = null;
      if (error) {
        outcome = 'error';
        code = String(message.error.code);
      } else if ((message.result as { isError?: unknown }).isError === true) {
        outcome = 'tool-error';
        const body = (message.result as { structuredContent?: { code?: unknown } }).structuredContent;
        code = typeof body?.code === 'string' ? body.code.slice(0, 80) : null;
      }
      const bytes = Buffer.byteLength(JSON.stringify(message));
      const text = scannedText(message);
      this.write(request, { outcome, code, bytes, ms: performance.now() - request.start }, text);
    } catch (err) {
      log(`journal MCP : réponse non journalisée (${(err as Error).message})`);
    }
  }

  /** Connection closed: the requests still waiting are kept, without response. */
  closed(): void {
    for (const request of this.pending.values()) {
      this.write(request, { outcome: 'no-response', code: null, bytes: 0, ms: performance.now() - request.start }, '');
    }
    this.pending.clear();
  }

  /** Resolves once every line queued so far is written. */
  flush(): Promise<void> {
    return this.queue;
  }

  private write(
    request: Pending,
    result: Pick<McpLogEntry, 'outcome' | 'code' | 'bytes' | 'ms'>,
    responseText: string,
  ): void {
    const client = this.client;
    this.queue = this.queue
      .then(async () => {
        const identity = await this.opts.identity().catch(() => null);
        const ids = { email: identity?.email ?? null, phone: identity?.phone ?? null };
        const entry: McpLogEntry = {
          v: 1,
          at: request.at.toISOString(),
          session: this.session,
          seq: request.seq,
          ip: this.opts.peer.ip,
          via: this.opts.peer.via,
          client,
          method: request.method,
          name: request.name,
          args: request.args === null ? null : (JSON.parse(maskContacts(JSON.stringify(request.args), ids)) as unknown),
          outcome: result.outcome,
          code: result.code,
          ms: Math.round(result.ms),
          bytes: result.bytes,
          leaks: responseText ? findContactLeaks(responseText, ids) : [],
        };
        if (entry.leaks.length > 0) log(`journal MCP : coordonnée dans la réponse à ${request.name ?? request.method}`);
        await mkdir(this.opts.dir, { recursive: true });
        await appendFile(path.join(this.opts.dir, mcpLogFileName(request.at)), `${JSON.stringify(entry)}\n`, {
          encoding: 'utf8',
          mode: 0o600,
        });
      })
      .catch((err: unknown) => log(`journal MCP : écriture impossible (${(err as Error).message})`));
  }
}

/** The transport of the server, journaled: the same messages, in both directions. */
export class LoggedTransport implements Transport {
  onclose?: (() => void) | undefined;
  onerror?: ((error: Error) => void) | undefined;
  onmessage?: (<T extends JSONRPCMessage>(message: T, extra?: MessageExtraInfo) => void) | undefined;

  constructor(
    private readonly inner: Transport,
    readonly journal: RequestJournal,
  ) {
    inner.onmessage = (message, extra) => {
      journal.received(message);
      this.onmessage?.(message, extra);
    };
    inner.onclose = () => {
      journal.closed();
      this.onclose?.();
    };
    inner.onerror = (error) => this.onerror?.(error);
  }

  get sessionId(): string | undefined {
    return this.inner.sessionId;
  }

  start(): Promise<void> {
    return this.inner.start();
  }

  async send(message: JSONRPCMessage, options?: TransportSendOptions): Promise<void> {
    await this.inner.send(message, options);
    this.journal.sent(message);
  }

  close(): Promise<void> {
    return this.inner.close();
  }

  setProtocolVersion(version: string): void {
    this.inner.setProtocolVersion?.(version);
  }

  setSupportedProtocolVersions(versions: string[]): void {
    this.inner.setSupportedProtocolVersions?.(versions);
  }
}
