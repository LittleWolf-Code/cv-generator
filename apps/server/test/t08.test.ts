// T-08 (§12.6, F-MOD-01 to 05, ADR 0017), end to end through the API the interface uses: the visual
// layout exports (PDF, and its one-column DOCX) with the layout warnings and the « lecture humaine » badge,
// the integrity criteria stay green; going back to ats-classique restores its defaults; an application
// has its own theme, a pale accent is refused with its ratio, and the letter takes the font and accent.
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { strFromU8, unzipSync } from 'fflate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  applyLayout,
  exportBlockers,
  HUMAN_READING_NOTICE,
  type ApplicationSelectionFile,
  type AtsReport,
  type PresetFile,
} from '@cv/core';
import { createApplication, DataStore, installFixture, sha256 } from '@cv/store';
import { createApp } from '../src/app.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const TOKEN = 'f'.repeat(64);
const API = 'http://127.0.0.1:4311';
const UI = 'http://127.0.0.1:4310';
const INTEGRITY = [
  'T-ATS-01',
  'T-ATS-02',
  'T-ATS-03',
  'T-ATS-04',
  'T-ATS-09',
  'T-ATS-10',
  'T-ATS-11',
  'T-ATS-12',
  'T-ATS-17',
];

let dir: string;
let out: string;
let app: ReturnType<typeof createApp>;
let applicationId: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'cv-t08-'));
  out = `${dir}-out`;
  await installFixture(path.join(ROOT, 'fixtures', 'personas', 'courte'), dir);
  const store = DataStore.open(dir);
  const created = await createApplication(
    store,
    {
      company: 'ACME Medical',
      jobTitle: 'Ingénieur logiciel dispositifs médicaux H/F',
      lang: 'fr',
      basePresetId: 'preset-defaut',
      offerText: await readFile(path.join(ROOT, 'fixtures', 'offres', 'offre-logiciel-dm.md'), 'utf8'),
    },
    { importDir: null },
  );
  applicationId = created.application.id;
  app = createApp({ store, token: TOKEN, apiPort: 4311, uiOrigins: [UI], outDir: out });
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
  await rm(out, { recursive: true, force: true });
});

const get = (url: string) => app.request(`${API}${url}`, { headers: { 'x-cv-token': TOKEN } });
const send = (method: string, url: string, body: unknown) =>
  app.request(`${API}${url}`, {
    method,
    headers: { 'content-type': 'application/json', origin: UI, 'x-cv-token': TOKEN },
    body: JSON.stringify(body),
  });
const statusOf = (r: AtsReport) => Object.fromEntries(r.criteria.map((c) => [c.id, c.status]));

interface RenderBody {
  sha256: string;
  report: AtsReport;
}
interface ExportBody {
  fileName: string;
  savedTo: string | null;
  sha256: string;
  report: AtsReport;
  fileBase64: string | null;
}

async function editPreset(change: (p: PresetFile) => void): Promise<PresetFile> {
  const { presets } = (await (await get('/api/presets')).json()) as { presets: PresetFile[] };
  const preset = structuredClone(presets.find((p) => p.id === 'preset-defaut')!);
  change(preset);
  const res = await send('PUT', '/api/presets/preset-defaut', { preset, expectedRevision: preset.revision });
  expect(res.status, await res.clone().text()).toBe(200);
  return ((await res.json()) as { preset: PresetFile }).preset;
}

/** What the interface does: preview, then export the buffer shown. */
async function previewAndExport(target: Record<string, string>, format: 'pdf' | 'docx') {
  const shown = (await (await send('POST', '/api/render', target)).json()) as RenderBody;
  const res = await send('POST', '/api/export', { ...target, format, previewSha256: shown.sha256 });
  expect(res.status, await res.clone().text()).toBe(200);
  return { shown, exported: (await res.json()) as ExportBody };
}

