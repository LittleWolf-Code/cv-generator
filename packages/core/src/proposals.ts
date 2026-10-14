// Proposals queue (§6.9): the element a proposal's base covers, and the pure application of each type.
// Validated text is never overwritten (F-PRO-03): a rewording becomes a new variant, a translation only
// fills a missing language. Hashing, locking and writes live in packages/store.
import { sameJson } from './canonical.js';
import { fileNamePart } from './naming.js';
import type { Bilingual, Lang } from './schema/common.js';
import type { IdKind } from './schema/ids.js';
import type { Bullet, CollectionName, Library, Variant } from './schema/library.js';
import type { Selection, SelectionDelta } from './schema/preset.js';
import { SENSITIVE_FIELDS, type EditedPayload, type ProposalFile } from './schema/proposal.js';

export type LibraryProposal = Exclude<ProposalFile, { type: 'selection' }>;
export type SelectionProposal = Extract<ProposalFile, { type: 'selection' }>;
export type ItemType = Extract<ProposalFile, { type: 'item' }>['payload']['itemType'];

export class ProposalError extends Error {
  constructor(
    readonly code: 'NOT_APPLICABLE' | 'TARGET_MISSING',
    message: string,
  ) {
    super(message);
    this.name = 'ProposalError';
  }
}

export const ITEM_COLLECTION: Record<ItemType, CollectionName> = {
  title: 'titles',
  summary: 'summaries',
  experience: 'experiences',
  education: 'education',
  project: 'projects',
  skill: 'skills',
  certification: 'certifications',
  language: 'languages',
  interest: 'interests',
  category: 'categories',
};

/** Singular French label of a collection, for messages and the review screen. */
export const COLLECTION_LABEL: Record<CollectionName, string> = {
  titles: 'Titre',
  summaries: 'Accroche',
  experiences: 'Expérience',
  education: 'Formation',
  projects: 'Projet',
  skills: 'Compétence',
  certifications: 'Certification',
  languages: 'Langue',
  interests: "Centre d'intérêt",
  categories: 'Catégorie',
};

type AnyRecord = Record<string, unknown>;

/** First available language of a bilingual value. */
export function pick(b: Bilingual | null | undefined, lang: Lang = 'fr'): string {
  if (!b) return '';
  return b[lang] ?? b[lang === 'fr' ? 'en' : 'fr'] ?? '';
}

/** Short readable label of a library element. */
export function itemLabel(collection: CollectionName, item: unknown, lang: Lang = 'fr'): string {
  const it = item as AnyRecord;
  const b = (k: string) => pick(it[k] as Bilingual | null, lang);
  const first = () => pick((it.variants as Variant[] | undefined)?.[0]?.text, lang);
  switch (collection) {
    case 'titles':
    case 'summaries':
      return first();
    case 'experiences':
      return [b('position'), it.organization].filter(Boolean).join(' – ');
    case 'education':
      return [b('degree'), it.institution].filter(Boolean).join(' – ');
    case 'projects':
      return b('name');
    case 'skills':
      return String(it.short ?? '');
    case 'certifications':
      return b('name');
    case 'languages':
      return b('language');
    case 'interests':
      return b('text');
    case 'categories':
      return b('label');
  }
}

export function truncate(s: string, max = 90): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

function collectionItems(library: Library, collection: CollectionName): AnyRecord[] {
  return library[collection] as unknown as AnyRecord[];
}

function findItem(library: Library, collection: CollectionName, itemId: string | null): AnyRecord | null {
  if (!itemId) return null;
  return collectionItems(library, collection).find((i) => i.id === itemId) ?? null;
}

/** Item and, when targeted, bullet of a library proposal. */
function locate(
  library: Library,
  p: LibraryProposal,
): { collection: CollectionName; item: AnyRecord; bullet: Bullet | null } | null {
  const collection = p.target.collection;
  const itemId = p.type === 'alias' ? (p.target.itemId ?? p.payload.skillId) : p.target.itemId;
  const item = findItem(library, collection, itemId);
  if (!item) return null;
  if (!p.target.bulletId) return { collection, item, bullet: null };
  const bullet = ((item.bullets as Bullet[] | undefined) ?? []).find((b) => b.id === p.target.bulletId) ?? null;
  return bullet ? { collection, item, bullet } : null;
}

