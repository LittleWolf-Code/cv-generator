// Selection operations (§6.2): three-state checkboxes that keep the children's selection (F-SEL-01/02),
// variants (F-SEL-03), manual order with ↑/↓ (F-SEL-04), sections (F-SEL-05) and the server rule
// F-SEL-10. Zod-free on purpose: the interface imports this module through `@cv/core/selection`
// (ADR 0011). Operations mutate the selection they receive, so they run inside Immer producers; the
// server applies them to a structured clone.
import { REGULATORY_CATEGORY } from './constants.js';
import type { EnVariant, Lang } from './schema/common.js';
import type { Library } from './schema/library.js';
import type { Layout, SectionKey, Selection } from './schema/preset.js';

// Layouts, themes and contrast are used by the same screens (ADR 0017).
export * from './theme.js';
export * from './color.js';

/** Items listed in `order` first (in that order), then the others in library order. */
export function applyOrder<T extends { id: string }>(items: T[], order: readonly string[] | undefined): T[] {
  if (!order || order.length === 0) return items;
  const rank = new Map(order.map((id, i) => [id, i]));
  return items
    .map((item, i) => ({ item, key: rank.get(item.id) ?? order.length + i }))
    .sort((a, b) => a.key - b.key)
    .map((x) => x.item);
}

/** Sort key of a date for antichronological order; year-only dates count as their last/first month. */
function dateKey(ym: string | null, bound: 'start' | 'end'): string {
  if (ym === null) return bound === 'end' ? '9999-99' : '0000-00';
  return ym.length === 4 ? `${ym}-${bound === 'end' ? '12' : '01'}` : ym;
}

/** Experiences and education are antichronological, imposed (§5.1): ongoing first. */
export function antichronological<T extends { start: string | null; end: string | null }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      dateKey(b.end, 'end').localeCompare(dateKey(a.end, 'end')) ||
      dateKey(b.start, 'start').localeCompare(dateKey(a.start, 'start')),
  );
}

// ---------------------------------------------------------------------------------------------------
// Three-state checkboxes (F-SEL-01, F-SEL-02).

export type CheckState = 'checked' | 'mixed' | 'unchecked';

export interface Tally {
  state: CheckState;
  /** Checked children ("3/5 puces"), counted whatever the parent's state. */
  checked: number;
  total: number;
}

export function isSectionEnabled(sel: Pick<Selection, 'sections'>, key: SectionKey): boolean {
  return sel.sections.find((s) => s.key === key)?.enabled ?? false;
}

/**
 * State of an entry and its bullets: unchecked when the entry is excluded (its bullets keep their own
 * state and come back with it), checked when every bullet is included, mixed otherwise.
 */
export function entryTally(sel: Pick<Selection, 'include'>, entryId: string, bulletIds: readonly string[]): Tally {
  const included = new Set(sel.include);
  const checked = bulletIds.filter((id) => included.has(id)).length;
  const state: CheckState = !included.has(entryId) ? 'unchecked' : checked === bulletIds.length ? 'checked' : 'mixed';
  return { state, checked, total: bulletIds.length };
}

/**
 * State of a section: unchecked when disabled (its items keep their state), checked when every item
 * is included, mixed otherwise. For `summary`, the single chosen summary counts.
 */
export function sectionTally(
  sel: Pick<Selection, 'include' | 'sections' | 'summaryId'>,
  key: SectionKey,
  itemIds: readonly string[],
): Tally {
  const included = new Set(sel.include);
  const checked =
    key === 'summary'
      ? sel.summaryId !== null && itemIds.includes(sel.summaryId)
        ? 1
        : 0
      : itemIds.filter((id) => included.has(id)).length;
  const total = key === 'summary' ? 1 : itemIds.length;
  const state: CheckState = !isSectionEnabled(sel, key) ? 'unchecked' : checked === total ? 'checked' : 'mixed';
  return { state, checked, total };
}

export interface CheckTarget {
  /** CV section of the element (`regulatory` for a skill of the regulatory category). */
  section: SectionKey;
  /** Entry or flat item (skill, certification, language, interest). */
  itemId: string;
  /** Every bullet of the entry, in any order (entries only). */
  bulletIds?: readonly string[];
  /** Set to check or uncheck one bullet of the entry. */
  bulletId?: string;
}

