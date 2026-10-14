// API of lot 2: presets (F-PRE-01/02), live preview of an unsaved draft (F-SEL-06), F-SEL-10 applied
// when a selection proposal is accepted, T-06 on the "debordante" fixture, NF-01 on the new routes.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AtsReport, PresetFile } from '@cv/core';
import { DataStore, installFixture } from '@cv/store';
import { createApp } from '../src/app.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const TOKEN = 'd'.repeat(64);
const API = 'http://127.0.0.1:4311';
const UI = 'http://127.0.0.1:4310';
const RULE = '01JC0FX0000000000000FSE010';

interface Env {
  dir: string;
  app: ReturnType<typeof createApp>;
}
const envs: Env[] = [];

async function setup(persona: string): Promise<Env> {
  const dir = await mkdtemp(path.join(os.tmpdir(), `cv-api2-${persona}-`));
  await installFixture(path.join(ROOT, 'fixtures', 'personas', persona), dir);
  const env = { dir, app: createApp({ store: DataStore.open(dir), token: TOKEN, apiPort: 4311, uiOrigins: [UI] }) };
  envs.push(env);
  return env;
}

let courte: Env;
let debordante: Env;
beforeAll(async () => {
  courte = await setup('courte');
  debordante = await setup('debordante');
});
afterAll(async () => {
  for (const e of envs) await rm(e.dir, { recursive: true, force: true });
});

const get = (env: Env, url: string) => env.app.request(`${API}${url}`, { headers: { 'x-cv-token': TOKEN } });
const send = (env: Env, method: string, url: string, body: unknown = {}) =>
  env.app.request(`${API}${url}`, {
    method,
    headers: { 'content-type': 'application/json', origin: UI, 'x-cv-token': TOKEN },
    body: JSON.stringify(body),
  });

interface RenderBody {
  pages: number;
  fillRatio: number;
  overflowLines: number;
  report: AtsReport;
}
interface PresetBody {
  preset: PresetFile;
  writes: Array<{ file: string; revision: number }>;
}

const presets = async (env: Env) =>
  ((await (await get(env, '/api/presets')).json()) as { presets: PresetFile[] }).presets;
const presetById = async (env: Env, id: string) => (await presets(env)).find((p) => p.id === id)!;
const draftOf = (p: PresetFile) => ({
  lang: p.lang,
  enVariant: p.enVariant,
  template: p.template,
  selection: p.selection,
  options: p.options,
});

