// Selection operations (§12.1 "trois états, conservation de la sélection des enfants, ordres,
// variantes"), T-07 (unchecking then re-checking an experience restores its bullets) and the server
// rule F-SEL-10.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  checkSelectionRule,
  entryTally,
  moveInOrder,
  moveSection,
  plainText,
  project,
  removalViolations,
  sectionTally,
  select,
  setChecked,
  setSectionEnabled,
  setSummary,
  setVariant,
  type Library,
  type PresetFile,
  type Projection,
  type Selection,
} from '@cv/core';
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

const MEDTECH = ['b-medtech-62304', 'b-medtech-cicd', 'b-medtech-risques'];
const medtech = { section: 'experience' as const, itemId: 'exp-medtech-2023', bulletIds: MEDTECH };
const fresh = (): Selection => structuredClone(preset.selection);

function render(selection: Selection): Projection {
  return project(select(snapshot.library, selection), {
    lang: 'fr',
    enVariant: 'en-GB',
    options: preset.options,
    template: preset.template,
    identity: snapshot.profile.identity,
  });
}

const bulletsOf = (p: Projection, id: string) =>
  p.sections
    .find((s) => s.key === 'experience')
    ?.entries.find((e) => e.id === id)
    ?.bullets.map((b) => b.id);

describe('cases à trois états (F-SEL-01, F-SEL-02)', () => {
  it('compte les puces et donne l’état coché, mixte ou décoché', () => {
    const sel = fresh();
    expect(entryTally(sel, 'exp-medtech-2023', MEDTECH)).toEqual({ state: 'checked', checked: 3, total: 3 });
    setChecked(sel, { ...medtech, bulletId: 'b-medtech-cicd' }, false);
    expect(entryTally(sel, 'exp-medtech-2023', MEDTECH)).toEqual({ state: 'mixed', checked: 2, total: 3 });
    setChecked(sel, medtech, false);
    // Unchecked parent: the bullets keep their own state (2/3 retained).
    expect(entryTally(sel, 'exp-medtech-2023', MEDTECH)).toEqual({ state: 'unchecked', checked: 2, total: 3 });
  });

  it('T-07 : décocher puis recocher une expérience restaure ses puces', () => {
    const sel = fresh();
    setChecked(sel, { ...medtech, bulletId: 'b-medtech-cicd' }, false);
    const before = render(sel);
    expect(bulletsOf(before, 'exp-medtech-2023')).toEqual(['b-medtech-62304', 'b-medtech-risques']);

    setChecked(sel, medtech, false);
    expect(bulletsOf(render(sel), 'exp-medtech-2023')).toBeUndefined();
    expect(sel.include).toEqual(expect.arrayContaining(['b-medtech-62304', 'b-medtech-risques']));

    setChecked(sel, medtech, true);
    const after = render(sel);
    expect(bulletsOf(after, 'exp-medtech-2023')).toEqual(['b-medtech-62304', 'b-medtech-risques']);
    expect(after.expected).toEqual(before.expected);
  });

  it('cocher une puce rend visible son entrée, sans ajouter les autres puces', () => {
    const sel = fresh();
    sel.include = sel.include.filter((id) => !['exp-medtech-2023', ...MEDTECH].includes(id));
    setChecked(sel, { ...medtech, bulletId: 'b-medtech-risques' }, true);
    expect(bulletsOf(render(sel), 'exp-medtech-2023')).toEqual(['b-medtech-risques']);
  });

  it('une entrée cochée sans aucune puce retenue reçoit toutes ses puces (ADR 0011)', () => {
    const sel = fresh();
    sel.include = sel.include.filter((id) => !['exp-medtech-2023', ...MEDTECH].includes(id));
    setChecked(sel, medtech, true);
    expect(bulletsOf(render(sel), 'exp-medtech-2023')).toEqual(MEDTECH);
  });

  it('section : décochée masque ses éléments sans les perdre ; cocher un élément active sa section', () => {
    const sel = fresh();
    const projectIds = snapshot.library.projects.map((p) => p.id);
    expect(sectionTally(sel, 'projects', projectIds).state).toBe('unchecked');
    setChecked(sel, { section: 'projects', itemId: 'prj-tracabilite', bulletIds: ['b-tracabilite-export'] }, true);
    expect(sectionTally(sel, 'projects', projectIds)).toEqual({ state: 'checked', checked: 1, total: 1 });
    expect(render(sel).headings).toContain('Projets');

    setSectionEnabled(sel, 'experience', false);
    expect(render(sel).headings).not.toContain('Expérience professionnelle');
    setSectionEnabled(sel, 'experience', true);
    expect(bulletsOf(render(sel), 'exp-medtech-2023')).toEqual(MEDTECH);
  });

  it('accroche : choisie parmi les accroches, elle active la section', () => {
    const sel = fresh();
    setSectionEnabled(sel, 'summary', false);
    expect(render(sel).header.summary).toBeNull();
    setSummary(sel, 'sum-dm');
    expect(render(sel).header.summary).not.toBeNull();
    expect(sectionTally(sel, 'summary', ['sum-dm']).state).toBe('checked');
  });
});

