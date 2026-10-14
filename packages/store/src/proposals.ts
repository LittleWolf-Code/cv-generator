// Proposals queue (§6.9, F-PRO-01 to 06): freshness of a proposal against its base (`stale`, computed
// on read, never written), acceptance (possibly edited, element by element for a selection, with its
// dependencies), rejection, and batch acceptance that leaves out sensitive facts and conflicts.
import {
  applyLibraryProposal,
  applySelectionDelta,
  batchExclusion,
  canonicalJson,
  checkLibraryIntegrity,
  checkSelectionRule,
  collectionFileSchemas,
  editedPayloadSchemas,
  pick,
  proposalSubject,
  requiredCategory,
  revealAdded,
  ProposalError,
  SCHEMA_VERSION,
  sameJson,
  sanitizeDeep,
  selectionElements,
  type ApplicationSelectionFile,
  type Category,
  type EditedPayload,
  type IdsFile,
  type Library,
  type LibraryApplication,
  type LibraryProposal,
  type PresetFile,
  type ProposalFile,
  type Selection,
  type SelectionProposal,
  type SubjectContext,
} from '@cv/core';
import type { z } from 'zod';
import { StoreError } from './errors.js';
import { prepare, type FieldIssue, type WriteRef } from './library.js';
import { sha256, validateDataFile, type DataStore } from './store.js';

const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** Base hash of a proposal: sha256 of the canonical JSON of the targeted element. */
export function hashSubject(value: unknown): string {
  return `sha256:${sha256(canonicalJson(value))}`;
}

export interface Freshness {
  stale: boolean;
  /** `changed`: the element differs from the base; `missing`: it no longer exists. */
  reason: 'changed' | 'missing' | null;
  /** Current state of the targeted element (null when missing or for a new item). */
  current: unknown;
}

/** `stale` when the targeted element changed since the proposal was computed (F-PRO-04). */
export function proposalFreshness(p: ProposalFile, ctx: SubjectContext): Freshness {
  const subject = proposalSubject(p, ctx);
  if (subject.kind === 'none') return { stale: false, reason: null, current: null };
  if (subject.kind === 'missing') return { stale: true, reason: 'missing', current: null };
  if (!p.base) return { stale: false, reason: null, current: subject.value };
  const stale = hashSubject(subject.value) !== p.base.hash;
  return { stale, reason: stale ? 'changed' : null, current: subject.value };
}

/** Library, presets and the application selections targeted by the given proposals. */
export async function subjectContext(store: DataStore, proposals: ProposalFile[]): Promise<SubjectContext> {
  const [library, presets] = await Promise.all([store.loadLibrary(), store.listPresets()]);
  const apps = new Map<string, Selection>();
  for (const p of proposals) {
    if (p.type !== 'selection' || p.target.kind !== 'application' || apps.has(p.target.id)) continue;
    try {
      apps.set(p.target.id, (await store.loadApplication(p.target.id)).selection.selection);
    } catch {
      // Missing application: the proposal is reported as stale (target missing).
    }
  }
  return {
    library,
    selection: (kind, id) =>
      kind === 'preset' ? (presets.find((x) => x.id === id)?.selection ?? null) : (apps.get(id) ?? null),
  };
}

const isOpen = (p: ProposalFile) => p.status === 'pending' || p.status === 'stale';

async function readProposal(store: DataStore, id: string): Promise<ProposalFile> {
  if (!ULID_RE.test(id)) throw new StoreError('NOT_FOUND', `proposition introuvable : ${id}`);
  const rel = `proposals/${id}.json`;
  if (!(await store.exists(rel))) throw new StoreError('NOT_FOUND', `proposition introuvable : ${id}`);
  return store.read<ProposalFile>(rel);
}

/** Editable part of a proposal, as the user sees it before "modifier puis accepter". */
export function editableOf(p: LibraryProposal): EditedPayload[LibraryProposal['type']] {
  switch (p.type) {
    case 'item':
      return { item: p.payload.item };
    case 'variant':
      return { label: p.payload.label, text: p.payload.text };
    case 'translation':
      return { text: p.payload.text };
    case 'edit':
      return { newValue: p.payload.newValue };
    case 'alias':
      return { alias: p.payload.alias, kind: p.payload.kind };
  }
}

