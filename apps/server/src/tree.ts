// Library tree for the interface: titles, the 9 sections in the default order of §5.1 (section → entry →
// bullet), then the skill categories. The tree does not depend on the selection: the interface applies
// the preset being edited (checked state, section and item order, chosen variants) with the Zod-free
// operations of `@cv/core/selection` (ADR 0011). Labels exist in both languages; each node also carries
// what the filters need (F-LIB-06): archived state, missing translations, ATS-22 warnings, search text.
import {
  antichronological,
  bilingualFields,
  entryWarnings,
  formatRange,
  HEADINGS,
  pick,
  REGULATORY_CATEGORY,
  SECTION_KEYS,
  type Bilingual,
  type Bullet,
  type CollectionName,
  type Lang,
  type Library,
  type SectionKey,
  type Variant,
} from '@cv/core';

/** A text in both languages; a missing translation falls back on the other language. */
export type Labels = Record<Lang, string>;

export interface TreeVariant {
  id: string;
  label: string | null;
  text: Labels;
}

export interface TreeNode {
  id: string;
  collection: CollectionName;
  /** Item of a bullet. */
  parentId: string | null;
  label: Labels;
  detail: string | null;
  archived: boolean;
  locked: boolean;
  /** Skill category (↑/↓ keep a skill inside its category). */
  category: string | null;
  /** Variants of a bullet, a title or a summary (F-SEL-03); empty otherwise. */
  variants: TreeVariant[];
  /** Languages with at least one missing translation (§9.3, F-LIB-04). */
  untranslated: Lang[];
  /** ATS-22 warnings of the element. */
  warnings: number;
  /** A language without CEFR level (« niveau CECRL à préciser »): blocks the export of that language. */
  cefrMissing: boolean;
  /** Lowercase text without accents, for the text filter. */
  search: string;
  children: TreeNode[];
}

export interface TreeGroup {
  key: 'titles' | SectionKey | 'categories';
  label: string;
  collection: CollectionName;
  /** CV section of the group, null for titles and categories. */
  section: SectionKey | null;
  /** Experiences and education: antichronological order, imposed (§5.1). */
  fixedOrder: boolean;
  /** Skill categories of the group, in library order (skills grouped by category). */
  categories: Array<{ id: string; label: string }>;
  /** Default values of an element created from this group (category of a skill). */
  defaults: Record<string, unknown>;
  items: TreeNode[];
}

