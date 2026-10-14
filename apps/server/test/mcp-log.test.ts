// Journal of the MCP requests (ADR 0024): GET /api/mcp-log reads out/logs/mcp-AAAA-MM.jsonl, one month at
// a time, the most recent requests first; invalid lines counted; NF-01 on the route.
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { McpLogEntry } from '@cv/core';
import { DataStore, installFixture } from '@cv/store';
import { createApp } from '../src/app.js';
import type { McpLogView } from '../src/mcp-log.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const TOKEN = 'j'.repeat(64);
const API = 'http://127.0.0.1:4311';
const UI = 'http://127.0.0.1:4310';

let dir: string;
let out: string;
let store: DataStore;

const entry = (at: string, name: string, extra: Partial<McpLogEntry> = {}): McpLogEntry => ({
  v: 1,
  at,
  session: 'sess0001',
  seq: 1,
  ip: '203.0.113.7',
  via: 'ssh',
  client: 'claude-code 2.1.0',
  method: 'tools/call',
  name,
  args: {},
  outcome: 'ok',
  code: null,
  ms: 5,
  bytes: 120,
  leaks: [],
  ...extra,
});

const lines = (...items: Array<McpLogEntry | string>) =>
  items.map((i) => (typeof i === 'string' ? i : JSON.stringify(i))).join('\n') + '\n';

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'cv-mcplog-'));
  out = `${dir}-out`;
  await installFixture(path.join(ROOT, 'fixtures', 'personas', 'courte'), dir);
  store = DataStore.open(dir);
  await mkdir(path.join(out, 'logs'), { recursive: true });
  await writeFile(
    path.join(out, 'logs', 'mcp-2026-10.jsonl'),
    lines(
      entry('2026-10-08T09:00:00.000Z', 'get_overview', { seq: 2 }),
      // Written when the response leaves: a slower request can come after a later one.
      entry('2026-10-08T09:00:02.000Z', 'get_library', { seq: 4, ms: 40 }),
      // Same millisecond: the order in the session decides.
      entry('2026-10-08T09:00:00.000Z', 'tools/list', { seq: 1, method: 'tools/list', name: null }),
      entry('2026-10-08T09:00:01.000Z', 'render', { session: 'sess0002', ip: '198.51.100.9' }),
      'pas du JSON',
      JSON.stringify({ v: 1, at: 'x' }),
    ),
  );
  await writeFile(path.join(out, 'logs', 'mcp-2026-09.jsonl'), lines(entry('2026-09-30T22:00:00.000Z', 'list')));
  await writeFile(path.join(out, 'logs', 'notes.txt'), 'ignoré\n');
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
  await rm(out, { recursive: true, force: true });
});

const get = (target: ReturnType<typeof createApp>, query = '', headers: Record<string, string> = {}) =>
  target.request(`${API}/api/mcp-log${query}`, { headers: { 'x-cv-token': TOKEN, ...headers } });

describe('GET /api/mcp-log', () => {
  it('renvoie le mois le plus récent, les requêtes les plus récentes en tête', async () => {
    const app = createApp({ store, token: TOKEN, apiPort: 4311, uiOrigins: [UI], outDir: out });
    const res = await get(app);
    expect(res.status).toBe(200);
    const body = (await res.json()) as McpLogView;
    expect(body).toMatchObject({ available: true, months: ['2026-10', '2026-09'], month: '2026-10' });
    expect(body.entries.map((e) => e.name ?? e.method)).toEqual([
      'get_library',
      'render',
      'get_overview',
      'tools/list',
    ]);
    expect(body.entries[1]).toMatchObject({ session: 'sess0002', ip: '198.51.100.9' });
    expect(body.invalidLines).toBe(2);
    expect(body.truncated).toBe(false);
  });

  it('lit un autre mois, refuse un mois mal formé', async () => {
    const app = createApp({ store, token: TOKEN, apiPort: 4311, uiOrigins: [UI], outDir: out });
    const september = (await (await get(app, '?month=2026-09')).json()) as McpLogView;
    expect(september.entries.map((e) => e.name)).toEqual(['list']);
    const absent = (await (await get(app, '?month=2026-01')).json()) as McpLogView;
    expect(absent).toMatchObject({ month: '2026-01', entries: [] });
    expect((await get(app, '?month=../../data')).status).toBe(400);
  });

  it('indisponible sans out/', async () => {
    const app = createApp({ store, token: TOKEN, apiPort: 4311, uiOrigins: [UI] });
    expect(await (await get(app)).json()).toMatchObject({ available: false, months: [], entries: [] });
  });

  it('exige le jeton (NF-01)', async () => {
    const app = createApp({ store, token: TOKEN, apiPort: 4311, uiOrigins: [UI], outDir: out });
    expect((await app.request(`${API}/api/mcp-log`)).status).toBe(403);
    expect((await get(app, '', { 'x-cv-token': 'k'.repeat(64) })).status).toBe(403);
  });
});
