// MCP-22 create_preset (ADR 0022) through an in-memory client, on a temporary copy of the fictitious
// fixtures: blank preset and copy, starting language and layout with the rules of the interface,
// expected refusals without any write, no other preset nor validated content changed, then the content
// of the new preset through propose_selection, accepted as in the interface.
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PresetFile, Selection } from '@cv/core';
import { acceptProposal, DataStore, installFixture, updatePreset } from '@cv/store';
import { createCvServer } from '../src/server.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SECRETS = ['camille.martin@example.com', '06 39 98 12 34', '0639981234', '+33 6 39 98 12 34'];

let tmp: string;
let dataDir: string;
let store: DataStore;
let client: Client;
let before: Record<string, string>;

type Res = {
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  content: Array<{ type: string; text?: string }>;
};
type Created = {
  presetId: string;
  name: string;
  revision: number;
  lang: string;
  enVariant: string;
  layout: string;
  fileLabel: string;
  isDefault: boolean;
  duplicatedFrom: string | null;
  checked: number;
  notes: string[];
};
const call = async (name: string, args: Record<string, unknown> = {}) =>
  (await client.callTool({ name, arguments: args })) as Res;
const data = <T>(r: Res) => r.structuredContent as T;
const textOf = (r: Res) => r.content.map((c) => c.text ?? '').join('\n');
const errorCode = (r: Res) => (r.isError ? (r.structuredContent as { code: string }).code : null);
const noSecrets = (r: Res) => {
  const s = JSON.stringify(r);
  for (const secret of SECRETS) expect(s).not.toContain(secret);
};
const presetFiles = async () => (await readdir(path.join(dataDir, 'presets'))).sort();

/** Hash of the validated content that create_preset must never change: library, profile, existing preset. */
async function hashValidated(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const hash = async (rel: string) => {
    out[rel] = createHash('sha256')
      .update(await readFile(path.join(dataDir, rel)))
      .digest('hex');
  };
  for (const f of await readdir(path.join(dataDir, 'library'))) await hash(path.join('library', f));
  await hash('profile.json');
  await hash(path.join('presets', 'preset-defaut.json'));
  return out;
}

beforeAll(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'cv-mcp-preset-'));
  dataDir = path.join(tmp, 'data');
  await installFixture(path.join(ROOT, 'fixtures', 'personas', 'courte'), dataDir);
  await mkdir(path.join(tmp, 'out'));
  store = DataStore.open(dataDir);
  // The photo is checked on the default preset, so that a copy in English shows the rule of the interface.
  const p = await store.read<PresetFile>('presets/preset-defaut.json');
  await updatePreset(store, 'preset-defaut', {
    preset: { ...p, options: { ...p.options, photo: true } },
    expectedRevision: p.revision,
  });
  const server = createCvServer({ dataDir, outDir: path.join(tmp, 'out'), uiPort: 4310 });
  const [c, s] = InMemoryTransport.createLinkedPair();
  await server.connect(s);
  client = new Client({ name: 'cv-test-preset', version: '0.0.0' });
  await client.connect(c);
  before = await hashValidated();
});
afterAll(async () => {
  await client.close();
  await rm(tmp, { recursive: true, force: true });
});

