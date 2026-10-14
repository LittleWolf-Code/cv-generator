// T-07 (§12.6, F-SEL-02, F-PRO-03, F-PRO-04), end to end through the API the interface uses: unchecking then
// re-checking an experience restores its bullets in the rendered CV; an accepted rephrasing becomes a new
// variant without touching the original; a proposal whose bullet changed is `stale` and shows the conflict
// in three columns (base, current, proposed).
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setChecked, type AtsReport, type Library, type PresetFile } from '@cv/core';
import { DataStore, installFixture } from '@cv/store';
import { createApp } from '../src/app.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const TOKEN = 'd'.repeat(64);
const API = 'http://127.0.0.1:4311';
const UI = 'http://127.0.0.1:4310';
const VARIANT = '01JC0FX0000000000000VAR001';
const STALE = '01JC0FX0000000000000STA001';
const MEDTECH = { section: 'experience' as const, itemId: 'exp-medtech-2023' };
const BULLET = "Mise en conformité IEC 62304 (classe B) du logiciel d'une pompe à";

let dir: string;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'cv-t07-'));
  await installFixture(path.join(ROOT, 'fixtures', 'personas', 'courte'), dir);
  for (const id of [VARIANT, STALE]) {
    await copyFile(path.join(ROOT, 'fixtures', 'proposals', `${id}.json`), path.join(dir, 'proposals', `${id}.json`));
  }
  app = createApp({ store: DataStore.open(dir), token: TOKEN, apiPort: 4311, uiOrigins: [UI] });
});
afterAll(() => rm(dir, { recursive: true, force: true }));

const get = (url: string) => app.request(`${API}${url}`, { headers: { 'x-cv-token': TOKEN } });
const send = (method: string, url: string, body: unknown = {}) =>
  app.request(`${API}${url}`, {
    method,
    headers: { 'content-type': 'application/json', origin: UI, 'x-cv-token': TOKEN },
    body: JSON.stringify(body),
  });

async function editPreset(change: (p: PresetFile) => void): Promise<PresetFile> {
  const { presets } = (await (await get('/api/presets')).json()) as { presets: PresetFile[] };
  const preset = structuredClone(presets.find((p) => p.id === 'preset-defaut')!);
  change(preset);
  const res = await send('PUT', '/api/presets/preset-defaut', { preset, expectedRevision: preset.revision });
  expect(res.status, await res.clone().text()).toBe(200);
  return ((await res.json()) as { preset: PresetFile }).preset;
}
const renderedText = async () =>
  ((await (await send('POST', '/api/render', { presetId: 'preset-defaut' })).json()) as { report: AtsReport }).report
    .text.pdfjs;
const bullet = async (id: string) => {
  const { library } = (await (await get('/api/library')).json()) as { library: Library };
  return library.experiences.find((e) => e.id === 'exp-medtech-2023')!.bullets.find((b) => b.id === id)!;
};

describe('T-07 : non-destruction', () => {
  it('décocher puis recocher une expérience restaure ses puces', async () => {
    const before = await renderedText();
    expect(before).toContain(BULLET);
    const unchecked = await editPreset((p) => setChecked(p.selection, MEDTECH, false));
    expect(await renderedText()).not.toContain(BULLET);
    // The bullets keep their own state while the experience is hidden.
    expect(unchecked.selection.include).toEqual(expect.arrayContaining(['b-medtech-62304', 'b-medtech-risques']));
    await editPreset((p) => setChecked(p.selection, MEDTECH, true));
    expect(await renderedText()).toBe(before);
  });

  it('une reformulation acceptée crée une variante sans toucher à l’original', async () => {
    const original = structuredClone(await bullet('b-medtech-62304'));
    const res = await send('POST', `/api/proposals/${VARIANT}/accept`);
    expect(res.status, await res.clone().text()).toBe(200);
    const after = await bullet('b-medtech-62304');
    expect(after.variants).toHaveLength(original.variants.length + 1);
    expect(after.variants.slice(0, original.variants.length)).toEqual(original.variants);
    expect(after.variants.at(-1)).toMatchObject({
      id: 'acme-tracabilite',
      text: { fr: expect.stringContaining('traçabilité des exigences'), en: null },
    });
  });

  it('une proposition devenue « stale » affiche le conflit en trois colonnes', async () => {
    const { proposals } = (await (await get(`/api/proposals?ids=${STALE}`)).json()) as {
      proposals: Array<{
        id: string;
        status: string;
        conflict: { base: unknown[] | null; current: unknown[] | null; proposed: unknown[] } | null;
      }>;
    };
    const p = proposals.find((x) => x.id === STALE)!;
    expect(p.status).toBe('stale');
    expect(p.conflict?.base?.length).toBeGreaterThan(0);
    expect(p.conflict?.current?.length).toBeGreaterThan(0);
    expect(p.conflict?.proposed.length).toBeGreaterThan(0);
    expect(JSON.stringify(p.conflict!.base)).not.toBe(JSON.stringify(p.conflict!.current));
  });
});
