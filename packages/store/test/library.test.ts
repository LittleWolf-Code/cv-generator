// Library editing (F-LIB-02, 05, 09): server-assigned ids never reused, sanitization with the field
// named, element-level revision check, two-step deletion, backup ZIP, data watcher.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  checkItem,
  createItem,
  DataStore,
  deleteItem,
  duplicateItem,
  installFixture,
  isIgnoredDataPath,
  saveIdentity,
  setItemArchived,
  updateItem,
  watchDataDir,
  zipDataDir,
  type DataChange,
} from '@cv/store';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
let dir: string;
let store: DataStore;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'cv-lib-'));
  await installFixture(path.join(ROOT, 'fixtures', 'personas', 'courte'), dir);
  store = DataStore.open(dir);
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const EMOJI = String.fromCodePoint(0x1f680);
const newExperience = () => ({
  id: 'exp-choisi-par-le-client',
  position: { fr: 'Ingénieure qualité logiciel', en: null },
  organization: 'Exemple Santé SAS',
  location: { city: 'Lyon', country: { fr: 'France', en: 'France' } },
  contract: 'cdd',
  start: '2018-03',
  end: '2019-08',
  skills: ['sk-python'],
  bullets: [
    {
      id: '',
      tags: [],
      skills: [],
      variants: [{ id: 'principale', label: null, text: { fr: 'Rédaction de 40 cas de test', en: null } }],
    },
  ],
});

describe('création et modification (F-LIB-05)', () => {
  it('attribue les identifiants côté serveur, les consigne, et ignore ceux du client', async () => {
    const r = await createItem(store, 'experiences', newExperience());
    expect(r.item.id).toBe('exp-exemple-sante-sas-2018');
    const bulletId = (r.item.bullets as Array<{ id: string }>)[0]!.id;
    expect(bulletId).toBe('b-redaction-de-40-cas');
    const ids = await store.readIds();
    expect(ids.ids[r.item.id as string]?.kind).toBe('experience');
    expect(ids.ids[bulletId]?.kind).toBe('bullet');
    expect(r.writes.map((w) => w.file)).toEqual(['ids.json', 'library/experiences.json']);
    expect((await store.loadLibrary()).experiences.some((e) => e.id === r.item.id)).toBe(true);
  });

  it("assainit à l'écriture et refuse un emoji en désignant le champ", async () => {
    const input = newExperience();
    input.position.fr = 'Ingénieure\u00A0qualité\u2019logiciel';
    const ok = await createItem(store, 'experiences', input);
    expect((ok.item.position as { fr: string }).fr).toBe("Ingénieure qualité'logiciel");

    const bad = newExperience();
    bad.bullets[0]!.variants[0]!.text.fr = `Tests ${EMOJI}`;
    await expect(createItem(store, 'experiences', bad)).rejects.toMatchObject({
      code: 'INVALID_DATA',
      details: {
        issues: [
          { path: 'bullets.0.variants.0.text.fr', message: expect.stringMatching(/emoji interdit \(U\+1F680\)/) },
        ],
      },
    });
    const before = await store.readIds();
    expect(Object.keys(before.ids)).not.toContain('b-tests');
  });

  it('valide à blanc avec les avertissements ATS-22', async () => {
    const r = await checkItem(store, 'experiences', {
      ...newExperience(),
      position: { fr: 'Ing. qualité', en: null },
      organization: '',
    });
    expect(r.issues.map((i) => i.path)).toContain('organization');
    expect(r.warnings.map((w) => w.path)).toEqual(['position.fr']);
  });

  it("modifie un élément, et refuse si l'élément a changé ailleurs (409)", async () => {
    const { library, revisions } = await store.loadLibraryFiles();
    const base = library.experiences.find((e) => e.id === 'exp-labo-2019')!;
    const edited = { ...base, organization: 'Laboratoire Fictif de Recherche' };
    // Another element of the same file changes: the edit is re-applied (element unchanged).
    const other = library.experiences.find((e) => e.id === 'exp-santenum-2019')!;
    await updateItem(store, 'experiences', other.id, {
      item: { ...other, tags: ['x'] },
      expectedRevision: revisions.experiences,
      base: other,
    });
    const r = await updateItem(store, 'experiences', base.id, {
      item: edited,
      expectedRevision: revisions.experiences,
      base,
    });
    expect(r.item.organization).toBe('Laboratoire Fictif de Recherche');
    // The element itself changed since it was loaded: 409.
    await expect(
      updateItem(store, 'experiences', base.id, {
        item: { ...base, end: '2019-06' },
        expectedRevision: revisions.experiences,
        base,
      }),
    ).rejects.toMatchObject({
      code: 'STALE_REVISION',
      details: { current: { organization: 'Laboratoire Fictif de Recherche' } },
    });
  });

  it('refuse une catégorie inconnue pour une compétence', async () => {
    await expect(createItem(store, 'skills', { category: 'inconnue', short: 'Rust' })).rejects.toMatchObject({
      code: 'INVALID_DATA',
      details: { issues: [{ path: 'category' }] },
    });
  });
});

