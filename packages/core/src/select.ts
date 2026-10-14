// core.select (§8.5 step 1): checked elements, chosen variants, order. Pure function.
import type { Bilingual } from './schema/common.js';
import {
  REGULATORY_CATEGORY,
  type Bullet,
  type Category,
  type Certification,
  type Education,
  type Experience,
  type Interest,
  type Language,
  type Library,
  type Project,
  type Skill,
  type Variant,
} from './schema/library.js';
import type { SectionKey, Selection } from './schema/preset.js';
import type { ProjectionIssue } from './projection.js';
import { antichronological, applyOrder } from './selection-ops.js';

export interface SelectedVariant {
  ownerId: string;
  variantId: string;
  text: Bilingual;
}

export interface SelectedBullet {
  bullet: Bullet;
  variant: SelectedVariant;
}

export interface SelectedEntry<T> {
  item: T;
  bullets: SelectedBullet[];
}

export type SelectedSection =
  | { key: 'experience'; entries: SelectedEntry<Experience>[] }
  | { key: 'education'; entries: SelectedEntry<Education>[] }
  | { key: 'projects'; entries: SelectedEntry<Project>[] }
  | { key: 'skills'; groups: Array<{ category: Category; skills: Skill[] }> }
  | { key: 'regulatory'; skills: Skill[] }
  | { key: 'certifications'; items: Certification[] }
  | { key: 'languages'; items: Language[] }
  | { key: 'interests'; items: Interest[] };

export interface Selected {
  title: { id: string | null; variantId: string | null; text: Bilingual } | null;
  summary: SelectedVariant | null;
  /** Enabled sections other than `summary`, in selection order. Empty sections are kept. */
  sections: SelectedSection[];
  regulatoryCategory: Category | null;
  /** Every non-archived skill short of the library: rendered as non-breaking blocks wherever they appear. */
  protectedTerms: string[];
  warnings: ProjectionIssue[];
}

export function select(library: Library, selection: Selection): Selected {
  const warnings: ProjectionIssue[] = [];
  const included = new Set(selection.include);
  const isIn = (item: { id: string; archived?: boolean }) => included.has(item.id) && !item.archived;

  const knownIds = new Set<string>();
  for (const list of Object.values(library) as Array<Array<{ id: string; bullets?: Bullet[] }>>) {
    for (const item of list) {
      knownIds.add(item.id);
      for (const b of item.bullets ?? []) knownIds.add(b.id);
    }
  }
  for (const ref of [...selection.include, selection.titleId, selection.summaryId]) {
    if (ref && !knownIds.has(ref)) {
      warnings.push({ code: 'ORPHAN_REF', message: `référence inconnue ignorée : ${ref}` });
    }
  }

  const chooseVariant = (ownerId: string, variants: Variant[]): SelectedVariant => {
    const wanted = selection.variantChoice[ownerId];
    let chosen = variants[0]!;
    if (wanted?.startsWith('prop:')) {
      warnings.push({
        code: 'PENDING_VARIANT',
        message: `variante en attente ignorée pour ${ownerId} (${wanted}) : la variante par défaut est utilisée`,
      });
    } else if (wanted) {
      const found = variants.find((v) => v.id === wanted);
      if (found) chosen = found;
      else warnings.push({ code: 'UNKNOWN_VARIANT', message: `variante inconnue pour ${ownerId} : ${wanted}` });
    }
    return { ownerId, variantId: chosen.id, text: chosen.text };
  };

  const selectEntries = <T extends { id: string; archived: boolean; bullets: Bullet[] }>(items: T[]) =>
    items.filter(isIn).map((item) => ({
      item,
      bullets: applyOrder(
        item.bullets.filter((b) => included.has(b.id)),
        selection.order[item.id],
      ).map((bullet) => ({ bullet, variant: chooseVariant(bullet.id, bullet.variants) })),
    }));

  let title: Selected['title'] = null;
  if (selection.overrides.title) {
    title = { id: null, variantId: null, text: selection.overrides.title };
  } else if (selection.titleId) {
    const t = library.titles.find((x) => x.id === selection.titleId && !x.archived);
    if (t) {
      const v = chooseVariant(t.id, t.variants);
      title = { id: t.id, variantId: v.variantId, text: v.text };
    }
  }

  const sectionEnabled = (key: SectionKey) => selection.sections.find((s) => s.key === key)?.enabled ?? false;

  let summary: SelectedVariant | null = null;
  if (sectionEnabled('summary') && selection.summaryId) {
    const s = library.summaries.find((x) => x.id === selection.summaryId && !x.archived);
    if (s) summary = chooseVariant(s.id, s.variants);
  }

  const regulatoryCategory = library.categories.find((c) => c.id === REGULATORY_CATEGORY) ?? null;
  const pickedSkills = library.skills.filter(isIn);

  const sections: SelectedSection[] = [];
  for (const { key, enabled } of selection.sections) {
    if (!enabled || key === 'summary') continue;
    switch (key) {
      case 'experience':
        sections.push({ key, entries: selectEntries(antichronological(library.experiences)) });
        break;
      case 'education':
        sections.push({ key, entries: selectEntries(antichronological(library.education)) });
        break;
      case 'projects':
        sections.push({ key, entries: selectEntries(applyOrder(library.projects, selection.order.projects)) });
        break;
      case 'skills': {
        const ordered = applyOrder(
          pickedSkills.filter((s) => s.category !== REGULATORY_CATEGORY),
          selection.order.skills,
        );
        const groups = library.categories
          .filter((c) => c.id !== REGULATORY_CATEGORY)
          .map((category) => ({ category, skills: ordered.filter((s) => s.category === category.id) }))
          .filter((g) => g.skills.length > 0);
        sections.push({ key, groups });
        break;
      }
      case 'regulatory':
        sections.push({
          key,
          skills: applyOrder(
            pickedSkills.filter((s) => s.category === REGULATORY_CATEGORY),
            selection.order.regulatory,
          ),
        });
        break;
      case 'certifications':
        sections.push({ key, items: applyOrder(library.certifications.filter(isIn), selection.order.certifications) });
        break;
      case 'languages':
        sections.push({ key, items: applyOrder(library.languages.filter(isIn), selection.order.languages) });
        break;
      case 'interests':
        sections.push({ key, items: applyOrder(library.interests.filter(isIn), selection.order.interests) });
        break;
    }
  }

  const protectedTerms = [...new Set(library.skills.filter((s) => !s.archived).map((s) => s.short))];
  return { title, summary, sections, regulatoryCategory, protectedTerms, warnings };
}
