// T-01, T-02 and T-05 (§12.6) replayed end to end on the fictitious persona « courte » (ADR 0015):
// T-01, the fictitious LinkedIn export dropped in import/ and imported from the interface (API): the
// proposals arrive in « À valider », some are accepted, others rejected; a language without a CEFR level
// is flagged and blocks the export until its level is entered. T-02, an in-memory MCP client plays
// Claude and follows importer-mon-cv on the fictitious CV: no duplicate of the LinkedIn proposals still
// pending (duplicateOf); the scanned PDF gives the expected message. T-05, in English the untranslated
// fields are listed with a link each and the export is blocked; after the translations proposed by
// propose_translation are accepted, the EN export passes in en-GB, then in en-US on Letter paper.
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { PDFDocument } from 'pdf-lib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exportBlockers, type AtsReport, type Library, type PresetFile } from '@cv/core';
import { DataStore, installFixture } from '@cv/store';
import { createApp } from '../../server/src/app.js';
import { importCvProcedure } from '../src/prompts.js';
import { createCvServer } from '../src/server.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const IMPORTS = path.join(ROOT, 'fixtures', 'imports');
const ZIP = 'Basic_LinkedInDataExport_fictif.zip';
const CV = 'CV_Camille_Martin_fictif.pdf';
const SCAN = 'CV_Camille_Martin_fictif_scan.pdf';
const TOKEN = 't'.repeat(64);
const API = 'http://127.0.0.1:4311';
const UI = 'http://127.0.0.1:4310';

let tmp: string;
let dataDir: string;
let app: ReturnType<typeof createApp>;
let client: Client;

type Res = {
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  content: Array<{ type: string; text?: string }>;
};
const call = async (name: string, args: Record<string, unknown> = {}) => {
  const r = (await client.callTool({ name, arguments: args })) as Res;
  expect(r.isError, `${name} : ${r.content.map((c) => c.text ?? '').join('\n')}`).toBeFalsy();
  return r;
};
const send = (method: string, url: string, body: unknown = {}) =>
  app.request(`${API}${url}`, {
    method,
    headers: { 'content-type': 'application/json', origin: UI, 'x-cv-token': TOKEN },
    body: JSON.stringify(body),
  });
const get = async <T>(url: string) =>
  (await (await app.request(`${API}${url}`, { headers: { 'x-cv-token': TOKEN } })).json()) as T;

interface View {
  id: string;
  type: string;
  status: string;
  duplicateOf: string | null;
  batchExcluded: string | null;
  checks: Array<{ rule: string; ok: boolean }>;
  payload: { itemType?: string; item?: Record<string, unknown> };
}
const pending = async () => (await get<{ proposals: View[] }>('/api/proposals')).proposals;
const itemOf = (views: View[], test: (item: Record<string, unknown>) => boolean) =>
  views.find((v) => v.type === 'item' && !v.duplicateOf && test(v.payload.item!))!;
const accept = async (id: string, body: unknown = {}) => {
  const r = await send('POST', `/api/proposals/${id}/accept`, body);
  expect(r.status, JSON.stringify(await r.clone().json())).toBe(200);
};
const reject = async (id: string) =>
  expect((await send('POST', `/api/proposals/${id}/reject`, { reason: null })).status).toBe(200);

async function preset(): Promise<PresetFile> {
  return (await get<{ presets: PresetFile[] }>('/api/presets')).presets.find((p) => p.id === 'preset-defaut')!;
}
async function savePreset(change: (p: PresetFile) => void): Promise<void> {
  const p = structuredClone(await preset());
  change(p);
  const r = await send('PUT', '/api/presets/preset-defaut', { preset: p, expectedRevision: p.revision });
  expect(r.status, JSON.stringify(await r.clone().json())).toBe(200);
}
async function render(): Promise<{ report: AtsReport; sha256: string; fileName: string; pdfBase64: string }> {
  const r = await send('POST', '/api/render', { presetId: 'preset-defaut' });
  expect(r.status).toBe(200);
  return (await r.json()) as { report: AtsReport; sha256: string; fileName: string; pdfBase64: string };
}
const exportPdf = (sha: string) =>
  send('POST', '/api/export', { presetId: 'preset-defaut', format: 'pdf', previewSha256: sha });
const library = async () => await get<{ library: Library; revisions: Record<string, number> }>('/api/library');