export type Subject = { kind: 'none' } | { kind: 'missing' } | { kind: 'found'; value: unknown };

export interface SubjectContext {
  library: Library;
  /** Selection of a preset or an application, or null when it does not exist. */
  selection: (kind: 'preset' | 'application', id: string) => Selection | null;
}

/**
 * The element whose hash is the proposal's base (F-PRO-04): the targeted bullet, otherwise the item;
 * the selection for a `selection` proposal. A new item has no subject (pure addition).
 */
export function proposalSubject(p: ProposalFile, ctx: SubjectContext): Subject {
  if (p.type === 'item') {
    // A complement (duplicateOf, ADR 0015) adds bullets to an existing element: that element is its subject.
    if (!p.payload.duplicateOf) return { kind: 'none' };
    const existing = findItem(ctx.library, ITEM_COLLECTION[p.payload.itemType], p.payload.duplicateOf);
    return existing ? { kind: 'found', value: existing } : { kind: 'missing' };
  }
  if (p.type === 'selection') {
    const sel = ctx.selection(p.target.kind, p.target.id);
    return sel ? { kind: 'found', value: sel } : { kind: 'missing' };
  }
  const found = locate(ctx.library, p);
  if (!found) return { kind: 'missing' };
  return { kind: 'found', value: found.bullet ?? found.item };
}

/** Checks recorded at creation that require a one-by-one review (ADR 0015): never accepted in a batch. */
const REVIEW_ONE_BY_ONE: Record<string, string> = {
  'date-to-verify': 'date à vérifier : à accepter individuellement',
};

/** Why a proposal is left out of a batch acceptance (F-PRO-06, ADR 0015), or null. */
export function batchExclusion(p: ProposalFile): string | null {
  if (isSensitive(p)) return 'fait sensible : à accepter individuellement (F-PRO-06)';
  const check = p.checks.find((c) => !c.ok && REVIEW_ONE_BY_ONE[c.rule]);
  return check ? REVIEW_ONE_BY_ONE[check.rule]! : null;
}

export function isSensitive(p: ProposalFile): boolean {
  if (p.type !== 'edit') return false;
  const root = p.payload.field.split('.')[0]!;
  return p.payload.sensitive || (SENSITIVE_FIELDS as readonly string[]).includes(root);
}

/** Every id used in the library, bullets included. */
export function libraryIds(library: Library): Set<string> {
  const ids = new Set<string>();
  for (const list of Object.values(library) as AnyRecord[][]) {
    for (const item of list) {
      ids.add(item.id as string);
      for (const b of (item.bullets as Bullet[] | undefined) ?? []) ids.add(b.id);
    }
  }
  return ids;
}

/** Variant id derived from the label (`acme-tracabilite`), unique within its owner. */
export function newVariantId(label: string | null, existing: readonly string[]): string {
  const base = (label ? fileNamePart(label).toLowerCase().slice(0, 40).replace(/-+$/, '') : '') || 'variante';
  let id = base;
  for (let n = 2; existing.includes(id); n++) id = `${base}-${n}`;
  return id;
}

export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const key of path.split('.')) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as AnyRecord)[key];
  }
  return cur;
}

export function setPath(obj: AnyRecord, path: string, value: unknown): void {
  const keys = path.split('.');
  let cur: AnyRecord = obj;
  for (const key of keys.slice(0, -1)) {
    const next = cur[key];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      throw new ProposalError('NOT_APPLICABLE', `champ introuvable : ${path}`);
    }
    cur = next as AnyRecord;
  }
  cur[keys[keys.length - 1]!] = value;
}

const isBilingual = (v: unknown): v is Bilingual => !!v && typeof v === 'object' && 'fr' in v && 'en' in v;

