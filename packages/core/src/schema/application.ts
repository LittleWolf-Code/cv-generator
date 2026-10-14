// Applications (§6.4, §9.2): data/applications/<id>/. Tracking is defined from v1 (validated,
// not yet written in MVP).
import { z } from 'zod';
import {
  enVariant,
  httpUrl,
  id,
  isoDate,
  isoDateTime,
  lang,
  multilineText,
  revision,
  schemaVersion,
  text,
} from './common.js';
import { fileLabel, layout, options, selection, template } from './preset.js';

export const exportEntry = z.strictObject({
  /** Relative to the application directory: `exports/<AAAAMMJJ-HHmmss>_<layout>/`. */
  dir: z.string().regex(/^exports\/\d{8}-\d{6}(?:-\d+)?_[a-z-]+\/$/),
  file: z.string().regex(/^[A-Za-z0-9_-]+\.(?:pdf|docx)$/),
  kind: z.enum(['cv', 'letter']),
  format: z.enum(['pdf', 'docx']),
  lang,
  layout,
  createdAt: isoDateTime,
  pages: z.number().int().positive(),
  /** Export is impossible with a blocking criterion, so only these two outcomes exist. */
  atsCheck: z.enum(['ok', 'avertissements']),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  sent: z.boolean().default(false),
});
export type ExportEntry = z.infer<typeof exportEntry>;

export const trackingEvent = z.strictObject({
  at: isoDate,
  type: z.enum(['envoi', 'relance', 'entretien', 'reponse', 'note']),
  note: multilineText.nullable().default(null),
});

export const tracking = z.strictObject({
  status: z.enum(['brouillon', 'envoyee', 'relancee', 'entretien', 'refus', 'offre']),
  sentAt: isoDate.nullable().default(null),
  sentExports: z.array(z.string()).default([]),
  snapshotDir: z.string().nullable().default(null),
  nextFollowUp: isoDate.nullable().default(null),
  events: z.array(trackingEvent).default([]),
  notes: multilineText.nullable().default(null),
});
export type Tracking = z.infer<typeof tracking>;

export const applicationFile = z.strictObject({
  schemaVersion,
  revision,
  id,
  createdAt: isoDate,
  company: text,
  jobTitle: text,
  offerReference: text.nullable().default(null),
  url: httpUrl.nullable().default(null),
  lang,
  enVariant: enVariant.default('en-GB'),
  basePresetId: id,
  fileLabel,
  activeLetter: z
    .strictObject({ fr: z.number().int().positive().nullable(), en: z.number().int().positive().nullable() })
    .default({ fr: null, en: null }),
  exports: z.array(exportEntry).default([]),
  tracking: tracking.nullable().default(null),
});
export type ApplicationFile = z.infer<typeof applicationFile>;

/** selection.json: copied from the preset at creation, then diverges without modifying it (F-CAN-01). */
export const applicationSelectionFile = z.strictObject({
  schemaVersion,
  revision,
  selection,
  options,
  template,
});
export type ApplicationSelectionFile = z.infer<typeof applicationSelectionFile>;

export const offerTerm = z.strictObject({
  term: text,
  aliases: z.array(text).default([]),
  weight: z.enum(['titre', 'requis', 'souhaite']),
  domain: z.enum(['dm', 'tech', 'general']),
  /** Must be a substring of offer.md once normalized (MCP-10). Untrusted data. */
  sourceSentence: text,
});
export type OfferTerm = z.infer<typeof offerTerm>;

export const offerAnalysis = z.strictObject({
  origin: z.enum(['claude', 'utilisateur']),
  createdAt: isoDateTime,
  terms: z.array(offerTerm),
});
export type OfferAnalysis = z.infer<typeof offerAnalysis>;

export const analysisFile = z.strictObject({
  schemaVersion,
  revision,
  current: offerAnalysis.nullable(),
  history: z.array(offerAnalysis).default([]),
});
export type AnalysisFile = z.infer<typeof analysisFile>;

export const LETTER_ROLES = {
  fr: ['vous', 'moi', 'nous'],
  en: ['opening', 'evidence', 'motivation', 'close'],
} as const;

export const letterVersionFile = z
  .strictObject({
    schemaVersion,
    revision,
    version: z.number().int().positive(),
    origin: z.enum(['claude', 'utilisateur']),
    basedOn: z.number().int().positive().nullable(),
    status: z.enum(['brouillon', 'finale']),
    createdAt: isoDateTime,
    recipient: z
      .strictObject({
        civility: z.enum(['madame', 'monsieur']).nullable(),
        name: text.nullable(),
        function: text.nullable(),
        company: text.nullable(),
        city: text.nullable(),
      })
      .nullable(),
    paragraphs: z
      .array(z.strictObject({ role: z.enum([...LETTER_ROLES.fr, ...LETTER_ROLES.en]), text }))
      .min(3, '3 à 4 paragraphes')
      .max(4, '3 à 4 paragraphes'),
    sourceIds: z.array(id),
  })
  .superRefine((l, ctx) => {
    const roles = l.paragraphs.map((p) => p.role as string);
    const fr = roles.every((r) => (LETTER_ROLES.fr as readonly string[]).includes(r));
    const en = roles.every((r) => (LETTER_ROLES.en as readonly string[]).includes(r));
    if (!fr && !en) ctx.addIssue({ code: 'custom', path: ['paragraphs'], message: 'rôles FR et EN mélangés' });
  });
export type LetterVersionFile = z.infer<typeof letterVersionFile>;
