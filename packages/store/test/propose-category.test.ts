// ADR 0023: a skill category proposed through the MCP (propose_item type category). Identifier reserved
// at once (`cat-<slug>`), deduplication on the label (FR or EN), skills that target a pending category
// (dependsOn filled by the server), acceptance with or after the category, batch order, and nothing
// written outside proposals/ and ids.json when proposing. Always on a copy of the fictitious persona.
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  acceptBatch,
  acceptProposal,
  checkItem,
  DataStore,
  installFixture,
  proposeEdit,
  proposeItems,
  proposeSelection,
  rejectProposal,
  StoreError,
  type ItemInput,
  type ProposeResult,
} from '../src/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

let tmp: string;
let dataDir: string;
let store: DataStore;

beforeEach(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'cv-category-'));
  dataDir = path.join(tmp, 'data');
  await installFixture(path.join(ROOT, 'fixtures', 'personas', 'courte'), dataDir);
  store = DataStore.open(dataDir);
});
afterEach(() => rm(tmp, { recursive: true, force: true }));

/** Hash of every file of the data directory, except the lock. */
async function hashTree(dir: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const walk = async (d: string) => {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.name === '.lock') continue;
      if (e.isDirectory()) await walk(p);
      else
        out[path.relative(dir, p).split(path.sep).join('/')] = createHash('sha256')
          .update(await readFile(p))
          .digest('hex');
    }
  };
  await walk(dir);
  return out;
}

const OPTS = { importDir: null };

const category = (label: { fr?: string | null; en?: string | null }, userStatement: string | null): ItemInput => ({
  type: 'category',
  data: { label },
  source: 'dictee',
  userStatement,
});

const skill = (short: string, categoryId: string): ItemInput => ({
  type: 'skill',
  data: { category: categoryId, short, long: null },
  source: 'dictee',
  userStatement: `J'utilise ${short} au quotidien.`,
});

type Created = Extract<ProposeResult, { status: 'created' }>;
type Duplicate = Extract<ProposeResult, { status: 'duplicateOf' }>;

async function proposeCategory(fr = 'Dispositifs médicaux'): Promise<Created> {
  const out = await proposeItems(store, [category({ fr }, `Ajoute une catégorie ${fr}.`)], OPTS);
  expect(out.results[0]!.status, JSON.stringify(out.results[0])).toBe('created');
  return out.results[0] as Created;
}

async function catch_(p: Promise<unknown>): Promise<StoreError> {
  try {
    await p;
  } catch (err) {
    if (err instanceof StoreError) return err;
    throw err;
  }
  throw new Error('une erreur était attendue');
}

const categoryIds = async () => (await store.loadLibrary()).categories.map((c) => c.id);

describe('proposition d’une catégorie (ADR 0023)', () => {
  it('une catégorie dictée reçoit cat-<slug>, réservé dans ids.json, sans dépendance', async () => {
    const r = await proposeCategory();
    expect(r.itemId).toBe('cat-dispositifs-medicaux');
    expect(r.dependsOn).toEqual([]);
    const ids = await store.readIds();
    expect(ids.ids['cat-dispositifs-medicaux']?.kind).toBe('category');
    const p = (await store.listProposals()).find((x) => x.id === r.proposalId)!;
    expect(p).toMatchObject({
      type: 'item',
      target: { collection: 'categories', itemId: null },
      payload: {
        itemType: 'category',
        item: { id: 'cat-dispositifs-medicaux', label: { fr: 'Dispositifs médicaux', en: null } },
      },
    });
  });

  it('refusée sans userStatement, en source offre, avec un libellé vide ou un emoji, sans consommer d’identifiant', async () => {
    const before = JSON.stringify((await store.readIds()).ids);
    const out = await proposeItems(
      store,
      [
        category({ fr: 'Cloud' }, null),
        { type: 'category', data: { label: { fr: 'Cloud' } }, source: 'offre' },
        category({ fr: null, en: null }, 'Ajoute une catégorie.'),
        category({}, 'Ajoute une catégorie.'),
        category({ fr: 'Cloud \u{1F680}' }, 'Ajoute une catégorie Cloud \u{1F680}.'),
      ],
      OPTS,
    );
    expect(out.results.map((r) => r.status)).toEqual(['rejected', 'rejected', 'rejected', 'rejected', 'rejected']);
    const reasons = out.results.map((r) => (r.status === 'rejected' ? r.reasons.join(' ') : ''));
    expect(reasons[0]).toMatch(/userStatement/);
    expect(reasons[1]).toMatch(/source offre/);
    expect(reasons[2]).toMatch(/au moins une langue/);
    expect(reasons[3]).toMatch(/label/);
    expect(JSON.stringify((await store.readIds()).ids)).toBe(before);
    expect(await store.listProposals()).toEqual([]);
  });
});