describe('create_preset (MCP-22, ADR 0022)', () => {
  it('crée un preset vide : identifiant attribué par le serveur, rien de coché, preset par défaut inchangé', async () => {
    const r = await call('create_preset', { name: 'Dev backend' });
    expect(r.isError).toBeFalsy();
    noSecrets(r);
    expect(data<Created>(r)).toEqual({
      presetId: 'preset-dev-backend',
      name: 'Dev backend',
      revision: 1,
      lang: 'fr',
      enVariant: 'en-GB',
      layout: 'ats-classique',
      fileLabel: 'Dev-backend',
      isDefault: false,
      duplicatedFrom: null,
      checked: 0,
      notes: [],
    });
    expect(textOf(r)).toMatch(/vide, rien de coché/);
    expect(textOf(r)).toMatch(/propose_selection avec baseRevision 1/);

    const read = data<{ preset: PresetFile }>(await call('get_preset', { presetId: 'preset-dev-backend' }));
    expect(read.preset).toMatchObject({ id: 'preset-dev-backend', revision: 1, isDefault: false, archived: false });
    expect(read.preset.selection.include).toEqual([]);
    const ids = JSON.parse(await readFile(path.join(dataDir, 'ids.json'), 'utf8')) as Record<string, unknown>;
    expect(JSON.stringify(ids)).toContain('preset-dev-backend');
    expect(await hashValidated()).toEqual(before);
  });

  it('copie un preset en anglais (en-US) et en modèle visuel, avec les règles des sélecteurs de l’interface', async () => {
    const source = await store.read<PresetFile>('presets/preset-defaut.json');
    const r = await call('create_preset', {
      name: 'Software engineer US',
      from: 'preset-defaut',
      language: 'en-US',
      layout: 'visuel',
    });
    expect(r.isError).toBeFalsy();
    noSecrets(r);
    const c = data<Created>(r);
    expect(c).toMatchObject({
      presetId: 'preset-software-engineer-us',
      lang: 'en',
      enVariant: 'en-US',
      layout: 'visuel',
      isDefault: false,
      duplicatedFrom: 'preset-defaut',
      checked: source.selection.include.length,
    });
    expect(c.notes).toEqual([
      "Photo décochée pour l'anglais (peu d'usage hors de France) : l'utilisateur peut la recocher dans l'interface.",
      '« Normes et réglementation » passe en section dédiée (défaut du modèle visuel).',
    ]);
    expect(textOf(r)).toMatch(/destiné à une lecture humaine, déconseillé pour les portails ATS/);

    const copy = await store.read<PresetFile>('presets/preset-software-engineer-us.json');
    expect(copy.selection).toEqual(source.selection);
    expect(copy.fileLabel).toBe(source.fileLabel);
    expect(copy.template.theme).toEqual(source.template.theme);
    expect(copy.options).toMatchObject({ photo: false, regulatoryPlacement: 'own-section' });
    // The source keeps its language, layout and photo.
    expect(await hashValidated()).toEqual(before);
  });

  it('refuse un preset source inconnu, un chemin ou un nom invalide, sans rien écrire', async () => {
    const files = await presetFiles();
    const ids = await readFile(path.join(dataDir, 'ids.json'), 'utf8');
    for (const from of ['preset-inconnu', '../library/experiences']) {
      const r = await call('create_preset', { name: 'Copie', from });
      expect(errorCode(r)).toBe('NOT_FOUND');
    }
    for (const name of ['', '   ', 'CV \u{1F680}']) {
      const r = await call('create_preset', { name });
      expect(errorCode(r), JSON.stringify(name)).toBe('INVALID_DATA');
    }
    expect(await presetFiles()).toEqual(files);
    expect(await readFile(path.join(dataDir, 'ids.json'), 'utf8')).toBe(ids);
    expect(await hashValidated()).toEqual(before);
  });

  it('remplit le nouveau preset par preview_selection puis propose_selection, accepté comme dans l’interface', async () => {
    const created = data<Created>(await call('create_preset', { name: 'Qualité DM' }));
    const { preset } = data<{ preset: PresetFile }>(await call('get_preset', { presetId: created.presetId }));
    const selection: Selection = {
      ...preset.selection,
      include: ['exp-medtech-2023', 'b-medtech-62304', 'b-medtech-risques', 'std-iso13485', 'std-iso14971'],
    };

    const preview = await call('preview_selection', { target: { presetId: created.presetId }, selection });
    expect(preview.isError).toBeFalsy();
    expect(data<{ pages: number }>(preview).pages).toBe(1);

    const proposed = await call('propose_selection', {
      target: { presetId: created.presetId },
      selection,
      baseRevision: created.revision,
    });
    expect(proposed.isError).toBeFalsy();
    const p = data<{ proposalId: string; delta: { add: string[]; remove: string[] } }>(proposed);
    expect(p.delta.add).toEqual(selection.include);
    expect(p.delta.remove).toEqual([]);
    // Nothing applied before the user accepts.
    expect((await store.read<PresetFile>(`presets/${created.presetId}.json`)).selection.include).toEqual([]);

    await acceptProposal(store, p.proposalId);
    const after = await store.read<PresetFile>(`presets/${created.presetId}.json`);
    expect(after.selection.include).toEqual(expect.arrayContaining(selection.include));
    expect(await hashValidated()).toEqual(before);
  });
});
