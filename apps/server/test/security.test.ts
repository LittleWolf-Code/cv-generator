// API security (§12.4, NF-01): 403 without X-CV-Token on writes and SSE, on a foreign Host, and on
// a write with a foreign Origin.
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataStore, installFixture } from '@cv/store';
import { createApp } from '../src/app.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const TOKEN = 'a'.repeat(64);
const API = 'http://127.0.0.1:4311';
const UI = 'http://127.0.0.1:4310';
let dir: string;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'cv-api-'));
  await installFixture(path.join(ROOT, 'fixtures', 'personas', 'courte'), dir);
  app = createApp({
    store: DataStore.open(dir),
    token: TOKEN,
    apiPort: 4311,
    uiOrigins: [UI, 'http://localhost:4310'],
  });
});
afterAll(() => rm(dir, { recursive: true, force: true }));

const json = { 'content-type': 'application/json' };
const body = JSON.stringify({ presetId: 'preset-defaut' });

describe('API locale : sécurité NF-01', () => {
  it('health répond sans jeton sur un Host autorisé', async () => {
    const res = await app.request(`${API}/api/health`, { headers: { host: '127.0.0.1:4311' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('403 pour un %s sans X-CV-Token', async (method) => {
    const res = await app.request(`${API}/api/render`, { method, headers: { ...json, origin: UI }, body });
    expect(res.status).toBe(403);
  });

  it('403 pour le flux SSE sans jeton', async () => {
    expect((await app.request(`${API}/api/events`)).status).toBe(403);
  });

  it('403 pour une lecture sans jeton', async () => {
    expect((await app.request(`${API}/api/library`)).status).toBe(403);
  });

  it('403 pour toute requête avec Host: evil.example (DNS rebinding)', async () => {
    const viaHeader = await app.request(`${API}/api/health`, { headers: { host: 'evil.example' } });
    expect(viaHeader.status).toBe(403);
    const viaUrl = await app.request('http://evil.example/api/health');
    expect(viaUrl.status).toBe(403);
    const withToken = await app.request('http://evil.example:4311/api/library', { headers: { 'x-cv-token': TOKEN } });
    expect(withToken.status).toBe(403);
  });

  it('403 pour une écriture avec un Origin étranger, même avec le jeton', async () => {
    const res = await app.request(`${API}/api/render`, {
      method: 'POST',
      headers: { ...json, origin: 'https://evil.example', 'x-cv-token': TOKEN },
      body,
    });
    expect(res.status).toBe(403);
    const noOrigin = await app.request(`${API}/api/render`, {
      method: 'POST',
      headers: { ...json, 'x-cv-token': TOKEN },
      body,
    });
    expect(noOrigin.status).toBe(403);
  });

  it('refuse un corps non JSON (415)', async () => {
    const res = await app.request(`${API}/api/render`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain', origin: UI, 'x-cv-token': TOKEN },
      body,
    });
    expect(res.status).toBe(415);
  });

  it('403 pour un jeton faux', async () => {
    const res = await app.request(`${API}/api/library`, { headers: { 'x-cv-token': 'b'.repeat(64) } });
    expect(res.status).toBe(403);
  });

  it('avec jeton, Host et Origin valides : arbre et rendu PDF avec rapport ATS', async () => {
    const lib = await app.request(`${API}/api/library`, { headers: { 'x-cv-token': TOKEN } });
    expect(lib.status).toBe(200);
    const l = (await lib.json()) as { groups: Array<{ key: string; items: unknown[] }> };
    expect(l.groups.map((s) => s.key)).toContain('experience');

    const res = await app.request(`${API}/api/render`, {
      method: 'POST',
      headers: { ...json, origin: UI, 'x-cv-token': TOKEN },
      body,
    });
    expect(res.status).toBe(200);
    const r = (await res.json()) as { pdfBase64: string; pages: number; report: { blocking: boolean } };
    expect(r.pages).toBe(1);
    expect(r.report.blocking).toBe(false);
    expect(Buffer.from(r.pdfBase64, 'base64').subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('404 pour un preset inconnu', async () => {
    const res = await app.request(`${API}/api/render`, {
      method: 'POST',
      headers: { ...json, origin: UI, 'x-cv-token': TOKEN },
      body: JSON.stringify({ presetId: 'inconnu' }),
    });
    expect(res.status).toBe(404);
  });
});
