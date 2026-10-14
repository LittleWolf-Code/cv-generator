// Reset of the data (F-LIB-09c, ADR 0021): ZIP copy kept in out/backups/ before erasing, data directory
// back to the state of `npm run data:init`, id registry, .git/ and files outside the data model kept,
// refusals (no confirmation, no out/), NF-01 on the route.
import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { COLLECTIONS } from '@cv/core';
import { createApplication, DataStore, installFixture, resetDataDir } from '@cv/store';
import { createApp } from '../src/app.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const TOKEN = 'r'.repeat(64);
const API = 'http://127.0.0.1:4311';
const UI = 'http://127.0.0.1:4310';
const PROPOSAL = '01JC0FX0000000000000VAR001';

let dir: string;
let out: string;
let store: DataStore;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'cv-reset-'));
  out = `${dir}-out`;
  await installFixture(path.join(ROOT, 'fixtures', 'personas', 'courte'), dir);
  await copyFile(
    path.join(ROOT, 'fixtures', 'proposals', `${PROPOSAL}.json`),
    path.join(dir, 'proposals', `${PROPOSAL}.json`),
  );
  store = DataStore.open(dir);
  await createApplication(
    store,
    {
      company: 'ACME Medical',
      jobTitle: 'Ingénieur logiciel',
      lang: 'fr',
      basePresetId: 'preset-defaut',
      offerText: 'Offre fictive : ingénieur logiciel pour dispositifs médicaux.',
    },
    { importDir: null },
  );
  // Outside the data model: a private git repository of data/ (§8.4) and a note of the user.
  await mkdir(path.join(dir, '.git'), { recursive: true });
  await writeFile(path.join(dir, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  await writeFile(path.join(dir, 'LISEZMOI.md'), 'Notes\n');
  app = createApp({ store, token: TOKEN, apiPort: 4311, uiOrigins: [UI], outDir: out });
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
  await rm(out, { recursive: true, force: true });
});

const post = (target: ReturnType<typeof createApp>, body: unknown, headers: Record<string, string> = {}) =>
  target.request(`${API}/api/reset`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: UI, 'x-cv-token': TOKEN, ...headers },
    body: JSON.stringify(body),
  });

describe('réinitialisation des données (F-LIB-09c)', () => {
  it('refuse sans confirmation, sans jeton ou depuis une origine étrangère, sans rien effacer', async () => {
    expect((await post(app, {})).status).toBe(400);
    expect((await post(app, { confirm: false })).status).toBe(400);
    expect((await post(app, { confirm: true }, { 'x-cv-token': 'x'.repeat(64) })).status).toBe(403);
    expect((await post(app, { confirm: true }, { origin: 'https://evil.example' })).status).toBe(403);
    expect((await store.loadLibrary()).experiences.length).toBeGreaterThan(0);
    expect(existsSync(out)).toBe(false);
  });

  it('refuse sans dossier out/ pour la copie de sécurité', async () => {
    const noOut = createApp({ store, token: TOKEN, apiPort: 4311, uiOrigins: [UI] });
    const res = await post(noOut, { confirm: true });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { code: string }).code).toBe('NOT_AVAILABLE');
    expect((await store.listApplicationIds()).length).toBe(1);
  });

  it('garde une copie ZIP, puis remet data/ dans son état initial', async () => {
    const before = await store.readIds();
    const res = await post(app, { confirm: true });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { backup: string; writes: Array<{ file: string; revision: number }> };
    expect(body.backup).toMatch(new RegExp(`^${path.basename(out)}/backups/cv-data-\\d{8}-\\d{6}\\.zip$`));
    expect(body.writes.map((w) => w.file)).toEqual(
      expect.arrayContaining(['profile.json', 'presets/preset-defaut.json', 'library/experiences.json']),
    );

    // The copy holds everything erased.
    const zip = unzipSync(new Uint8Array(await readFile(path.join(path.dirname(out), ...body.backup.split('/')))));
    expect(Object.keys(zip)).toEqual(
      expect.arrayContaining([
        'data/profile.json',
        'data/library/experiences.json',
        'data/assets/photo.jpg',
        `data/proposals/${PROPOSAL}.json`,
        'data/LISEZMOI.md',
      ]),
    );
    expect(Object.keys(zip).some((f) => /^data\/applications\/[^/]+\/application\.json$/.test(f))).toBe(true);
    expect(Object.keys(zip).some((f) => f.includes('.git/') || f.endsWith('.lock'))).toBe(false);

    // Empty and valid, as after `npm run data:init`.
    const snapshot = await DataStore.open(dir).loadSnapshot();
    expect(snapshot.profile.identity).toBeNull();
    expect(snapshot.presets.map((p) => p.id)).toEqual(['preset-defaut']);
    expect(snapshot.presets[0]!.selection.include).toEqual([]);
    for (const name of COLLECTIONS) {
      expect(snapshot.library[name].length, name).toBe(name === 'categories' ? 4 : 0);
    }
    for (const folder of ['applications', 'proposals', 'assets']) {
      expect(await readdir(path.join(dir, folder)), folder).toEqual([]);
    }

    // Kept: the id registry (F-LIB-02), .git/ and the files outside the data model.
    expect((await store.readIds()).ids).toEqual(before.ids);
    expect(await readFile(path.join(dir, '.git', 'HEAD'), 'utf8')).toBe('ref: refs/heads/main\n');
    expect(existsSync(path.join(dir, 'LISEZMOI.md'))).toBe(true);
  });

  it('ne remplace jamais une copie de la même seconde ; complète le registre des identifiants par défaut', async () => {
    const registry = await store.readIds();
    delete registry.ids['methodes'];
    await store.write('ids.json', registry);
    const now = new Date(2026, 9, 8, 14, 30, 0);
    const backups = path.join(out, 'backups');
    const first = await resetDataDir(store, backups, now);
    const second = await resetDataDir(store, backups, now);
    expect(path.basename(first.backupFile)).toBe('cv-data-20261008-143000.zip');
    expect(path.basename(second.backupFile)).toBe('cv-data-20261008-143000-2.zip');
    expect(first.writes.map((w) => w.file)).toContain('ids.json');
    expect(second.writes.map((w) => w.file)).not.toContain('ids.json');
    expect((await store.readIds()).ids['methodes']?.kind).toBe('category');
  });
});
