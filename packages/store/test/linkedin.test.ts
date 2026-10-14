// Lot 6 in packages/store (F-IMP-02, F-IMP-04, F-IMP-05, ADR 0015): the LinkedIn export read in memory
// (first level only, 20 MB at most), the import as proposals (complement, variant, duplicates against
// the library, the pending proposals and the same file), dry run, batch acceptance without dates to
// check, translations (empty language only), the same deduplication for propose_item.
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { strToU8, zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Experience, ProposalFile } from '@cv/core';
import {
  acceptBatch,
  acceptProposal,
  DataStore,
  importLinkedIn,
  installFixture,
  LINKEDIN_MAX_BYTES,
  linkedInIdentity,
  proposeItems,
  proposeTranslations,
  readLinkedInSource,
  StoreError,
  unzipLinkedIn,
} from '../src/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const IMPORTS = path.join(ROOT, 'fixtures', 'imports');
const ZIP = 'Basic_LinkedInDataExport_fictif.zip';

let tmp: string;
let dataDir: string;
let importDir: string;
let store: DataStore;

beforeEach(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'cv-linkedin-'));
  dataDir = path.join(tmp, 'data');
  importDir = path.join(tmp, 'import');
  await installFixture(path.join(ROOT, 'fixtures', 'personas', 'courte'), dataDir);
  await mkdir(importDir, { recursive: true });
  await copyFile(path.join(IMPORTS, ZIP), path.join(importDir, ZIP));
  store = DataStore.open(dataDir);
});
afterEach(() => rm(tmp, { recursive: true, force: true }));