export interface AcceptOptions {
  /** User changes before accepting (shape of `editedPayloadSchemas[type]`). */
  edited?: unknown;
  /** Selection: keys of the elements to apply (`add:<id>`, `remove:<id>`, `variant:<id>`); all by default. */
  elements?: string[];
  /**
   * Also accept the pending proposals it depends on (F-PRO-03): the variants of a selection, the pending
   * category of a skill (ADR 0023).
   */
  withDependencies?: boolean;
  /** Batch acceptance: refuse a stale proposal instead of applying it on the current state. */
  requireFresh?: boolean;
  now?: Date;
}

export interface Resolution {
  proposal: ProposalFile;
  writes: WriteRef[];
  /** Dependencies accepted along the way. */
  dependencies: string[];
}

function toStoreError(err: unknown): never {
  if (err instanceof ProposalError) {
    throw new StoreError(err.code === 'TARGET_MISSING' ? 'NOT_FOUND' : 'NOT_APPLICABLE', err.message);
  }
  throw err;
}

async function writeResolution(
  store: DataStore,
  p: ProposalFile,
  action: 'accepted' | 'edited' | 'rejected',
  finalValue: unknown,
  reason: string | null,
  now: Date,
): Promise<{ proposal: ProposalFile; write: WriteRef }> {
  const next = {
    ...p,
    status: action,
    resolution: {
      at: now.toISOString(),
      action,
      ...(finalValue !== undefined ? { finalValue } : {}),
      reason,
    },
  } as ProposalFile;
  const saved = await store.write(`proposals/${p.id}.json`, next, { locked: true });
  return { proposal: saved, write: { file: `proposals/${p.id}.json`, revision: saved.revision } };
}

/** A proposal of a new category whose reserved id is `categoryId`, whatever its status (ADR 0023). */
async function categoryProposal(store: DataStore, categoryId: string): Promise<ProposalFile | null> {
  const all = await store.listProposals();
  const found = all.filter(
    (x) =>
      x.type === 'item' &&
      x.payload.itemType === 'category' &&
      !x.payload.duplicateOf &&
      x.payload.item.id === categoryId,
  );
  return found.find(isOpen) ?? found[0] ?? null;
}

const categoryLabelOf = (p: ProposalFile) =>
  p.type === 'item' ? pick((p.payload.item as { label?: { fr: string | null; en: string | null } }).label) : '';

/**
 * The change a library proposal makes to `library`, checked as its write would be: sanitization,
 * new integrity errors and schema of the collection file. Throws a StoreError, writes nothing.
 */
function libraryChange(
  library: Library,
  p: LibraryProposal,
  edited: EditedPayload[LibraryProposal['type']] | undefined,
): { app: LibraryApplication; items: unknown[] } {
  let app;
  try {
    app = applyLibraryProposal(library, p, edited);
  } catch (err) {
    toStoreError(err);
  }
  if (!app.changed) return { app, items: app.items };
  const { value: items, issues } = sanitizeDeep(app.items, '$');
  if (issues.length) {
    throw new StoreError('INVALID_DATA', "texte refusé par l'assainissement", {
      issues: issues.map((i): FieldIssue => ({ path: i.path, message: i.message })),
    });
  }
  const next = { ...library, [app.collection]: items };
  const known = new Set(checkLibraryIntegrity(library).errors.map((e) => e.message));
  const fresh = checkLibraryIntegrity(next as Library).errors.filter((e) => !known.has(e.message));
  if (fresh.length) throw new StoreError('NOT_APPLICABLE', fresh.map((e) => e.message).join(' ; '));
  const rel = `library/${app.collection}.json`;
  validateDataFile(rel, collectionFileSchemas[app.collection] as z.ZodType<unknown>, {
    schemaVersion: SCHEMA_VERSION,
    revision: 0,
    items,
  });
  return { app, items };
}