export interface LibraryApplication {
  collection: CollectionName;
  /** New content of the collection, to be sanitized and validated by the store before writing. */
  items: unknown[];
  /** Recorded in the proposal's resolution (`finalValue`). */
  finalValue: unknown;
  /** Identifiers to record in ids.json (new item and its bullets). */
  newIds: Array<{ id: string; kind: IdKind }>;
  /** false when the change is already present (idempotent acceptance after an interrupted write). */
  changed: boolean;
}

const bulletsOf = (item: AnyRecord): Bullet[] => (item.bullets as Bullet[] | undefined) ?? [];

/** Same texts in every variant (a bullet already present is never added twice). */
const sameBulletText = (a: Bullet, b: Bullet) =>
  a.variants.some((x) =>
    b.variants.some((y) => (['fr', 'en'] as const).some((l) => x.text[l] && x.text[l] === y.text[l])),
  );

/**
 * Complement of an existing element (`duplicateOf`, F-IMP-04, ADR 0015): only the bullets that are not
 * already there are added. Organization, title, dates and every other field stay as validated.
 */
function applyComplement(
  collection: CollectionName,
  items: AnyRecord[],
  targetId: string,
  proposed: AnyRecord,
  library: Library,
): LibraryApplication {
  const existing = items.find((i) => i.id === targetId);
  if (!existing) throw new ProposalError('TARGET_MISSING', `élément à compléter introuvable : ${targetId}`);
  if (!Array.isArray(existing.bullets)) {
    throw new ProposalError('NOT_APPLICABLE', "l'élément visé n'a pas de puces : rien à compléter");
  }
  const current = bulletsOf(existing);
  const added = bulletsOf(proposed).filter((b) => !current.some((x) => x.id === b.id || sameBulletText(x, b)));
  if (added.length === 0) {
    return { collection, items, finalValue: { itemId: targetId, addedBullets: [] }, newIds: [], changed: false };
  }
  const used = libraryIds(library);
  const taken = added.map((b) => b.id).filter((i) => used.has(i));
  if (taken.length) throw new ProposalError('NOT_APPLICABLE', `identifiant déjà utilisé : ${taken.join(', ')}`);
  (existing.bullets as Bullet[]).push(...structuredClone(added));
  return {
    collection,
    items,
    finalValue: { itemId: targetId, addedBullets: added.map((b) => b.id) },
    newIds: added.map((b) => ({ id: b.id, kind: 'bullet' as const })),
    changed: true,
  };
}

/**
 * Applies a library proposal (item, variant, translation, edit, alias) on a copy of the library.
 * `edited` is what the user changed before accepting ("modifier puis accepter").
 */