async function hashValidated(): Promise<string> {
  const h = createHash('sha256');
  const walk = async (rel: string) => {
    for (const e of (await readdir(path.join(dataDir, rel), { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const r = path.join(rel, e.name);
      if (e.isDirectory()) await walk(r);
      else h.update(r).update(await readFile(path.join(dataDir, r)));
    }
  };
  await walk('library');
  await walk('presets');
  h.update(await readFile(path.join(dataDir, 'profile.json')));
  return h.digest('hex');
}

const proposals = async () => (await store.listProposals()).sort((a, b) => a.id.localeCompare(b.id));

describe('lecture de l\u2019export (F-IMP-02)', () => {
  it('ZIP lu en mémoire : seuls les CSV attendus du premier niveau', async () => {
    const source = await readLinkedInSource(importDir, ZIP);
    expect(source.tables.map((t) => t.file).sort()).toEqual(
      [
        'Certifications.csv',
        'Education.csv',
        'Email Addresses.csv',
        'Languages.csv',
        'PhoneNumbers.csv',
        'Positions.csv',
        'Profile.csv',
        'Projects.csv',
        'Skills.csv',
      ].sort(),
    );
    expect(source.skipped.sort()).toEqual(['Connections.csv', 'Jobs/Positions.csv']);
    const positions = source.tables.find((t) => t.file === 'Positions.csv')!;
    expect(JSON.stringify(positions.rows)).not.toContain('Entreprise Imbriquée Fictive');
  });

  it('refuse plus de 20 Mo décompressés dans les CSV attendus, sans tout décompresser', () => {
    const big = new Uint8Array(LINKEDIN_MAX_BYTES + 1024).fill(0x41);
    const zip = zipSync({ 'Positions.csv': big }, { level: 9 });
    expect(zip.length).toBeLessThan(1024 * 1024);
    expect(() => unzipLinkedIn(zip)).toThrow(/plus de 20 Mo/);
    // A large file that is not expected is never decompressed.
    const ignored = zipSync({ 'Messages.csv': big, 'Skills.csv': strToU8('Name\nPython\n') });
    expect(unzipLinkedIn(ignored).files.size).toBe(1);
  });

  it('CSV déposés directement : un fichier attendu, ou tous ceux de la racine de import/', async () => {
    await copyFile(path.join(IMPORTS, 'linkedin', 'Skills.csv'), path.join(importDir, 'Skills.csv'));
    await copyFile(path.join(IMPORTS, 'linkedin', 'Languages.csv'), path.join(importDir, 'languages.csv'));
    expect((await readLinkedInSource(importDir, 'Skills.csv')).tables.map((t) => t.file)).toEqual(['Skills.csv']);
    expect((await readLinkedInSource(importDir, null)).tables.map((t) => t.file)).toEqual([
      'Skills.csv',
      'Languages.csv',
    ]);
    await writeFile(path.join(importDir, 'Connections.csv'), 'First Name\nAlex\n');
    await expect(readLinkedInSource(importDir, 'Connections.csv')).rejects.toThrow(/pas un fichier de l'export/);
  });

  it('périmètre de fichiers (§7.6) : un chemin est refusé', async () => {
    await expect(readLinkedInSource(importDir, '../data/profile.json')).rejects.toMatchObject({
      code: 'FORBIDDEN_PATH',
    });
    await expect(readLinkedInSource(importDir, 'absent.zip')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('import en propositions', () => {
  it('essai à blanc : rien n\u2019est écrit, ni valeur renvoyée ; seulement colonnes et comptages', async () => {
    const before = await hashValidated();
    const report = await importLinkedIn(store, { importDir, fileName: ZIP, dryRun: true });
    expect(await proposals()).toEqual([]);
    expect(await hashValidated()).toBe(before);
    expect(report.created).toBe(0);
    const json = JSON.stringify(report);
    for (const value of ['Camille', 'example.com', '06 39', 'MedTech', 'Printemps', '1990', 'Imaginaire']) {
      expect(json).not.toContain(value);
    }
    const positions = report.files.find((f) => f.file === 'Positions.csv')!;
    expect(positions.dateFormats).toEqual({
      'Started On': { 'MMM AAAA': 2, autre: 1, vide: 1 },
      'Finished On': { vide: 2, 'MMM AAAA': 2 },
    });
    expect(report.files.find((f) => f.file === 'Languages.csv')!.levels).toEqual({ native: 1, toSpecify: 3 });
    expect(report.unknownColumns).toContain('Profile.csv : Industry');
    expect(report.ignoredColumns.sort()).toEqual(
      [
        'Profile.csv : Address',
        'Profile.csv : Birth Date',
        'Profile.csv : Maiden Name',
        'Profile.csv : Zip Code',
      ].sort(),
    );
  });

  it('propositions import-linkedin, doublons, compléments, variantes, sans toucher au contenu validé', async () => {
    const before = await hashValidated();
    const report = await importLinkedIn(store, { importDir, fileName: ZIP });
    expect(await hashValidated()).toBe(before);
    const all = await proposals();
    expect(all.every((p) => p.origin === 'import-linkedin' && p.source === 'import-linkedin')).toBe(true);
    expect(all.every((p) => p.sourceFile === ZIP)).toBe(true);
    expect(report.proposalIds.sort()).toEqual(all.map((p) => p.id));

    // MedTech: one new bullet as a complement, one close bullet as a variant, the identical one ignored.
    const medtech = report.duplicates.find((d) => d.duplicateOf === 'exp-medtech-2023')!;
    expect(medtech.proposalIds).toHaveLength(2);
    const complement = all.find((p) => p.type === 'item' && p.payload.duplicateOf === 'exp-medtech-2023')!;
    expect(
      complement.type === 'item' && (complement.payload.item as Experience).bullets.map((b) => b.variants[0]!.text.fr),
    ).toEqual(["Revue des exigences logicielles avec l'équipe système : 120 exigences clarifiées"]);
    expect(complement.base?.hash).toMatch(/^sha256:/);
    const variant = all.find((p) => p.type === 'variant')!;
    expect(variant.type === 'variant' && variant.target.bulletId).toBe('b-medtech-cicd');
    expect(variant.type === 'variant' && variant.payload).toMatchObject({ label: 'linkedin' });

    // Validated elements without new content: duplicateOf only.
    for (const id of [
      'exp-santenum-2019',
      'sk-python',
      'sk-cpp',
      'std-iec62304',
      'lang-fr',
      'lang-en',
      'cert-auditeur-13485',
      'prj-tracabilite',
    ]) {
      expect(report.duplicates.map((d) => d.duplicateOf)).toContain(id);
    }
    // Education duplicate with a new bullet (Notes) → complement.
    expect(all.some((p) => p.type === 'item' && p.payload.duplicateOf === 'edu-ingenieur-2019')).toBe(true);
    // Python twice in Skills.csv: the second is a duplicate of the first (same file).
    expect(report.duplicates.filter((d) => d.label === 'Python')).toHaveLength(2);

    const items = all.filter((p) => p.type === 'item' && !p.payload.duplicateOf);
    const labels = items.map((p) => (p.type === 'item' ? p.payload.itemType : ''));
    expect(labels.sort()).toEqual(
      [
        'certification',
        'education',
        'experience',
        'language',
        'project',
        'skill',
        'skill',
        'skill',
        'summary',
        'title',
      ].sort(),
    );
    expect(report.languagesWithoutLevel).toEqual(['Allemand']);
    expect(report.datesToVerify).toBe(1);
    expect(report.incomplete).toHaveLength(4);
    expect(report.identityFound).toEqual({ firstName: true, lastName: true, email: true, phone: true, location: true });
    expect(JSON.stringify(report)).not.toContain('camille.martin@example.com');

    // A second import finds every element pending: nothing new.
    const again = await importLinkedIn(store, { importDir, fileName: ZIP });
    expect(again.created).toBe(0);
    expect(again.duplicates.filter((d) => d.inPending).length).toBeGreaterThan(5);
  });

  it('acceptation en lot : la date à vérifier est laissée de côté ; un complément ajoute ses puces seulement', async () => {
    await importLinkedIn(store, { importDir, fileName: ZIP });
    const all = await proposals();
    const r = await acceptBatch(
      store,
      all.map((p) => p.id),
    );
    const hospital = all.find(
      (p) =>
        p.type === 'item' &&
        (p.payload.item as { organization?: string }).organization === 'Hôpital Fictif de Villeurbanne',
    )!;
    expect(r.skipped.find((s) => s.id === hospital.id)?.reason).toMatch(/date à vérifier/);
    const lib = await store.loadLibrary();
    const medtech = lib.experiences.find((e) => e.id === 'exp-medtech-2023')!;
    expect(medtech.position.fr).toBe('Ingénieure logiciel embarqué');
    expect(medtech.organization).toBe('MedTech Exemple SAS');
    expect(medtech.bullets.map((b) => b.variants[0]!.text.fr)).toContain(
      "Revue des exigences logicielles avec l'équipe système : 120 exigences clarifiées",
    );
    expect(medtech.bullets.find((b) => b.id === 'b-medtech-cicd')!.variants.map((v) => v.id)).toEqual([
      'principale',
      'linkedin',
    ]);
    // The pending German language, accepted in the batch, keeps cefr null (blocks its export).
    expect(lib.languages.find((l) => l.code === 'de')!.cefr).toBeNull();
    // Accepted one by one after review.
    await acceptProposal(store, hospital.id);
    expect((await store.loadLibrary()).experiences.some((e) => e.start === '2018')).toBe(true);
  });

  it("identité trouvée, pour le préremplissage de l'interface seulement", async () => {
    expect(await linkedInIdentity(importDir, ZIP)).toMatchObject({
      firstName: 'Camille',
      email: 'camille.martin@example.com',
    });
  });
});

describe('dédoublonnage partagé avec propose_item (F-IMP-04, T-02)', () => {
  const cvText = async () => readFile(path.join(IMPORTS, 'cv-source.md'), 'utf8');

  it('un élément du CV déjà proposé par l\u2019import LinkedIn en attente renvoie duplicateOf, sans rien créer', async () => {
    await importLinkedIn(store, { importDir, fileName: ZIP });
    const pending = await proposals();
    const hospital = pending.find(
      (p) =>
        p.type === 'item' &&
        (p.payload.item as { organization?: string }).organization === 'Hôpital Fictif de Villeurbanne',
    )!;
    const text = await cvText();
    const out = await proposeItems(
      store,
      [
        {
          type: 'experience',
          source: 'import-cv',
          sourceFile: 'CV.pdf',
          data: {
            position: { fr: 'Stagiaire ingénieure biomédicale', en: null },
            organization: 'Hôpital Fictif de Villeurbanne',
            start: '2018-04',
            end: '2018-08',
            bullets: [],
          },
        },
        {
          type: 'interest',
          source: 'import-cv',
          sourceFile: 'CV.pdf',
          data: { text: { fr: 'Randonnée en montagne', en: null } },
        },
      ],
      { importDir, readImportText: async () => ({ text, hasTextLayer: true }) },
    );
    expect(out.results[0]).toMatchObject({ status: 'duplicateOf', duplicateOf: hospital.id });
    expect(out.results[1]).toMatchObject({ status: 'created' });
    expect((await proposals()).length).toBe(pending.length + 1);
  });

  it('un PDF sans couche texte est refusé avec la consigne attendue', async () => {
    const out = await proposeItems(
      store,
      [
        {
          type: 'interest',
          source: 'import-cv',
          sourceFile: 'scan.pdf',
          data: { text: { fr: 'Course à pied', en: null } },
        },
      ],
      { importDir, readImportText: async () => ({ text: '', hasTextLayer: false }) },
    );
    expect(out.results[0]).toMatchObject({ status: 'rejected' });
    expect(JSON.stringify(out.results[0])).toContain(
      'joignez le fichier directement dans la conversation, ou fournissez le DOCX',
    );
  });
});

describe('traductions (MCP-14, ADR 0010)', () => {
  const englishFree = async () => {
    // A French-only bullet, as an import leaves it.
    const lib = await store.loadLibrary();
    const file = await store.read<{ schemaVersion: 1; revision: number; items: unknown[] }>('library/experiences.json');
    const items = structuredClone(lib.experiences);
    items[1]!.bullets[0]!.variants[0]!.text.en = null;
    items[1]!.position.en = null;
    await store.write('library/experiences.json', { ...file, items });
    return items[1]!;
  };

  it('remplit une langue vide ; refuse une langue déjà traduite, un chiffre nouveau, une cible inconnue', async () => {
    const exp = await englishFree();
    const bullet = exp.bullets[0]!;
    const out = await proposeTranslations(store, [
      {
        target: {
          collection: 'experiences',
          itemId: exp.id,
          bulletId: bullet.id,
          variantId: 'principale',
          field: 'text',
        },
        lang: 'en',
        text: 'Developed in Python a patient remote-monitoring API used by 12 healthcare facilities',
      },
      {
        target: { collection: 'experiences', itemId: exp.id, field: 'position' },
        lang: 'en',
        text: 'Software Developer',
      },
      {
        target: { collection: 'experiences', itemId: 'exp-medtech-2023', field: 'position' },
        lang: 'en',
        text: 'Embedded Engineer',
      },
      {
        target: {
          collection: 'experiences',
          itemId: exp.id,
          bulletId: bullet.id,
          variantId: 'principale',
          field: 'text',
        },
        lang: 'en',
        text: 'Developed a Python API used by 15 healthcare facilities',
      },
      { target: { collection: 'experiences', itemId: exp.id, field: 'organization' }, lang: 'en', text: 'x' },
      {
        target: { collection: 'profile' as never, itemId: 'identity', field: 'drivingLicense' },
        lang: 'en',
        text: 'x',
      },
    ]);
    expect(out.results.map((r) => r.status)).toEqual([
      'created',
      'created',
      'rejected',
      'duplicateOf',
      'rejected',
      'rejected',
    ]);
    expect(JSON.stringify(out.results[2])).toContain('déjà traduit');
    expect(JSON.stringify(out.results[4])).toContain('champ bilingue introuvable');
    expect(JSON.stringify(out.results[5])).toContain("se traduisent dans l'interface");
    const created = (await proposals()).filter((p) => p.type === 'translation') as Array<
      Extract<ProposalFile, { type: 'translation' }>
    >;
    expect(created.every((p) => p.source === 'bibliotheque' && p.origin === 'claude')).toBe(true);

    // A new number is refused (annex C).
    const bad = await proposeTranslations(store, [
      {
        target: { collection: 'experiences', itemId: exp.id, field: 'position' },
        lang: 'en',
        text: 'Software Developer, 15 teams',
      },
    ]);
    expect(bad.results[0]).toMatchObject({ status: 'duplicateOf' });

    await acceptProposal(store, created[0]!.id);
    const after = (await store.loadLibrary()).experiences[1]!;
    expect(after.bullets[0]!.variants[0]!.text.en).toBe(
      'Developed in Python a patient remote-monitoring API used by 12 healthcare facilities',
    );
    expect(after.bullets[0]!.variants[0]!.text.fr).toBe(bullet.variants[0]!.text.fr);
  });

  it('garde-fou : chiffre nouveau rejeté', async () => {
    const exp = await englishFree();
    const out = await proposeTranslations(store, [
      {
        target: { collection: 'experiences', itemId: exp.id, field: 'position' },
        lang: 'en',
        text: 'Software Developer (3 teams)',
      },
    ]);
    expect(out.results[0]).toMatchObject({ status: 'rejected' });
    expect(JSON.stringify(out.results[0])).toContain('no-new-numbers');
  });

  it("refuse une erreur d'outil propre si rien n'est lisible", async () => {
    await expect(readLinkedInSource(null, ZIP)).rejects.toBeInstanceOf(StoreError);
  });
});