async function acceptLibrary(
  store: DataStore,
  p: LibraryProposal,
  opts: AcceptOptions,
  now: Date,
  visiting: Set<string>,
): Promise<Resolution> {
  let edited: EditedPayload[LibraryProposal['type']] | undefined;
  if (opts.edited !== undefined) {
    const { value, issues } = prepare(editedPayloadSchemas[p.type] as z.ZodType<unknown>, opts.edited);
    if (!value) throw new StoreError('INVALID_DATA', 'modification invalide', { issues });
    edited = value as EditedPayload[LibraryProposal['type']];
  }
  let library = await store.loadLibrary();
  // A skill in a pending category (ADR 0023), computed on the final value: accepted after it, or with it.
  const depWrites: WriteRef[] = [];
  const dependencies: string[] = [];
  const required = requiredCategory(p, edited);
  if (required && !library.categories.some((c) => c.id === required)) {
    const dep = await categoryProposal(store, required);
    if (dep && isOpen(dep) && dep.type === 'item') {
      const label = categoryLabelOf(dep);
      if (!opts.withDependencies) {
        throw new StoreError(
          'DEPENDENCY_PENDING',
          `cette compétence dépend de la catégorie proposée « ${label} » : acceptez-la avant, ou avec elle`,
          { pending: [dep.id] },
        );
      }
      // The final value is checked first against the library with the pending category in memory:
      // a skill refused afterwards would leave its category accepted (partial acceptance).
      libraryChange({ ...library, categories: [...library.categories, dep.payload.item as Category] }, p, edited);
      const r = await acceptLocked(store, dep.id, { now }, visiting);
      depWrites.push(...r.writes);
      dependencies.push(dep.id, ...r.dependencies);
      library = await store.loadLibrary();
    } else if (dep && (dep.status === 'rejected' || dep.status === 'superseded')) {
      throw new StoreError(
        'NOT_APPLICABLE',
        `la catégorie proposée « ${categoryLabelOf(dep)} » a été rejetée : modifiez puis acceptez avec une autre catégorie`,
      );
    }
  }
  const { app, items } = libraryChange(library, p, edited);
  const writes: WriteRef[] = [];
  if (app.changed) {
    if (app.newIds.length) {
      const registry: IdsFile = await store.readIds();
      let added = false;
      for (const { id, kind } of app.newIds) {
        if (!registry.ids[id]) {
          registry.ids[id] = { kind, createdAt: now.toISOString() };
          added = true;
        }
      }
      if (added) {
        const saved = await store.write('ids.json', registry, { locked: true });
        writes.push({ file: 'ids.json', revision: saved.revision });
      }
    }
    const rel = `library/${app.collection}.json`;
    const file = await store.read<{ schemaVersion: 1; revision: number; items: unknown[] }>(rel);
    const saved = await store.write(rel, { ...file, items }, { locked: true });
    writes.push({ file: rel, revision: saved.revision });
  }
  const action = edited !== undefined && !sameJson(edited, editableOf(p)) ? 'edited' : 'accepted';
  const { proposal, write } = await writeResolution(store, p, action, app.finalValue, null, now);
  return { proposal, writes: [...depWrites, ...writes, write], dependencies };
}