export function applyLibraryProposal(
  library: Library,
  p: LibraryProposal,
  edited?: EditedPayload[LibraryProposal['type']],
): LibraryApplication {
  if (p.type === 'item') {
    const collection = ITEM_COLLECTION[p.payload.itemType];
    if (p.target.collection !== collection) {
      throw new ProposalError(
        'NOT_APPLICABLE',
        `type d'élément ${p.payload.itemType} incompatible avec la collection ${p.target.collection}`,
      );
    }
    const item = structuredClone(((edited as EditedPayload['item'] | undefined)?.item ?? p.payload.item) as AnyRecord);
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new ProposalError('NOT_APPLICABLE', 'élément proposé invalide');
    }
    const items = structuredClone(collectionItems(library, collection));
    if (p.payload.duplicateOf) return applyComplement(collection, items, p.payload.duplicateOf, item, library);
    // The id of a new element was reserved in ids.json when proposed, and other proposals may depend on it
    // (a skill targeting a pending category, ADR 0023): an edited id is ignored.
    item.id = (p.payload.item as AnyRecord).id;
    const existing = items.find((i) => i.id === item.id);
    if (existing && sameJson(existing, item)) {
      return { collection, items, finalValue: { itemId: item.id }, newIds: [], changed: false };
    }
    const used = libraryIds(library);
    const ids = [item.id as string, ...bulletsOf(item).map((b) => b.id)];
    const taken = ids.filter((i) => used.has(i));
    if (taken.length) throw new ProposalError('NOT_APPLICABLE', `identifiant déjà utilisé : ${taken.join(', ')}`);
    items.push(item);
    return {
      collection,
      items,
      finalValue: { itemId: item.id, item },
      newIds: [
        { id: item.id as string, kind: p.payload.itemType },
        ...bulletsOf(item).map((b) => ({ id: b.id, kind: 'bullet' as const })),
      ],
      changed: true,
    };
  }

  const collection = p.target.collection;
  const items = structuredClone(collectionItems(library, collection));
  const copy: Library = { ...library, [collection]: items } as Library;
  const found = locate(copy, p);
  if (!found) {
    throw new ProposalError('TARGET_MISSING', `élément visé introuvable : ${p.target.itemId ?? ''}`);
  }
  const owner = (found.bullet ?? found.item) as AnyRecord;
  const done = (finalValue: unknown, changed = true): LibraryApplication => ({
    collection,
    items,
    finalValue,
    newIds: [],
    changed,
  });

  switch (p.type) {
    case 'variant': {
      const variants = owner.variants as Variant[] | undefined;
      if (!variants) throw new ProposalError('NOT_APPLICABLE', "l'élément visé n'a pas de variantes");
      const v = (edited as EditedPayload['variant'] | undefined) ?? p.payload;
      if (v.text.fr === null && v.text.en === null) throw new ProposalError('NOT_APPLICABLE', 'variante vide');
      const same = variants.find((x) => sameJson(x.text, v.text));
      if (same) return done({ variantId: same.id, label: same.label, text: same.text }, false);
      const id = newVariantId(
        v.label,
        variants.map((x) => x.id),
      );
      variants.push({ id, label: v.label, text: v.text });
      return done({ variantId: id, label: v.label, text: v.text });
    }
    case 'translation': {
      const lang = p.payload.lang;
      const text = (edited as EditedPayload['translation'] | undefined)?.text ?? p.payload.text;
      let target: unknown;
      if (p.target.variantId) {
        target = (owner.variants as Variant[] | undefined)?.find((x) => x.id === p.target.variantId)?.text;
      } else if (p.target.field) {
        target = getPath(owner, p.target.field);
      }
      if (!isBilingual(target)) throw new ProposalError('NOT_APPLICABLE', 'champ à traduire introuvable');
      if (target[lang] === text) return done({ lang, text }, false);
      if (target[lang] !== null) {
        throw new ProposalError(
          'NOT_APPLICABLE',
          `déjà traduit (${lang.toUpperCase()} : « ${truncate(target[lang]!, 60)} ») : la traduction existante n'est jamais écrasée ; modifiez l'élément dans la bibliothèque si besoin`,
        );
      }
      target[lang] = text;
      return done({ lang, text });
    }
    case 'edit': {
      const field = p.payload.field;
      const root = field.split('.')[0]!;
      if (['id', 'bullets', 'variants'].includes(root)) {
        throw new ProposalError('NOT_APPLICABLE', `champ non modifiable par une proposition : ${field}`);
      }
      const value = edited !== undefined ? (edited as EditedPayload['edit']).newValue : p.payload.newValue;
      if (sameJson(getPath(owner, field), value)) return done({ field, value }, false);
      setPath(owner, field, structuredClone(value));
      return done({ field, value });
    }
    case 'alias': {
      if (collection !== 'skills') throw new ProposalError('NOT_APPLICABLE', 'un alias vise une compétence');
      const a = (edited as EditedPayload['alias'] | undefined) ?? p.payload;
      const norm = (s: string) => s.trim().toLocaleLowerCase('fr');
      const aliases = owner.aliases as string[];
      const related = owner.related as string[];
      const list = a.kind === 'alias' ? aliases : related;
      if (list.some((x) => norm(x) === norm(a.alias))) return done({ kind: a.kind, alias: a.alias }, false);
      const known = [owner.short as string, ...aliases, ...related];
      if (known.some((x) => norm(x) === norm(a.alias))) {
        throw new ProposalError('NOT_APPLICABLE', `« ${a.alias} » figure déjà dans cette compétence`);
      }
      list.push(a.alias);
      return done({ kind: a.kind, alias: a.alias });
    }
  }
}

