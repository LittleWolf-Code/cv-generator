// Library editing from the interface (F-LIB-05): create, modify, duplicate, archive, then delete an
// archived element. Every write sanitizes (annex B.1), assigns missing ids (F-LIB-02), validates the
// schema and the cross-file integrity, under the single data lock (§8.4).
import {
  checkLibraryIntegrity,
  collectionItemSchemas,
  entryWarnings,
  identity as identitySchema,
  openCategoryProposals,
  sameJson,
  sanitizeDeep,
  type CollectionName,
  type FieldWarning,
  type Identity,
  type IdKind,
  type IdsFile,
  type Library,
  type ProfileFile,
} from '@cv/core';
import type { z } from 'zod';
import { StoreError } from './errors.js';
import { allocateIdIn, type DataStore } from './store.js';

export interface WriteRef {
  /** Path relative to the data directory, with `/`. */
  file: string;
  /** null for a file without revision (offer.md, an exported file). */
  revision: number | null;
}

export interface FieldIssue {
  /** Dot path inside the element (`position.en`, `bullets.0.variants.1.text.fr`); empty for the element. */
  path: string;
  message: string;
}

export interface ItemWrite {
  item: Record<string, unknown>;
  revision: number;
  writes: WriteRef[];
  warnings: FieldWarning[];
}

export const COLLECTION_KIND: Record<CollectionName, IdKind> = {
  titles: 'title',
  summaries: 'summary',
  experiences: 'experience',
  education: 'education',
  projects: 'project',
  skills: 'skill',
  certifications: 'certification',
  languages: 'language',
  interests: 'interest',
  categories: 'category',
};

type AnyRecord = Record<string, unknown>;
interface CollectionFile {
  schemaVersion: 1;
  revision: number;
  items: AnyRecord[];
}

const firstWords = (s: unknown, n = 4) =>
  typeof s === 'string' ? s.split(/\s+/).filter(Boolean).slice(0, n).join(' ') : '';
const pickText = (b: unknown) => {
  const v = b as { fr?: string | null; en?: string | null } | null | undefined;
  return v?.fr ?? v?.en ?? '';
};
const year = (ym: unknown) => (typeof ym === 'string' ? ym.slice(0, 4) : '');

/** Readable base of a generated id (`exp-medtech-exemple-2023`, `sk-python`…). */
export function idBase(collection: CollectionName, item: AnyRecord): string {
  const firstVariant = () => firstWords(pickText((item.variants as AnyRecord[] | undefined)?.[0]?.text));
  switch (collection) {
    case 'titles':
    case 'summaries':
      return firstVariant();
    case 'experiences':
      return `${firstWords(item.organization, 3)} ${year(item.start)}`;
    case 'education':
      return `${firstWords(item.institution, 3)} ${year(item.end) || year(item.start)}`;
    case 'projects':
      return firstWords(pickText(item.name));
    case 'skills':
      return String(item.short ?? '');
    case 'certifications':
      return firstWords(pickText(item.name));
    case 'languages':
      return String(item.code ?? '');
    case 'interests':
      return firstWords(pickText(item.text));
    case 'categories':
      return firstWords(pickText(item.label), 3);
  }
}

function bulletIdBase(bullet: AnyRecord): string {
  return firstWords(pickText((bullet.variants as AnyRecord[] | undefined)?.[0]?.text));
}

const isBlankId = (v: unknown) => typeof v !== 'string' || v.trim() === '';

/** `$.a.b[0].c` (sanitizeDeep) → `a.b.0.c`. */
function dotPath(p: string): string {
  return p
    .replace(/^\$\.?/, '')
    .replace(/\[(\d+)\]/g, '.$1')
    .replace(/^\./, '');
}

function zodIssues(error: z.ZodError, prefix = ''): FieldIssue[] {
  return error.issues.map((i) => ({ path: prefix + i.path.join('.'), message: i.message }));
}

/** Sanitizes then validates: issues name the field (F-LIB-05). */
export function prepare<T>(schema: z.ZodType<T>, input: unknown): { value: T | null; issues: FieldIssue[] } {
  const { value, issues } = sanitizeDeep(input, '$');
  const refused: FieldIssue[] = issues.map((i) => ({ path: dotPath(i.path), message: i.detail ?? i.message }));
  const parsed = schema.safeParse(value);
  if (parsed.success && refused.length === 0) return { value: parsed.data, issues: [] };
  const seen = new Set(refused.map((i) => i.path));
  const rest = parsed.success ? [] : zodIssues(parsed.error).filter((i) => !seen.has(i.path));
  return { value: null, issues: [...refused, ...rest] };
}