export function setSectionEnabled(sel: Pick<Selection, 'sections'>, key: SectionKey, enabled: boolean): void {
  const section = sel.sections.find((s) => s.key === key);
  if (section) section.enabled = enabled;
}

/**
 * Checks or unchecks an element. Unchecking removes that element only: the selection of its bullets
 * is kept and comes back when it is checked again (F-SEL-02). Checking makes the element visible: its
 * section is enabled and, for a bullet, its entry is checked. An entry checked while none of its
 * bullets is retained gets all of them (ADR 0011).
 */
export function setChecked(sel: Pick<Selection, 'include' | 'sections'>, t: CheckTarget, value: boolean): void {
  const add = (id: string) => {
    if (!sel.include.includes(id)) sel.include.push(id);
  };
  if (!value) {
    const id = t.bulletId ?? t.itemId;
    sel.include = sel.include.filter((x) => x !== id);
    return;
  }
  setSectionEnabled(sel, t.section, true);
  if (t.bulletId) {
    add(t.bulletId);
    add(t.itemId);
    return;
  }
  const bullets = t.bulletIds ?? [];
  if (!sel.include.includes(t.itemId) && bullets.length > 0 && !bullets.some((b) => sel.include.includes(b))) {
    bullets.forEach(add);
  }
  add(t.itemId);
}

/** Title of the CV (F-SEL-03); null for none. A user-typed `overrides.title` still takes precedence. */
export function setTitle(sel: Pick<Selection, 'titleId'>, id: string | null): void {
  sel.titleId = id;
}

/** Summary of the CV (F-SEL-03); choosing one enables the summary. */
export function setSummary(sel: Pick<Selection, 'summaryId' | 'sections'>, id: string | null): void {
  sel.summaryId = id;
  if (id !== null) setSectionEnabled(sel, 'summary', true);
}

/** Variant of a bullet, a title or a summary (F-SEL-03). */
export function setVariant(sel: Pick<Selection, 'variantChoice'>, ownerId: string, variantId: string): void {
  sel.variantChoice[ownerId] = variantId;
}

// ---------------------------------------------------------------------------------------------------
// Order (F-SEL-04).

/**
 * Sections whose items keep a manual order. Experiences and education are antichronological, imposed
 * (§5.1); the summary has no items to order.
 */
export function isOrderable(key: SectionKey): boolean {
  return key !== 'experience' && key !== 'education' && key !== 'summary';
}

/**
 * Moves `id` one step up (-1) or down (+1) among `ids`, the order shown, and stores the whole list
 * under `order[key]` (a section key, or an entry id for its bullets). With `sameGroup`, the step skips
 * the elements of other groups: skills move inside their category. Returns false at an edge.
 */
export function moveInOrder(
  sel: Pick<Selection, 'order'>,
  key: string,
  ids: readonly string[],
  id: string,
  step: -1 | 1,
  sameGroup?: (a: string, b: string) => boolean,
): boolean {
  const list = [...ids];
  const from = list.indexOf(id);
  if (from < 0) return false;
  let to = from + step;
  while (to >= 0 && to < list.length && sameGroup && !sameGroup(id, list[to]!)) to += step;
  if (to < 0 || to >= list.length) return false;
  [list[from], list[to]] = [list[to]!, list[from]!];
  sel.order[key] = list;
  return true;
}

/**
 * Moves a section one step in the CV order. The summary always follows the title (§5.1): it keeps its
 * slot and is never moved. `passOver` lists sections without a place of their own, stepped over the
 * same way (`regulatory` while it is a line of Compétences).
 */
export function moveSection(
  sel: Pick<Selection, 'sections'>,
  key: SectionKey,
  step: -1 | 1,
  passOver: readonly SectionKey[] = [],
): boolean {
  const fixed = (k: SectionKey) => k === 'summary' || passOver.includes(k);
  if (fixed(key)) return false;
  const slots = sel.sections.flatMap((s, i) => (fixed(s.key) ? [] : [i]));
  const pos = slots.findIndex((i) => sel.sections[i]!.key === key);
  const target = pos + step;
  if (pos < 0 || target < 0 || target >= slots.length) return false;
  const a = slots[pos]!;
  const b = slots[target]!;
  const first = { key: sel.sections[a]!.key, enabled: sel.sections[a]!.enabled };
  const second = { key: sel.sections[b]!.key, enabled: sel.sections[b]!.enabled };
  sel.sections[a] = second;
  sel.sections[b] = first;
  return true;
}

