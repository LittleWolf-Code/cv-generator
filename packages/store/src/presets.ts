// Presets (§6.3, F-PRE-01/02): create (blank), duplicate, save with the revision read, archive or
// restore, default preset. Every write runs under the single data lock (§8.4) and returns the files
// it changed with their revision, so that the interface ignores its own events (ADR 0009, ADR 0011).
import {
  applyLanguage,
  applyLayout,
  fileNamePart,
  presetFile,
  text,
  truncateAtWord,
  type AvailableLayout,
  type LanguageChoice,
  type PresetFile,
} from '@cv/core';
import { StoreError } from './errors.js';
import { prepare, type WriteRef } from './library.js';
import { blankPreset } from './setup.js';
import { allocateIdIn, type DataStore } from './store.js';

export interface PresetWrite {
  preset: PresetFile;
  writes: WriteRef[];
}

export interface PresetCreated extends PresetWrite {
  /** Effects of the starting language and layout, as the selectors of the interface report them (ADR 0022). */
  changes: { photoUnchecked: boolean; regulatoryPlacement: 'skills-subgroup' | 'own-section' | null };
}

const presetRel = (id: string) => `presets/${id}.json`;

async function readPreset(store: DataStore, id: string): Promise<PresetFile> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || !(await store.exists(presetRel(id)))) {
    throw new StoreError('NOT_FOUND', `preset introuvable : ${id}`);
  }
  return store.read<PresetFile>(presetRel(id));
}

/** `<Libellé>` of the file names (annex B.4) derived from the preset name, `CV` when nothing is left. */
export function fileLabelFromName(name: string): string {
  return truncateAtWord(fileNamePart(name), 40) || 'CV';
}

function validName(input: unknown): string {
  const { value, issues } = prepare(text, input);
  if (value === null) {
    throw new StoreError('INVALID_DATA', 'nom de preset invalide', {
      issues: issues.map((i) => ({ path: 'name', message: i.message })),
    });
  }
  return value;
}

/**
 * Creates a preset: blank (nothing checked), or a copy of `from` (duplicate) with its selection,
 * options, template, language and file label. The id is assigned by the server (`preset-<slug>`) and
 * recorded in ids.json (F-LIB-02). The copy is never the default preset nor archived. `language` and
 * `layout` set the starting language and layout with the rules of the interface selectors
 * (`applyLanguage`, `applyLayout`); create_preset (MCP-22, ADR 0022) is the only caller passing them.
 */
export async function createPreset(
  store: DataStore,
  input: { name: unknown; from?: string | null; language?: LanguageChoice | null; layout?: AvailableLayout | null },
  now = new Date(),
): Promise<PresetCreated> {
  const name = validName(input.name);
  return store.withLock(async () => {
    const source = input.from ? await readPreset(store, input.from) : null;
    const presets = await store.listPresets();
    const registry = await store.readIds();
    const id = allocateIdIn(registry, 'preset', name, now);
    const base = source ?? blankPreset(id, name, fileLabelFromName(name));
    const value = {
      ...structuredClone(base),
      revision: 1,
      id,
      name,
      isDefault: !presets.some((p) => p.isDefault),
      archived: false,
    };
    const photoUnchecked = input.language ? applyLanguage(value, input.language) : false;
    const { regulatoryPlacement } = input.layout ? applyLayout(value, input.layout) : { regulatoryPlacement: null };
    const idsSaved = await store.write('ids.json', registry, { locked: true });
    const saved = await store.write<PresetFile>(presetRel(id), value as PresetFile, { locked: true });
    return {
      preset: saved,
      writes: [
        { file: 'ids.json', revision: idsSaved.revision },
        { file: presetRel(id), revision: saved.revision },
      ],
      changes: { photoUnchecked, regulatoryPlacement },
    };
  });
}

/**
 * Saves a preset edited in the interface (selection, options, language, density, name). The revision
 * read must still be the current one, otherwise 409 STALE_REVISION with the current version. The id,
 * the default flag and the archived state only change through their own actions.
 */
export async function updatePreset(
  store: DataStore,
  id: string,
  input: { preset: unknown; expectedRevision: number },
): Promise<PresetWrite> {
  if (!input.preset || typeof input.preset !== 'object' || Array.isArray(input.preset)) {
    throw new StoreError('INVALID_DATA', 'preset attendu', { issues: [{ path: '', message: 'objet attendu' }] });
  }
  return store.withLock(async () => {
    const current = await readPreset(store, id);
    if (current.revision !== input.expectedRevision) {
      throw new StoreError(
        'STALE_REVISION',
        `le preset « ${current.name} » a été modifié ailleurs depuis son chargement`,
        { file: presetRel(id), currentRevision: current.revision, current },
        'rechargez la version enregistrée, ou gardez vos modifications pour les enregistrer par-dessus',
      );
    }
    const { value, issues } = prepare(presetFile, {
      ...(input.preset as Record<string, unknown>),
      schemaVersion: current.schemaVersion,
      revision: current.revision,
      id: current.id,
      isDefault: current.isDefault,
      archived: current.archived,
    });
    if (value === null) throw new StoreError('INVALID_DATA', 'preset invalide', { issues });
    const saved = await store.write(presetRel(id), value, { expectedRevision: current.revision, locked: true });
    return { preset: saved, writes: [{ file: presetRel(id), revision: saved.revision }] };
  });
}

/** Archives or restores a preset (F-PRE-02). The default preset cannot be archived. */
export async function setPresetArchived(store: DataStore, id: string, archived: boolean): Promise<PresetWrite> {
  return store.withLock(async () => {
    const current = await readPreset(store, id);
    if (archived && current.isDefault) {
      throw new StoreError(
        'IS_DEFAULT',
        "le preset par défaut ne peut pas être archivé : choisissez d'abord un autre preset par défaut",
      );
    }
    if (current.archived === archived) return { preset: current, writes: [] };
    const saved = await store.write(presetRel(id), { ...current, archived }, { locked: true });
    return { preset: saved, writes: [{ file: presetRel(id), revision: saved.revision }] };
  });
}

/** Makes `id` the single default preset (F-PRE-02): the previous default loses the flag. */
export async function setDefaultPreset(store: DataStore, id: string): Promise<PresetWrite> {
  return store.withLock(async () => {
    const target = await readPreset(store, id);
    if (target.archived) {
      throw new StoreError(
        'ARCHIVED',
        "un preset archivé ne peut pas être le preset par défaut : restaurez-le d'abord",
      );
    }
    const writes: WriteRef[] = [];
    let preset = target;
    for (const p of await store.listPresets()) {
      const isDefault = p.id === id;
      if (p.isDefault === isDefault) continue;
      const saved = await store.write(presetRel(p.id), { ...p, isDefault }, { locked: true });
      writes.push({ file: presetRel(p.id), revision: saved.revision });
      if (p.id === id) preset = saved;
    }
    return { preset, writes };
  });
}
