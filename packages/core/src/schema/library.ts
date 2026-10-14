// Content library (spec §6.1, §9.1–9.3): data/library/*.json.
import { z } from 'zod';
import { isAllowedEdition } from '../vocab/editions.js';
import {
  bilingual,
  id,
  link,
  linkKey,
  location,
  revision,
  schemaVersion,
  skillRefs,
  tags,
  text,
  variantId,
  yearMonth,
} from './common.js';

const itemBase = {
  id,
  tags,
  locked: z.boolean().default(false),
  archived: z.boolean().default(false),
};

export const variant = z.strictObject({
  id: variantId,
  label: text.nullable().default(null),
  text: bilingual,
});
export type Variant = z.infer<typeof variant>;

const variants = z
  .array(variant)
  .min(1, 'au moins une variante')
  .superRefine((vs, ctx) => {
    const seen = new Set<string>();
    for (const v of vs) {
      if (seen.has(v.id)) ctx.addIssue({ code: 'custom', message: `variante en double : ${v.id}` });
      seen.add(v.id);
    }
  });

export const bullet = z.strictObject({ id, tags, skills: skillRefs, variants });
export type Bullet = z.infer<typeof bullet>;

export const title = z.strictObject({ ...itemBase, variants });
export type Title = z.infer<typeof title>;

export const summary = z.strictObject({ ...itemBase, variants });
export type Summary = z.infer<typeof summary>;

export const contractType = z.enum(['cdi', 'cdd', 'stage', 'alternance', 'freelance', 'interim', 'these']);
export type ContractType = z.infer<typeof contractType>;

export const experience = z.strictObject({
  ...itemBase,
  position: bilingual,
  organization: text,
  location: location.nullable().default(null),
  contract: contractType.nullable().default(null),
  start: yearMonth,
  end: yearMonth.nullable(),
  skills: skillRefs,
  bullets: z.array(bullet).default([]),
});
export type Experience = z.infer<typeof experience>;

export const education = z.strictObject({
  ...itemBase,
  degree: bilingual,
  field: bilingual.nullable().default(null),
  institution: text,
  location: location.nullable().default(null),
  start: yearMonth.nullable().default(null),
  end: yearMonth.nullable().default(null),
  honors: bilingual.nullable().default(null),
  /** FR: "Bac+5, grade de master (diplôme habilité CTI)"; EN: "Master's degree in Engineering, EQF level 7". */
  levelEquivalent: bilingual.nullable().default(null),
  skills: skillRefs,
  bullets: z.array(bullet).default([]),
});
export type Education = z.infer<typeof education>;

export const projectItem = z
  .strictObject({
    ...itemBase,
    name: bilingual,
    role: bilingual.nullable().default(null),
    organization: text.nullable().default(null),
    /** Main link: page, demo or main repository. */
    url: link.nullable().default(null),
    /** Repositories (GitHub…), shown after the main link, each URL in clear (ADR 0027). */
    repos: z.array(link).default([]),
    start: yearMonth.nullable().default(null),
    end: yearMonth.nullable().default(null),
    skills: skillRefs,
    bullets: z.array(bullet).default([]),
  })
  .superRefine((p, ctx) => {
    const main = p.url ? linkKey(p.url.url) : null;
    const seen = new Set<string>();
    p.repos.forEach((r, i) => {
      const key = linkKey(r.url);
      if (key === main) {
        ctx.addIssue({ code: 'custom', path: ['repos', i, 'url'], message: 'dépôt identique au lien du projet' });
      } else if (seen.has(key)) {
        ctx.addIssue({ code: 'custom', path: ['repos', i, 'url'], message: `dépôt en double : ${r.display}` });
      }
      seen.add(key);
    });
  });
export type Project = z.infer<typeof projectItem>;

export const skill = z
  .strictObject({
    ...itemBase,
    /** Category id (categories.json); `reglementaire` feeds the "regulatory" section. */
    category: id,
    /** Acronym or name, rendered as a non-breaking block. */
    short: text,
    /** Bilingual long form, null when `short` is not an acronym. */
    long: bilingual.nullable().default(null),
    /** Standards only. */
    code: text.nullable().default(null),
    edition: text.nullable().default(null),
    /** Strict equivalents: they count for coverage. */
    aliases: z.array(text).default([]),
    /** Neighbouring terms: suggestions only, never coverage. */
    related: z.array(text).default([]),
    ambiguous: z.boolean().default(false),
  })
  .superRefine((s, ctx) => {
    if (s.edition !== null) {
      if (s.code === null) {
        ctx.addIssue({ code: 'custom', path: ['edition'], message: 'une édition exige un code de norme' });
      } else if (!isAllowedEdition(s.code, s.edition)) {
        ctx.addIssue({
          code: 'custom',
          path: ['edition'],
          message: `édition non autorisée pour ${s.code} : ${s.edition} (annexe A.2)`,
        });
      }
    }
  });
