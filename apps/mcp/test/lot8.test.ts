// MCP tools of lot 8 through an in-memory client (§12.4, F-MOD-03, ADR 0017), on a temporary copy of the
// fictitious fixtures: render, preview_selection and check_ats with layout visuel (schemas, the badge and
// the orange layout criteria in the response, integrity criteria green, no contact detail, the neutral
// photo only, nothing written in the validated content, no write at all for preview_selection), and the
// export trace of a visual render saved to an application.
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HUMAN_READING_NOTICE, VISUAL_DOCX_NOTICE } from '@cv/core';
import { placeholderPhoto } from '@cv/render';
import { createApplication, DataStore, installFixture } from '@cv/store';
import { createCvServer } from '../src/server.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SECRETS = ['camille.martin@example.com', '06 39 98 12 34', '0639981234'];
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

let tmp: string;
let dataDir: string;
let client: Client;
let applicationId: string;

type Criterion = { id: string; status: string; label: string };
type Summary = { blocking: boolean; criteria: Criterion[]; notice: { badge: string; docx: string | null } | null };
type Res = {
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  content: Array<{ type: string; text?: string }>;
};
const call = async (name: string, args: Record<string, unknown> = {}) =>
  (await client.callTool({ name, arguments: args })) as Res;
const textOf = (r: Res) => r.content.map((c) => c.text ?? '').join('\n');
const summaryOf = (r: Res) => r.structuredContent!.atsReport as Summary;
const status = (s: Summary) => Object.fromEntries(s.criteria.map((c) => [c.id, c.status]));
const noSecrets = (r: Res) => {
  const s = JSON.stringify(r);
  for (const secret of SECRETS) expect(s).not.toContain(secret);
};

async function hashTree(...roots: string[]): Promise<string> {
  const h = createHash('sha256');
  const walk = async (rel: string) => {
    for (const e of (await readdir(path.join(dataDir, rel), { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const r = path.join(rel, e.name);
      if (e.isDirectory()) await walk(r);
      else if (!e.name.endsWith('.lock')) h.update(r).update(await readFile(path.join(dataDir, r)));
    }
  };
  for (const r of roots) await walk(r);
  return h.digest('hex');
}
const hashValidated = async () =>
  (await hashTree('library', 'presets')) +
  createHash('sha256')
    .update(await readFile(path.join(dataDir, 'profile.json')))
    .digest('hex');

beforeAll(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'cv-lot8-'));
  dataDir = path.join(tmp, 'data');
  await installFixture(path.join(ROOT, 'fixtures', 'personas', 'courte'), dataDir);
  const store = DataStore.open(dataDir);
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
  // The application diverges from its preset (theme at the application level, ADR 0017): visual layout,
  // Source Sans 3, photo checked. Written as the interface would, before the server starts.
  const file = path.join(dataDir, 'applications', applicationId, 'selection.json');
  const sel = JSON.parse(await readFile(file, 'utf8'));
  sel.template = { layout: 'visuel', theme: { font: 'source-sans-3', accent: '#7B2C3F', density: 'normale' } };
  sel.options.photo = true;
  sel.options.regulatoryPlacement = 'own-section';
  await writeFile(file, JSON.stringify(sel));

  const server = createCvServer({ dataDir, outDir: path.join(tmp, 'out'), importDir: null, uiPort: 4310 });
  const [c, s] = InMemoryTransport.createLinkedPair();
  await server.connect(s);
  client = new Client({ name: 'cv-lot8', version: '0.0.0' });
  await client.connect(c);
});
afterAll(async () => {
  await client.close();
  await rm(tmp, { recursive: true, force: true });
});