beforeAll(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'cv-t01-'));
  dataDir = path.join(tmp, 'data');
  const importDir = path.join(tmp, 'import');
  await installFixture(path.join(ROOT, 'fixtures', 'personas', 'courte'), dataDir);
  await mkdir(importDir, { recursive: true });
  for (const f of [ZIP, CV, SCAN]) await copyFile(path.join(IMPORTS, f), path.join(importDir, f));
  app = createApp({
    store: DataStore.open(dataDir),
    token: TOKEN,
    apiPort: 4311,
    uiOrigins: [UI],
    outDir: path.join(tmp, 'out'),
    importDir,
  });
  const server = createCvServer({ dataDir, outDir: path.join(tmp, 'out'), importDir, uiPort: 4310 });
  const [c, s] = InMemoryTransport.createLinkedPair();
  await server.connect(s);
  client = new Client({ name: 'cv-t01', version: '0.0.0' });
  await client.connect(c);
});
afterAll(async () => {
  await client.close();
  await rm(tmp, { recursive: true, force: true });
});

describe('T-01, T-02, T-05 (lot 6)', () => {
  it('T-01 : import LinkedIn depuis l\u2019interface, acceptations et rejets, langue sans niveau CECRL', async () => {
    const files = await get<{ files: Array<{ name: string; kind: string }> }>('/api/import/files');
    expect(files.files.filter((f) => f.kind === 'linkedin').map((f) => f.name)).toEqual([ZIP]);
    const r = await send('POST', '/api/import/linkedin', { fileName: ZIP });
    expect(r.status).toBe(200);
    const report = (await r.json()) as {
      created: number;
      proposalIds: string[];
      languagesWithoutLevel: string[];
      writes: unknown[];
    };
    expect(report.created).toBeGreaterThan(10);
    expect(report.writes.length).toBeGreaterThan(report.created);
    const views = await pending();
    expect(views.map((v) => v.id).sort()).toEqual([...report.proposalIds].sort());

    // Accepted: the MedTech complement and its variant, the certification, German (no level yet).
    const complement = views.find((v) => v.duplicateOf === 'exp-medtech-2023')!;
    await accept(complement.id);
    await accept(views.find((v) => v.type === 'variant')!.id);
    await accept(itemOf(views, (i) => i.issuer === 'Organisme Agile Fictif').id);
    const german = itemOf(views, (i) => i.code === 'de');
    expect(german.checks.find((c) => c.rule === 'cefr-to-specify')).toMatchObject({ ok: false });
    await accept(german.id);
    // Rejected: the LinkedIn title and summary, Docker.
    await reject(views.find((v) => v.payload.itemType === 'title' && !v.duplicateOf)!.id);
    await reject(views.find((v) => v.payload.itemType === 'summary')!.id);
    await reject(itemOf(views, (i) => i.short === 'Docker').id);

    // The language without a CEFR level is flagged in the library and blocks the export once shown.
    const lib = await library();
    const de = lib.library.languages.find((l) => l.code === 'de')!;
    const tree = await get<{ groups: Array<{ items: Array<{ id: string; cefrMissing: boolean }> }> }>('/api/library');
    expect(tree.groups.flatMap((g) => g.items).find((n) => n.id === de.id)!.cefrMissing).toBe(true);
    await savePreset((p) => p.selection.include.push(de.id));
    const blocked = await render();
    expect(blocked.report.projection.blocking.map((b) => b.code)).toEqual(['LANGUAGE_LEVEL_MISSING']);
    expect(exportBlockers(blocked.report, 'normale')[0]!.message).toMatch(/^Niveau CECRL à préciser : Allemand/);
    expect((await exportPdf(blocked.sha256)).status).toBe(422);
    const put = await send('PUT', `/api/library/languages/${de.id}`, {
      item: { ...de, cefr: 'A2' },
      expectedRevision: lib.revisions.languages,
      base: de,
    });
    expect(put.status).toBe(200);
    const ok = await render();
    expect(ok.report.blocking).toBe(false);
    expect((await exportPdf(ok.sha256)).status).toBe(200);
  });

  it('T-02 : importer-mon-cv sur le CV fictif, sans doublon des propositions LinkedIn en attente', async () => {
    const procedure = importCvProcedure(CV);
    expect(procedure).toContain(`get_import_file_text({ fileName: "${CV}" })`);
    // 1. Pending proposals and import files.
    const listed = await call('list', { kind: 'proposals', status: 'pending' });
    const open = (listed.structuredContent!.items as Array<{ id: string }>).map((p) => p.id);
    const files = await call('list', { kind: 'import_files' });
    expect(JSON.stringify(files.structuredContent)).toContain(CV);
    // 2. The CV text (untrusted); the scanned PDF has none.
    const text = await call('get_import_file_text', { fileName: CV });
    expect(text.structuredContent!.hasTextLayer).toBe(true);
    const scan = await call('get_import_file_text', { fileName: SCAN });
    expect(scan.structuredContent!.hasTextLayer).toBe(false);
    expect(scan.content[0]!.text).toContain(
      'joignez le fichier directement dans la conversation, ou fournissez le DOCX',
    );
    // 3. « Claude » proposes what it read, copied as is, with sourceFile.
    const src = { source: 'import-cv', sourceFile: CV };
    const r = await call('propose_item', {
      items: [
        {
          type: 'experience',
          ...src,
          data: {
            position: { fr: 'Ingénieure logiciel embarqué' },
            organization: 'MedTech Exemple SAS',
            location: { city: 'Grenoble', country: { fr: 'France' } },
            start: '2023-02',
            end: null,
            bullets: [
              {
                variants: [
                  {
                    text: {
                      fr: "Analyse des risques logiciels selon l'ISO 14971 avec l'équipe qualité : 35 mesures de maîtrise tracées",
                    },
                  },
                ],
              },
            ],
          },
        },
        {
          type: 'experience',
          ...src,
          data: {
            position: { fr: 'Stagiaire ingénieure biomédicale' },
            organization: 'Hôpital Fictif de Villeurbanne',
            start: '2018-04',
            end: '2018-08',
            bullets: [
              {
                variants: [
                  {
                    text: {
                      fr: 'Rédaction des procédures de maintenance préventive pour 40 équipements, validées par le responsable biomédical',
                    },
                  },
                ],
              },
            ],
          },
        },
        {
          type: 'education',
          ...src,
          data: {
            degree: { fr: 'Classe préparatoire MPSI-MP' },
            institution: 'Lycée Fictif Ampère',
            start: '2013',
            end: '2016',
          },
        },
        { type: 'skill', ...src, data: { category: 'langages', short: 'Rust' } },
        { type: 'skill', ...src, data: { category: 'reglementaire', short: 'ISO 13485' } },
        { type: 'language', ...src, data: { code: 'de', language: { fr: 'Allemand', en: 'German' }, cefr: 'A2' } },
        { type: 'interest', ...src, data: { text: { fr: 'Randonnée en montagne' } } },
      ],
    });
    const results = r.structuredContent!.results as Array<{
      status: string;
      duplicateOf?: string;
      proposalId?: string;
    }>;
    expect(results.map((x) => x.status)).toEqual([
      'duplicateOf',
      'duplicateOf',
      'duplicateOf',
      'duplicateOf',
      'duplicateOf',
      'duplicateOf',
      'created',
    ]);
    // Duplicates of the LinkedIn proposals still pending, by their ULID: nothing created for them.
    for (const i of [1, 2, 3]) expect(open).toContain(results[i]!.duplicateOf);
    expect(results[0]!.duplicateOf).toBe('exp-medtech-2023');
    expect(results[4]!.duplicateOf).toBe('std-iso13485');
    expect(results[5]!.duplicateOf).toMatch(/^lang-/);
    // 4. PAUSE, then 5. recap (the user validates in the interface).
    expect(r.content[0]!.text).toContain('1 proposition(s) créée(s) sur 7');
  });

  it('T-05 : champs non traduits listés et export EN bloqué, puis traductions acceptées : en-GB puis en-US (Letter)', async () => {
    // The user accepts the remaining imported elements, one by one for the date to check.
    const views = await pending();
    const hospital = itemOf(views, (i) => i.organization === 'Hôpital Fictif de Villeurbanne');
    expect(hospital.batchExcluded).toMatch(/date à vérifier/);
    const prepa = itemOf(views, (i) => i.institution === 'Lycée Fictif Ampère');
    const project = itemOf(
      views,
      (i) => (i.name as { fr: string } | undefined)?.fr === "Application de suivi d'entraînement",
    );
    const hiking = itemOf(views, (i) => (i.text as { fr: string } | undefined)?.fr === 'Randonnée en montagne');
    for (const v of [hospital, prepa, project, hiking]) await accept(v.id);
    const lib = (await library()).library;
    const exp = lib.experiences.find((e) => e.organization === 'Hôpital Fictif de Villeurbanne')!;
    const edu = lib.education.find((e) => e.institution === 'Lycée Fictif Ampère')!;
    const prj = lib.projects.find((p) => p.name.fr === "Application de suivi d'entraînement")!;
    const int = lib.interests.find((i) => i.text.fr === 'Randonnée en montagne')!;
    await savePreset((p) => {
      p.selection.include.push(
        exp.id,
        ...exp.bullets.map((b) => b.id),
        edu.id,
        prj.id,
        ...prj.bullets.map((b) => b.id),
        int.id,
      );
      p.selection.sections.find((s) => s.key === 'projects')!.enabled = true;
      p.lang = 'en';
      p.enVariant = 'en-GB';
    });

    // In English: every untranslated field listed, each with its link, and the export blocked.
    const blocked = await render();
    const untranslated = blocked.report.projection.blocking.filter((b) => b.code === 'UNTRANSLATED');
    expect(untranslated.length).toBeGreaterThanOrEqual(8);
    const blocker = exportBlockers(blocked.report, 'normale').find((b) => b.code === 'UNTRANSLATED')!;
    expect(blocker.fields).toHaveLength(untranslated.length);
    expect(blocker.fields!.every((f) => f.fix?.kind === 'open')).toBe(true);
    expect(blocker.fields!.some((f) => f.fix?.kind === 'open' && f.fix.itemId === exp.id && f.fix.bulletId)).toBe(true);
    const refused = await exportPdf(blocked.sha256);
    expect(refused.status).toBe(422);
    expect(((await refused.json()) as { code: string }).code).toBe('EXPORT_BLOCKED');

    // « Claude » translates every missing English field it is given (list untranslated), by lots of 25.
    const EN: Record<string, string> = {
      'Stagiaire ingénieure biomédicale': 'Biomedical Engineering Intern',
      'Inventaire du parc de pompes à perfusion et de moniteurs du service de réanimation. Rédaction des procédures de maintenance préventive pour 40 équipements, validées par le responsable biomédical.':
        'Inventory of the infusion pumps and monitors of the intensive care unit. Wrote preventive maintenance procedures for 40 devices, approved by the biomedical manager.',
      "Formation de 15 soignants à l'utilisation des nouveaux pousse-seringues.":
        'Trained 15 caregivers to use the new syringe pumps.',
      'Classe préparatoire MPSI-MP':
        'Classe préparatoire MPSI-MP (undergraduate preparatory classes in mathematics and physics)',
      "Application de suivi d'entraînement": 'Training tracking app',
      'Application mobile personnelle de suivi de course à pied': 'Personal mobile app for tracking running',
      '3 000 séances enregistrées par 25 testeurs': '3,000 sessions recorded by 25 testers',
      'Randonnée en montagne': 'Mountain hiking',
      "Revue des exigences logicielles avec l'équipe système : 120 exigences clarifiées":
        'Reviewed the software requirements with the system team: 120 requirements clarified',
      "Mise en place d'une chaîne CI/CD sous GitLab CI : validation d'une version réduite de 3 jours à 4 heures":
        'Set up a CI/CD pipeline on GitLab CI: release validation reduced from 3 days to 4 hours',
      'Spécialité informatique et santé': 'Major in computer science and health',
      'Scrum Master (certification fictive)': 'Scrum Master (fictitious certification)',
    };
    const rows = (await call('list', { kind: 'untranslated' })).structuredContent!.items as Array<{
      lang: string;
      target: Record<string, string>;
      sourceText: string;
    }>;
    const toTranslate = rows.filter((x) => x.lang === 'en');
    expect(toTranslate.map((x) => x.sourceText).filter((t) => !EN[t])).toEqual([]);
    const proposed: string[] = [];
    for (let i = 0; i < toTranslate.length; i += 25) {
      const r = await call('propose_translation', {
        items: toTranslate.slice(i, i + 25).map((x) => ({ target: x.target, lang: 'en', text: EN[x.sourceText] })),
      });
      const results = r.structuredContent!.results as Array<{
        status: string;
        proposalId?: string;
        reasons?: string[];
      }>;
      expect(results.filter((x) => x.status !== 'created')).toEqual([]);
      proposed.push(...results.map((x) => x.proposalId!));
    }
    // The user accepts the translations in « À valider » (batch: none is a sensitive fact).
    const batch = await send('POST', '/api/proposals/accept-batch', { ids: proposed });
    expect(((await batch.json()) as { accepted: string[] }).accepted).toHaveLength(proposed.length);
    expect(((await call('list', { kind: 'untranslated' })).structuredContent!.items as unknown[]).length).toBe(0);

    // en-GB, A4: the export passes.
    const gb = await render();
    expect(gb.report.blocking).toBe(false);
    expect(gb.fileName).toMatch(/^CV_Camille_Martin_.+_EN\.pdf$/);
    const gbExport = await exportPdf(gb.sha256);
    expect(gbExport.status).toBe(200);

    // en-US: Letter paper and a Resume_ file, the export passes. The Letter page is 50 pt shorter than A4:
    // this CV, filled at 94 % on A4 with the vertical scale of ADR 0020, takes the compact density, as the
    // overflow message suggests.
    await savePreset((p) => {
      p.enVariant = 'en-US';
      p.template.theme.density = 'compacte';
    });
    const us = await render();
    expect(us.report.blocking).toBe(false);
    expect(us.fileName).toMatch(/^Resume_Camille_Martin_.+_EN\.pdf$/);
    const page = (await PDFDocument.load(Buffer.from(us.pdfBase64, 'base64'))).getPage(0).getSize();
    expect([Math.round(page.width), Math.round(page.height)]).toEqual([612, 792]);
    const usExport = await exportPdf(us.sha256);
    expect(usExport.status).toBe(200);
    expect(((await usExport.json()) as { fileName: string }).fileName).toMatch(/^Resume_/);
  });
});