describe('dédoublonnage d’une catégorie (F-IMP-04)', () => {
  it('un libellé de la bibliothèque, en FR ou en EN, casse et accents compris, renvoie la catégorie à viser', async () => {
    const out = await proposeItems(
      store,
      [
        category({ fr: 'Outils' }, 'Une catégorie Outils.'),
        category({ en: 'tools' }, 'A tools category.'),
        category({ fr: 'méthodes' }, 'Une catégorie méthodes.'),
      ],
      OPTS,
    );
    expect(out.results).toMatchObject([
      { status: 'duplicateOf', duplicateOf: 'outils', itemId: 'outils' },
      { status: 'duplicateOf', duplicateOf: 'outils', itemId: 'outils' },
      { status: 'duplicateOf', duplicateOf: 'methodes', itemId: 'methodes' },
    ]);
    expect((out.results[0] as Duplicate).hint).toMatch(/itemId/);
    expect(out.proposalIds).toEqual([]);
  });

  it('une catégorie en attente renvoie l’ULID et l’identifiant réservé', async () => {
    const first = await proposeCategory();
    const out = await proposeItems(store, [category({ fr: 'dispositifs medicaux' }, 'Dispositifs medicaux.')], OPTS);
    expect(out.results[0]).toMatchObject({
      status: 'duplicateOf',
      duplicateOf: first.proposalId,
      itemId: 'cat-dispositifs-medicaux',
    });
    expect((await store.listProposals()).length).toBe(1);
  });

  it('un doublon du même envoi donne l’identifiant du premier', async () => {
    const out = await proposeItems(
      store,
      [category({ fr: 'Cloud' }, 'Une catégorie Cloud.'), category({ en: 'cloud' }, 'A cloud category.')],
      OPTS,
    );
    const first = out.results[0] as Created;
    expect(first.status).toBe('created');
    expect(out.results[1]).toMatchObject({ status: 'duplicateOf', duplicateOf: first.proposalId, itemId: 'cat-cloud' });
  });
});

