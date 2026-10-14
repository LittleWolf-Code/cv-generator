import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analysisFile, presetFile, proposalFile, skill, title } from '@cv/core';
import { StoreError, validateDataFile } from '@cv/store';
import { FIXTURES, loadPersona } from './helpers.js';

const readJson = async (p: string) => JSON.parse(await readFile(p, 'utf8')) as Record<string, unknown>;

describe('schéma Zod v1 (§9)', () => {
  it.each(['courte', 'debordante', 'pieges'])('la persona %s est valide après assainissement', async (name) => {
    const { snapshot, cleanup } = await loadPersona(name);
    expect(snapshot.integrity.errors).toEqual([]);
    expect(snapshot.presets).toHaveLength(1);
    await cleanup();
  });

  it('refuse explicitement un schemaVersion inconnu', async () => {
    const raw = await readJson(path.join(FIXTURES, 'personas', 'courte', 'presets', 'preset-defaut.json'));
    expect(() => validateDataFile('presets/preset-defaut.json', presetFile, { ...raw, schemaVersion: 2 })).toThrowError(
      StoreError,
    );
    try {
      validateDataFile('presets/preset-defaut.json', presetFile, { ...raw, schemaVersion: 2 });
    } catch (err) {
      expect((err as StoreError).code).toBe('SCHEMA_VERSION');
    }
  });

  it('exige les 9 sections du §5.3 et un accent contrasté', async () => {
    const raw = (await readJson(path.join(FIXTURES, 'personas', 'courte', 'presets', 'preset-defaut.json'))) as {
      selection: { sections: unknown[] };
      template: { theme: Record<string, unknown> };
    };
    const missing = structuredClone(raw);
    missing.selection.sections = missing.selection.sections.slice(1);
    expect(presetFile.safeParse(missing).success).toBe(false);
    const pale = structuredClone(raw);
    pale.template.theme.accent = '#AACCEE';
    expect(presetFile.safeParse(pale).success).toBe(false);
  });

  it('n\u2019accepte qu\u2019une édition de norme de la table A.2', () => {
    const base = { id: 'std-iec62304', category: 'reglementaire', short: 'IEC 62304', code: 'IEC 62304' };
    expect(skill.safeParse({ ...base, edition: '2006+AMD1:2015' }).success).toBe(true);
    expect(skill.safeParse({ ...base, edition: 'Ed. 2' }).success).toBe(false);
  });

  it('refuse un texte non assaini et une chaîne vide pour une traduction absente', () => {
    const base = { id: 'ttl-x', variants: [{ id: 'principale', text: { fr: 'Titre', en: null } }] };
    expect(presetFile.shape.name.safeParse('Ingénieure').success).toBe(true);
    expect(presetFile.shape.name.safeParse('Ingénieure ' + String.fromCodePoint(0x1f680)).success).toBe(false);
    expect(presetFile.shape.name.safeParse('A' + String.fromCodePoint(0xa0) + 'B').success).toBe(false);
    const empty = structuredClone(base);
    empty.variants[0]!.text.en = '' as unknown as null;
    expect(title.safeParse(base).success).toBe(true);
    expect(title.safeParse(empty).success).toBe(false);
  });

  it('valide les propositions et l\u2019analyse de fixture (lots 1 et 4)', async () => {
    const dir = path.join(FIXTURES, 'proposals');
    for (const f of await readdir(dir)) {
      const parsed = proposalFile.safeParse(await readJson(path.join(dir, f)));
      expect(parsed.success, f).toBe(true);
      if (parsed.success) expect(`${parsed.data.id}.json`).toBe(f);
    }
    expect(
      analysisFile.safeParse(await readJson(path.join(FIXTURES, 'analyses', 'analyse-logiciel-dm.json'))).success,
    ).toBe(true);
  });
});
