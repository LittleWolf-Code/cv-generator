// Lot 6, English CV (§5.4, F-EXP-03, ADR 0015): spelling controlled by en-GB / en-US, driving licence
// line per variant, Letter paper and Resume_ names, every untranslated field listed with its link, EQF
// level accepted as a code by the guardrails.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildSkillDictionary,
  cvFileName,
  exportBlockers,
  exportWarnings,
  numbersIn,
  project,
  runGuardrails,
  select,
  spellingIssues,
  SPELLING_PAIR_COUNT,
  US_DRIVING_LICENSE,
  type Library,
  type Snapshot,
} from '@cv/core';
import { loadPersona } from './helpers.js';

describe('orthographe selon la variante anglaise (§5.4)', () => {
  it('en-US signale les formes britanniques, avec la forme attendue dans la même casse', () => {
    expect(spellingIssues('Organisation of the Licence programme; optimised modelling', 'en-US')).toEqual([
      { word: 'Organisation', expected: 'Organization' },
      { word: 'Licence', expected: 'License' },
      { word: 'programme', expected: 'program' },
      { word: 'optimised', expected: 'optimized' },
      { word: 'modelling', expected: 'modeling' },
    ]);
  });

  it('en-GB signale les formes américaines, sauf celles qui sont aussi britanniques', () => {
    expect(spellingIssues('organization, center, color, analyzed', 'en-GB')).toEqual([
      { word: 'organization', expected: 'organisation' },
      { word: 'center', expected: 'centre' },
      { word: 'color', expected: 'colour' },
      { word: 'analyzed', expected: 'analysed' },
    ]);
    // « program » (software), « meter » (device), « catalog »: also British.
    expect(spellingIssues('software program, flow meter, analog catalog', 'en-GB')).toEqual([]);
    expect(spellingIssues('driving license', 'en-GB')[0]!.expected).toContain('licence');
  });

  it('ne confond pas « analyses » (pluriel de analysis) ni les mots en -ise communs aux deux', () => {
    expect(spellingIssues('two risk analyses; advise, revise, expertise, enterprise', 'en-US')).toEqual([]);
  });

  it('liste rédigée pour le projet, de plusieurs centaines de formes', () => {
    expect(SPELLING_PAIR_COUNT).toBeGreaterThan(300);
  });
});