// ---------------------------------------------------------------------------------------------------
// Server rule F-SEL-10.

/** Ids of the title, summary, entries and items a selection shows (bullets excluded). */
export function visibleIds(library: Library, sel: Selection): Set<string> {
  const included = new Set(sel.include);
  const out = new Set<string>();
  const add = (items: Array<{ id: string; archived: boolean }>, enabled: boolean) => {
    if (!enabled) return;
    for (const item of items) if (included.has(item.id) && !item.archived) out.add(item.id);
  };
  if (!sel.overrides.title && sel.titleId && library.titles.some((t) => t.id === sel.titleId && !t.archived)) {
    out.add(sel.titleId);
  }
  if (
    isSectionEnabled(sel, 'summary') &&
    sel.summaryId &&
    library.summaries.some((s) => s.id === sel.summaryId && !s.archived)
  ) {
    out.add(sel.summaryId);
  }
  add(library.experiences, isSectionEnabled(sel, 'experience'));
  add(library.education, isSectionEnabled(sel, 'education'));
  add(library.projects, isSectionEnabled(sel, 'projects'));
  add(
    library.skills.filter((s) => s.category !== REGULATORY_CATEGORY),
    isSectionEnabled(sel, 'skills'),
  );
  add(
    library.skills.filter((s) => s.category === REGULATORY_CATEGORY),
    isSectionEnabled(sel, 'regulatory'),
  );
  add(library.certifications, isSectionEnabled(sel, 'certifications'));
  add(library.languages, isSectionEnabled(sel, 'languages'));
  add(library.interests, isSectionEnabled(sel, 'interests'));
  return out;
}

export interface SelectionRuleViolation {
  /** `HIDES_EXPERIENCE`: a whole experience disappears; `UNCHECKS_LOCKED`: a locked element disappears. */
  code: 'HIDES_EXPERIENCE' | 'UNCHECKS_LOCKED';
  id: string;
  message: string;
}

/**
 * F-SEL-10: an automatic pre-selection (Claude or an algorithm) never hides a whole experience shown by
 * the base selection (it reduces its bullets instead, to avoid a gap in the career), and never unchecks
 * a locked element. Returns the elements at fault, empty when `next` is allowed.
 */
export function checkSelectionRule(library: Library, base: Selection, next: Selection): SelectionRuleViolation[] {
  const before = visibleIds(library, base);
  const after = visibleIds(library, next);
  const out: SelectionRuleViolation[] = [];
  for (const e of library.experiences) {
    if (before.has(e.id) && !after.has(e.id)) {
      out.push({
        code: 'HIDES_EXPERIENCE',
        id: e.id,
        message: `masquerait l'expérience entière ${e.id} (trou dans le parcours) : réduisez plutôt ses puces`,
      });
    }
  }
  const locked = [
    ...library.titles,
    ...library.summaries,
    ...library.experiences,
    ...library.education,
    ...library.projects,
    ...library.skills,
    ...library.certifications,
    ...library.languages,
    ...library.interests,
  ].filter((item) => item.locked);
  for (const item of locked) {
    if (before.has(item.id) && !after.has(item.id) && !out.some((v) => v.id === item.id)) {
      out.push({ code: 'UNCHECKS_LOCKED', id: item.id, message: `décocherait l'élément verrouillé ${item.id}` });
    }
  }
  return out;
}

/** F-SEL-10 for the removal of one element from `sel` (one `remove:<id>` of a selection proposal). */
export function removalViolations(library: Library, sel: Selection, id: string): SelectionRuleViolation[] {
  return checkSelectionRule(library, sel, { ...sel, include: sel.include.filter((x) => x !== id) });
}

// ---------------------------------------------------------------------------------------------------
// Language of the document (F-SEL-05, §5.4).