describe('aperçu en direct d’un brouillon (F-SEL-06)', () => {
  it('rend le brouillon sans rien écrire', async () => {
    const before = await presetById(courte, 'preset-defaut');
    const draft = draftOf(structuredClone(before));
    draft.selection.include = draft.selection.include.filter((id) => id !== 'exp-labo-2019');
    const res = await send(courte, 'POST', '/api/render', { presetId: 'preset-defaut', draft });
    expect(res.status).toBe(200);
    const r = (await res.json()) as RenderBody;
    expect(r.report.text.pdfjs).not.toContain('Laboratoire');
    const saved = await send(courte, 'POST', '/api/render', { presetId: 'preset-defaut' });
    expect(((await saved.json()) as RenderBody).report.text.pdfjs).toContain('Laboratoire');
    expect((await presetById(courte, 'preset-defaut')).revision).toBe(before.revision);
  });

  it('refuse un brouillon invalide en désignant le champ', async () => {
    const draft = draftOf(await presetById(courte, 'preset-defaut'));
    const res = await send(courte, 'POST', '/api/render', {
      presetId: 'preset-defaut',
      draft: { ...draft, options: { ...draft.options, dateStyle: 'romain' } },
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { details: { issues: Array<{ path: string }> } };
    expect(body.details.issues.map((i) => i.path)).toContain('options.dateStyle');
  });
});

describe('F-SEL-10 à l’acceptation d’une proposition de sélection', () => {
  it('refuse de masquer une expérience entière, accepte la réduction des puces', async () => {
    const seq = JSON.parse(
      await readFile(path.join(ROOT, 'fixtures', 'proposals', '01JC0FX0000000000000SEQ001.json'), 'utf8'),
    ) as Record<string, unknown>;
    const proposal = {
      ...seq,
      id: RULE,
      base: null,
      payload: { add: [], remove: ['exp-labo-2019', 'b-santenum-tests'], variantChoice: {} },
      rationale: {},
      checks: [],
      dependsOn: [],
    };
    await writeFile(path.join(courte.dir, 'proposals', `${RULE}.json`), JSON.stringify(proposal));

    const list = (await (await get(courte, `/api/proposals?ids=${RULE}`)).json()) as {
      proposals: Array<{ selection: Array<{ key: string; applicable: boolean; reason: string | null }> }>;
    };
    const rows = list.proposals[0]!.selection;
    expect(rows.find((r) => r.key === 'remove:exp-labo-2019')).toMatchObject({ applicable: false });
    expect(rows.find((r) => r.key === 'remove:exp-labo-2019')!.reason).toContain('F-SEL-10');
    expect(rows.find((r) => r.key === 'remove:b-santenum-tests')).toMatchObject({ applicable: true });

    const all = await send(courte, 'POST', `/api/proposals/${RULE}/accept`, {});
    expect(all.status).toBe(422);
    const refused = (await all.json()) as { code: string; details: { ids: string[] }; hint: string };
    expect(refused.code).toBe('SELECTION_RULE');
    expect(refused.details.ids).toEqual(['exp-labo-2019']);
    expect((await presetById(courte, 'preset-defaut')).selection.include).toContain('exp-labo-2019');

    const partial = await send(courte, 'POST', `/api/proposals/${RULE}/accept`, {
      elements: ['remove:b-santenum-tests'],
    });
    expect(partial.status).toBe(200);
    const after = await presetById(courte, 'preset-defaut');
    expect(after.selection.include).not.toContain('b-santenum-tests');
    expect(after.selection.include).toContain('exp-labo-2019');
  });
});

describe('presets (F-PRE-01/02)', () => {
  it('crée un preset vierge, le duplique, le renomme, puis l’archive', async () => {
    const created = await send(courte, 'POST', '/api/presets', { name: 'Dev backend' });
    expect(created.status).toBe(201);
    const c = (await created.json()) as PresetBody;
    expect(c.preset).toMatchObject({ id: 'preset-dev-backend', isDefault: false, archived: false, revision: 1 });
    expect(c.preset.fileLabel).toBe('Dev-backend');
    expect(c.preset.selection.include).toEqual([]);
    expect(c.writes.map((w) => w.file)).toEqual(['ids.json', 'presets/preset-dev-backend.json']);

    const source = await presetById(courte, 'preset-defaut');
    const dup = (await (
      await send(courte, 'POST', '/api/presets', { name: 'Qualité DM', from: 'preset-defaut' })
    ).json()) as PresetBody;
    expect(dup.preset.id).toBe('preset-qualite-dm');
    expect(dup.preset.selection).toEqual(source.selection);
    expect(dup.preset.fileLabel).toBe(source.fileLabel);
    expect(dup.preset.isDefault).toBe(false);

    // Rename through a save; id, default flag and archived state cannot change this way.
    const renamed = await send(courte, 'PUT', '/api/presets/preset-qualite-dm', {
      preset: { ...dup.preset, name: 'Qualité / réglementaire DM', id: 'autre', isDefault: true },
      expectedRevision: dup.preset.revision,
    });
    expect(renamed.status).toBe(200);
    const r = (await renamed.json()) as PresetBody;
    expect(r.preset).toMatchObject({ id: 'preset-qualite-dm', name: 'Qualité / réglementaire DM', isDefault: false });
    expect(r.preset.revision).toBe(dup.preset.revision + 1);

    const stale = await send(courte, 'PUT', '/api/presets/preset-qualite-dm', {
      preset: { ...dup.preset, name: 'Ancienne version' },
      expectedRevision: dup.preset.revision,
    });
    expect(stale.status).toBe(409);
    const s = (await stale.json()) as { code: string; details: { current: PresetFile } };
    expect(s.code).toBe('STALE_REVISION');
    expect(s.details.current.name).toBe('Qualité / réglementaire DM');

    const archived = await send(courte, 'POST', '/api/presets/preset-qualite-dm/archive', { archived: true });
    expect(((await archived.json()) as PresetBody).preset.archived).toBe(true);
    expect((await presetById(courte, 'preset-qualite-dm')).archived).toBe(true);
  });

  it('refuse un nom vide ou un emoji, en désignant le champ', async () => {
    for (const name of ['', 'CV \u{1F680}']) {
      const res = await send(courte, 'POST', '/api/presets', { name });
      expect(res.status).toBe(422);
      const body = (await res.json()) as { details: { issues: Array<{ path: string }> } };
      expect(body.details.issues[0]!.path).toBe('name');
    }
  });

  it('un seul preset par défaut ; le preset par défaut ne s’archive pas', async () => {
    const refused = await send(courte, 'POST', '/api/presets/preset-defaut/archive', { archived: true });
    expect(refused.status).toBe(409);
    expect(((await refused.json()) as { code: string }).code).toBe('IS_DEFAULT');

    const archivedDefault = await send(courte, 'POST', '/api/presets/preset-qualite-dm/default', {});
    expect(archivedDefault.status).toBe(409);

    const res = await send(courte, 'POST', '/api/presets/preset-dev-backend/default', {});
    expect(res.status).toBe(200);
    const body = (await res.json()) as PresetBody;
    expect(body.writes.map((w) => w.file).sort()).toEqual([
      'presets/preset-defaut.json',
      'presets/preset-dev-backend.json',
    ]);
    expect((await presets(courte)).filter((p) => p.isDefault).map((p) => p.id)).toEqual(['preset-dev-backend']);
    const archived = await send(courte, 'POST', '/api/presets/preset-defaut/archive', { archived: true });
    expect(archived.status).toBe(200);
  });

  it('NF-01 : 403 sans jeton sur les routes des presets', async () => {
    expect((await courte.app.request(`${API}/api/presets`)).status).toBe(403);
    for (const [method, url] of [
      ['POST', '/api/presets'],
      ['PUT', '/api/presets/preset-defaut'],
      ['POST', '/api/presets/preset-defaut/default'],
    ] as const) {
      const res = await courte.app.request(`${API}${url}`, {
        method,
        headers: { 'content-type': 'application/json', origin: UI },
        body: '{}',
      });
      expect(res.status).toBe(403);
    }
  });
});

describe('T-06 : débordement (fixture debordante)', () => {
  it('jauge au-delà de 100 %, dépassement chiffré, export bloqué avec un message actionnable', async () => {
    const res = await send(debordante, 'POST', '/api/render', { presetId: 'preset-defaut' });
    const r = (await res.json()) as RenderBody;
    expect(r.pages).toBeGreaterThan(1);
    expect(r.fillRatio).toBeGreaterThan(1);
    expect(r.overflowLines).toBeGreaterThan(0);
    expect(r.report.blocking).toBe(true);
    const pages = r.report.criteria.find((c) => c.id === 'T-ATS-01')!;
    expect(pages.status).toBe('red');
    expect(pages.message).toBe(
      `Le CV dépasse d'environ ${r.overflowLines} lignes (${r.pages} pages) : décochez une puce ou passez en densité compacte`,
    );
  });

  it('en densité compacte, le dépassement diminue et le message ne propose plus la densité compacte', async () => {
    const preset = await presetById(debordante, 'preset-defaut');
    const draft = draftOf(structuredClone(preset));
    draft.template.theme.density = 'compacte';
    const r = (await (
      await send(debordante, 'POST', '/api/render', { presetId: 'preset-defaut', draft })
    ).json()) as RenderBody;
    const normal = (await (
      await send(debordante, 'POST', '/api/render', { presetId: 'preset-defaut' })
    ).json()) as RenderBody;
    expect(r.fillRatio).toBeLessThan(normal.fillRatio);
    const pages = r.report.criteria.find((c) => c.id === 'T-ATS-01')!;
    if (pages.status === 'red') expect(pages.message).toContain('la densité compacte est déjà active');
  });
});
