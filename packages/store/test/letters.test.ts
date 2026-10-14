// Lot 7 in packages/store (F-LET-01, F-LET-04, ADR 0016): letter versions never overwritten (two saves at
// the same time), unknown sourceIds and roles out of order refused, final status irreversible, active
// version chosen explicitly, letter exports in exports/<…>_lettre/.
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LetterVersionFile } from '@cv/core';
import {
  activeLetterVersion,
  addApplicationExport,
  createApplication,
  createLetterVersion,
  DataStore,
  finalizeLetter,
  installFixture,
  letterChecks,
  listLetterVersions,
  setActiveLetter,
} from '../src/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const fixtureLetter = async (name: string) =>
  JSON.parse(await readFile(path.join(ROOT, 'fixtures', 'letters', name), 'utf8')) as LetterVersionFile;

let dir: string;
let store: DataStore;
let id: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'cv-letters-'));
  await installFixture(path.join(ROOT, 'fixtures', 'personas', 'courte'), dir);
  store = DataStore.open(dir);
  const created = await createApplication(
    store,
    {
      company: 'ACME Medical',
      jobTitle: 'Ingénieur logiciel dispositifs médicaux H/F',
      offerReference: 'ACME-1234',
      lang: 'fr',
      basePresetId: 'preset-defaut',
      offerText: await readFile(path.join(ROOT, 'fixtures', 'offres', 'offre-logiciel-dm.md'), 'utf8'),
    },
    { importDir: null },
  );
  id = created.application.id;
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const lettersDir = () => path.join(dir, 'applications', id, 'letters', 'fr');

describe('versions de lettre (F-LET-01, F-LET-04)', () => {
  it('numérotées sous le verrou : deux enregistrements simultanés donnent v1 et v2, aucun écrasé', async () => {
    const letter = await fixtureLetter('lettre-logiciel-dm-fr.json');
    const other = DataStore.open(dir); // a second process (MCP) on the same data
    const [a, b] = await Promise.all([
      createLetterVersion(store, id, 'fr', letter, 'claude'),
      createLetterVersion(other, id, 'fr', { ...letter, recipient: null }, 'utilisateur'),
    ]);
    expect([a.version.version, b.version.version].sort()).toEqual([1, 2]);
    expect((await readdir(lettersDir())).sort()).toEqual(['v1.json', 'v2.json']);
    const versions = await listLetterVersions(store, id, 'fr');
    expect(versions.map((v) => v.origin).sort()).toEqual(['claude', 'utilisateur']);
    // A third version based on v1 leaves v1 and v2 untouched.
    const before = await Promise.all(['v1.json', 'v2.json'].map((f) => readFile(path.join(lettersDir(), f), 'utf8')));
    const c = await createLetterVersion(store, id, 'fr', { ...letter, basedOn: 1 }, 'claude');
    expect(c.version).toMatchObject({ version: 3, basedOn: 1, status: 'brouillon' });
    const after = await Promise.all(['v1.json', 'v2.json'].map((f) => readFile(path.join(lettersDir(), f), 'utf8')));
    expect(after).toEqual(before);
  });

  it('refuse un identifiant inconnu, un ordre de rôles hors règle, une version de départ absente', async () => {
    const letter = await fixtureLetter('lettre-logiciel-dm-fr.json');
    await expect(
      createLetterVersion(store, id, 'fr', { ...letter, sourceIds: ['exp-inventee'] }, 'claude'),
    ).rejects.toMatchObject({ code: 'INVALID_DATA', details: { unknown: ['exp-inventee'] } });
    await expect(
      createLetterVersion(
        store,
        id,
        'fr',
        { ...letter, paragraphs: [letter.paragraphs[1], letter.paragraphs[0], letter.paragraphs[2]] },
        'claude',
      ),
    ).rejects.toMatchObject({ code: 'INVALID_DATA' });
    await expect(createLetterVersion(store, id, 'fr', { ...letter, basedOn: 7 }, 'claude')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(readdir(lettersDir())).rejects.toThrow();
  });

  it('statut finale irréversible ; une version existante ne se remplace jamais', async () => {
    const letter = await fixtureLetter('lettre-logiciel-dm-fr.json');
    await createLetterVersion(store, id, 'fr', letter, 'claude');
    const done = await finalizeLetter(store, id, 'fr', 1);
    expect(done.version.status).toBe('finale');
    await expect(finalizeLetter(store, id, 'fr', 1)).rejects.toMatchObject({ code: 'ALREADY_RESOLVED' });
    await expect(
      store.create(`applications/${id}/letters/fr/v1.json`, { ...letter, version: 1 }),
    ).rejects.toMatchObject({
      code: 'ALREADY_EXISTS',
    });
    expect(JSON.parse(await readFile(path.join(lettersDir(), 'v1.json'), 'utf8')).status).toBe('finale');
  });

  it('version active choisie explicitement ; sans elle, rien ne s\u2019exporte', async () => {
    const letter = await fixtureLetter('lettre-logiciel-dm-fr.json');
    await createLetterVersion(store, id, 'fr', letter, 'claude');
    await expect(activeLetterVersion(store, id, 'fr')).rejects.toMatchObject({ code: 'NO_ACTIVE_LETTER' });
    expect((await store.loadApplication(id)).application.activeLetter).toEqual({ fr: null, en: null });
    await setActiveLetter(store, id, 'fr', 1);
    expect((await activeLetterVersion(store, id, 'fr')).version).toBe(1);
    await expect(setActiveLetter(store, id, 'fr', 9)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('avertissements calculés à la lecture ; export de lettre rangé dans exports/<…>_lettre/', async () => {
    const letter = await fixtureLetter('lettre-logiciel-dm-fr.json');
    const { version } = await createLetterVersion(store, id, 'fr', letter, 'claude');
    expect(await letterChecks(store, id, version)).toEqual([]);
    const saved = await addApplicationExport(store, id, {
      kind: 'letter',
      fileName: 'LM_Camille_Martin_ACME-Medical_FR.pdf',
      bytes: new TextEncoder().encode('%PDF-fictif'),
      format: 'pdf',
      lang: 'fr',
      layout: 'ats-classique',
      pages: 1,
      atsCheck: 'ok',
    });
    expect(saved.entry).toMatchObject({ kind: 'letter', file: 'LM_Camille_Martin_ACME-Medical_FR.pdf' });
    expect(saved.entry.dir).toMatch(/^exports\/\d{8}-\d{6}_lettre\/$/);
  });
});
