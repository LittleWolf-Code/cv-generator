// `npm start` (ADR 0018): the API serves the built interface with the token injected, its assets, and the
// single-page fallback; the API routes keep their JSON answers.
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataStore, installFixture } from '@cv/store';
import { createApp } from '../src/app.js';
import { serveWeb } from '../src/web.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const TOKEN = 'c'.repeat(64);
const BASE = 'http://127.0.0.1:4310';
let dir: string;
let dist: string;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'cv-web-'));
  dist = path.join(dir, 'dist');
  await mkdir(path.join(dist, 'assets'), { recursive: true });
  await writeFile(
    path.join(dist, 'index.html'),
    '<!doctype html><html><head><title>CV</title></head><body></body></html>',
  );
  await writeFile(path.join(dist, 'assets', 'index-abc123.js'), 'console.info("cv");');
  await writeFile(path.join(dir, 'secret.txt'), 'secret');
  await installFixture(path.join(ROOT, 'fixtures', 'personas', 'courte'), path.join(dir, 'data'));
  app = createApp({
    store: DataStore.open(path.join(dir, 'data')),
    token: TOKEN,
    apiPort: 4310,
    uiOrigins: [BASE],
  });
  await serveWeb(app, { distDir: dist, token: TOKEN });
});
afterAll(() => rm(dir, { recursive: true, force: true }));

describe('npm start : interface compilée servie par l’API', () => {
  it('injecte le jeton dans la page, pour chaque route de l’interface', async () => {
    for (const p of ['/', '/candidatures', '/a-valider?ids=x', '/candidatures/2026-10-07-acme-dev/lettre']) {
      const res = await app.request(`${BASE}${p}`);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain(`<meta name="cv-token" content="${TOKEN}" />`);
      expect(html).not.toContain('cv-online');
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
  });

  it('sert les fichiers de assets/ avec leur type, et rien en dehors', async () => {
    const js = await app.request(`${BASE}/assets/index-abc123.js`);
    expect(js.status).toBe(200);
    expect(js.headers.get('content-type')).toMatch(/^text\/javascript/);
    expect((await app.request(`${BASE}/assets/absent.js`)).status).toBe(404);
    expect((await app.request(`${BASE}/assets/%2e%2e%2f%2e%2e%2fsecret.txt`)).status).toBe(404);
    expect((await app.request(`${BASE}/assets/index.html`)).status).toBe(404);
  });

  it('les routes /api inconnues restent des 404, jamais la page', async () => {
    const res = await app.request(`${BASE}/api/inconnue`, { headers: { 'x-cv-token': TOKEN } });
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain('<html');
  });

  it('refuse un jeton qui ne serait pas hexadécimal, et signale l’instance en ligne', async () => {
    await expect(
      serveWeb(
        createApp({ store: DataStore.open(path.join(dir, 'data')), token: TOKEN, apiPort: 4310, uiOrigins: [] }),
        { distDir: dist, token: '"><script>' },
      ),
    ).rejects.toThrow(/jeton/);
    const online = createApp({
      store: DataStore.open(path.join(dir, 'data')),
      token: TOKEN,
      apiPort: 4310,
      uiOrigins: [],
    });
    await serveWeb(online, { distDir: dist, token: TOKEN, online: true });
    expect(await (await online.request(`${BASE}/`)).text()).toContain('<meta name="cv-online" content="1" />');
  });
});
