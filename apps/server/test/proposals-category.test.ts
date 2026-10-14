// ADR 0023 on the API: review views of a proposed category and of a skill that depends on it, 409 then
// acceptance with its dependency, batch in any order, rejected category, live form check with the pending
// categories, NF-01 on the routes. Proposals are created by the store on a copy of the fictitious persona.
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  acceptProposal,
  DataStore,
  deleteItem,
  installFixture,
  proposeEdit,
  proposeItems,
  type ItemInput,
  type ProposeResult,
} from '@cv/store';
import { createApp } from '../src/app.js';
import type { ProposalView } from '../src/proposal-views.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const TOKEN = 'e'.repeat(64);
const API = 'http://127.0.0.1:4311';
const UI = 'http://127.0.0.1:4310';
const OPTS = { importDir: null };

let dir: string;
let store: DataStore;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'cv-api-category-'));
  await installFixture(path.join(ROOT, 'fixtures', 'personas', 'courte'), dir);
  store = DataStore.open(dir);
  app = createApp({ store, token: TOKEN, apiPort: 4311, uiOrigins: [UI] });
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const get = (url: string) => app.request(`${API}${url}`, { headers: { 'x-cv-token': TOKEN } });
const send = (method: string, url: string, body: unknown = {}) =>
  app.request(`${API}${url}`, {
    method,
    headers: { 'content-type': 'application/json', origin: UI, 'x-cv-token': TOKEN },
    body: JSON.stringify(body),
  });

interface ProposalsBody {
  proposals: ProposalView[];
  pendingCategories: Array<{ id: string; label: string; proposalId: string }>;
}
type Created = Extract<ProposeResult, { status: 'created' }>;

async function propose(input: ItemInput): Promise<Created> {
  const out = await proposeItems(store, [input], OPTS);
  expect(out.results[0]!.status, JSON.stringify(out.results[0])).toBe('created');
  return out.results[0] as Created;
}

/** A category dictated by the user, then a skill in that pending category (two calls, as the MCP does). */
async function pair(): Promise<{ cat: Created; sk: Created }> {
  const cat = await propose({
    type: 'category',
    data: { label: { fr: 'Dispositifs médicaux' } },
    source: 'dictee',
    userStatement: 'Ajoute une catégorie Dispositifs médicaux.',
  });
  const sk = await propose({
    type: 'skill',
    data: { category: cat.itemId, short: 'Pydicom', long: null },
    source: 'dictee',
    userStatement: "J'utilise Pydicom au quotidien.",
  });
  return { cat, sk };
}

const views = async (query = '') => (await (await get(`/api/proposals${query}`)).json()) as ProposalsBody;
const viewOf = async (id: string) => (await views()).proposals.find((v) => v.id === id)!;

describe('vues de l’écran « À valider » (ADR 0023)', () => {
  it('la catégorie est un nouvel élément ; la compétence en dépend et affiche son libellé en attente', async () => {
    const { cat, sk } = await pair();
    expect(cat.itemId).toBe('cat-dispositifs-medicaux');
    expect(sk.dependsOn).toEqual([cat.proposalId]);

    const catView = await viewOf(cat.proposalId);
    expect(catView.target).toBe('Nouvel élément : Catégorie « Dispositifs médicaux »');
    expect(catView.collection).toBe('categories');
    expect(catView.applicable).toEqual({ ok: true, reason: null });
    expect((catView.editable as { item: unknown }).item).toEqual({
      id: 'cat-dispositifs-medicaux',
      label: { fr: 'Dispositifs médicaux', en: null },
    });

    const skView = await viewOf(sk.proposalId);
    expect(skView.collection).toBe('skills');
    expect(skView.dependsOn).toEqual([
      { id: cat.proposalId, status: 'pending', label: 'Nouvel élément : Catégorie « Dispositifs médicaux »' },
    ]);
    expect(skView.applicable).toEqual({
      ok: true,
      reason: 'acceptée avec la catégorie proposée « Dispositifs médicaux » dont elle dépend',
    });
    const line = skView.diff.find((d) => d.label === 'Catégorie');
    expect(line?.segments).toEqual([{ op: 'ins', text: 'Dispositifs médicaux (en attente)' }]);
  });

  it('pendingCategories est donné même quand ?ids= ne montre que la compétence', async () => {
    const { cat, sk } = await pair();
    const body = await views(`?ids=${sk.proposalId}`);
    expect(body.proposals.map((v) => v.id)).toEqual([sk.proposalId]);
    expect(body.pendingCategories).toEqual([
      { id: 'cat-dispositifs-medicaux', label: 'Dispositifs médicaux', proposalId: cat.proposalId },
    ]);
  });

  it('une catégorie rejetée rend la compétence non applicable, avec le motif', async () => {
    const { cat, sk } = await pair();
    expect((await send('POST', `/api/proposals/${cat.proposalId}/reject`, { reason: null })).status).toBe(200);
    const skView = await viewOf(sk.proposalId);
    expect(skView.applicable).toEqual({
      ok: false,
      reason:
        'la catégorie proposée « Dispositifs médicaux » a été rejetée : modifiez puis acceptez avec une autre catégorie',
    });
    expect(skView.dependsOn[0]!.status).toBe('rejected');
    expect((await views()).pendingCategories).toEqual([]);
  });

  it('une catégorie acceptée puis supprimée donne « catégorie inconnue », comme le store, jamais « rejetée »', async () => {
    const { cat, sk } = await pair();
    await acceptProposal(store, cat.proposalId);
    await deleteItem(store, 'categories', cat.itemId!);
    const skView = await viewOf(sk.proposalId);
    expect(skView.applicable).toEqual({ ok: false, reason: 'catégorie inconnue : cat-dispositifs-medicaux' });
    const res = await send('POST', `/api/proposals/${sk.proposalId}/accept`, { withDependencies: true });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { message: string }).message).toBe('catégorie inconnue : cat-dispositifs-medicaux');
  });

  it('propose_edit du champ category vers une catégorie en attente : dépendance et libellé « (en attente) »', async () => {
    const { cat } = await pair();
    const edit = await proposeEdit(store, {
      target: { collection: 'skills', itemId: 'sk-git' },
      field: 'category',
      newValue: cat.itemId,
      rationale: 'Git sert aux dispositifs médicaux.',
    });
    const v = await viewOf(edit.proposalId);
    expect(v.dependsOn).toEqual([
      { id: cat.proposalId, status: 'pending', label: 'Nouvel élément : Catégorie « Dispositifs médicaux »' },
    ]);
    expect(v.applicable).toEqual({
      ok: true,
      reason: 'acceptée avec la catégorie proposée « Dispositifs médicaux » dont elle dépend',
    });
    const block = v.diff.find((d) => d.label.startsWith('Catégorie'))!;
    const after = block.segments
      .filter((s) => s.op !== 'del')
      .map((s) => s.text)
      .join('');
    expect(after).toBe('Dispositifs médicaux (en attente)');
  });
});

