// Proposals queue (§6.9, §9.2): data/proposals/<ULID>.json, one proposal per file.
import { z } from 'zod';
import { bilingual, id, isoDateTime, lang, revision, schemaVersion, text, ulid, variantId } from './common.js';
import {
  category,
  certification,
  COLLECTIONS,
  education,
  experience,
  interest,
  language,
  projectItem,
  skill,
  summary,
  title,
} from './library.js';
import { selectionDelta } from './preset.js';

export const proposalType = z.enum(['item', 'variant', 'translation', 'edit', 'alias', 'selection']);
export type ProposalType = z.infer<typeof proposalType>;

export const proposalStatus = z.enum(['pending', 'accepted', 'edited', 'rejected', 'superseded', 'stale']);
export type ProposalStatus = z.infer<typeof proposalStatus>;

/** Target inside the library. */
export const libraryTarget = z.strictObject({
  collection: z.enum(COLLECTIONS),
  itemId: id.nullable(),
  bulletId: id.nullable().default(null),
  variantId: variantId.nullable().default(null),
  field: z.string().nullable().default(null),
});

/** Target of a selection proposal: a preset or an application. */
export const selectionTarget = z.strictObject({ kind: z.enum(['preset', 'application']), id });

export const proposalCheck = z.strictObject({
  rule: z.string(),
  ok: z.boolean(),
  /** Warning-level rules (similarity, ambiguous aliases) never reject. */
  level: z.enum(['error', 'warning']).default('error'),
  value: z.number().optional(),
  found: z.array(z.string()).optional(),
  message: z.string().optional(),
});

export const proposalBase = z.strictObject({
  file: z.string(),
  revision,
  /** sha256 of the canonical JSON of the targeted element (bullet, item or selection), see ADR 0010. */
  hash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  /** Copy of that element when the proposal was computed: "base" column of the three-way conflict (F-PRO-04). */
  snapshot: z.unknown().optional(),
});

export const resolution = z.strictObject({
  at: isoDateTime,
  action: z.enum(['accepted', 'edited', 'rejected', 'superseded']),
  /** Final value accepted (after an edit, the user's text). */
  finalValue: z.unknown().optional(),
  reason: text.nullable().default(null),
});

const common = {
  schemaVersion,
  revision,
  id: ulid,
  status: proposalStatus,
  origin: z.enum(['claude', 'import-linkedin']),
  /** `bibliotheque`: built from validated content only (translation, ADR 0015). */
  source: z.enum(['dictee', 'import-cv', 'import-linkedin', 'offre', 'bibliotheque']),
  createdAt: isoDateTime,
  base: proposalBase.nullable(),
  checks: z.array(proposalCheck).default([]),
  dependsOn: z.array(ulid).default([]),
  supersedes: ulid.nullable().default(null),
  resolution: resolution.nullable().default(null),
  /** File of import/ the content was extracted from (guardrail reference source). */
  sourceFile: z.string().nullable().default(null),
  /** What the user dictated (guardrail reference source for `dictee`). */
  userStatement: text.nullable().default(null),
};

/**
 * The server assigns ids. `duplicateOf` (F-IMP-04, ADR 0015): the element duplicates an existing one;
 * the proposal then only adds its new bullets to that element (organization, title and dates untouched).
 */
const duplicateOf = id.nullable().default(null);
const itemPayload = z.discriminatedUnion('itemType', [
  z.strictObject({ itemType: z.literal('title'), item: title, duplicateOf }),
  z.strictObject({ itemType: z.literal('summary'), item: summary, duplicateOf }),
  z.strictObject({ itemType: z.literal('experience'), item: experience, duplicateOf }),
  z.strictObject({ itemType: z.literal('education'), item: education, duplicateOf }),
  z.strictObject({ itemType: z.literal('project'), item: projectItem, duplicateOf }),
  z.strictObject({ itemType: z.literal('skill'), item: skill, duplicateOf }),
  z.strictObject({ itemType: z.literal('certification'), item: certification, duplicateOf }),
  z.strictObject({ itemType: z.literal('language'), item: language, duplicateOf }),
  z.strictObject({ itemType: z.literal('interest'), item: interest, duplicateOf }),
  // Skill category (ADR 0023): never a complement, duplicates are reported without writing.
  z.strictObject({ itemType: z.literal('category'), item: category, duplicateOf }),
]);

export const proposalFile = z.discriminatedUnion('type', [
  z.strictObject({
    ...common,
    type: z.literal('item'),
    target: libraryTarget,
    payload: itemPayload,
    rationale: text,
  }),
  z.strictObject({
    ...common,
    type: z.literal('variant'),
    target: libraryTarget,
    payload: z.strictObject({ label: text.nullable().default(null), text: bilingual }),
    rationale: text,
  }),
  z.strictObject({
    ...common,
    type: z.literal('translation'),
    target: libraryTarget,
    payload: z.strictObject({ lang, text }),
    rationale: text.nullable().default(null),
  }),
  z.strictObject({
    ...common,
    type: z.literal('edit'),
    target: libraryTarget,
    payload: z.strictObject({
      field: z.string(),
      oldValue: z.unknown(),
      newValue: z.unknown(),
      /** organization, position, start, end: excluded from batch acceptance (F-PRO-06). */
      sensitive: z.boolean(),
    }),
    rationale: text,
  }),
  z.strictObject({
    ...common,
    type: z.literal('alias'),
    target: libraryTarget,
    payload: z.strictObject({
      skillId: id,
      alias: text,
      kind: z.enum(['alias', 'related']),
      sourceTerm: text.nullable().default(null),
    }),
    rationale: text,
  }),
  z.strictObject({
    ...common,
    type: z.literal('selection'),
    target: selectionTarget,
    payload: selectionDelta,
    /** One justification per added or removed id. */
    rationale: z.record(id, text),
  }),
]);
export type ProposalFile = z.infer<typeof proposalFile>;

/** What the user may change before accepting ("modifier puis accepter", F-PRO-03), per type. */
export const editedPayloadSchemas = {
  item: z.strictObject({ item: z.unknown() }),
  variant: z.strictObject({ label: text.nullable().default(null), text: bilingual }),
  translation: z.strictObject({ text }),
  edit: z.strictObject({ newValue: z.unknown() }),
  alias: z.strictObject({ alias: text, kind: z.enum(['alias', 'related']) }),
} as const;
export type EditedPayload = { [K in keyof typeof editedPayloadSchemas]: z.infer<(typeof editedPayloadSchemas)[K]> };

/** Fields whose edition is a "fait sensible" (F-PRO-06). */
export const SENSITIVE_FIELDS = ['organization', 'position', 'start', 'end'] as const;