describe('projection anglaise', () => {
  let snapshot: Snapshot;
  let cleanup: () => Promise<void>;
  beforeAll(async () => {
    ({ snapshot, cleanup } = await loadPersona('courte'));
  });
  afterAll(() => cleanup());

  const run = (library: Library, enVariant: 'en-GB' | 'en-US', drivingLicense = false) => {
    const preset = snapshot.presets.find((p) => p.isDefault)!;
    return project(select(library, preset.selection), {
      lang: 'en',
      enVariant,
      options: { ...preset.options, drivingLicense },
      template: preset.template,
      identity: snapshot.profile.identity,
    });
  };

  it('en-US : papier Letter, ligne de permis générée « Driver\u2019s license » ; en-GB : texte saisi', () => {
    const us = run(snapshot.library, 'en-US', true);
    expect(us.paper).toBe('us-letter');
    expect(us.expected.map((e) => e.text)).toContain(US_DRIVING_LICENSE);
    const gb = run(snapshot.library, 'en-GB', true);
    expect(gb.paper).toBe('a4');
    expect(gb.expected.map((e) => e.text)).toContain('Full driving licence (category B)');
    expect(gb.expected.map((e) => e.text)).not.toContain(US_DRIVING_LICENSE);
  });

  it('noms de fichiers : CV_ en en-GB, Resume_ en en-US', () => {
    const base = {
      firstName: 'Camille',
      lastName: 'Martin',
      label: 'Ingenieure',
      lang: 'en' as const,
      format: 'pdf' as const,
    };
    expect(cvFileName({ ...base, enVariant: 'en-GB' })).toBe('CV_Camille_Martin_Ingenieure_EN.pdf');
    expect(cvFileName({ ...base, enVariant: 'en-US' })).toBe('Resume_Camille_Martin_Ingenieure_EN.pdf');
  });

  it("l'orthographe de l'autre variante est un avertissement avec sa cible, jamais un blocage", () => {
    const library = structuredClone(snapshot.library);
    const bullet = library.experiences[0]!.bullets[0]!;
    bullet.variants[0]!.text.en = 'Optimised the organisation of 240 automated unit tests';
    const p = run(library, 'en-US');
    expect(p.blocking).toEqual([]);
    const w = p.warnings.filter((x) => x.code === 'SPELLING_VARIANT');
    expect(w).toHaveLength(1);
    expect(w[0]!.target).toMatchObject({ collection: 'experiences', bulletId: bullet.id, variantId: 'principale' });
    const shown = exportWarnings({ projection: p });
    expect(shown[0]!.fields![0]!.detail).toContain('« Optimised » → « Optimized »');
    expect(shown[0]!.fields![0]!.fix).toEqual({
      kind: 'open',
      collection: 'experiences',
      itemId: library.experiences[0]!.id,
      bulletId: bullet.id,
    });
    expect(run(library, 'en-GB').warnings.filter((x) => x.code === 'SPELLING_VARIANT')).toEqual([]);
  });

  it("tous les champs affichés non traduits sont listés, chacun avec son lien, et bloquent l'export EN", () => {
    const library = structuredClone(snapshot.library);
    const exp = library.experiences[0]!;
    exp.position.en = null;
    exp.bullets[0]!.variants[0]!.text.en = null;
    exp.bullets[1]!.variants[0]!.text.en = null;
    library.education[0]!.degree.en = null;
    const p = run(library, 'en-GB');
    const blockers = exportBlockers({ criteria: [], projection: p, lang: 'en' }, 'normale');
    const untranslated = blockers.find((b) => b.code === 'UNTRANSLATED')!;
    expect(untranslated.message).toMatch(/^4 champs affichés non traduits en anglais/);
    expect(untranslated.fields!.map((f) => f.field)).toEqual([
      'intitulé',
      'puce (variante principale)',
      'puce (variante principale)',
      'diplôme',
    ]);
    expect(untranslated.fields!.map((f) => f.fix)).toEqual([
      { kind: 'open', collection: 'experiences', itemId: exp.id },
      { kind: 'open', collection: 'experiences', itemId: exp.id, bulletId: exp.bullets[0]!.id },
      { kind: 'open', collection: 'experiences', itemId: exp.id, bulletId: exp.bullets[1]!.id },
      { kind: 'open', collection: 'education', itemId: library.education[0]!.id },
    ]);
  });
});

describe('garde-fous : repère EQF (§5.4)', () => {
  it("« EQF level 7 » n'est pas un chiffre nouveau ; un autre chiffre l'est", () => {
    expect(numbersIn("Diplôme d'Ingénieur (Master's degree in Engineering, EQF level 7)")).toEqual([]);
    expect(numbersIn('niveau 7 du CEC')).toEqual([]);
    const checks = runGuardrails({
      texts: [{ lang: 'en', text: "Master's degree in Engineering, EQF level 7, 5 years", max: null }],
      sources: [{ lang: 'fr', text: "Diplôme d'ingénieur, Bac+5, grade de master" }],
      dictionary: buildSkillDictionary({ ...({} as Library), skills: [] } as unknown as Library),
    });
    expect(checks.find((c) => c.rule === 'no-new-numbers')).toMatchObject({ ok: true });
  });

  it('longueur : erreur pour Claude, avertissement pour un import déterministe', () => {
    const base = {
      texts: [{ lang: 'fr' as const, text: 'x'.repeat(230), max: 200 }],
      sources: [{ lang: 'fr' as const, text: 'x'.repeat(230) }],
      dictionary: buildSkillDictionary({ skills: [] } as unknown as Library),
    };
    expect(runGuardrails(base).find((c) => c.rule === 'max-length')).toMatchObject({ ok: false, level: 'error' });
    expect(runGuardrails({ ...base, lengthLevel: 'warning' }).find((c) => c.rule === 'max-length')).toMatchObject({
      ok: false,
      level: 'warning',
    });
  });
});