/** Language choice of the top bar: one value sets `lang` and `enVariant`. */
export type LanguageChoice = 'fr' | EnVariant;

/**
 * Sets the language and the English variant. Moving from French to English unchecks the photo
 * (§5.4: uncommon outside France); the user can check it again. Returns true when it was unchecked.
 */
export function applyLanguage(
  preset: { lang: Lang; enVariant: EnVariant; options: { photo: boolean } },
  choice: LanguageChoice,
): boolean {
  const wasFrench = preset.lang === 'fr';
  if (choice === 'fr') {
    preset.lang = 'fr';
    return false;
  }
  preset.lang = 'en';
  preset.enVariant = choice;
  if (wasFrench && preset.options.photo) {
    preset.options.photo = false;
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------------
// Layout of the document (F-MOD-02, F-MOD-03, §5.3; ADR 0017).

export interface LayoutChange {
  /** New `regulatoryPlacement`, when the switch changed it. */
  regulatoryPlacement: 'own-section' | 'skills-subgroup' | null;
  /** The visual layout integrates the photo: suggested (never checked) when the identity has one. */
  suggestPhoto: boolean;
}

/**
 * Sets the layout. `own-section` is the default of the visual layout and `skills-subgroup` the default
 * of the ATS layouts (§5.3): entering the visual layout sets the first, leaving it sets the second. The
 * photo is never checked automatically; it is only suggested.
 */
export function applyLayout(
  preset: {
    template: { layout: Layout };
    options: { photo: boolean; regulatoryPlacement: 'skills-subgroup' | 'own-section' };
  },
  layout: Layout,
  identityHasPhoto = false,
): LayoutChange {
  const before = preset.template.layout;
  preset.template.layout = layout;
  const change: LayoutChange = { regulatoryPlacement: null, suggestPhoto: false };
  if (before === layout) return change;
  const wanted = layout === 'visuel' ? 'own-section' : before === 'visuel' ? 'skills-subgroup' : null;
  if (wanted && preset.options.regulatoryPlacement !== wanted) {
    preset.options.regulatoryPlacement = wanted;
    change.regulatoryPlacement = wanted;
  }
  change.suggestPhoto = layout === 'visuel' && identityHasPhoto && !preset.options.photo;
  return change;
}

// ---------------------------------------------------------------------------------------------------
// Elements added by a selection proposal (ADR 0014).

/** Section of a library element (and the entry of a bullet), or null for an unknown id. */
export function sectionOf(library: Library, id: string): { section: SectionKey; parentId: string | null } | null {
  const entries = [
    ['experience', library.experiences],
    ['education', library.education],
    ['projects', library.projects],
  ] as const;
  for (const [section, items] of entries) {
    for (const item of items) {
      if (item.id === id) return { section, parentId: null };
      if (item.bullets.some((b) => b.id === id)) return { section, parentId: item.id };
    }
  }
  const skill = library.skills.find((s) => s.id === id);
  if (skill) return { section: skill.category === REGULATORY_CATEGORY ? 'regulatory' : 'skills', parentId: null };
  if (library.certifications.some((x) => x.id === id)) return { section: 'certifications', parentId: null };
  if (library.languages.some((x) => x.id === id)) return { section: 'languages', parentId: null };
  if (library.interests.some((x) => x.id === id)) return { section: 'interests', parentId: null };
  return null;
}

/**
 * Makes the elements added by a selection proposal visible: a delta only carries checks (MCP-12), so
 * the section of an added element is enabled, and the entry of an added bullet is checked, as when the
 * user checks a child (ADR 0011). A regulatory skill shown inside Compétences also needs that section.
 */
export function revealAdded(
  library: Library,
  sel: Pick<Selection, 'include' | 'sections'>,
  ids: readonly string[],
  regulatoryPlacement: 'skills-subgroup' | 'own-section',
): void {
  for (const id of ids) {
    const found = sectionOf(library, id);
    if (!found) continue;
    setSectionEnabled(sel, found.section, true);
    if (found.section === 'regulatory' && regulatoryPlacement === 'skills-subgroup')
      setSectionEnabled(sel, 'skills', true);
    if (found.parentId && !sel.include.includes(found.parentId)) sel.include.push(found.parentId);
  }
}