describe('compétence dans une catégorie en attente (F-PRO-03)', () => {
  it('le serveur remplit dependsOn ; une catégorie inconnue ou du même appel est refusée avec l’indice', async () => {
    const cat = await proposeCategory();
    const out = await proposeItems(store, [skill('Pydicom', cat.itemId!), skill('Orthanc', 'cat-inconnue')], OPTS);
    expect(out.results[0]).toMatchObject({ status: 'created', dependsOn: [cat.proposalId] });
    const p = (await store.listProposals()).find((x) => x.id === (out.results[0] as Created).proposalId)!;
    expect(p.dependsOn).toEqual([cat.proposalId]);
    expect(out.results[1]!.status).toBe('rejected');
    expect(JSON.stringify(out.results[1])).toMatch(/catégorie inconnue.*appel séparé/);

    const same = await proposeItems(
      store,
      [category({ fr: 'Imagerie' }, 'Une catégorie Imagerie.'), skill('DICOM', 'cat-imagerie')],
      OPTS,
    );
    expect(same.results.map((r) => r.status)).toEqual(['created', 'rejected']);
    expect(JSON.stringify(same.results[1])).toMatch(/appel séparé/);
  });

  it('propose_edit du champ category : en attente (dependsOn), validée, inconnue', async () => {
    const cat = await proposeCategory();
    const pending = await proposeEdit(store, {
      target: { collection: 'skills', itemId: 'sk-git' },
      field: 'category',
      newValue: cat.itemId,
      rationale: 'Git sert aux dispositifs médicaux.',
    });
    expect(pending.dependsOn).toEqual([cat.proposalId]);
    const p = (await store.listProposals()).find((x) => x.id === pending.proposalId)!;
    expect(p.dependsOn).toEqual([cat.proposalId]);

    const validated = await proposeEdit(store, {
      target: { collection: 'skills', itemId: 'sk-gitlab-ci' },
      field: 'category',
      newValue: 'methodes',
      rationale: 'Plutôt une méthode.',
    });
    expect(validated.dependsOn).toEqual([]);

    const unknown = await catch_(
      proposeEdit(store, {
        target: { collection: 'skills', itemId: 'sk-tdd' },
        field: 'category',
        newValue: 'cat-inconnue',
        rationale: 'x',
      }),
    );
    expect(unknown.code).toBe('INVALID_DATA');
    expect(unknown.message).toMatch(/catégorie inconnue : cat-inconnue/);
    expect(unknown.hint).toMatch(/itemId/);
  });

  it('un identifiant de catégorie avec des chiffres n’est pas pris pour un chiffre inventé', async () => {
    const cat = await proposeCategory('Qualité 13485');
    expect(cat.itemId).toBe('cat-qualite-13485');
    const r = await proposeEdit(store, {
      target: { collection: 'skills', itemId: 'sk-git' },
      field: 'category',
      newValue: cat.itemId,
      rationale: 'Rattachement à la qualité.',
    });
    expect(r.checks.find((c) => c.rule === 'no-new-numbers' && !c.ok)).toBeUndefined();
  });

  it('le contrôle du formulaire connaît les catégories en attente sur demande', async () => {
    const cat = await proposeCategory();
    const draft = { category: cat.itemId, short: 'Pydicom', long: null };
    const plain = await checkItem(store, 'skills', draft);
    expect(plain.issues.map((i) => i.path)).toContain('category');
    const withPending = await checkItem(store, 'skills', draft, null, { withPendingCategories: true });
    expect(withPending.issues).toEqual([]);
    // The pending category itself, edited before acceptance, is not a duplicate of itself.
    const self = await checkItem(store, 'categories', { id: cat.itemId, label: { fr: 'DM', en: null } }, null, {
      withPendingCategories: true,
    });
    expect(self.issues).toEqual([]);
  });
});

