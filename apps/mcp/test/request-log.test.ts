// Journal of the MCP requests (ADR 0024): one line per request in out/logs/mcp-AAAA-MM.jsonl, with the
// address of the SSH client, the session, the client, the tool and its arguments summarized, the outcome
// and the contact check of the response; never the contact details themselves. On a temporary copy of
// the fictitious fixture « courte ».
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import type { JSONRPCMessage, Transport } from '@modelcontextprotocol/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mcpLogEntry, type McpLogEntry } from '@cv/core';
import { DataStore, installFixture } from '@cv/store';
import { LoggedTransport, peerFromEnv, RequestJournal, summarizeArgs } from '../src/request-log.js';
import { createCvServer } from '../src/server.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SECRETS = ['camille.martin@example.com', '06 39 98 12 34', '0639981234'];
const IDENTITY = { email: 'camille.martin@example.com', phone: '06 39 98 12 34' };

let tmp: string;

beforeAll(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'cv-journal-'));
});
afterAll(() => rm(tmp, { recursive: true, force: true }));

async function readJournal(dir: string): Promise<{ raw: string; entries: McpLogEntry[] }> {
  const files = await readdir(dir);
  expect(files.every((f) => /^mcp-\d{4}-\d{2}\.jsonl$/.test(f))).toBe(true);
  const raw = (await Promise.all(files.map((f) => readFile(path.join(dir, f), 'utf8')))).join('');
  const entries = raw
    .split('\n')
    .filter(Boolean)
    .map((l) => mcpLogEntry.parse(JSON.parse(l)));
  return { raw, entries };
}

/** A transport whose messages the test sends and receives by hand. */
class FakeTransport implements Transport {
  onclose?: (() => void) | undefined;
  onerror?: ((error: Error) => void) | undefined;
  onmessage?: ((message: JSONRPCMessage) => void) | undefined;
  readonly sent: JSONRPCMessage[] = [];
  async start(): Promise<void> {}
  async send(message: JSONRPCMessage): Promise<void> {
    this.sent.push(message);
  }
  async close(): Promise<void> {
    this.onclose?.();
  }
}

describe('adresse du client', () => {
  it('lit CV_SSH_CONNECTION, transmis à travers sudo', () => {
    expect(peerFromEnv({ CV_SSH_CONNECTION: '203.0.113.7 51234 198.51.100.2 22' })).toEqual({
      via: 'ssh',
      ip: '203.0.113.7',
    });
    expect(peerFromEnv({ SSH_CONNECTION: '2001:db8::7 51234 2001:db8::1 22' })).toEqual({
      via: 'ssh',
      ip: '2001:db8::7',
    });
  });

  it("distingue le poste local d'une connexion SSH sans adresse", () => {
    expect(peerFromEnv({})).toEqual({ via: 'local', ip: null });
    expect(peerFromEnv({ CV_PUBLIC_ORIGIN: 'https://cv.example.org' })).toEqual({ via: 'ssh', ip: null });
    expect(peerFromEnv({ CV_SSH_CONNECTION: '<script> 1 2 3' })).toEqual({ via: 'ssh', ip: null });
  });
});

describe('résumé des arguments', () => {
  it('garde les valeurs courtes, remplace les textes longs et les structures profondes par leur taille', () => {
    expect(
      summarizeArgs({
        target: { applicationId: '2026-10-08-acme-ingenieur' },
        ids: ['exp-1', 'exp-2'],
        offerText: 'x'.repeat(500),
        item: { bullets: [{ text: 'a' }], nested: { deep: true } },
      }),
    ).toEqual({
      target: { applicationId: '2026-10-08-acme-ingenieur' },
      ids: ['exp-1', 'exp-2'],
      offerText: '‹texte de 500 caractères›',
      item: { bullets: '‹liste de 1›', nested: '‹objet›' },
    });
    expect(summarizeArgs(Array.from({ length: 12 }, (_, i) => i))).toHaveLength(11);
  });
});