describe('T-08 : modèle visuel', () => {
  it('preset passé au visuel : export PDF possible, avertissements de mise en page, badge, intégrité au vert', async () => {
    // The interface switch (applyLayout): the standards go to their own section (§5.3).
    const preset = await editPreset((p) => {
      const change = applyLayout(p, 'visuel', true);
      expect(change).toEqual({ regulatoryPlacement: 'own-section', suggestPhoto: true });
      p.options.photo = true;
    });
    expect(preset.template.layout).toBe('visuel');

    const { shown, exported } = await previewAndExport({ presetId: 'preset-defaut' }, 'pdf');
    expect(shown.report.notice?.badge).toBe(HUMAN_READING_NOTICE);
    expect(exportBlockers(shown.report, 'normale')).toEqual([]);
    const s = statusOf(exported.report);
    for (const id of INTEGRITY) expect(s[id], id).toBe('green');
    expect(s['T-ATS-13']).toBe('green');
    expect(s['T-ATS-06']).toBe('orange');
    expect(s['T-ATS-15']).toBe('na');
    expect(s['T-ATS-16']).toBe('na');
    expect(exported.report.blocking).toBe(false);
    expect(exported.sha256).toBe(shown.sha256);
    expect(exported.fileName).toBe('CV_Camille_Martin_Ingenieure-logiciel-DM_FR.pdf');
    expect(exported.savedTo).toMatch(/\/exports\/preset-defaut\/\d{8}-\d{6}_visuel\/CV_Camille_Martin_/);
    const file = path.join(path.dirname(out), ...exported.savedTo!.split('/'));
    expect(sha256(await readFile(file))).toBe(shown.sha256);
    const trace = JSON.parse(await readFile(path.join(path.dirname(file), 'export.json'), 'utf8')) as Record<
      string,
      unknown
    >;
    expect(trace).toMatchObject({ layout: 'visuel', photo: true });
  });

  it('DOCX du visuel : export possible, une seule colonne, avec sa remarque', async () => {
    const { exported } = await previewAndExport({ presetId: 'preset-defaut' }, 'docx');
    expect(exported.report.notice?.docx).toMatch(/^Le DOCX garde une seule colonne/);
    const doc = strFromU8(unzipSync(Buffer.from(exported.fileBase64!, 'base64'))['word/document.xml']!);
    expect(doc).not.toContain('<w:tbl');
    expect(statusOf(exported.report)['T-DOCX-01']).toBe('green');
    expect(exported.report.blocking).toBe(false);
  }, 60_000);

  it('retour en ATS classique : normes en ligne dans Compétences, plus de badge, tout au vert sauf la photo', async () => {
    await editPreset((p) => {
      expect(applyLayout(p, 'ats-classique').regulatoryPlacement).toBe('skills-subgroup');
    });
    const shown = (await (await send('POST', '/api/render', { presetId: 'preset-defaut' })).json()) as RenderBody;
    expect(shown.report.notice).toBeUndefined();
    for (const c of shown.report.criteria) {
      expect(['green', 'na'].includes(c.status) || (c.id === 'T-ATS-16' && c.status === 'orange'), c.id).toBe(true);
    }
  });

  it('candidature : thème propre, accent trop clair refusé avec son ratio, lettre au thème de la candidature', async () => {
    const detail = (await (await get(`/api/applications/${applicationId}`)).json()) as {
      application: { fileLabel: string; lang: string; enVariant: string };
      selection: ApplicationSelectionFile;
    };
    const put = (template: unknown, expectedRevision: number) =>
      send('PUT', `/api/applications/${applicationId}/selection`, {
        selection: detail.selection.selection,
        options: { ...detail.selection.options, regulatoryPlacement: 'own-section' },
        template,
        lang: detail.application.lang,
        enVariant: detail.application.enVariant,
        fileLabel: detail.application.fileLabel,
        expectedRevision,
      });
    const pale = await put(
      { layout: 'visuel', theme: { font: 'ibm-plex-sans', accent: '#AAAAAA', density: 'normale' } },
      detail.selection.revision,
    );
    expect(pale.status).toBeGreaterThanOrEqual(400);
    expect(await pale.text()).toContain('contraste de 2,3:1 sur blanc, insuffisant (minimum 4,5:1)');
    const ok = await put(
      { layout: 'visuel', theme: { font: 'ibm-plex-sans', accent: '#0B5563', density: 'normale' } },
      detail.selection.revision,
    );
    expect(ok.status, await ok.clone().text()).toBe(200);
    // The preset is unchanged (back in ats-classique, Carlito).
    const { presets } = (await (await get('/api/presets')).json()) as { presets: PresetFile[] };
    expect(presets.find((p) => p.id === 'preset-defaut')!.template).toMatchObject({
      layout: 'ats-classique',
      theme: { font: 'carlito' },
    });

    const cv = (await (await send('POST', '/api/render', { applicationId })).json()) as RenderBody;
    expect(cv.report.notice?.badge).toBe(HUMAN_READING_NOTICE);
    expect(cv.report.criteria.find((c) => c.id === 'T-ATS-09')!.message).toMatch(/IBMPlexSans/);

    const fixture = JSON.parse(
      await readFile(path.join(ROOT, 'fixtures', 'letters', 'lettre-logiciel-dm-fr.json'), 'utf8'),
    );
    const saved = await send('POST', `/api/applications/${applicationId}/letters/fr`, {
      recipient: fixture.recipient,
      paragraphs: fixture.paragraphs,
      sourceIds: fixture.sourceIds,
    });
    expect(saved.status, await saved.clone().text()).toBe(201);
    const letter = (await (
      await send('POST', '/api/letters/render', { applicationId, lang: 'fr', version: 1 })
    ).json()) as RenderBody & { pages: number };
    expect(letter.pages).toBe(1);
    const t09 = letter.report.criteria.find((c) => c.id === 'T-ATS-09')!;
    expect(t09.status).toBe('green');
    expect(t09.message).toMatch(/IBMPlexSans/);
    expect(letter.report.notice).toBeUndefined();
  });
});