async function acceptSelection(
  store: DataStore,
  p: SelectionProposal,
  opts: AcceptOptions,
  now: Date,
  visiting: Set<string>,
): Promise<Resolution> {
  const writes: WriteRef[] = [];
  const dependencies: string[] = [];
  const pending: string[] = [];
  for (const depId of p.dependsOn) {
    let dep: ProposalFile;
    try {
      dep = await readProposal(store, depId);
    } catch {
      continue; // Unknown dependency: elements that reference it are skipped below.
    }
    if (!isOpen(dep)) continue;
    if (!opts.withDependencies) {
      pending.push(depId);
      continue;
    }
    // Transitive: a selection, a pending skill it depends on (explicit dependsOn), that skill's pending
    // category. A selection cannot add a pending skill itself: `add` only takes validated elements.
    const r = await acceptLocked(store, depId, { now, withDependencies: true }, visiting);
    writes.push(...r.writes);
    dependencies.push(depId, ...r.dependencies);
  }
  if (pending.length) {
    throw new StoreError(
      'DEPENDENCY_PENDING',
      `cette sélection dépend de ${pending.length} proposition(s) en attente : acceptez-les avant, ou avec elle`,
      { pending },
    );
  }

  const resolved = new Map<string, { variantId: string } | { reason: string }>();
  for (const el of selectionElements(p.payload)) {
    if (!el.value?.startsWith('prop:')) continue;
    const ref = el.value.slice(5);
    try {
      const dep = await readProposal(store, ref);
      const fv = dep.resolution?.finalValue as { variantId?: string } | undefined;
      if ((dep.status === 'accepted' || dep.status === 'edited') && fv?.variantId) {
        resolved.set(ref, { variantId: fv.variantId });
      } else if (dep.status === 'rejected') {
        resolved.set(ref, { reason: 'la variante proposée a été rejetée' });
      } else {
        resolved.set(ref, { reason: 'la variante proposée est encore en attente' });
      }
    } catch {
      resolved.set(ref, { reason: 'proposition de variante introuvable' });
    }
  }

  const rel = p.target.kind === 'preset' ? `presets/${p.target.id}.json` : `applications/${p.target.id}/selection.json`;
  if (!(await store.exists(rel))) throw new StoreError('NOT_FOUND', `cible introuvable : ${p.target.id}`);
  const file = await store.read<PresetFile | ApplicationSelectionFile>(rel);
  const result = applySelectionDelta(file.selection, p.payload, opts.elements ?? null, (ref) => resolved.get(ref)!);
  const library = await store.loadLibrary();
  // An added element becomes visible: its section is enabled, the entry of a bullet is checked (ADR 0014).
  revealAdded(
    library,
    result.selection,
    result.applied.filter((k) => k.startsWith('add:')).map((k) => k.slice(4)),
    file.options.regulatoryPlacement,
  );
  // F-SEL-10: an automatic pre-selection never hides a whole experience nor unchecks a locked element.
  const violations = checkSelectionRule(library, file.selection, result.selection);
  if (violations.length > 0) {
    const ids = [...new Set(violations.map((v) => v.id))];
    throw new StoreError(
      'SELECTION_RULE',
      `proposition refusée (F-SEL-10) : ${violations.map((v) => v.message).join(' ; ')}`,
      { ids, violations },
      `décochez ces éléments de la proposition (${ids.join(', ')}) ou rejetez-la`,
    );
  }
  if (result.applied.length === 0) {
    throw new StoreError(
      'NOT_APPLICABLE',
      `aucun élément applicable${result.skipped.length ? ` (${result.skipped.map((s) => s.reason).join(' ; ')})` : ''}`,
      { skipped: result.skipped },
    );
  }
  if (!sameJson(result.selection, file.selection)) {
    const saved = await store.write(rel, { ...file, selection: result.selection }, { locked: true });
    writes.push({ file: rel, revision: saved.revision });
  }
  const all = selectionElements(p.payload).length;
  const action = result.applied.length === all ? 'accepted' : 'edited';
  const { proposal, write } = await writeResolution(
    store,
    p,
    action,
    { applied: result.applied, skipped: result.skipped },
    null,
    now,
  );
  return { proposal, writes: [...writes, write], dependencies };
}

async function acceptLocked(
  store: DataStore,
  id: string,
  opts: AcceptOptions,
  visiting = new Set<string>(),
): Promise<Resolution> {
  if (visiting.has(id)) throw new StoreError('NOT_APPLICABLE', `dépendance circulaire : ${id}`);
  visiting.add(id);
  const p = await readProposal(store, id);
  if (!isOpen(p)) {
    throw new StoreError('ALREADY_RESOLVED', `proposition déjà traitée (${p.status})`, { status: p.status });
  }
  if (opts.requireFresh) {
    const ctx = await subjectContext(store, [p]);
    if (proposalFreshness(p, ctx).stale) {
      throw new StoreError('NOT_APPLICABLE', "l'élément a changé depuis la proposition : conflit à traiter un par un");
    }
  }
  const now = opts.now ?? new Date();
  return p.type === 'selection'
    ? acceptSelection(store, p, opts, now, visiting)
    : acceptLibrary(store, p, opts, now, visiting);
}