function invalid(message: string, issues: FieldIssue[]): StoreError {
  return new StoreError('INVALID_DATA', message, { issues });
}

/** Fills blank ids of an element (and of its bullets / identity links) from the registry. */
export function assignIds(
  registry: IdsFile,
  collection: CollectionName,
  item: AnyRecord,
  opts: { itemId?: string; placeholder?: () => string } = {},
): void {
  const alloc = (kind: IdKind, base: string) =>
    opts.placeholder ? opts.placeholder() : allocateIdIn(registry, kind, base);
  if (opts.itemId) item.id = opts.itemId;
  else if (isBlankId(item.id)) item.id = alloc(COLLECTION_KIND[collection], idBase(collection, item));
  if (Array.isArray(item.bullets)) {
    for (const b of item.bullets as AnyRecord[]) {
      if (b && typeof b === 'object' && isBlankId(b.id)) b.id = alloc('bullet', bulletIdBase(b));
    }
  }
}

/** Integrity errors introduced by `next` (duplicate ids, unknown category), as field issues. */
function newIntegrityIssues(before: Library, next: Library): FieldIssue[] {
  const known = new Set(checkLibraryIntegrity(before).errors.map((e) => e.message));
  return checkLibraryIntegrity(next)
    .errors.filter((e) => !known.has(e.message))
    .map((e) => ({ path: e.path.endsWith('.category') ? 'category' : '', message: e.message }));
}

const relOf = (collection: CollectionName) => `library/${collection}.json`;

function withItems(library: Library, collection: CollectionName, items: AnyRecord[]): Library {
  return { ...library, [collection]: items } as Library;
}

async function readCollection(store: DataStore, collection: CollectionName): Promise<CollectionFile> {
  const rel = relOf(collection);
  if (!(await store.exists(rel))) return { schemaVersion: 1, revision: 0, items: [] };
  return store.read<CollectionFile>(rel);
}

/**
 * Validation without writing (live form check): issues and ATS-22 warnings. `withPendingCategories`: the
 * form edits a proposal ("modifier puis accepter"), whose skill may target a pending category (ADR 0023).
 */
export async function checkItem(
  store: DataStore,
  collection: CollectionName,
  input: unknown,
  itemId: string | null = null,
  opts: { withPendingCategories?: boolean } = {},
): Promise<{ issues: FieldIssue[]; warnings: FieldWarning[] }> {
  const draft = structuredClone((input ?? {}) as AnyRecord);
  let n = 0;
  assignIds({ schemaVersion: 1, revision: 0, ids: {} }, collection, draft, {
    ...(itemId ? { itemId } : {}),
    placeholder: () => `brouillon-${++n}`,
  });
  const { value, issues } = prepare(collectionItemSchemas[collection] as z.ZodType<AnyRecord>, draft);
  const warnings = entryWarnings(collection, value ?? draft);
  if (!value) return { issues, warnings };
  let library = await store.loadLibrary();
  if (opts.withPendingCategories) {
    // The pending category being edited itself is not counted twice.
    const pending = [...openCategoryProposals(await store.listProposals()).values()]
      .map((p) => p.payload.item)
      .filter((c) => c.id !== value.id);
    library = { ...library, categories: [...library.categories, ...pending] };
  }
  const items = (library[collection] as unknown as AnyRecord[]).filter((i) => i.id !== itemId);
  return { issues: newIntegrityIssues(library, withItems(library, collection, [...items, value])), warnings };
}

async function commit(
  store: DataStore,
  collection: CollectionName,
  file: CollectionFile,
  items: AnyRecord[],
  registry: IdsFile | null,
): Promise<{ revision: number; writes: WriteRef[] }> {
  const writes: WriteRef[] = [];
  if (registry) {
    const ids = await store.write('ids.json', registry, { locked: true });
    writes.push({ file: 'ids.json', revision: ids.revision });
  }
  const saved = await store.write(relOf(collection), { ...file, items }, { locked: true });
  writes.push({ file: relOf(collection), revision: saved.revision });
  return { revision: saved.revision, writes };
}

