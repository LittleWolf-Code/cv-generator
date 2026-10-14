// Compact views of the library: one row per element (MCP-03 `index` view, UI tree) and the list of
// untranslated fields (§9.3). Pure functions; identity data never appears here.
import { formatRange } from './dates.js';
import type { OfferTerm } from './schema/application.js';
import type { Bilingual, Lang } from './schema/common.js';
import { COLLECTIONS, type Bullet, type CollectionName, type Library, type Variant } from './schema/library.js';
import { containsTerm } from './text/normalize.js';

export const ITEM_TYPE: Record<CollectionName, string> = {
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

export interface FieldRef {
  collection: CollectionName;
  itemId: string;
  bulletId?: string;
  variantId?: string;
  field: string;
}

interface BilingualField extends FieldRef {
  value: Bilingual;
}

type AnyItem = Library[CollectionName][number];

function variantFields(
  collection: CollectionName,
  itemId: string,
  variants: Variant[],
  bulletId?: string,
): BilingualField[] {
  return variants.map((v) => ({
    collection,
    itemId,
    ...(bulletId ? { bulletId } : {}),
    variantId: v.id,
    field: 'text',
    value: v.text,
  }));
}

/** Every bilingual field of an element (§9.3), bullets and variants included. */
export function bilingualFields(collection: CollectionName, item: AnyItem): BilingualField[] {
  const out: BilingualField[] = [];
  const add = (field: string, value: Bilingual | null | undefined) => {
    if (value) out.push({ collection, itemId: item.id, field, value });
  };
  const it = item as Record<string, unknown> & { id: string };
  if ('variants' in it) out.push(...variantFields(collection, it.id, it.variants as Variant[]));
  for (const key of [
    'position',
    'degree',
    'field',
    'honors',
    'levelEquivalent',
    'name',
    'role',
    'long',
    'language',
    'text',
    'detail',
    'label',
  ]) {
    if (key in it && it[key] && typeof it[key] === 'object' && 'fr' in (it[key] as object))
      add(key, it[key] as Bilingual);
  }
  const location = it.location as { country: Bilingual } | null | undefined;
  if (location) add('location.country', location.country);
  for (const b of (it.bullets as Bullet[] | undefined) ?? [])
    out.push(...variantFields(collection, it.id, b.variants, b.id));
  return out;
}

/** Fields without a translation in `lang` (non-archived elements). */
export function untranslatedFields(library: Library, lang: Lang): FieldRef[] {
  const out: FieldRef[] = [];
  for (const collection of COLLECTIONS) {
    for (const item of library[collection] as AnyItem[]) {
      if ('archived' in item && item.archived) continue;
      for (const f of bilingualFields(collection, item)) {
        if (f.value[lang] === null) {
          const { value: _value, ...ref } = f;
          out.push(ref);
        }
      }
    }
  }
  return out;
}

export interface IndexRow {
  id: string;
  type: string;
  parentId: string | null;
  /** Title, or first (or chosen) variant, truncated to 120 characters. */
  label: string;
  dates: string | null;
  tags: string[];
  skills: string[];
  locked: boolean;
  archived: boolean;
  /** Untranslated fields of this row in the requested language. */
  untranslated: number;
  /** Estimated height on the page, in lines of body text. */
  lineCost: number;
  variants?: Array<{ id: string; label: string | null; text: string }>;
  /** Offer terms contained in the row (when an application with an analysis is given). */
  offerTerms?: string[];
}

export interface IndexOptions {
  lang: Lang;
  variants: 'chosen' | 'all';
  variantChoice?: Record<string, string>;
  includeArchived?: boolean;
  collections?: CollectionName[];
  tags?: string[];
  ids?: string[];
  offerTerms?: OfferTerm[];
}

const CHARS_PER_LINE = 95;
const truncate = (s: string, n = 120) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const pick = (b: Bilingual | null | undefined, lang: Lang) =>
  b ? (b[lang] ?? b[lang === 'fr' ? 'en' : 'fr'] ?? '') : '';

export function libraryIndex(library: Library, opts: IndexOptions): IndexRow[] {
  const rows: IndexRow[] = [];
  const chosen = (ownerId: string, variants: Variant[]) =>
    variants.find((v) => v.id === opts.variantChoice?.[ownerId]) ?? variants[0]!;
  const variantList = (variants: Variant[]) =>
    opts.variants === 'all'
      ? { variants: variants.map((v) => ({ id: v.id, label: v.label, text: truncate(pick(v.text, opts.lang)) })) }
      : {};
  const terms = (text: string) =>
    opts.offerTerms
      ? {
          offerTerms: opts.offerTerms
            .filter((t) => [t.term, ...t.aliases].some((x) => containsTerm(text, x)))
            .map((t) => t.term),
        }
      : {};
  const keep = (row: { id: string; tags: string[]; archived: boolean }, collection: CollectionName) =>
    (!opts.collections || opts.collections.includes(collection)) &&
    (!opts.ids || opts.ids.includes(row.id)) &&
    (!opts.tags || row.tags.some((t) => opts.tags!.includes(t))) &&
    (opts.includeArchived || !row.archived);

  for (const collection of COLLECTIONS) {
    for (const raw of library[collection] as AnyItem[]) {
      const item = raw as AnyItem & { tags?: string[]; skills?: string[]; locked?: boolean; archived?: boolean };
      const untranslated = bilingualFields(collection, raw).filter(
        (f) => f.value[opts.lang] === null && !f.bulletId,
      ).length;
      const base = {
        id: item.id,
        type: ITEM_TYPE[collection],
        parentId: null,
        tags: item.tags ?? [],
        skills: item.skills ?? [],
        locked: item.locked ?? false,
        archived: item.archived ?? false,
        untranslated,
      };
      let label = '';
      let dates: string | null = null;
      let lineCost = 1;
      let extra = {};
      const it = item as Record<string, unknown>;
      switch (collection) {
        case 'titles':
        case 'summaries': {
          const variants = it.variants as Variant[];
          const full = pick(chosen(item.id, variants).text, opts.lang);
          label = full;
          lineCost = Math.max(1, Math.ceil(full.length / CHARS_PER_LINE));
          extra = variantList(variants);
          break;
        }
        case 'experiences':
          label = `${pick(it.position as Bilingual, opts.lang)} – ${it.organization as string}`;
          dates = formatRange(it.start as string, it.end as string | null, 'numerique', opts.lang);
          lineCost = 2;
          break;
        case 'education':
          label = `${pick(it.degree as Bilingual, opts.lang)} – ${it.institution as string}`;
          dates = formatRange(it.start as string | null, it.end as string | null, 'numerique', opts.lang);
          lineCost = 2;
          break;
        case 'projects':
          label = pick(it.name as Bilingual, opts.lang);
          dates = formatRange(it.start as string | null, it.end as string | null, 'numerique', opts.lang);
          lineCost = 2;
          break;
        case 'skills': {
          const long = pick(it.long as Bilingual | null, opts.lang);
          label = long ? `${it.short as string} (${long})` : (it.short as string);
          lineCost = 0.2;
          break;
        }
        case 'certifications':
          label = `${pick(it.name as Bilingual, opts.lang)} – ${it.issuer as string}`;
          break;
        case 'languages':
          label = `${pick(it.language as Bilingual, opts.lang)} : ${(it.cefr as string | null) ?? 'niveau à préciser'}`;
          lineCost = 0.3;
          break;
        case 'interests':
          label = pick(it.text as Bilingual, opts.lang);
          lineCost = 0.3;
          break;
        case 'categories':
          label = pick(it.label as Bilingual, opts.lang);
          lineCost = 0;
          break;
      }
      const row = { ...base, label: truncate(label), dates, lineCost, ...extra, ...terms(label) };
      if (keep(row, collection)) rows.push(row);

      for (const b of (it.bullets as Bullet[] | undefined) ?? []) {
        const text = pick(chosen(b.id, b.variants).text, opts.lang);
        const bulletRow: IndexRow = {
          id: b.id,
          type: 'bullet',
          parentId: item.id,
          label: truncate(text),
          dates: null,
          tags: b.tags,
          skills: b.skills,
          locked: base.locked,
          archived: base.archived,
          untranslated: b.variants.filter((v) => v.text[opts.lang] === null).length,
          lineCost: Math.max(1, Math.ceil(text.length / CHARS_PER_LINE)),
          ...variantList(b.variants),
          ...terms(text),
        };
        if (keep(bulletRow, collection) || (opts.ids?.includes(item.id) ?? false)) rows.push(bulletRow);
      }
    }
  }
  return rows;
}