describe('render en visuel (MCP-19)', () => {
  it('layout visuel sur un preset ATS : badge, orange de mise en page, intégrité au vert, rien d’écrit dans le contenu validé', async () => {
    const before = await hashValidated();
    const r = await call('render', { target: { presetId: 'preset-defaut' }, layout: 'visuel' });
    expect(r.isError, textOf(r)).toBeFalsy();
    const s = summaryOf(r);
    expect(s.notice).toEqual({ badge: HUMAN_READING_NOTICE, docx: null });
    expect(s.blocking).toBe(false);
    for (const id of INTEGRITY) expect(status(s)[id], id).toBe('green');
    expect(status(s)['T-ATS-06']).toBe('orange');
    expect(status(s)['T-ATS-15']).toBe('na');
    expect(textOf(r)).toContain('modèle visuel : destiné à une lecture humaine, déconseillé pour les portails ATS');
    noSecrets(r);
    expect(await hashValidated()).toBe(before);
    // The preset keeps its layout: the visual one was only requested for this render.
    const preset = JSON.parse(await readFile(path.join(dataDir, 'presets', 'preset-defaut.json'), 'utf8'));
    expect(preset.template.layout).toBe('ats-classique');
  });

  it('candidature en visuel avec photo : image neutre seulement, export tracé avec le modèle et ses avertissements', async () => {
    const photo = await readFile(path.join(dataDir, 'assets', 'photo.jpg'));
    const grey = Buffer.from(await placeholderPhoto());
    const r = await call('render', { target: { applicationId }, saveToApplication: true });
    expect(r.isError, textOf(r)).toBeFalsy();
    const data = r.structuredContent as { absolutePath: string; savedToApplication: string; atsReport: Summary };
    expect(data.atsReport.notice?.badge).toBe(HUMAN_READING_NOTICE);
    const bytes = await readFile(data.absolutePath);
    expect(bytes.includes(photo.subarray(100, 400))).toBe(false);
    expect(bytes.includes(grey.subarray(100, 400))).toBe(true);
    expect(data.savedToApplication).toMatch(/exports\/\d{8}-\d{6}(?:-\d+)?_visuel\/CV_Camille_Martin_/);
    const app = await DataStore.open(dataDir).loadApplication(applicationId);
    expect(app.application.exports.at(-1)).toMatchObject({
      layout: 'visuel',
      atsCheck: 'avertissements',
      format: 'pdf',
    });
    expect(JSON.stringify(r)).not.toContain(photo.toString('base64').slice(400, 480));
    noSecrets(r);
  });

  it('DOCX du visuel : une colonne, avec sa remarque et l’avertissement de police', async () => {
    const r = await call('render', { target: { applicationId }, format: 'docx' });
    expect(r.isError, textOf(r)).toBeFalsy();
    const s = summaryOf(r);
    expect(s.notice).toEqual({ badge: HUMAN_READING_NOTICE, docx: VISUAL_DOCX_NOTICE });
    expect(status(s)['T-DOCX-01']).toBe('green');
    expect(status(s)['T-DOCX-03']).toBe('orange');
    expect(s.criteria.find((c) => c.id === 'T-DOCX-03')).toMatchObject({ label: 'Pagination DOCX' });
    noSecrets(r);
  }, 60_000);

  it('refuse un modèle non disponible (ats-moderne, V2)', async () => {
    const r = await call('render', { target: { presetId: 'preset-defaut' }, layout: 'ats-moderne' });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toMatch(/layout/);
  });
});

describe('preview_selection et check_ats en visuel (MCP-11, MCP-20)', () => {
  it('preview_selection : aucune écriture, badge, coût des puces, 1 page', async () => {
    const app = await call('get_application', { applicationId });
    const selection = (app.structuredContent as { selection: { selection: unknown } }).selection.selection;
    const before = await hashTree('.');
    const r = await call('preview_selection', { target: { applicationId }, selection, layout: 'visuel' });
    expect(r.isError, textOf(r)).toBeFalsy();
    const data = r.structuredContent as { pages: number; bulletCosts: unknown[]; atsReport: Summary };
    expect(data.pages).toBe(1);
    expect(data.bulletCosts.length).toBeGreaterThan(0);
    expect(data.atsReport.notice?.badge).toBe(HUMAN_READING_NOTICE);
    for (const id of INTEGRITY) expect(status(data.atsReport)[id], id).toBe('green');
    expect(textOf(r)).toContain('Tient sur 1 page');
    noSecrets(r);
    expect(await hashTree('.')).toBe(before);
  });

  it('check_ats : layout visuel accepté, texte masqué, badge dans le rapport', async () => {
    const r = await call('check_ats', { target: { presetId: 'preset-defaut' }, layout: 'visuel' });
    expect(r.isError, textOf(r)).toBeFalsy();
    const s = summaryOf(r);
    expect(s.notice?.badge).toBe(HUMAN_READING_NOTICE);
    expect(s.criteria.find((c) => c.id === 'T-ATS-17')!.label).toBe('Gabarit conforme (intégrité)');
    expect((r.structuredContent as { text: string }).text).toContain('{{email}}');
    noSecrets(r);
    // Without a layout, the preset is checked in its own layout (ATS): no badge.
    const ats = await call('check_ats', { target: { presetId: 'preset-defaut' } });
    expect(summaryOf(ats).notice).toBeNull();
  });
});
