// Proposals queue on the fictitious fixtures (F-PRO-01 to 06): `stale` from the base hash, acceptance
// as a new variant, rejection, dependencies, batch without sensitive facts, invalid files reported.
import { copyFile, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  acceptBatch,
  acceptProposal,
  DataStore,
  installFixture,
  proposalFreshness,
  rejectProposal,
  subjectContext,
  updateItem,
} from '@cv/store';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const FIXTURE_PROPOSALS = path.join(ROOT, 'fixtures', 'proposals');
const ID = {
  variant: '01JC0FX0000000000000VAR001',
  selection: '01JC0FX0000000000000SEQ001',
  stale: '01JC0FX0000000000000STA001',
  edit: '01JC0FX0000000000000EDT001',
  alias: '01JC0FX0000000000000SYN001',
  item: '01JC0FX0000000000000NEW001',
};

let dir: string;
let store: DataStore;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'cv-prop-'));
  await installFixture(path.join(ROOT, 'fixtures', 'personas', 'courte'), dir);
  for (const f of await readdir(FIXTURE_PROPOSALS)) {
    await copyFile(path.join(FIXTURE_PROPOSALS, f), path.join(dir, 'proposals', f));
  }
  store = DataStore.open(dir);
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const bulletOf = async (id: string) =>
  (await store.loadLibrary()).experiences.flatMap((e) => e.bullets).find((b) => b.id === id)!;

async function freshness() {
  const proposals = await store.listProposals();
  const ctx = await subjectContext(store, proposals);
  return Object.fromEntries(proposals.map((p) => [p.id, proposalFreshness(p, ctx).stale]));
}

describe('fixtures de propositions (lot 1)', () => {
  it('sont valides ; seule STA001 est en conflit sur la persona « courte »', async () => {
    const scan = await store.scanProposals();
    expect(scan.invalid).toEqual([]);
    expect(scan.proposals).toHaveLength(6);
    expect(await freshness()).toEqual({
      [ID.edit]: false,
      [ID.item]: false,
      [ID.selection]: false,
      [ID.stale]: true,
      [ID.alias]: false,
      [ID.variant]: false,
    });
  });
});