/** Validates `input`, assigns its ids, checks integrity; returns the stored form of the element. */
async function validated(
  store: DataStore,
  collection: CollectionName,
  input: unknown,
  registry: IdsFile,
  others: AnyRecord[],
  itemId?: string,
): Promise<AnyRecord> {
  const draft = structuredClone((input ?? {}) as AnyRecord);
  // Sanitize/validate a first time without ids, so that refused text does not consume identifiers.
  let n = 0;
  const probe = structuredClone(draft);
  assignIds(registry, collection, probe, { ...(itemId ? { itemId } : {}), placeholder: () => `brouillon-${++n}` });
  const first = prepare(collectionItemSchemas[collection] as z.ZodType<AnyRecord>, probe);
  if (!first.value) throw invalid('élément invalide', first.issues);
  assignIds(registry, collection, draft, itemId ? { itemId } : {});
  const { value, issues } = prepare(collectionItemSchemas[collection] as z.ZodType<AnyRecord>, draft);
  if (!value) throw invalid('élément invalide', issues);
  const library = await store.loadLibrary();
  const integrity = newIntegrityIssues(library, withItems(library, collection, [...others, value]));
  if (integrity.length) throw invalid('élément incohérent avec la bibliothèque', integrity);
  return value;
}

export async function createItem(store: DataStore, collection: CollectionName, input: unknown): Promise<ItemWrite> {
  return store.withLock(async () => {
    const file = await readCollection(store, collection);
    const registry = await store.readIds();
    const before = Object.keys(registry.ids).length;
    // Identifiers are assigned by the server (F-LIB-02): any id sent by the client is ignored.
    const fresh = structuredClone((input ?? {}) as AnyRecord);
    fresh.id = '';
    if (Array.isArray(fresh.bullets)) for (const b of fresh.bullets as AnyRecord[]) if (b) b.id = '';
    const item = await validated(store, collection, fresh, registry, file.items);
    const { revision, writes } = await commit(
      store,
      collection,
      file,
      [...file.items, item],
      Object.keys(registry.ids).length > before ? registry : null,
    );
    return { item, revision, writes, warnings: entryWarnings(collection, item) };
  });
}

export interface UpdateInput {
  item: unknown;
  /** Revision of the collection file the form was loaded from. */
  expectedRevision: number;
  /** The element as loaded: when the file changed elsewhere but this element did not, the edit is re-applied. */
  base?: unknown;
}

export async function updateItem(
  store: DataStore,
  collection: CollectionName,
  itemId: string,
  input: UpdateInput,
): Promise<ItemWrite> {
  return store.withLock(async () => {
    const file = await readCollection(store, collection);
    const index = file.items.findIndex((i) => i.id === itemId);
    if (index < 0) throw new StoreError('NOT_FOUND', `élément introuvable : ${itemId}`);
    const current = file.items[index]!;
    if (file.revision !== input.expectedRevision && (input.base === undefined || !sameJson(current, input.base))) {
      throw new StoreError(
        'STALE_REVISION',
        `l'élément ${itemId} a été modifié ailleurs depuis son ouverture`,
        { file: relOf(collection), currentRevision: file.revision, current },
        'rechargez la version actuelle, puis refaites la modification',
      );
    }
    const registry = await store.readIds();
    const before = Object.keys(registry.ids).length;
    const others = file.items.filter((_, i) => i !== index);
    const item = await validated(store, collection, input.item, registry, others, itemId);
    const items = file.items.map((x, i) => (i === index ? item : x));
    const { revision, writes } = await commit(
      store,
      collection,
      file,
      items,
      Object.keys(registry.ids).length > before ? registry : null,
    );
    return { item, revision, writes, warnings: entryWarnings(collection, item) };
  });
}

/** Copy with new ids (element and bullets), inserted right after the original, never archived. */
export async function duplicateItem(store: DataStore, collection: CollectionName, itemId: string): Promise<ItemWrite> {
  return store.withLock(async () => {
    const file = await readCollection(store, collection);
    const index = file.items.findIndex((i) => i.id === itemId);
    if (index < 0) throw new StoreError('NOT_FOUND', `élément introuvable : ${itemId}`);
    const copy = structuredClone(file.items[index]!);
    copy.id = '';
    if ('archived' in copy) copy.archived = false;
    if (Array.isArray(copy.bullets)) for (const b of copy.bullets as AnyRecord[]) b.id = '';
    const registry = await store.readIds();
    const item = await validated(store, collection, copy, registry, file.items);
    const items = [...file.items.slice(0, index + 1), item, ...file.items.slice(index + 1)];
    const { revision, writes } = await commit(store, collection, file, items, registry);
    return { item, revision, writes, warnings: entryWarnings(collection, item) };
  });
}