describe('journal des requêtes du serveur « cv »', () => {
  it('journalise chaque requête avec la date, l’adresse, la session, le client et le résultat', async () => {
    const dataDir = path.join(tmp, 'courte', 'data');
    const outDir = path.join(tmp, 'courte', 'out');
    const logDir = path.join(outDir, 'logs');
    await installFixture(path.join(ROOT, 'fixtures', 'personas', 'courte'), dataDir);
    const store = DataStore.open(dataDir);
    const journal = new RequestJournal({
      dir: logDir,
      peer: peerFromEnv({ CV_SSH_CONNECTION: '203.0.113.7 51234 198.51.100.2 22' }),
      identity: async () => (await store.loadProfile()).identity,
      session: 'sess0001',
    });
    const server = createCvServer({ dataDir, outDir });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await server.connect(new LoggedTransport(serverSide, journal));
    const client = new Client({ name: 'cv-test', version: '0.0.0' });
    await client.connect(clientSide);

    await client.listTools();
    await client.callTool({ name: 'get_overview', arguments: {} });
    await client.callTool({ name: 'get_library', arguments: { view: 'full', collections: ['experiences'] } });
    const refused = await client.callTool({ name: 'get_preset', arguments: { presetId: 'preset-introuvable' } });
    expect(refused.isError).toBe(true);
    await client.close();
    await journal.flush();

    const { raw, entries } = await readJournal(logDir);
    for (const secret of SECRETS) expect(raw).not.toContain(secret);
    expect(entries.every((e) => e.session === 'sess0001' && e.ip === '203.0.113.7' && e.via === 'ssh')).toBe(true);
    expect(entries.every((e) => !Number.isNaN(Date.parse(e.at)))).toBe(true);
    expect(entries.some((e) => e.method === 'tools/list' && e.outcome === 'ok')).toBe(true);

    expect(entries.map((e) => e.seq).sort((a, b) => a - b)).toEqual(entries.map((_, i) => i + 1));
    const calls = entries.filter((e) => e.method === 'tools/call');
    expect(calls.map((e) => e.name)).toEqual(['get_overview', 'get_library', 'get_preset']);
    expect(calls.every((e) => e.client === 'cv-test 0.0.0')).toBe(true);
    expect(calls[1]!.args).toEqual({ view: 'full', collections: ['experiences'] });
    expect(calls[1]!.bytes).toBeGreaterThan(1000);
    // The library holds the identity nowhere, and the masking of §7.5 applies to every response.
    expect(entries.every((e) => e.leaks.length === 0)).toBe(true);
    expect(calls[2]).toMatchObject({
      outcome: 'tool-error',
      code: 'NOT_FOUND',
      args: { presetId: 'preset-introuvable' },
    });
  });

  it('signale une réponse qui contiendrait une coordonnée, sans la recopier', async () => {
    const logDir = path.join(tmp, 'fuite', 'logs');
    const inner = new FakeTransport();
    const journal = new RequestJournal({
      dir: logDir,
      peer: { via: 'local', ip: null },
      identity: async () => IDENTITY,
      session: 'sess0002',
    });
    const transport = new LoggedTransport(inner, journal);
    const received: JSONRPCMessage[] = [];
    transport.onmessage = (m) => received.push(m);
    await transport.start();

    inner.onmessage?.({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'get_overview', arguments: { note: 'joindre camille.martin@example.com' } },
    });
    inner.onmessage?.({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'render', arguments: {} } });
    inner.onmessage?.({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'check_ats', arguments: {} } });
    expect(received).toHaveLength(3);

    await transport.send({
      jsonrpc: '2.0',
      id: 1,
      result: { content: [{ type: 'text', text: 'Camille.Martin@example.com, +33 6 39 98 12 34' }] },
    });
    // The base64 data of a preview image is not text: left out of the check.
    await transport.send({
      jsonrpc: '2.0',
      id: 2,
      result: {
        content: [{ type: 'image', mimeType: 'image/png', data: 'iVBOR0639981234camille.martin@example.com' }],
      },
    });
    expect(inner.sent).toHaveLength(2);
    await transport.close();
    await journal.flush();

    const { raw, entries } = await readJournal(logDir);
    for (const secret of SECRETS) expect(raw).not.toContain(secret);
    const byName = Object.fromEntries(entries.map((e) => [e.name, e]));
    expect(byName.get_overview).toMatchObject({ leaks: ['email', 'phone'], outcome: 'ok', ip: null, via: 'local' });
    expect(byName.get_overview!.args).toEqual({ note: 'joindre {{email}}' });
    expect(byName.render).toMatchObject({ leaks: [], outcome: 'ok' });
    expect(byName.check_ats).toMatchObject({ outcome: 'no-response', bytes: 0 });
  });
});