describe('acceptation et rejet (F-PRO-03)', () => {
  it("une reformulation acceptée devient une nouvelle variante ; l'original reste intact", async () => {
    const before = await bulletOf('b-medtech-62304');
    const r = await acceptProposal(store, ID.variant);
    expect(r.proposal.status).toBe('accepted');
    expect(r.proposal.resolution?.finalValue).toMatchObject({ variantId: 'acme-tracabilite' });
    const after = await bulletOf('b-medtech-62304');
    expect(after.variants.slice(0, before.variants.length)).toEqual(before.variants);
    expect(after.variants).toHaveLength(before.variants.length + 1);
    await expect(acceptProposal(store, ID.variant)).rejects.toMatchObject({ code: 'ALREADY_RESOLVED' });
  });

  it('modifier puis accepter enregistre le texte final et le statut « edited »', async () => {
    const r = await acceptProposal(store, ID.variant, {
      edited: {
        label: 'ma version',
        text: { fr: 'Conformité IEC 62304 (classe B) : traçabilité de 240 tests', en: null },
      },
    });
    expect(r.proposal.status).toBe('edited');
    const after = await bulletOf('b-medtech-62304');
    expect(after.variants.at(-1)).toMatchObject({
      id: 'ma-version',
      text: { fr: 'Conformité IEC 62304 (classe B) : traçabilité de 240 tests' },
    });
  });

  it('un texte modifié est assaini, et refusé avec un emoji', async () => {
    await expect(
      acceptProposal(store, ID.variant, {
        edited: { label: null, text: { fr: `Tests ${String.fromCodePoint(0x1f680)}`, en: null } },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_DATA', details: { issues: [{ path: 'text.fr' }] } });
  });

  it('un rejet garde la proposition et son motif, sans toucher la bibliothèque', async () => {
    const before = await store.loadLibrary();
    const r = await rejectProposal(store, ID.alias, 'pas un équivalent strict');
    expect(r.proposal).toMatchObject({
      status: 'rejected',
      resolution: { action: 'rejected', reason: 'pas un équivalent strict' },
    });
    expect(await store.loadLibrary()).toEqual(before);
  });

  it('un nouvel élément est ajouté et son identifiant consigné', async () => {
    await acceptProposal(store, ID.item);
    expect((await store.loadLibrary()).skills.find((s) => s.id === 'sk-docker')?.short).toBe('Docker');
    expect((await store.readIds()).ids['sk-docker']?.kind).toBe('skill');
  });

  it('une sélection attend ses dépendances, ou les accepte avec elle', async () => {
    await expect(acceptProposal(store, ID.selection)).rejects.toMatchObject({ code: 'DEPENDENCY_PENDING' });
    const r = await acceptProposal(store, ID.selection, { withDependencies: true });
    expect(r.dependencies).toEqual([ID.variant]);
    const preset = (await store.listPresets())[0]!;
    expect(preset.selection.include).toContain('prj-tracabilite');
    expect(preset.selection.include).not.toContain('b-santenum-tests');
    expect(preset.selection.variantChoice['b-medtech-62304']).toBe('acme-tracabilite');
  });

  it('une sélection acceptée en partie passe à « edited » ; une variante rejetée est écartée', async () => {
    await rejectProposal(store, ID.variant);
    const r = await acceptProposal(store, ID.selection, {
      elements: ['add:prj-tracabilite', 'variant:b-medtech-62304'],
    });
    expect(r.proposal.status).toBe('edited');
    expect(r.proposal.resolution?.finalValue).toMatchObject({
      applied: ['add:prj-tracabilite'],
      skipped: [{ key: 'variant:b-medtech-62304', reason: 'la variante proposée a été rejetée' }],
    });
  });
});

describe('conflits (F-PRO-04)', () => {
  it('une proposition devient « stale » quand son élément change, puis reste applicable', async () => {
    await acceptProposal(store, ID.variant);
    // VAR001 added a variant to b-medtech-62304; a second proposal on the same bullet would be stale.
    const { library, revisions } = await store.loadLibraryFiles();
    const exp = library.experiences.find((e) => e.id === 'exp-santenum-2019')!;
    await updateItem(store, 'experiences', exp.id, {
      item: { ...exp, organization: 'Santé Numérique Fictive (nouveau nom)' },
      expectedRevision: revisions.experiences,
      base: exp,
    });
    expect((await freshness())[ID.edit]).toBe(true);
    // A stale variant is still additive: accepting it applies it on the current version.
    const r = await acceptProposal(store, ID.stale);
    expect(r.proposal.status).toBe('accepted');
    expect((await bulletOf('b-medtech-cicd')).variants.map((v) => v.id)).toEqual(['principale', 'acme-devops']);
  });
});

describe('acceptation en lot (F-UI-03, F-PRO-06)', () => {
  it('écarte les faits sensibles et les conflits', async () => {
    const r = await acceptBatch(store, Object.values(ID));
    expect(r.accepted.sort()).toEqual([ID.variant, ID.selection, ID.alias, ID.item].sort());
    expect(r.skipped.map((s) => s.id).sort()).toEqual([ID.edit, ID.stale].sort());
    expect(r.skipped.find((s) => s.id === ID.edit)?.reason).toMatch(/fait sensible/);
    expect(r.skipped.find((s) => s.id === ID.stale)?.reason).toMatch(/conflit/);
  });
});

describe('fichiers déposés à la main', () => {
  it('un fichier invalide est signalé sans masquer les autres', async () => {
    await writeFile(path.join(dir, 'proposals', '01JC0FX0000000000000BAD001.json'), '{ "schemaVersion": 1, ');
    await writeFile(path.join(dir, 'proposals', 'pas-un-ulid.json'), '{}');
    const scan = await store.scanProposals();
    expect(scan.proposals).toHaveLength(6);
    expect(scan.invalid.map((i) => i.file).sort()).toEqual([
      'proposals/01JC0FX0000000000000BAD001.json',
      'proposals/pas-un-ulid.json',
    ]);
  });
});