/** Lowercase, accents removed: the same folding is applied to the query in the interface. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr');
}

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const v of value) strings(v, out);
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) if (k !== 'id') strings(v, out);
  }
  return out;
}

function missing(fields: Array<{ value: { fr: string | null; en: string | null } }>): Lang[] {
  const out: Lang[] = [];
  if (fields.some((f) => f.value.fr === null)) out.push('fr');
  if (fields.some((f) => f.value.en === null)) out.push('en');
  return out;
}

const both = (f: (lang: Lang) => string): Labels => ({ fr: f('fr'), en: f('en') });
const bi = (b: Bilingual | null | undefined): Labels => both((lang) => pick(b, lang));
const variantsOf = (variants: Variant[]): TreeVariant[] =>
  variants.map((v) => ({ id: v.id, label: v.label, text: bi(v.text) }));

export function libraryTree(library: Library): TreeGroup[] {
  const node = (
    collection: CollectionName,
    item: { id: string; archived?: boolean; locked?: boolean },
    label: Labels,
    detail: string | null,
    extra: Partial<Pick<TreeNode, 'category' | 'variants' | 'children'>> = {},
  ): TreeNode => ({
    id: item.id,
    collection,
    parentId: null,
    label,
    detail,
    archived: item.archived ?? false,
    locked: item.locked ?? false,
    category: extra.category ?? null,
    variants: extra.variants ?? [],
    untranslated: missing(bilingualFields(collection, item as never)),
    warnings: entryWarnings(collection, item).length,
    cefrMissing: collection === 'languages' && (item as { cefr?: string | null }).cefr === null,
    search: fold(strings(item).join(' ')),
    children: extra.children ?? [],
  });
  const bullets = (collection: CollectionName, itemId: string, list: Bullet[]): TreeNode[] =>
    list.map((b) => ({
      id: b.id,
      collection,
      parentId: itemId,
      label: bi(b.variants[0]?.text),
      detail: null,
      archived: false,
      locked: false,
      category: null,
      variants: variantsOf(b.variants),
      untranslated: missing(b.variants.map((v) => ({ value: v.text }))),
      warnings: 0,
      cefrMissing: false,
      search: fold(strings(b).join(' ')),
      children: [],
    }));
  const range = (start: string | null, end: string | null) => formatRange(start, end, 'numerique', 'fr');
  const categoryLabel = (id: string) => pick(library.categories.find((c) => c.id === id)?.label, 'fr') || id;

  const groups: TreeGroup[] = [
    {
      key: 'titles',
      label: 'Titres',
      collection: 'titles',
      section: null,
      fixedOrder: false,
      categories: [],
      defaults: {},
      items: library.titles.map((t) =>
        node('titles', t, bi(t.variants[0]?.text), null, { variants: variantsOf(t.variants) }),
      ),
    },
  ];

  const firstSkillCategory = library.categories.find((c) => c.id !== REGULATORY_CATEGORY)?.id ?? null;
  for (const key of SECTION_KEYS) {
    const group = (
      collection: CollectionName,
      items: TreeNode[],
      extra: Partial<Pick<TreeGroup, 'fixedOrder' | 'categories' | 'defaults'>> = {},
    ) =>
      groups.push({
        key,
        label: key === 'summary' ? 'Accroches' : HEADINGS[key].fr,
        collection,
        section: key,
        fixedOrder: extra.fixedOrder ?? false,
        categories: extra.categories ?? [],
        defaults: extra.defaults ?? {},
        items,
      });
    switch (key) {
      case 'summary':
        group(
          'summaries',
          library.summaries.map((s) =>
            node('summaries', s, bi(s.variants[0]?.text), null, { variants: variantsOf(s.variants) }),
          ),
        );
        break;
      case 'experience':
        group(
          'experiences',
          antichronological(library.experiences).map((e) =>
            node(
              'experiences',
              e,
              both((lang) => [pick(e.position, lang), e.organization].join(' – ')),
              range(e.start, e.end),
              { children: bullets('experiences', e.id, e.bullets) },
            ),
          ),
          { fixedOrder: true },
        );
        break;
      case 'education':
        group(
          'education',
          antichronological(library.education).map((e) =>
            node(
              'education',
              e,
              both((lang) => [pick(e.degree, lang), e.institution].join(' – ')),
              range(e.start, e.end),
              { children: bullets('education', e.id, e.bullets) },
            ),
          ),
          { fixedOrder: true },
        );
        break;
      case 'projects':
        group(
          'projects',
          library.projects.map((p) =>
            node('projects', p, bi(p.name), range(p.start, p.end), {
              children: bullets('projects', p.id, p.bullets),
            }),
          ),
        );
        break;
      case 'skills':
      case 'regulatory': {
        const regulatory = key === 'regulatory';
        const categories = library.categories
          .filter((c) => (c.id === REGULATORY_CATEGORY) === regulatory)
          .map((c) => ({ id: c.id, label: pick(c.label, 'fr') || c.id }));
        group(
          'skills',
          library.skills
            .filter((s) => (s.category === REGULATORY_CATEGORY) === regulatory)
            .map((s) =>
              node(
                'skills',
                s,
                both(() => s.short),
                categoryLabel(s.category),
                { category: s.category },
              ),
            ),
          { categories, defaults: { category: regulatory ? REGULATORY_CATEGORY : firstSkillCategory } },
        );
        break;
      }
      case 'certifications':
        group(
          'certifications',
          library.certifications.map((c) => node('certifications', c, bi(c.name), c.issuer)),
        );
        break;
      case 'languages':
        group(
          'languages',
          library.languages.map((l) => node('languages', l, bi(l.language), l.cefr)),
        );
        break;
      case 'interests':
        group(
          'interests',
          library.interests.map((i) => node('interests', i, bi(i.text), null)),
        );
        break;
    }
  }

  groups.push({
    key: 'categories',
    label: 'Catégories de compétences',
    collection: 'categories',
    section: null,
    fixedOrder: false,
    categories: [],
    defaults: {},
    items: library.categories.map((c) =>
      node('categories', c, bi(c.label), c.id === REGULATORY_CATEGORY ? 'ligne ou section Normes' : null),
    ),
  });
  return groups;
}
