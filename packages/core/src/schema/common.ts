// Shared building blocks of the v1 data schema (spec §9).
import { z } from 'zod';
import { checkSanitized } from '../text/sanitize.js';

export const SCHEMA_VERSION = 1 as const;

/** `schemaVersion` of every data file. MVP: any other value is refused explicitly (§8.4). */
export const schemaVersion = z.literal(SCHEMA_VERSION, {
  error: (issue) =>
    `version de schéma inconnue (${String(issue.input)}) : seule la version ${SCHEMA_VERSION} est prise en charge`,
});

export const revision = z.number().int().nonnegative();

/** Single-line user text: non-empty and already sanitized (annex B.1). */
export const text = z
  .string()
  .min(1, 'texte vide : utilisez null pour une valeur absente')
  .superRefine((s, ctx) => {
    const problem = checkSanitized(s);
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
  });

/** Multiline user text (notes): `\n` allowed. */
export const multilineText = z
  .string()
  .min(1)
  .superRefine((s, ctx) => {
    const problem = checkSanitized(s, { multiline: true });
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
  });

/** Bilingual field (§9.3): a missing translation is null, never an empty string. */
export const bilingual = z.strictObject({ fr: text.nullable(), en: text.nullable() });
export type Bilingual = z.infer<typeof bilingual>;

/** Server-assigned stable identifier: lowercase slug (+ suffix). */
export const id = z
  .string()
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'identifiant invalide (minuscules, chiffres et tirets)');

/** Crockford base32 ULID, used for proposals. */
export const ulid = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'ULID invalide');

/** Local variant identifier (`principale`, `courte`, `tech`, `dm`…). */
export const variantId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

/** `YYYY-MM`, or `YYYY` when the month is unknown. Never an invented month (§5.1). */
export const yearMonth = z.string().regex(/^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/, 'date attendue au format AAAA-MM ou AAAA');

export const isoDate = z.iso.date();
export const isoDateTime = z.iso.datetime({ local: true, offset: true });

export const lang = z.enum(['fr', 'en']);
export type Lang = z.infer<typeof lang>;
export const enVariant = z.enum(['en-GB', 'en-US']);
export type EnVariant = z.infer<typeof enVariant>;

export const httpUrl = z
  .string()
  .max(2048)
  .regex(/^https?:\/\/[^\s]+$/, 'URL http(s) attendue');

/** A URL displayed in clear (ATS-10): `display` is what the reader sees, `url` the clickable target. */
export const link = z.strictObject({ url: httpUrl, display: text });
export type Link = z.infer<typeof link>;

/** Comparison key of a link target: no scheme, no `www.`, no trailing `/` or `.git`, case folded (ADR 0027). */
export function linkKey(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/(?:\.git)?\/*$/, '');
}

export const location = z.strictObject({ city: text, country: bilingual });
export type Location = z.infer<typeof location>;

export const tags = z.array(id).default([]);
export const skillRefs = z.array(id).default([]);