// ---------------------------------------------------------------------------------------------------
// Pending categories (ADR 0023): a skill may target a category that is itself still proposed.

export type ItemProposal = Extract<ProposalFile, { type: 'item' }>;
export type CategoryProposal = ItemProposal & {
  payload: Extract<ItemProposal['payload'], { itemType: 'category' }>;
};

/** Open (pending or stale) proposals of a new category, indexed by the reserved category id. */
export function openCategoryProposals(proposals: readonly ProposalFile[]): Map<string, CategoryProposal> {
  const out = new Map<string, CategoryProposal>();
  for (const p of proposals) {
    if (p.type !== 'item' || p.payload.itemType !== 'category' || p.payload.duplicateOf) continue;
    if (p.status !== 'pending' && p.status !== 'stale') continue;
    out.set(p.payload.item.id, p as CategoryProposal);
  }
  return out;
}

/**
 * Category required by the final value of a library proposal (after "modifier puis accepter"): the
 * `category` of a new skill, or the new value of an edit of a skill's `category`. Otherwise null.
 */
export function requiredCategory(p: LibraryProposal, edited?: EditedPayload[LibraryProposal['type']]): string | null {
  if (p.type === 'item') {
    if (p.payload.itemType !== 'skill' || p.payload.duplicateOf) return null;
    const item = ((edited as EditedPayload['item'] | undefined)?.item ?? p.payload.item) as AnyRecord | null;
    const category = item && typeof item === 'object' ? item.category : undefined;
    return typeof category === 'string' ? category : null;
  }
  if (p.type === 'edit' && p.target.collection === 'skills' && p.payload.field === 'category') {
    const value = edited !== undefined ? (edited as EditedPayload['edit']).newValue : p.payload.newValue;
    return typeof value === 'string' ? value : null;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------
// Selection proposals: accepted element by element (F-PRO-03).

export interface SelectionElement {
  /** `add:<id>`, `remove:<id>` or `variant:<ownerId>`. */
  key: string;
  op: 'add' | 'remove' | 'variant';
  id: string;
  /** Variant reference for `variant` (a variant id or `prop:<ULID>`). */
  value?: string;
}

export function selectionElements(delta: SelectionDelta): SelectionElement[] {
  return [
    ...delta.add.map((id) => ({ key: `add:${id}`, op: 'add' as const, id })),
    ...delta.remove.map((id) => ({ key: `remove:${id}`, op: 'remove' as const, id })),
    ...Object.entries(delta.variantChoice).map(([id, value]) => ({
      key: `variant:${id}`,
      op: 'variant' as const,
      id,
      value,
    })),
  ];
}

export interface SelectionApplication {
  selection: Selection;
  applied: string[];
  skipped: Array<{ key: string; reason: string }>;
}

/**
 * Applies the chosen elements of a selection delta. `resolveProp` maps `prop:<ULID>` to the variant
 * created when that proposal was accepted, or explains why it cannot be used.
 */
export function applySelectionDelta(
  selection: Selection,
  delta: SelectionDelta,
  keys: readonly string[] | null,
  resolveProp: (proposalId: string) => { variantId: string } | { reason: string },
): SelectionApplication {
  const next = structuredClone(selection);
  const applied: string[] = [];
  const skipped: SelectionApplication['skipped'] = [];
  const wanted = keys ? new Set(keys) : null;
  for (const el of selectionElements(delta)) {
    if (wanted && !wanted.has(el.key)) continue;
    if (el.op === 'add') {
      if (!next.include.includes(el.id)) next.include.push(el.id);
    } else if (el.op === 'remove') {
      next.include = next.include.filter((x) => x !== el.id);
    } else {
      let value = el.value!;
      if (value.startsWith('prop:')) {
        const r = resolveProp(value.slice(5));
        if ('reason' in r) {
          skipped.push({ key: el.key, reason: r.reason });
          continue;
        }
        value = r.variantId;
      }
      next.variantChoice[el.id] = value;
    }
    applied.push(el.key);
  }
  if (wanted) {
    const known = new Set(selectionElements(delta).map((e) => e.key));
    for (const k of wanted) if (!known.has(k)) skipped.push({ key: k, reason: 'élément inconnu de la proposition' });
  }
  return { selection: next, applied, skipped };
}

/** Readable description of what a proposal targets (review screen). */
export function describeTarget(p: ProposalFile, library: Library): string {
  if (p.type === 'selection') {
    return p.target.kind === 'preset'
      ? `Sélection du preset ${p.target.id}`
      : `Sélection de la candidature ${p.target.id}`;
  }
  if (p.type === 'item') {
    const collection = ITEM_COLLECTION[p.payload.itemType];
    if (p.payload.duplicateOf) {
      const existing = findItem(library, collection, p.payload.duplicateOf);
      const label = existing ? itemLabel(collection, existing) : p.payload.duplicateOf;
      const n = bulletsOf(p.payload.item as AnyRecord).length;
      return `Complément : ${COLLECTION_LABEL[collection]} « ${truncate(label)} » (${n} puce${n > 1 ? 's' : ''} à ajouter)`;
    }
    return `Nouvel élément : ${COLLECTION_LABEL[collection]} « ${truncate(itemLabel(collection, p.payload.item))} »`;
  }
  const collection = p.target.collection;
  const itemId = p.type === 'alias' ? (p.target.itemId ?? p.payload.skillId) : p.target.itemId;
  const item = findItem(library, collection, itemId);
  if (!item) return `${COLLECTION_LABEL[collection]} ${itemId ?? ''} (introuvable)`;
  let out = `${COLLECTION_LABEL[collection]} « ${truncate(itemLabel(collection, item), 70)} »`;
  if (p.target.bulletId) {
    const bullet = bulletsOf(item).find((b) => b.id === p.target.bulletId);
    out += bullet
      ? ` › puce « ${truncate(pick(bullet.variants[0]?.text), 60)} »`
      : ` › puce ${p.target.bulletId} (introuvable)`;
  }
  if (p.target.variantId) out += ` › variante ${p.target.variantId}`;
  if (p.type === 'edit') out += ` › champ ${p.payload.field}`;
  else if (p.target.field) out += ` › champ ${p.target.field}`;
  return out;
}

/**
 * For a preview only (MCP-11): `prop:<ULID>` in `variantChoice` is replaced by the text of that pending
 * variant proposal, added to a copy of the library under a temporary id (`prop-<ulid>`). Nothing is
 * written; a reference that is not a pending variant of that owner is reported in `unresolved`.
 */
export function previewPendingVariants(
  library: Library,
  selection: Selection,
  proposals: readonly ProposalFile[],
): { library: Library; selection: Selection; unresolved: string[] } {
  const refs = Object.entries(selection.variantChoice).filter(([, v]) => v.startsWith('prop:'));
  if (refs.length === 0) return { library, selection, unresolved: [] };
  const lib = structuredClone(library);
  const sel = structuredClone(selection);
  const unresolved: string[] = [];
  for (const [owner, ref] of refs) {
    const p = proposals.find((x) => x.id === ref.slice(5));
    if (!p || p.type !== 'variant' || (p.status !== 'pending' && p.status !== 'stale')) {
      unresolved.push(`${owner} : ${ref}`);
      continue;
    }
    const item = findItem(lib, p.target.collection, p.target.itemId);
    const holder = p.target.bulletId ? bulletsOf(item ?? {}).find((b) => b.id === p.target.bulletId) : item;
    if (!holder || (p.target.bulletId ?? p.target.itemId) !== owner) {
      unresolved.push(`${owner} : ${ref}`);
      continue;
    }
    const variantId = `prop-${p.id.toLowerCase()}`;
    (holder as { variants: Variant[] }).variants.push({ id: variantId, label: p.payload.label, text: p.payload.text });
    sel.variantChoice[owner] = variantId;
  }
  return { library: lib, selection: sel, unresolved };
}