/** First step of a deletion (F-LIB-05): the element leaves the CV but stays in the library. */
export async function setItemArchived(
  store: DataStore,
  collection: CollectionName,
  itemId: string,
  archived: boolean,
): Promise<ItemWrite> {
  if (collection === 'categories') {
    throw new StoreError('NOT_APPLICABLE', "une catégorie ne s'archive pas : supprimez-la si elle n'est plus utilisée");
  }
  return store.withLock(async () => {
    const file = await readCollection(store, collection);
    const index = file.items.findIndex((i) => i.id === itemId);
    if (index < 0) throw new StoreError('NOT_FOUND', `élément introuvable : ${itemId}`);
    const item = { ...file.items[index]!, archived };
    const items = file.items.map((x, i) => (i === index ? item : x));
    const { revision, writes } = await commit(store, collection, file, items, null);
    return { item, revision, writes, warnings: entryWarnings(collection, item) };
  });
}

/**
 * Second step (F-LIB-05): removes an archived element (or an unused category). Its id stays in
 * ids.json and is never reused (F-LIB-02); references left in presets are ignored with a warning (§9.3).
 */
export async function deleteItem(
  store: DataStore,
  collection: CollectionName,
  itemId: string,
): Promise<{ writes: WriteRef[] }> {
  return store.withLock(async () => {
    const file = await readCollection(store, collection);
    const current = file.items.find((i) => i.id === itemId);
    if (!current) throw new StoreError('NOT_FOUND', `élément introuvable : ${itemId}`);
    if (collection === 'categories') {
      const skills = await readCollection(store, 'skills');
      const users = skills.items.filter((s) => s.category === itemId).map((s) => String(s.short));
      if (users.length) {
        throw new StoreError('IN_USE', `catégorie utilisée par ${users.length} compétence(s) : ${users.join(', ')}`, {
          users,
        });
      }
    } else if (current.archived !== true) {
      throw new StoreError('NOT_ARCHIVED', "archivez d'abord l'élément, puis supprimez-le définitivement");
    }
    const { writes } = await commit(
      store,
      collection,
      file,
      file.items.filter((i) => i.id !== itemId),
      null,
    );
    return { writes };
  });
}

function withoutPhoto(identity: unknown): unknown {
  return identity && typeof identity === 'object' ? { ...(identity as AnyRecord), photo: null } : identity;
}

/**
 * Identity and contact details (F-LIB-01). Missing link ids are assigned (`lk-linkedin`). The photo
 * has its own route (§5.2, `savePhoto`): the stored one is kept, whatever the form sends, and is
 * ignored when comparing with the version the form was loaded from.
 */
export async function saveIdentity(
  store: DataStore,
  input: { identity: unknown; expectedRevision: number; base?: unknown },
): Promise<{ identity: Identity; revision: number; writes: WriteRef[] }> {
  return store.withLock(async () => {
    const profile = await store.read<ProfileFile>('profile.json');
    if (
      profile.revision !== input.expectedRevision &&
      (input.base === undefined || !sameJson(withoutPhoto(profile.identity), withoutPhoto(input.base)))
    ) {
      throw new StoreError(
        'STALE_REVISION',
        "l'identité a été modifiée ailleurs depuis son ouverture",
        { file: 'profile.json', currentRevision: profile.revision, current: profile.identity },
        'rechargez la version actuelle, puis refaites la modification',
      );
    }
    const draft = structuredClone((input.identity ?? {}) as AnyRecord);
    draft.photo = profile.identity?.photo ?? null;
    const probe = structuredClone(draft);
    const links = (o: AnyRecord) => (Array.isArray(o.links) ? (o.links as AnyRecord[]) : []);
    links(probe).forEach((l, i) => {
      if (isBlankId(l.id)) l.id = `brouillon-${i + 1}`;
    });
    const first = prepare(identitySchema, probe);
    if (!first.value) throw invalid('identité invalide', first.issues);
    const registry = await store.readIds();
    let allocated = false;
    for (const l of links(draft)) {
      if (isBlankId(l.id)) {
        l.id = allocateIdIn(registry, 'link', String(l.kind ?? 'lien'));
        allocated = true;
      }
    }
    const { value, issues } = prepare(identitySchema, draft);
    if (!value) throw invalid('identité invalide', issues);
    const writes: WriteRef[] = [];
    if (allocated) {
      const ids = await store.write('ids.json', registry, { locked: true });
      writes.push({ file: 'ids.json', revision: ids.revision });
    }
    const saved = await store.write('profile.json', { ...profile, identity: value }, { locked: true });
    writes.push({ file: 'profile.json', revision: saved.revision });
    return { identity: value, revision: saved.revision, writes };
  });
}