/** Accepts one proposal (F-PRO-03). Validated text is never overwritten. */
export async function acceptProposal(store: DataStore, id: string, opts: AcceptOptions = {}): Promise<Resolution> {
  return store.withLock(() => acceptLocked(store, id, opts));
}

export async function rejectProposal(
  store: DataStore,
  id: string,
  reason: string | null = null,
  now = new Date(),
): Promise<Resolution> {
  let why: string | null = null;
  if (reason && reason.trim()) {
    const { value, issues } = sanitizeDeep({ reason }, '$');
    if (issues.length) throw new StoreError('INVALID_DATA', issues[0]!.message);
    why = value.reason || null;
  }
  return store.withLock(async () => {
    const p = await readProposal(store, id);
    if (!isOpen(p)) throw new StoreError('ALREADY_RESOLVED', `proposition déjà traitée (${p.status})`);
    const { proposal, write } = await writeResolution(store, p, 'rejected', undefined, why, now);
    return { proposal, writes: [write], dependencies: [] };
  });
}

export interface BatchResult {
  accepted: string[];
  skipped: Array<{ id: string; reason: string }>;
  writes: WriteRef[];
}

/** Order of a batch: new categories, then the other library proposals, then selections (ADR 0023). */
function batchRank(p: ProposalFile): number {
  if (p.type === 'selection') return 2;
  return p.type === 'item' && p.payload.itemType === 'category' && !p.payload.duplicateOf ? 0 : 1;
}

/**
 * Batch acceptance (F-UI-03): sensitive facts (F-PRO-06), dates to check (ADR 0015) and conflicts are
 * left out, to be handled one by one. New categories go first, then the other library proposals, then
 * selections, so that each proposal finds what it depends on (a skill its category, a selection its
 * variants). A proposal with an open dependency outside the batch is left out.
 */
export async function acceptBatch(store: DataStore, ids: string[], now = new Date()): Promise<BatchResult> {
  return store.withLock(async () => {
    const out: BatchResult = { accepted: [], skipped: [], writes: [] };
    const loaded: ProposalFile[] = [];
    for (const id of [...new Set(ids)]) {
      try {
        loaded.push(await readProposal(store, id));
      } catch (err) {
        out.skipped.push({ id, reason: (err as Error).message });
      }
    }
    loaded.sort((a, b) => batchRank(a) - batchRank(b));
    const inBatch = new Set(loaded.map((p) => p.id));
    for (const p of loaded) {
      if (!isOpen(p)) {
        out.skipped.push({ id: p.id, reason: `déjà traitée (${p.status})` });
        continue;
      }
      const excluded = batchExclusion(p);
      if (excluded) {
        out.skipped.push({ id: p.id, reason: excluded });
        continue;
      }
      if (p.dependsOn.some((d) => !inBatch.has(d) && !out.accepted.includes(d))) {
        const open: string[] = [];
        for (const d of p.dependsOn) {
          try {
            if (isOpen(await readProposal(store, d))) open.push(d);
          } catch {
            // Unknown dependency: handled when the proposal is applied.
          }
        }
        if (open.some((d) => !inBatch.has(d))) {
          out.skipped.push({ id: p.id, reason: 'dépend de propositions en attente hors du lot' });
          continue;
        }
      }
      try {
        const r = await acceptLocked(store, p.id, { requireFresh: true, now });
        out.accepted.push(p.id);
        out.writes.push(...r.writes);
      } catch (err) {
        out.skipped.push({ id: p.id, reason: (err as Error).message });
      }
    }
    return out;
  });
}