export type Skill = z.infer<typeof skill>;

export const certification = z.strictObject({
  ...itemBase,
  name: bilingual,
  issuer: text,
  date: yearMonth.nullable().default(null),
  url: link.nullable().default(null),
  skills: skillRefs,
});
export type Certification = z.infer<typeof certification>;

export const cefrLevel = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native']);
export type CefrLevel = z.infer<typeof cefrLevel>;

export const language = z.strictObject({
  ...itemBase,
  /** ISO 639-1 code (deduplication key, F-IMP-04). */
  code: z.string().regex(/^[a-z]{2,3}$/),
  language: bilingual,
  /** null = "niveau CECRL à préciser": blocks the export of this language. */
  cefr: cefrLevel.nullable(),
  certification: z
    .strictObject({
      name: text,
      score: text.nullable().default(null),
      year: z
        .string()
        .regex(/^\d{4}$/)
        .nullable()
        .default(null),
    })
    .nullable()
    .default(null),
});
export type Language = z.infer<typeof language>;

export const interest = z.strictObject({
  ...itemBase,
  text: bilingual,
  detail: bilingual.nullable().default(null),
});
export type Interest = z.infer<typeof interest>;

export const category = z.strictObject({ id, label: bilingual });
export type Category = z.infer<typeof category>;

export { REGULATORY_CATEGORY } from '../constants.js';

function collectionFile<T extends z.ZodType>(item: T) {
  return z.strictObject({ schemaVersion, revision, items: z.array(item) });
}

export const COLLECTIONS = [
  'titles',
  'summaries',
  'experiences',
  'education',
  'projects',
  'skills',
  'certifications',
  'languages',
  'interests',
  'categories',
] as const;
export type CollectionName = (typeof COLLECTIONS)[number];

export const collectionItemSchemas = {
  titles: title,
  summaries: summary,
  experiences: experience,
  education,
  projects: projectItem,
  skills: skill,
  certifications: certification,
  languages: language,
  interests: interest,
  categories: category,
} as const;

export const collectionFileSchemas = {
  titles: collectionFile(title),
  summaries: collectionFile(summary),
  experiences: collectionFile(experience),
  education: collectionFile(education),
  projects: collectionFile(projectItem),
  skills: collectionFile(skill),
  certifications: collectionFile(certification),
  languages: collectionFile(language),
  interests: collectionFile(interest),
  categories: collectionFile(category),
} as const;

export interface Library {
  titles: Title[];
  summaries: Summary[];
  experiences: Experience[];
  education: Education[];
  projects: Project[];
  skills: Skill[];
  certifications: Certification[];
  languages: Language[];
  interests: Interest[];
  categories: Category[];
}

export function emptyLibrary(): Library {
  return {
    titles: [],
    summaries: [],
    experiences: [],
    education: [],
    projects: [],
    skills: [],
    certifications: [],
    languages: [],
    interests: [],
    categories: [],
  };
}

export interface LibraryIssue {
  path: string;
  message: string;
}

/**
 * Cross-file integrity: unique ids across the library (bullets included), known categories.
 * Orphan skill references are reported as warnings (§9.3: ignored with a warning).
 */
export function checkLibraryIntegrity(lib: Library): { errors: LibraryIssue[]; warnings: LibraryIssue[] } {
  const errors: LibraryIssue[] = [];
  const warnings: LibraryIssue[] = [];
  const seen = new Map<string, string>();
  const claim = (itemId: string, where: string) => {
    const prev = seen.get(itemId);
    if (prev) errors.push({ path: where, message: `identifiant en double : ${itemId} (déjà utilisé dans ${prev})` });
    else seen.set(itemId, where);
  };
  for (const name of COLLECTIONS) {
    lib[name].forEach((item, i) => {
      claim(item.id, `${name}[${i}]`);
      if ('bullets' in item) item.bullets.forEach((b, j) => claim(b.id, `${name}[${i}].bullets[${j}]`));
    });
  }
  const categories = new Set(lib.categories.map((c) => c.id));
  const skills = new Set(lib.skills.map((s) => s.id));
  lib.skills.forEach((s, i) => {
    if (!categories.has(s.category)) {
      errors.push({ path: `skills[${i}].category`, message: `catégorie inconnue : ${s.category}` });
    }
  });
  for (const name of ['experiences', 'education', 'projects', 'certifications'] as const) {
    lib[name].forEach((item, i) => {
      const refs = [...item.skills, ...('bullets' in item ? item.bullets.flatMap((b) => b.skills) : [])];
      for (const ref of refs) {
        if (!skills.has(ref)) warnings.push({ path: `${name}[${i}]`, message: `compétence inconnue ignorée : ${ref}` });
      }
    });
  }
  return { errors, warnings };
}