describe('duplication, archivage et suppression en deux temps', () => {
  it('duplique avec de nouveaux identifiants', async () => {
    const r = await duplicateItem(store, 'experiences', 'exp-medtech-2023');
    expect(r.item.id).toBe('exp-medtech-exemple-sas-2023');
    const lib = await store.loadLibrary();
    const original = lib.experiences.find((e) => e.id === 'exp-medtech-2023')!;
    const copy = lib.experiences.find((e) => e.id === r.item.id)!;
    expect(copy.bullets.map((b) => b.variants)).toEqual(original.bullets.map((b) => b.variants));
    expect(copy.bullets.map((b) => b.id).some((id) => original.bullets.some((b) => b.id === id))).toBe(false);
    expect(lib.experiences.indexOf(copy)).toBe(lib.experiences.indexOf(original) + 1);
  });

  it('supprime seulement un élément archivé, et ne réutilise jamais son identifiant', async () => {
    await expect(deleteItem(store, 'interests', 'int-photo')).rejects.toMatchObject({ code: 'NOT_ARCHIVED' });
    await setItemArchived(store, 'interests', 'int-photo', true);
    await deleteItem(store, 'interests', 'int-photo');
    expect((await store.loadLibrary()).interests.map((i) => i.id)).not.toContain('int-photo');
    expect((await store.readIds()).ids['int-photo']).toBeDefined();
    const again = await createItem(store, 'interests', { text: { fr: 'Photo', en: 'Photography' } });
    expect(again.item.id).toBe('int-photo-2');
  });

  it('refuse de supprimer une catégorie utilisée', async () => {
    await expect(deleteItem(store, 'categories', 'outils')).rejects.toMatchObject({ code: 'IN_USE' });
  });
});

describe('identité', () => {
  it('attribue un identifiant aux nouveaux liens et contrôle la révision', async () => {
    const profile = await store.loadProfile();
    const identity = {
      ...profile.identity!,
      links: [
        ...profile.identity!.links,
        { id: '', kind: 'portfolio', url: 'https://camille.example.com', display: 'camille.example.com' },
      ],
    };
    const r = await saveIdentity(store, { identity, expectedRevision: profile.revision, base: profile.identity });
    expect(r.identity.links.at(-1)!.id).toBe('lk-portfolio');
    await expect(
      saveIdentity(store, {
        identity: { ...profile.identity!, phone: '01 99 00 00 00' },
        expectedRevision: profile.revision,
        base: profile.identity,
      }),
    ).rejects.toMatchObject({ code: 'STALE_REVISION' });
  });
});

describe('sauvegarde ZIP (F-LIB-09)', () => {
  it('contient data/ sans le verrou ni les fichiers temporaires', async () => {
    await writeFile(path.join(dir, 'library', '.experiences.json.123.abcd.tmp'), '{}');
    const files = Object.keys(unzipSync(await zipDataDir(dir)));
    expect(files).toContain('data/library/experiences.json');
    expect(files).toContain('data/ids.json');
    expect(files.some((f) => f.endsWith('.tmp') || f.includes('.lock'))).toBe(false);
  });
});

describe('surveillance de data/ (§8.4)', () => {
  it('ignore le verrou, les temporaires et .git', () => {
    expect(isIgnoredDataPath('.lock')).toBe(true);
    expect(isIgnoredDataPath('.lock/x')).toBe(true);
    expect(isIgnoredDataPath('library/.experiences.json.1.ab.tmp')).toBe(true);
    expect(isIgnoredDataPath('.git/HEAD')).toBe(true);
    expect(isIgnoredDataPath('proposals/01JC0FX0000000000000VAR001.json')).toBe(false);
  });

  it('signale une écriture avec le fichier et sa révision, une seule fois', async () => {
    const events: DataChange[] = [];
    const watcher = watchDataDir(dir, (c) => events.push(c), { debounceMs: 50 });
    await watcher.ready;
    try {
      const r = await setItemArchived(store, 'interests', 'int-course', true);
      const revision = r.revision;
      await expect
        .poll(() => events.find((e) => e.file === 'library/interests.json'), { timeout: 5000 })
        .toMatchObject({ file: 'library/interests.json', revision, deleted: false });
      expect(events.filter((e) => e.file === 'library/interests.json')).toHaveLength(1);
      expect(events.some((e) => e.file.includes('.lock') || e.file.endsWith('.tmp'))).toBe(false);
    } finally {
      await watcher.close();
    }
  });
});
