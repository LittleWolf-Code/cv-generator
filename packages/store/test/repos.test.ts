// Repositories of a project through the proposals (ADR 0027): each URL is checked against the source
// (no-foreign-content), a project that shares its link or a repository with a validated one is its
// duplicate, and new repositories of an existing project are proposed by propose_edit on `repos`.
// Always on a copy of the fictitious persona.
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  acceptProposal,
  DataStore,
  installFixture,
  proposeEdit,
  proposeItems,
  StoreError,
  type ItemInput,
  type ProposeResult,
} from '../src/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

let tmp: string;
let store: DataStore;

beforeEach(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'cv-repos-'));
  const dataDir = path.join(tmp, 'data');
  await installFixture(path.join(ROOT, 'fixtures', 'personas', 'courte'), dataDir);
  store = DataStore.open(dataDir);
});
afterEach(() => rm(tmp, { recursive: true, force: true }));

const OPTS = { importDir: null };
const REPO = (name: string) => ({
  url: `https://github.com/camille-martin-fictif/${name}`,
  display: `github.com/camille-martin-fictif/${name}`,
});

const projectInput = (name: string, repos: Array<{ url: string; display: string }>, statement: string): ItemInput => ({
  type: 'project',
  source: 'dictee',
  userStatement: statement,
  rationale: 'Import des dépôts GitHub',
  data: {
    name: { fr: name, en: name },
    role: { fr: 'projet personnel', en: 'personal project' },
    repos,
    start: '2025-01',
    end: null,
    bullets: [],
  },
});

type Created = Extract<ProposeResult, { status: 'created' }>;
type Rejected = Extract<ProposeResult, { status: 'rejected' }>;
type Duplicate = Extract<ProposeResult, { status: 'duplicateOf' }>;

describe('dépôts proposés (ADR 0027)', () => {
  it('un projet et ses dépôts cités dans la source : proposition créée, dépôts gardés', async () => {
    const statement =
      'Dépôt GitHub de l’utilisateur (copié mot pour mot) : « camille-martin-fictif/relevés : https://github.com/camille-martin-fictif/releves et https://github.com/camille-martin-fictif/releves-api, créé en 2025 »';
    const out = await proposeItems(
      store,
      [projectInput('Relevés', [REPO('releves'), REPO('releves-api')], statement)],
      OPTS,
    );
    expect(out.results[0]!.status, JSON.stringify(out.results[0])).toBe('created');
    const p = (await store.listProposals()).find((x) => x.id === (out.results[0] as Created).proposalId)!;
    expect(p.type === 'item' && p.payload.item).toMatchObject({ repos: [REPO('releves'), REPO('releves-api')] });
  });

  it('un dépôt absent de la source est rejeté (no-foreign-content)', async () => {
    const out = await proposeItems(
      store,
      [
        projectInput(
          'Relevés',
          [REPO('releves'), REPO('autre-depot')],
          'Dépôt GitHub : « https://github.com/camille-martin-fictif/releves, créé en 2025 »',
        ),
      ],
      OPTS,
    );
    const r = out.results[0] as Rejected;
    expect(r.status).toBe('rejected');
    const rule = r.checks.find((c) => c.rule === 'no-foreign-content')!;
    expect(rule.ok).toBe(false);
    expect(rule.found!.join(' ')).toContain('autre-depot');
    expect(rule.found!.join(' ')).not.toMatch(/releves(?!-)/);
  });

  it('un autre nom mais un dépôt partagé avec un projet validé : doublon de ce projet', async () => {
    const statement = 'Dépôt GitHub : « https://github.com/Camille-Martin-Fictif/tracabilite.git, créé en 2025 »';
    const out = await proposeItems(
      store,
      [
        projectInput(
          'Matrice de traçabilité',
          [{ url: 'https://github.com/Camille-Martin-Fictif/tracabilite.git', display: 'tracabilite' }],
          statement,
        ),
      ],
      OPTS,
    );
    expect(out.results[0]).toMatchObject({ status: 'duplicateOf', duplicateOf: 'prj-tracabilite' });
    expect((out.results[0] as Duplicate).duplicateOf).toBe('prj-tracabilite');
  });

  it('de nouveaux dépôts d’un projet validé : propose_edit sur repos, puis acceptation', async () => {
    const current = (await store.loadLibrary()).projects.find((p) => p.id === 'prj-tracabilite')!;
    const repos = [...current.repos, REPO('tracabilite-web')];
    const r = await proposeEdit(store, {
      target: { collection: 'projects', itemId: 'prj-tracabilite' },
      field: 'repos',
      newValue: repos,
      rationale: 'Nouveau dépôt du projet',
      userStatement: 'Ajoute https://github.com/camille-martin-fictif/tracabilite-web à ce projet.',
    });
    await acceptProposal(store, r.proposalId);
    const after = (await store.loadLibrary()).projects.find((p) => p.id === 'prj-tracabilite')!;
    expect(after.repos.map((x) => x.display)).toEqual([
      'github.com/camille-martin-fictif/tracabilite',
      'github.com/camille-martin-fictif/tracabilite-cli',
      'github.com/camille-martin-fictif/tracabilite-web',
    ]);
  });

  it('propose_edit : un dépôt non cité, ou en double, est refusé', async () => {
    const current = (await store.loadLibrary()).projects.find((p) => p.id === 'prj-tracabilite')!;
    const err = await proposeEdit(store, {
      target: { collection: 'projects', itemId: 'prj-tracabilite' },
      field: 'repos',
      newValue: [...current.repos, REPO('inconnu')],
      rationale: 'Nouveau dépôt',
      userStatement: 'Ajoute un dépôt.',
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(StoreError);
    expect((err as StoreError).message).toMatch(/inconnu/);
    const twice = await proposeEdit(store, {
      target: { collection: 'projects', itemId: 'prj-tracabilite' },
      field: 'repos',
      newValue: [...current.repos, current.repos[0]!],
      rationale: 'Dépôt répété',
    }).catch((e: unknown) => e);
    expect((twice as StoreError).message).toMatch(/dépôt en double/);
  });
});
