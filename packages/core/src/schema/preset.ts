// Presets and selections (§6.2, §6.3, §9.2): data/presets/<id>.json.
import { z } from 'zod';
import { accentProblem, THEME_FONT_IDS } from '../theme.js';
import { bilingual, enVariant, id, lang, revision, schemaVersion, text, variantId } from './common.js';

/** The 9 section keys of §5.3, in the default order of §5.1. */
export const SECTION_KEYS = [
  'summary',
  'experience',
  'skills',
  'regulatory',
  'education',
  'projects',
  'certifications',
  'languages',
  'interests',
] as const;
export const sectionKey = z.enum(SECTION_KEYS);
export type SectionKey = z.infer<typeof sectionKey>;

export const layout = z.enum(['ats-classique', 'visuel', 'ats-moderne']);
export type Layout = z.infer<typeof layout>;

/** Theme fonts (ATS-11, ADR 0017): static OFL TTF files of packages/render/fonts/. */
export const themeFont = z.enum(THEME_FONT_IDS);
export type ThemeFont = z.infer<typeof themeFont>;

export const density = z.enum(['normale', 'compacte']);
export type Density = z.infer<typeof density>;

export const template = z.strictObject({
  layout,
  theme: z.strictObject({
    font: themeFont,
    // F-MOD-01, NF-10: contrast >= 4.5:1 on white; the refusal gives the ratio obtained.
    accent: z.string().superRefine((c, ctx) => {
      const problem = accentProblem(c);
      if (problem) ctx.addIssue({ code: 'custom', message: problem });
    }),
    density,
  }),
});
export type Template = z.infer<typeof template>;

/** A variant id, or `prop:<ULID>` to preview a pending variant (MCP-11). */
export const variantRef = z.union([variantId, z.string().regex(/^prop:[0-9A-HJKMNP-TV-Z]{26}$/)]);

export const selection = z.strictObject({
  titleId: id.nullable(),
  summaryId: id.nullable(),
  /** Always the 9 keys of §5.3, each once; array order = section order. */
  sections: z.array(z.strictObject({ key: sectionKey, enabled: z.boolean() })).superRefine((secs, ctx) => {
    const keys = secs.map((s) => s.key);
    const missing = SECTION_KEYS.filter((k) => !keys.includes(k));
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (missing.length || dupes.length || keys.length !== SECTION_KEYS.length) {
      ctx.addIssue({
        code: 'custom',
        message: `les 9 sections doivent figurer une fois chacune (manquantes : ${missing.join(', ') || 'aucune'} ; en double : ${dupes.join(', ') || 'aucune'})`,
      });
    }
  }),
  /** Checked ids, at every level (entry and bullet). A parent unchecked hides its children without losing them. */
  include: z.array(id),
  /** Manual order, keyed by section key or by item id (bullet order). */
  order: z.record(z.string(), z.array(id)).default({}),
  /** Chosen variant per bullet, title or summary id. */
  variantChoice: z.record(id, variantRef).default({}),
  /** User-typed values specific to this selection. */
  overrides: z.strictObject({ title: bilingual.optional() }).default({}),
});
export type Selection = z.infer<typeof selection>;

export const options = z.strictObject({
  photo: z.boolean().default(false),
  drivingLicense: z.boolean().default(false),
  workAuthorization: z.boolean().default(false),
  /** Identity link ids shown in the header. */
  links: z.array(id).default([]),
  dateStyle: z.enum(['numerique', 'lettres']).default('numerique'),
  regulatoryPlacement: z.enum(['skills-subgroup', 'own-section']).default('skills-subgroup'),
  referencesNote: z.boolean().default(false),
});
export type Options = z.infer<typeof options>;

/** `<Libellé>` of file names: [A-Za-z0-9-], 40 characters at most (annex B.4). */
export const fileLabel = z
  .string()
  .max(40)
  .regex(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/, 'libellé de fichier invalide ([A-Za-z0-9-], 40 caractères au plus)');

export const presetFile = z.strictObject({
  schemaVersion,
  revision,
  id,
  name: text,
  isDefault: z.boolean().default(false),
  archived: z.boolean().default(false),
  lang,
  enVariant: enVariant.default('en-GB'),
  template,
  selection,
  options,
  fileLabel,
});
export type PresetFile = z.infer<typeof presetFile>;

/** Selection delta stored by a `selection` proposal (MCP-12). */
export const selectionDelta = z.strictObject({
  add: z.array(id).default([]),
  remove: z.array(id).default([]),
  variantChoice: z.record(id, variantRef).default({}),
});
export type SelectionDelta = z.infer<typeof selectionDelta>;