describe('variantes et ordre (F-SEL-03, F-SEL-04)', () => {
  it('choisit la variante d’une puce', () => {
    const sel = fresh();
    setVariant(sel, 'b-medtech-62304', 'courte');
    const text = render(sel).sections[0]!.entries[0]!.bullets[0]!.text;
    expect(plainText(text)).toBe("Conformité IEC 62304 (classe B) d'un logiciel de pompe à perfusion");
  });

  it('↑/↓ d’une puce dans son entrée, avec arrêt aux bords', () => {
    const sel = fresh();
    expect(moveInOrder(sel, 'exp-medtech-2023', MEDTECH, 'b-medtech-risques', -1)).toBe(true);
    expect(bulletsOf(render(sel), 'exp-medtech-2023')).toEqual([
      'b-medtech-62304',
      'b-medtech-risques',
      'b-medtech-cicd',
    ]);
    expect(moveInOrder(sel, 'exp-medtech-2023', sel.order['exp-medtech-2023']!, 'b-medtech-62304', -1)).toBe(false);
  });

  it('↑/↓ d’une compétence reste dans sa catégorie', () => {
    const sel = fresh();
    const lib = snapshot.library;
    const ids = lib.skills.filter((s) => s.category !== 'reglementaire').map((s) => s.id);
    const category = new Map(lib.skills.map((s) => [s.id, s.category]));
    const same = (a: string, b: string) => category.get(a) === category.get(b);
    // sk-git is the first "outils" skill: no step up inside its category.
    expect(moveInOrder(sel, 'skills', ids, 'sk-git', -1, same)).toBe(false);
    expect(moveInOrder(sel, 'skills', ids, 'sk-gitlab-ci', -1, same)).toBe(true);
    const line = render(sel).sections.find((s) => s.key === 'skills')!.lines[1]!;
    expect(line.items.map(plainText)).toEqual(['GitLab CI', 'Git']);
  });

  it('↑/↓ des sections ; l’accroche garde sa place, la ligne Normes est enjambée', () => {
    const sel = fresh();
    // skills-subgroup: regulatory has no place of its own, stepped over.
    expect(moveSection(sel, 'education', -1, ['regulatory'])).toBe(true);
    expect(moveSection(sel, 'education', -1, ['regulatory'])).toBe(true);
    expect(render(sel).headings.slice(0, 2)).toEqual(['Formation', 'Expérience professionnelle']);
    expect(sel.sections.map((s) => s.key).slice(0, 4)).toEqual(['summary', 'education', 'experience', 'regulatory']);
    expect(moveSection(sel, 'regulatory', 1, ['regulatory'])).toBe(false);
    expect(moveSection(sel, 'experience', -1)).toBe(true);
    expect(moveSection(sel, 'experience', -1)).toBe(false);
    expect(moveSection(sel, 'summary', 1)).toBe(false);
  });
});

describe('règle serveur F-SEL-10', () => {
  const lib = (): Library => structuredClone(snapshot.library);

  it('refuse de masquer une expérience entière, accepte de réduire ses puces', () => {
    const base = fresh();
    const reduced = fresh();
    reduced.include = reduced.include.filter((id) => !MEDTECH.includes(id));
    expect(checkSelectionRule(lib(), base, reduced)).toEqual([]);

    const hidden = fresh();
    hidden.include = hidden.include.filter((id) => id !== 'exp-labo-2019');
    expect(checkSelectionRule(lib(), base, hidden).map((v) => [v.code, v.id])).toEqual([
      ['HIDES_EXPERIENCE', 'exp-labo-2019'],
    ]);
    const sectionOff = fresh();
    setSectionEnabled(sectionOff, 'experience', false);
    expect(checkSelectionRule(lib(), base, sectionOff).map((v) => v.id)).toEqual([
      'exp-medtech-2023',
      'exp-santenum-2019',
      'exp-labo-2019',
    ]);
  });

  it('ne décoche jamais un élément verrouillé', () => {
    const library = lib();
    library.skills.find((s) => s.id === 'sk-python')!.locked = true;
    const base = fresh();
    expect(removalViolations(library, base, 'sk-python').map((v) => [v.code, v.id])).toEqual([
      ['UNCHECKS_LOCKED', 'sk-python'],
    ]);
    expect(removalViolations(library, base, 'sk-cpp')).toEqual([]);
    // An element not shown by the base selection can be removed freely.
    const without = fresh();
    without.include = without.include.filter((id) => id !== 'sk-python');
    expect(removalViolations(library, without, 'sk-python')).toEqual([]);
  });
});
