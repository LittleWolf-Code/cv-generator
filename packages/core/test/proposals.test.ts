// Pure functions of the proposals queue (§6.9) and of the library editor: word diff, canonical JSON,
// ATS-22 warnings, application of each proposal type without ever overwriting validated text.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  applyLibraryProposal,
  applySelectionDelta,
  canonicalJson,
  describeTarget,
  entryWarnings,
  isSensitive,
  newVariantId,
  openCategoryProposals,
  proposalFile,
  ProposalError,
  proposalSubject,
  requiredCategory,
  selectionElements,
  wordDiff,
  type Experience,
  type Library,
  type ProposalFile,
} from '@cv/core';
import { loadPersona } from './helpers.js';

let library: Library;
let cleanup: () => Promise<void>;
beforeAll(async () => {
  const persona = await loadPersona('courte');
  library = persona.snapshot.library;
  cleanup = persona.cleanup;
});
afterAll(() => cleanup());

const common = {
  schemaVersion: 1,
  revision: 1,
  id: '01JC0FX0000000000000TST001',
  status: 'pending',
  origin: 'claude',
  source: 'offre',
  createdAt: '2026-10-05T10:00:00',
  base: null,
  rationale: 'test',
};
const proposal = (p: Record<string, unknown>): ProposalFile => proposalFile.parse({ ...common, ...p });
const bullet = (lib: Library, id: string) => lib.experiences.flatMap((e) => e.bullets).find((b) => b.id === id)!;

describe('diff mot à mot (F-PRO-02)', () => {
  it('marque les mots supprimés et ajoutés, garde les blancs', () => {
    const d = wordDiff('traçabilité exigences-tests, 240 tests', 'traçabilité des exigences jusqu’aux 240 tests');
    expect(d.filter((s) => s.op === 'del').map((s) => s.text.trim())).toEqual(['exigences-tests,']);
    expect(d.at(-1)).toEqual({ op: 'eq', text: '240 tests' });
    expect(
      d
        .filter((s) => s.op !== 'ins')
        .map((s) => s.text)
        .join(''),
    ).toBe('traçabilité exigences-tests, 240 tests');
    expect(
      d
        .filter((s) => s.op !== 'del')
        .map((s) => s.text)
        .join(''),
    ).toBe('traçabilité des exigences jusqu’aux 240 tests');
  });

  it('un texte absent devient un ajout complet', () => {
    expect(wordDiff(null, 'Docker')).toEqual([{ op: 'ins', text: 'Docker' }]);
  });
});

describe('JSON canonique', () => {
  it("ne dépend pas de l'ordre des clés", () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: null } })).toBe(
      canonicalJson({ a: { c: null, d: [1, { x: 1, y: 2 }] }, b: 1 }),
    );
  });
});

describe('avertissements ATS-22', () => {
  it('signale un intitulé abrégé et une organisation réduite à un sigle', () => {
    const w = entryWarnings('experiences', {
      position: { fr: 'Ing. logiciel', en: 'Sr Dev' },
      organization: 'CEA',
    });
    expect(w.map((x) => x.path)).toEqual(['position.fr', 'position.en', 'organization']);
    expect(w[0]!.message).toMatch(/« Ing\. »/);
  });

  it("n'avertit pas pour un intitulé complet", () => {
    expect(
      entryWarnings('experiences', {
        position: { fr: 'Ingénieure logiciel embarqué', en: 'DevOps Engineer' },
        organization: 'MedTech Exemple SAS',
      }),
    ).toEqual([]);
  });
});

