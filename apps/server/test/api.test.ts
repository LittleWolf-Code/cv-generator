// API of lot 1 (§12.4): library editing with field-designating refusals and 409, proposals queue with
// stale conflict, live SSE event when a proposal file is dropped by hand, backup ZIP, NF-01 on the new
// routes.
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataStore, installFixture, watchDataDir, type DataWatcher } from '@cv/store';
import { createApp } from '../src/app.js';
import { DataEvents } from '../src/events.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const TOKEN = 'c'.repeat(64);
const API = 'http://127.0.0.1:4311';
const UI = 'http://127.0.0.1:4310';
const P = {
  variant: '01JC0FX0000000000000VAR001',
  stale: '01JC0FX0000000000000STA001',
  edit: '01JC0FX0000000000000EDT001',
  alias: '01JC0FX0000000000000SYN001',
};
let dir: string;
let app: ReturnType<typeof createApp>;
let watcher: DataWatcher;

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'cv-api1-'));
  await installFixture(path.join(ROOT, 'fixtures', 'personas', 'courte'), dir);
  for (const id of [P.variant, P.stale, P.edit]) {
    await copyFile(path.join(ROOT, 'fixtures', 'proposals', `${id}.json`), path.join(dir, 'proposals', `${id}.json`));
  }
  const events = new DataEvents();
  watcher = watchDataDir(dir, (c) => events.publish(c), { debounceMs: 50 });
  await watcher.ready;
  app = createApp({ store: DataStore.open(dir), events, token: TOKEN, apiPort: 4311, uiOrigins: [UI] });
});
afterAll(async () => {
  await watcher.close();
  await rm(dir, { recursive: true, force: true });
});

const get = (url: string) => app.request(`${API}${url}`, { headers: { 'x-cv-token': TOKEN } });
const send = (method: string, url: string, body: unknown = {}) =>
  app.request(`${API}${url}`, {
    method,
    headers: { 'content-type': 'application/json', origin: UI, 'x-cv-token': TOKEN },
    body: JSON.stringify(body),
  });

interface LibraryBody {
  library: { experiences: Array<Record<string, unknown>>; interests: Array<Record<string, unknown>> };
  revisions: Record<string, number>;
  groups: Array<{ key: string; items: Array<{ id: string; untranslated: string[] }> }>;
  identity: { revision: number; value: { firstName: string } | null };
}

describe("bibliothèque par l'API (F-LIB-05)", () => {
  it('crée puis modifie un élément ; refuse un emoji en désignant le champ', async () => {
    const created = await send('POST', '/api/library/interests', {
      item: { text: { fr: 'Escalade en bloc', en: null }, detail: null },
    });
    expect(created.status).toBe(201);
    const c = (await created.json()) as { item: { id: string }; writes: Array<{ file: string; revision: number }> };
    expect(c.item.id).toBe('int-escalade-en-bloc');
    expect(c.writes.map((w) => w.file)).toContain('library/interests.json');

    const lib = (await (await get('/api/library')).json()) as LibraryBody;
    const node = lib.groups.find((g) => g.key === 'interests')!.items.find((i) => i.id === c.item.id)!;
    expect(node.untranslated).toEqual(['en']);
    const base = lib.library.interests.find((i) => i.id === c.item.id)!;

    const updated = await send('PUT', `/api/library/interests/${c.item.id}`, {
      item: { ...base, text: { fr: 'Escalade en bloc', en: 'Bouldering' } },
      expectedRevision: lib.revisions.interests,
      base,
    });
    expect(updated.status).toBe(200);

    const stale = await send('PUT', `/api/library/interests/${c.item.id}`, {
      item: { ...base, detail: { fr: 'compétition', en: null } },
      expectedRevision: lib.revisions.interests,
      base,
    });
    expect(stale.status).toBe(409);
    expect(((await stale.json()) as { code: string }).code).toBe('STALE_REVISION');

    const refused = await send('POST', '/api/library/interests', {
      item: { text: { fr: `Voile ${String.fromCodePoint(0x26f5)}`, en: null } },
    });
    expect(refused.status).toBe(422);
    const r = (await refused.json()) as { details: { issues: Array<{ path: string; message: string }> } };
    expect(r.details.issues).toEqual([
      { path: 'text.fr', message: expect.stringMatching(/emoji interdit \(U\+26F5\)/) },
    ]);
  });

  it('valide à blanc avec les avertissements ATS-22', async () => {
    const res = await send('POST', '/api/library/experiences/check', {
      item: { position: { fr: 'Resp. qualité', en: null }, organization: 'CHU', start: '2020-01', end: null },
    });
    const body = (await res.json()) as { issues: unknown[]; warnings: Array<{ path: string }> };
    expect(body.issues).toEqual([]);
    expect(body.warnings.map((w) => w.path)).toEqual(['position.fr', 'organization']);
  });

  it('archive, puis supprime définitivement ; refuse la suppression sans archivage', async () => {
    expect((await send('DELETE', '/api/library/interests/int-course', { confirm: true })).status).toBe(409);
    expect((await send('POST', '/api/library/interests/int-course/archive', { archived: true })).status).toBe(200);
    expect((await send('DELETE', '/api/library/interests/int-course', {})).status).toBe(400);
    expect((await send('DELETE', '/api/library/interests/int-course', { confirm: true })).status).toBe(200);
    expect((await send('POST', '/api/library/inconnue', { item: {} })).status).toBe(404);
  });

  it('duplique un élément', async () => {
    const res = await send('POST', '/api/library/experiences/exp-labo-2019/duplicate');
    expect(res.status).toBe(201);
  });
});