describe('acceptation (F-PRO-03, ADR 0023)', () => {
  it('409 DEPENDENCY_PENDING, puis 200 avec withDependencies', async () => {
    const { cat, sk } = await pair();
    const refused = await send('POST', `/api/proposals/${sk.proposalId}/accept`, {});
    expect(refused.status).toBe(409);
    const err = (await refused.json()) as { code: string; details: unknown };
    expect(err.code).toBe('DEPENDENCY_PENDING');
    expect(err.details).toEqual({ pending: [cat.proposalId] });

    const ok = await send('POST', `/api/proposals/${sk.proposalId}/accept`, { withDependencies: true });
    expect(ok.status).toBe(200);
    const r = (await ok.json()) as { dependencies: string[]; writes: Array<{ file: string; revision: number }> };
    expect(r.dependencies).toEqual([cat.proposalId]);
    expect(r.writes.map((w) => w.file)).toEqual(
      expect.arrayContaining(['library/categories.json', 'library/skills.json']),
    );
    const library = await store.loadLibrary();
    expect(library.categories.map((c) => c.id)).toContain('cat-dispositifs-medicaux');
    expect(library.skills.find((s) => s.short === 'Pydicom')?.category).toBe('cat-dispositifs-medicaux');
  });

  it('« modifier puis accepter » vers une catégorie en attente : 200 avec withDependencies, comme l’envoie la carte', async () => {
    const cat = await propose({
      type: 'category',
      data: { label: { fr: 'Imagerie' } },
      source: 'dictee',
      userStatement: 'Ajoute une catégorie Imagerie.',
    });
    const sk = await propose({
      type: 'skill',
      data: { category: 'outils', short: 'Pydicom', long: null },
      source: 'dictee',
      userStatement: "J'utilise Pydicom au quotidien.",
    });
    const v = await viewOf(sk.proposalId);
    expect(v.dependsOn).toEqual([]);
    const item = (v.editable as { item: Record<string, unknown> }).item;
    const edited = { item: { ...item, category: cat.itemId } };
    const refused = await send('POST', `/api/proposals/${sk.proposalId}/accept`, { edited, withDependencies: false });
    expect(refused.status).toBe(409);
    const ok = await send('POST', `/api/proposals/${sk.proposalId}/accept`, { edited, withDependencies: true });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { dependencies: string[] }).dependencies).toEqual([cat.proposalId]);
    expect((await store.loadLibrary()).skills.find((s) => s.short === 'Pydicom')?.category).toBe('cat-imagerie');
  });

  it('le lot accepte les deux, même dans le désordre', async () => {
    const { cat, sk } = await pair();
    const res = await send('POST', '/api/proposals/accept-batch', { ids: [sk.proposalId, cat.proposalId] });
    expect(res.status).toBe(200);
    const r = (await res.json()) as { accepted: string[]; skipped: unknown[] };
    expect(r.skipped).toEqual([]);
    expect(r.accepted).toEqual([cat.proposalId, sk.proposalId]);
  });
});

describe('contrôle du formulaire « modifier puis accepter »', () => {
  it('withPendingCategories : aucune issue sur la catégorie en attente', async () => {
    const { cat } = await pair();
    const item = { category: cat.itemId, short: 'Orthanc', long: null };
    const plain = (await (await send('POST', '/api/library/skills/check', { item })).json()) as {
      issues: Array<{ path: string }>;
    };
    expect(plain.issues.map((i) => i.path)).toContain('category');
    const res = await send('POST', '/api/library/skills/check', { item, withPendingCategories: true });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { issues: Array<{ path: string }> };
    expect(body.issues.filter((i) => i.path === 'category')).toEqual([]);
  });
});

describe('NF-01', () => {
  it('403 sans jeton', async () => {
    const { sk } = await pair();
    expect((await app.request(`${API}/api/proposals`)).status).toBe(403);
    const noToken = await app.request(`${API}/api/proposals/${sk.proposalId}/accept`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: UI },
      body: JSON.stringify({ withDependencies: true }),
    });
    expect(noToken.status).toBe(403);
    const check = await app.request(`${API}/api/library/skills/check`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: UI },
      body: JSON.stringify({ item: {}, withPendingCategories: true }),
    });
    expect(check.status).toBe(403);
  });
});