describe('application des propositions (F-PRO-03)', () => {
  const variant = (text: { fr: string | null; en: string | null }, label: string | null = 'acme') =>
    proposal({
      type: 'variant',
      target: { collection: 'experiences', itemId: 'exp-medtech-2023', bulletId: 'b-medtech-62304' },
      payload: { label, text },
    });

  it('une reformulation devient une nouvelle variante, sans toucher aux autres', () => {
    const before = structuredClone(bullet(library, 'b-medtech-62304'));
    const r = applyLibraryProposal(library, variant({ fr: 'Nouvelle formulation', en: null }));
    const after = (r.items as Experience[]).flatMap((e) => e.bullets).find((b) => b.id === 'b-medtech-62304')!;
    expect(after.variants.slice(0, before.variants.length)).toEqual(before.variants);
    expect(after.variants.at(-1)).toEqual({
      id: 'acme',
      label: 'acme',
      text: { fr: 'Nouvelle formulation', en: null },
    });
    expect(r.finalValue).toMatchObject({ variantId: 'acme' });
    // The library passed in is untouched (pure function).
    expect(bullet(library, 'b-medtech-62304')).toEqual(before);
  });

  it('identifiant de variante unique et dérivé du libellé', () => {
    expect(newVariantId('ACME : traçabilité', ['principale'])).toBe('acme-tracabilite');
    expect(newVariantId('courte', ['principale', 'courte'])).toBe('courte-2');
    expect(newVariantId(null, [])).toBe('variante');
  });

  it("une variante identique à l'existant n'est pas dupliquée (acceptation idempotente)", () => {
    const text = bullet(library, 'b-medtech-62304').variants[0]!.text;
    const r = applyLibraryProposal(library, variant(text));
    expect(r.changed).toBe(false);
    expect(r.finalValue).toMatchObject({ variantId: 'principale' });
  });

  it('une traduction remplit un champ vide et ne remplace jamais une traduction existante', () => {
    const lib = structuredClone(library);
    bullet(lib, 'b-medtech-cicd').variants[0]!.text.en = null;
    const t = proposal({
      type: 'translation',
      target: {
        collection: 'experiences',
        itemId: 'exp-medtech-2023',
        bulletId: 'b-medtech-cicd',
        variantId: 'principale',
        field: 'text',
      },
      payload: { lang: 'en', text: 'Set up a pipeline' },
    });
    const r = applyLibraryProposal(lib, t);
    expect((r.items as Experience[])[0]!.bullets[1]!.variants[0]!.text.en).toBe('Set up a pipeline');
    expect(() => applyLibraryProposal(library, t)).toThrowError(/déjà traduit/);
  });

  it('une modification (fait sensible) change le champ visé', () => {
    const e = proposal({
      type: 'edit',
      target: { collection: 'experiences', itemId: 'exp-santenum-2019', field: 'organization' },
      payload: {
        field: 'organization',
        oldValue: 'Santé Numérique Fictive',
        newValue: 'Santé Numérique Fictive SAS',
        sensitive: false,
      },
    });
    expect(isSensitive(e)).toBe(true);
    const r = applyLibraryProposal(library, e);
    expect((r.items as Experience[]).find((x) => x.id === 'exp-santenum-2019')!.organization).toBe(
      'Santé Numérique Fictive SAS',
    );
    expect(() =>
      applyLibraryProposal(library, proposal({ ...e, payload: { ...(e.payload as object), field: 'bullets' } })),
    ).toThrowError(ProposalError);
  });

  it('un alias est ajouté une seule fois', () => {
    const a = proposal({
      type: 'alias',
      target: { collection: 'skills', itemId: 'sk-python', field: 'aliases' },
      payload: { skillId: 'sk-python', alias: 'Python 3', kind: 'alias' },
    });
    const r = applyLibraryProposal(library, a);
    expect((r.items as Library['skills']).find((s) => s.id === 'sk-python')!.aliases).toEqual(['Python 3']);
    const again = applyLibraryProposal({ ...library, skills: r.items as Library['skills'] }, a);
    expect(again.changed).toBe(false);
  });

  it('un nouvel élément est ajouté avec ses identifiants à consigner, jamais sur un identifiant existant', () => {
    const item = proposal({
      type: 'item',
      target: { collection: 'skills', itemId: null },
      payload: { itemType: 'skill', item: { id: 'sk-docker', category: 'outils', short: 'Docker' } },
    });
    const r = applyLibraryProposal(library, item);
    expect(r.newIds).toEqual([{ id: 'sk-docker', kind: 'skill' }]);
    const clash = proposal({
      type: 'item',
      target: { collection: 'skills', itemId: null },
      payload: { itemType: 'skill', item: { id: 'sk-python', category: 'outils', short: 'Autre' } },
    });
    expect(() => applyLibraryProposal(library, clash)).toThrowError(/déjà utilisé/);
  });

  it("le sujet d'une proposition est la puce visée ; une cible disparue est signalée", () => {
    const ctx = { library, selection: () => null };
    expect(proposalSubject(variant({ fr: 'x', en: null }), ctx)).toEqual({
      kind: 'found',
      value: bullet(library, 'b-medtech-62304'),
    });
    const gone = proposal({
      type: 'variant',
      target: { collection: 'experiences', itemId: 'exp-medtech-2023', bulletId: 'b-absente' },
      payload: { label: null, text: { fr: 'x', en: null } },
    });
    expect(proposalSubject(gone, ctx)).toEqual({ kind: 'missing' });
  });
});

