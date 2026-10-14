import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { plainText, project, select, type PresetFile, type Projection, type Selection } from '@cv/core';
import type { Snapshot } from '@cv/store';
import { loadPersona } from './helpers.js';

let snapshot: Snapshot;
let preset: PresetFile;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const p = await loadPersona('courte');
  snapshot = p.snapshot;
  cleanup = p.cleanup;
  preset = snapshot.presets[0]!;
});
afterAll(() => cleanup());

function render(
  selection: Selection = preset.selection,
  over: Partial<{ lang: 'fr' | 'en'; enVariant: 'en-GB' | 'en-US'; options: PresetFile['options'] }> = {},
): Projection {
  return project(select(snapshot.library, selection), {
    lang: over.lang ?? 'fr',
    enVariant: over.enVariant ?? 'en-GB',
    options: over.options ?? preset.options,
    template: preset.template,
    identity: snapshot.profile.identity,
  });
}

const entry = (p: Projection, key: string, id: string) =>
  p.sections.find((s) => s.key === key)?.entries.find((e) => e.id === id);

describe('select et project (§8.5)', () => {
  it('trois états : un parent décoché masque ses puces sans perdre leur sélection', () => {
    const without = { ...preset.selection, include: preset.selection.include.filter((i) => i !== 'exp-medtech-2023') };
    expect(entry(render(without), 'experience', 'exp-medtech-2023')).toBeUndefined();
    // The bullets are still checked: re-checking the parent restores them.
    expect(without.include).toContain('b-medtech-62304');
    expect(entry(render(preset.selection), 'experience', 'exp-medtech-2023')!.bullets.map((b) => b.id)).toEqual([
      'b-medtech-62304',
      'b-medtech-cicd',
      'b-medtech-risques',
    ]);
  });

  it('expériences en ordre antichronologique imposé, puces dans l\u2019ordre demandé', () => {
    const sel = { ...preset.selection, order: { 'exp-medtech-2023': ['b-medtech-risques', 'b-medtech-62304'] } };
    const p = render(sel);
    expect(p.sections.find((s) => s.key === 'experience')!.entries.map((e) => e.id)).toEqual([
      'exp-medtech-2023',
      'exp-santenum-2019',
      'exp-labo-2019',
    ]);
    expect(entry(p, 'experience', 'exp-medtech-2023')!.bullets.map((b) => b.id)).toEqual([
      'b-medtech-risques',
      'b-medtech-62304',
      'b-medtech-cicd',
    ]);
  });

  it('applique la variante choisie et signale une variante inconnue', () => {
    const p = render({
      ...preset.selection,
      variantChoice: { 'b-medtech-62304': 'courte', 'b-medtech-cicd': 'absente' },
    });
    expect(plainText(entry(p, 'experience', 'exp-medtech-2023')!.bullets[0]!.text)).toBe(
      "Conformité IEC 62304 (classe B) d'un logiciel de pompe à perfusion",
    );
    expect(p.warnings.map((w) => w.code)).toContain('UNKNOWN_VARIANT');
  });

  it('langue et enVariant : EN en A4 (en-GB) ou Letter (en-US), libellés traduits', () => {
    const gb = render(preset.selection, { lang: 'en' });
    expect(gb.paper).toBe('a4');
    expect(gb.headings[0]).toBe('Professional Experience');
    expect(gb.header.contacts[0]!.label).toBe('Email:');
    expect(render(preset.selection, { lang: 'en', enVariant: 'en-US' }).paper).toBe('us-letter');
  });

  it('sigle et forme longue (ATS-18) seulement si long est non nul et différent de short', () => {
    const p = render();
    const skills = p.sections.find((s) => s.key === 'skills')!;
    const all = skills.lines.flatMap((l) => l.items.map(plainText));
    expect(all).toContain('IEC 62304 (cycle de vie du logiciel de dispositif médical)');
    expect(all).toContain('Python');
  });

  it('formats de date : numérique, lettres, année seule et « aujourd\u2019hui »', () => {
    expect(entry(render(), 'experience', 'exp-medtech-2023')!.dates).toBe("02/2023 – aujourd'hui");
    const lettres = render(preset.selection, { options: { ...preset.options, dateStyle: 'lettres' } });
    expect(entry(lettres, 'experience', 'exp-santenum-2019')!.dates).toBe('septembre 2019 – janvier 2023');
    const lib = structuredClone(snapshot.library);
    lib.education[0]!.start = '2016';
    lib.education[0]!.end = '2019';
    const p = project(select(lib, preset.selection), {
      lang: 'fr',
      enVariant: 'en-GB',
      options: preset.options,
      template: preset.template,
      identity: snapshot.profile.identity,
    });
    expect(entry(p, 'education', 'edu-ingenieur-2019')!.dates).toBe('2016 – 2019');
    expect(p.warnings.map((w) => w.code)).toContain('MIXED_DATE_PRECISION');
  });

  it('regulatoryPlacement : ligne libellée dans Compétences ou section dédiée', () => {
    const sub = render();
    expect(sub.headings).not.toContain('Normes et réglementation');
    expect(
      sub.sections.find((s) => s.key === 'skills')!.lines.some((l) => l.label === 'Normes et réglementation'),
    ).toBe(true);
    const own = render(preset.selection, { options: { ...preset.options, regulatoryPlacement: 'own-section' } });
    expect(own.headings).toContain('Normes et réglementation');
    expect(
      own.sections.find((s) => s.key === 'skills')!.lines.some((l) => l.label === 'Normes et réglementation'),
    ).toBe(false);
  });

  it('headings = sections actives et non vides, sans summary', () => {
    expect(render().headings).toEqual([
      'Expérience professionnelle',
      'Compétences',
      'Formation',
      'Langues',
      "Centres d'intérêt",
    ]);
    const noLang = { ...preset.selection, include: preset.selection.include.filter((i) => !i.startsWith('lang-')) };
    expect(render(noLang).headings).not.toContain('Langues');
  });

  it('textes attendus champ par champ', () => {
    const p = render();
    const texts = p.expected.map((f) => f.text);
    expect(texts).toContain('Camille Martin');
    expect(texts).toContain('MedTech Exemple SAS, Grenoble, France');
    expect(texts).toContain("02/2023 – aujourd'hui");
    expect(texts).toContain('E-mail : camille.martin@example.com');
    expect(p.datedEntries).toHaveLength(4);
  });

  it('une traduction manquante bloque l\u2019export dans cette langue, avec la cible', () => {
    const lib = structuredClone(snapshot.library);
    lib.experiences[0]!.bullets[0]!.variants[0]!.text.en = null;
    const p = project(select(lib, preset.selection), {
      lang: 'en',
      enVariant: 'en-GB',
      options: preset.options,
      template: preset.template,
      identity: snapshot.profile.identity,
    });
    expect(p.blocking).toHaveLength(1);
    expect(p.blocking[0]).toMatchObject({
      code: 'UNTRANSLATED',
      target: { itemId: 'exp-medtech-2023', bulletId: 'b-medtech-62304' },
    });
  });

  it('une langue sans niveau CECRL bloque l\u2019export', () => {
    const lib = structuredClone(snapshot.library);
    lib.languages[1]!.cefr = null;
    const p = project(select(lib, preset.selection), {
      lang: 'fr',
      enVariant: 'en-GB',
      options: preset.options,
      template: preset.template,
      identity: snapshot.profile.identity,
    });
    expect(p.blocking.map((b) => b.code)).toEqual(['LANGUAGE_LEVEL_MISSING']);
  });

  it('signale une référence orpheline sans échouer', () => {
    const p = render({ ...preset.selection, include: [...preset.selection.include, 'exp-inexistante'] });
    expect(p.warnings.some((w) => w.code === 'ORPHAN_REF' && w.message.includes('exp-inexistante'))).toBe(true);
  });
});