describe('file « À valider » (F-PRO-01 à 06)', () => {
  interface View {
    id: string;
    status: string;
    sensitive: boolean;
    diff: Array<{ segments: Array<{ op: string }> }>;
    conflict: { base: unknown[] | null; current: unknown[] | null; proposed: unknown[] } | null;
  }
  const list = async (q = '') =>
    (await (await get(`/api/proposals${q}`)).json()) as {
      proposals: View[];
      counts: { pending: number; stale: number };
      invalid: unknown[];
    };

  it('liste les propositions, avec diff, fait sensible et conflit en trois colonnes', async () => {
    const r = await list();
    expect(r.counts).toMatchObject({ pending: 3, stale: 1 });
    const byId = Object.fromEntries(r.proposals.map((p) => [p.id, p]));
    expect(byId[P.variant]!.status).toBe('pending');
    expect(byId[P.variant]!.diff[0]!.segments.some((s) => s.op === 'ins')).toBe(true);
    expect(byId[P.edit]!.sensitive).toBe(true);
    expect(byId[P.stale]!.status).toBe('stale');
    expect(byId[P.stale]!.conflict?.base?.length).toBeGreaterThan(0);
    expect(byId[P.stale]!.conflict?.current?.length).toBeGreaterThan(0);
    expect(byId[P.stale]!.conflict?.proposed.length).toBeGreaterThan(0);
  });

  it('filtre par ?ids= et accepte une variante, puis rejette une autre proposition', async () => {
    const filtered = await list(`?ids=${P.variant}`);
    expect(filtered.proposals.map((p) => p.id)).toEqual([P.variant]);
    const ok = await send('POST', `/api/proposals/${P.variant}/accept`);
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { proposal: { status: string } }).proposal.status).toBe('accepted');
    expect((await send('POST', `/api/proposals/${P.variant}/accept`)).status).toBe(409);
    const rejected = await send('POST', `/api/proposals/${P.edit}/reject`, { reason: 'raison sociale déjà correcte' });
    expect(rejected.status).toBe(200);
    expect((await list()).counts.pending).toBe(1);
    expect((await list('?all=1')).proposals).toHaveLength(3);
  });
});

describe('flux SSE en direct (§8.4, F-PRO-05)', () => {
  it('signale une proposition déposée à la main dans proposals/', async () => {
    const res = await get('/api/events');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);
    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
    let text = '';
    const until = async (needle: string) => {
      const deadline = Date.now() + 8000;
      while (!text.includes(needle)) {
        if (Date.now() > deadline) throw new Error(`attendu dans le flux : ${needle}`);
        const { value, done } = await reader.read();
        if (done) break;
        text += value;
      }
    };
    await until('event: ready');
    await copyFile(
      path.join(ROOT, 'fixtures', 'proposals', `${P.alias}.json`),
      path.join(dir, 'proposals', `${P.alias}.json`),
    );
    await until(`proposals/${P.alias}.json`);
    expect(text).toMatch(
      new RegExp(`event: change\\ndata: \\{"file":"proposals/${P.alias}.json","revision":1,"deleted":false\\}`),
    );
    await reader.cancel();
  });
});

describe('sauvegarde et sécurité', () => {
  it('exporte data/ en ZIP', async () => {
    const res = await get('/api/backup.zip');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');
    expect(res.headers.get('content-disposition')).toMatch(/attachment; filename="cv-data-\d{8}-\d{6}\.zip"/);
    expect(
      Buffer.from(await res.arrayBuffer())
        .subarray(0, 2)
        .toString(),
    ).toBe('PK');
  });

  it('403 sur les nouvelles routes sans jeton ou avec une origine étrangère', async () => {
    expect((await app.request(`${API}/api/backup.zip`)).status).toBe(403);
    expect((await app.request(`${API}/api/proposals`)).status).toBe(403);
    const noToken = await app.request(`${API}/api/library/interests/int-photo`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', origin: UI },
      body: JSON.stringify({ confirm: true }),
    });
    expect(noToken.status).toBe(403);
    const foreign = await app.request(`${API}/api/proposals/${P.alias}/accept`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example', 'x-cv-token': TOKEN },
      body: '{}',
    });
    expect(foreign.status).toBe(403);
  });
});