describe('acceptation (F-PRO-03, ADR 0023)', () => {
  async function pair(): Promise<{ cat: Created; sk: Created }> {
    const cat = await proposeCategory();
    const out = await proposeItems(store, [skill('Pydicom', cat.itemId!)], OPTS);
    return { cat, sk: out.results[0] as Created };
  }

  it('DEPENDENCY_PENDING sans withDependencies ; avec, la catégorie est acceptée d’abord', async () => {
    const { cat, sk } = await pair();
    const err = await catch_(acceptProposal(store, sk.proposalId));
    expect(err.code).toBe('DEPENDENCY_PENDING');
    expect(err.details).toEqual({ pending: [cat.proposalId] });
    expect(err.message).toMatch(/Dispositifs médicaux/);

    const r = await acceptProposal(store, sk.proposalId, { withDependencies: true });
    expect(r.dependencies).toEqual([cat.proposalId]);
    expect(r.writes.map((w) => w.file)).toEqual(
      expect.arrayContaining(['library/categories.json', 'library/skills.json']),
    );
    const library = await store.loadLibrary();
    expect(library.categories.at(-1)).toEqual({
      id: 'cat-dispositifs-medicaux',
      label: { fr: 'Dispositifs médicaux', en: null },
    });
    expect(library.skills.find((s) => s.short === 'Pydicom')?.category).toBe('cat-dispositifs-medicaux');
  });

  it('accepter la catégorie n’écrit que library/categories.json et la résolution', async () => {
    const cat = await proposeCategory();
    const r = await acceptProposal(store, cat.proposalId);
    expect(r.writes.map((w) => w.file).sort()).toEqual(['library/categories.json', `proposals/${cat.proposalId}.json`]);
  });

  it('« modifier puis accepter » d’une catégorie garde son identifiant ; la compétence suit', async () => {
    const { cat, sk } = await pair();
    await acceptProposal(store, cat.proposalId, {
      edited: { item: { id: 'cat-autre', label: { fr: 'Dispositifs médicaux (DM)', en: 'Medical devices' } } },
    });
    expect((await store.loadLibrary()).categories.at(-1)).toEqual({
      id: 'cat-dispositifs-medicaux',
      label: { fr: 'Dispositifs médicaux (DM)', en: 'Medical devices' },
    });
    const r = await acceptProposal(store, sk.proposalId);
    expect(r.proposal.status).toBe('accepted');
    expect(r.dependencies).toEqual([]);
  });

  it('une compétence rattachée à une catégorie validée par « modifier puis accepter » n’exige plus la catégorie', async () => {
    const { cat, sk } = await pair();
    const p = (await store.listProposals()).find((x) => x.id === sk.proposalId)!;
    const item = (p.payload as { item: Record<string, unknown> }).item;
    const r = await acceptProposal(store, sk.proposalId, { edited: { item: { ...item, category: 'outils' } } });
    expect(r.proposal.status).toBe('edited');
    expect(r.dependencies).toEqual([]);
    expect(await categoryIds()).not.toContain(cat.itemId);
  });

  it('une catégorie rejetée rend la compétence non applicable, avec un message explicite', async () => {
    const { cat, sk } = await pair();
    await rejectProposal(store, cat.proposalId);
    const err = await catch_(acceptProposal(store, sk.proposalId, { withDependencies: true }));
    expect(err.code).toBe('NOT_APPLICABLE');
    expect(err.message).toBe(
      'la catégorie proposée « Dispositifs médicaux » a été rejetée : modifiez puis acceptez avec une autre catégorie',
    );
    const p = (await store.listProposals()).find((x) => x.id === sk.proposalId)!;
    const item = (p.payload as { item: Record<string, unknown> }).item;
    const r = await acceptProposal(store, sk.proposalId, { edited: { item: { ...item, category: 'outils' } } });
    expect(r.proposal.status).toBe('edited');
  });

  it('le lot accepte la catégorie avant ses compétences, quel que soit l’ordre', async () => {
    const { cat, sk } = await pair();
    const r = await acceptBatch(store, [sk.proposalId, cat.proposalId]);
    expect(r.skipped).toEqual([]);
    expect(r.accepted).toEqual([cat.proposalId, sk.proposalId]);
    expect(await categoryIds()).toContain('cat-dispositifs-medicaux');
  });

  it('le lot écarte une compétence dont la catégorie en attente est hors du lot', async () => {
    const { sk } = await pair();
    const r = await acceptBatch(store, [sk.proposalId]);
    expect(r.accepted).toEqual([]);
    expect(r.skipped).toEqual([{ id: sk.proposalId, reason: 'dépend de propositions en attente hors du lot' }]);
  });

  it('« modifier puis accepter » vers une catégorie en attente : DEPENDENCY_PENDING, puis acceptée avec elle', async () => {
    const cat = await proposeCategory();
    const out = await proposeItems(store, [skill('Pydicom', 'outils')], OPTS);
    const sk = out.results[0] as Created;
    expect(sk.dependsOn).toEqual([]);
    const p = (await store.listProposals()).find((x) => x.id === sk.proposalId)!;
    const item = (p.payload as { item: Record<string, unknown> }).item;
    const edited = { item: { ...item, category: cat.itemId } };
    const err = await catch_(acceptProposal(store, sk.proposalId, { edited }));
    expect(err.code).toBe('DEPENDENCY_PENDING');
    const r = await acceptProposal(store, sk.proposalId, { edited, withDependencies: true });
    expect(r.proposal.status).toBe('edited');
    expect(r.dependencies).toEqual([cat.proposalId]);
    expect((await store.loadLibrary()).skills.find((s) => s.short === 'Pydicom')?.category).toBe(cat.itemId);
  });

  it('une compétence refusée à l’écriture ne laisse pas sa catégorie acceptée', async () => {
    const { cat, sk } = await pair();
    const before = await hashTree(dataDir);
    const p = (await store.listProposals()).find((x) => x.id === sk.proposalId)!;
    const item = (p.payload as { item: Record<string, unknown> }).item;
    const err = await catch_(
      acceptProposal(store, sk.proposalId, { edited: { item: { ...item, short: '' } }, withDependencies: true }),
    );
    expect(err.code).toBe('INVALID_DATA');
    expect(await categoryIds()).not.toContain(cat.itemId);
    expect((await store.listProposals()).find((x) => x.id === cat.proposalId)?.status).toBe('pending');
    expect(await hashTree(dataDir)).toEqual(before);
  });

  it('propose_edit du champ category vers une catégorie en attente : refusée seule, acceptée avec elle, écartée du lot', async () => {
    const cat = await proposeCategory();
    const edit = await proposeEdit(store, {
      target: { collection: 'skills', itemId: 'sk-git' },
      field: 'category',
      newValue: cat.itemId,
      rationale: 'Git sert aux dispositifs médicaux.',
    });
    const err = await catch_(acceptProposal(store, edit.proposalId));
    expect(err.code).toBe('DEPENDENCY_PENDING');
    expect(err.details).toEqual({ pending: [cat.proposalId] });

    const batch = await acceptBatch(store, [edit.proposalId]);
    expect(batch.accepted).toEqual([]);
    expect(batch.skipped).toEqual([{ id: edit.proposalId, reason: 'dépend de propositions en attente hors du lot' }]);

    const r = await acceptProposal(store, edit.proposalId, { withDependencies: true });
    expect(r.dependencies).toEqual([cat.proposalId]);
    expect(r.writes.map((w) => w.file)).toEqual(
      expect.arrayContaining(['library/categories.json', 'library/skills.json']),
    );
    const library = await store.loadLibrary();
    expect(library.categories.map((c) => c.id)).toContain(cat.itemId);
    expect(library.skills.find((s) => s.id === 'sk-git')?.category).toBe(cat.itemId);
  });

  it('une sélection qui dépend d’une compétence en attente l’accepte avec sa catégorie (transitivité)', async () => {
    const { cat, sk } = await pair();
    const preset = await store.read<{ selection: { include: string[] } & Record<string, unknown> }>(
      'presets/preset-defaut.json',
    );
    const selection = { ...preset.selection, include: preset.selection.include.filter((id) => id !== 'sk-tdd') };
    const sel = await proposeSelection(store, {
      target: { kind: 'preset', id: 'preset-defaut' },
      selection,
      dependsOn: [sk.proposalId],
    });
    const err = await catch_(acceptProposal(store, sel.proposalId));
    expect(err.code).toBe('DEPENDENCY_PENDING');
    const r = await acceptProposal(store, sel.proposalId, { withDependencies: true });
    expect(r.dependencies).toEqual([sk.proposalId, cat.proposalId]);
    const statuses = new Map((await store.listProposals()).map((x) => [x.id, x.status]));
    expect([statuses.get(cat.proposalId), statuses.get(sk.proposalId)]).toEqual(['accepted', 'accepted']);
    expect(await categoryIds()).toContain(cat.itemId);
  });
});

describe('écritures à la proposition (ADR 0014, ADR 0023)', () => {
  it('seuls ids.json et de nouveaux proposals/*.json changent, sans suppression', async () => {
    const before = await hashTree(dataDir);
    const cat = await proposeCategory();
    await proposeItems(store, [skill('Pydicom', cat.itemId!)], OPTS);
    await proposeEdit(store, {
      target: { collection: 'skills', itemId: 'sk-git' },
      field: 'category',
      newValue: cat.itemId,
      rationale: 'Rattachement.',
    });
    const after = await hashTree(dataDir);
    for (const file of Object.keys(before)) expect(after, file).toHaveProperty([file]);
    const changed = Object.keys(after).filter((f) => before[f] !== after[f]);
    expect(changed.filter((f) => f !== 'ids.json' && !/^proposals\/[0-9A-Z]{26}\.json$/.test(f))).toEqual([]);
    expect(changed).toContain('ids.json');
    expect(changed.filter((f) => f.startsWith('proposals/'))).toHaveLength(3);
    expect(changed.filter((f) => f.startsWith('proposals/')).every((f) => before[f] === undefined)).toBe(true);
  });
});