describe('proposition de catégorie (ADR 0023)', () => {
  const category = (extra: Record<string, unknown> = {}, item: Record<string, unknown> = {}) =>
    proposal({
      type: 'item',
      target: { collection: 'categories', itemId: null },
      payload: { itemType: 'category', item: { id: 'cat-cloud', label: { fr: 'Cloud', en: 'Cloud' }, ...item } },
      ...extra,
    });
  const skillIn = (cat: string, extra: Record<string, unknown> = {}) =>
    proposal({
      type: 'item',
      target: { collection: 'skills', itemId: null },
      payload: { itemType: 'skill', item: { id: 'sk-aws', category: cat, short: 'AWS' } },
      ...extra,
    });

  it('le schéma accepte une catégorie et refuse un champ en trop', () => {
    const p = category();
    expect(p.type === 'item' && p.payload.itemType).toBe('category');
    expect(() => category({}, { tags: [] })).toThrow();
  });

  it("l'application ajoute la catégorie et consigne son identifiant", () => {
    const r = applyLibraryProposal(library, category() as never);
    expect(r.collection).toBe('categories');
    expect((r.items as Library['categories']).at(-1)).toEqual({
      id: 'cat-cloud',
      label: { fr: 'Cloud', en: 'Cloud' },
    });
    expect(r.newIds).toEqual([{ id: 'cat-cloud', kind: 'category' }]);
    expect(() => applyLibraryProposal(library, category({}, { id: 'outils' }) as never)).toThrowError(/déjà utilisé/);
    const again = applyLibraryProposal(
      { ...library, categories: r.items as Library['categories'] },
      category() as never,
    );
    expect(again.changed).toBe(false);
  });

  it('une catégorie visant une autre collection est non applicable', () => {
    const p = category({ target: { collection: 'skills', itemId: null } });
    expect(() => applyLibraryProposal(library, p as never)).toThrowError(ProposalError);
  });

  it("« modifier puis accepter » garde l'identifiant réservé", () => {
    const r = applyLibraryProposal(library, category() as never, {
      item: { id: 'cat-autre', label: { fr: 'Informatique en nuage', en: 'Cloud' } },
    });
    expect((r.items as Library['categories']).at(-1)).toEqual({
      id: 'cat-cloud',
      label: { fr: 'Informatique en nuage', en: 'Cloud' },
    });
    expect(r.newIds).toEqual([{ id: 'cat-cloud', kind: 'category' }]);
  });

  it('la cible se décrit comme un nouvel élément', () => {
    expect(describeTarget(category(), library)).toBe('Nouvel élément : Catégorie « Cloud »');
  });

  it('les catégories ouvertes ignorent les propositions traitées et les doublons', () => {
    const open = category();
    const accepted = category({ id: '01JC0FX0000000000000TST002', status: 'accepted' }, { id: 'cat-a' });
    const rejected = category({ id: '01JC0FX0000000000000TST003', status: 'rejected' }, { id: 'cat-b' });
    const dup = proposal({
      id: '01JC0FX0000000000000TST004',
      type: 'item',
      target: { collection: 'categories', itemId: null },
      payload: {
        itemType: 'category',
        item: { id: 'cat-c', label: { fr: 'Outils', en: null } },
        duplicateOf: 'outils',
      },
    });
    const map = openCategoryProposals([open, accepted, rejected, dup, skillIn('cat-cloud')]);
    expect([...map.keys()]).toEqual(['cat-cloud']);
    expect(map.get('cat-cloud')!.id).toBe(open.id);
  });

  it('la catégorie exigée suit la valeur finale', () => {
    const skill = skillIn('cat-cloud') as never;
    expect(requiredCategory(skill)).toBe('cat-cloud');
    expect(requiredCategory(skill, { item: { id: 'sk-aws', category: 'outils', short: 'AWS' } })).toBe('outils');
    const edit = proposal({
      type: 'edit',
      target: { collection: 'skills', itemId: 'sk-git', field: 'category' },
      payload: { field: 'category', oldValue: 'outils', newValue: 'cat-cloud', sensitive: false },
    }) as never;
    expect(requiredCategory(edit)).toBe('cat-cloud');
    expect(requiredCategory(edit, { newValue: 'methodes' })).toBe('methodes');
    const other = proposal({
      type: 'edit',
      target: { collection: 'skills', itemId: 'sk-git', field: 'long' },
      payload: { field: 'long', oldValue: null, newValue: 'x', sensitive: false },
    }) as never;
    expect(requiredCategory(other)).toBeNull();
    expect(requiredCategory(category() as never)).toBeNull();
  });
});

describe('sélection acceptée élément par élément', () => {
  const delta = {
    add: ['prj-tracabilite'],
    remove: ['b-santenum-tests'],
    variantChoice: { 'b-medtech-62304': 'prop:01JC0FX0000000000000VAR001' },
  };
  const selection = {
    titleId: null,
    summaryId: null,
    sections: [],
    include: ['b-santenum-tests'],
    order: {},
    variantChoice: {},
    overrides: {},
  } as never;

  it('applique les éléments choisis et résout la variante acceptée', () => {
    const r = applySelectionDelta(selection, delta, null, () => ({ variantId: 'acme' }));
    expect(r.selection.include).toEqual(['prj-tracabilite']);
    expect(r.selection.variantChoice).toEqual({ 'b-medtech-62304': 'acme' });
    expect(r.applied).toHaveLength(3);
  });

  it('écarte une variante rejetée et respecte le choix partiel', () => {
    const keys = selectionElements(delta)
      .map((e) => e.key)
      .filter((k) => !k.startsWith('remove:'));
    const r = applySelectionDelta(selection, delta, keys, () => ({ reason: 'rejetée' }));
    expect(r.selection.include).toEqual(['b-santenum-tests', 'prj-tracabilite']);
    expect(r.skipped).toEqual([{ key: 'variant:b-medtech-62304', reason: 'rejetée' }]);
  });
});
