// Proposals created by Claude through the MCP server (§6.9, F-PRO-01, MCP-12, 13, 15 to 17, annex C,
// ADR 0014). Nothing here touches the validated content (library/, presets/, profile.json): each tool
// adds proposals/<ULID>.json files, after the guardrails of annex C, with the base computed by the
// server (F-PRO-04). Identifiers of new elements are reserved in ids.json at once, so that two pending
// proposals never share one. Acceptance only exists in the interface.
import { monotonicFactory } from 'ulid';
import { z } from 'zod';
import {
  applySelectionDelta,
  bilingual,
  bilingualFields,
  BULLET_MAX_CHARS,
  buildSkillDictionary,
  checkForeignContent,
  checkLibraryIntegrity,
  checkSelectionRule,
  collectionItemSchemas,
  detectSkills,
  durationNumbers,
  experienceDurations,
  foldWord,
  getPath,
  id as idSchema,
  isRejected,
  ITEM_COLLECTION,
  jaccard,
  linkKey,
  openCategoryProposals,
  proposalFile,
  rejectionReasons,
  revealAdded,
  runGuardrails,
  sameJson,
  sameTerm,
  sanitizeDeep,
  selection as selectionSchema,
  SENSITIVE_FIELDS,
  setPath,
  SUMMARY_MAX_CHARS,
  text,
  type Bilingual,
  type CollectionName,
  type GuardrailCheck,
  type ItemType,
  type Library,
  type Link,
  type OfferTerm,
  type PresetFile,
  type ApplicationSelectionFile,
  type ProposalFile,
  type ProposedText,
  type Selection,
  type SelectionDelta,
  type SkillDictionary,
} from '@cv/core';
import { StoreError } from './errors.js';
import { readImportTextFile } from './import-offers.js';
import { assignIds, prepare, type WriteRef } from './library.js';
import { hashSubject } from './proposals.js';
import type { DataStore } from './store.js';

const nextUlid = monotonicFactory();

type AnyRecord = Record<string, unknown>;
type NewProposal = Omit<ProposalFile, 'schemaVersion' | 'revision' | 'id' | 'status' | 'createdAt' | 'resolution'>;

/**
 * Result of one element. `itemId` (propose_item, ADR 0023): id of the element created, or of the element to
 * target for a duplicate (a pending category is targeted by its reserved id, never by the ULID).
 * `dependsOn`: proposals the created one depends on (a skill in a pending category).
 */
export type ProposeResult =
  | {
      index: number;
      status: 'created';
      proposalId: string;
      checks: GuardrailCheck[];
      itemId?: string;
      dependsOn?: string[];
    }
  | { index: number; status: 'rejected'; reasons: string[]; checks: GuardrailCheck[] }
  | {
      index: number;
      status: 'duplicateOf';
      duplicateOf: string;
      proposalIds: string[];
      hint: string;
      itemId?: string | null;
    };

export interface ProposeOutcome {
  results: ProposeResult[];
  /** Ids of every proposal written (for reviewUrl). */
  proposalIds: string[];
  writes: WriteRef[];
}

const isOpen = (p: ProposalFile) => p.status === 'pending' || p.status === 'stale';
const issuesText = (issues: Array<{ path: string; message: string }>) =>
  issues.map((i) => (i.path ? `${i.path} : ${i.message}` : i.message)).join(' ; ');
const looseKey = (s: string | null | undefined) =>
  s
    ? foldWord(s)
        .replace(/[^a-z0-9+#]+/g, ' ')
        .trim()
    : '';

/** Terms and aliases of every saved offer analysis (current and history): part of the dictionary. */
async function allOfferTerms(store: DataStore): Promise<OfferTerm[]> {
  const out: OfferTerm[] = [];
  for (const id of await store.listApplicationIds()) {
    try {
      const { analysis } = await store.loadApplication(id);
      if (!analysis) continue;
      for (const a of [analysis.current, ...analysis.history]) if (a) out.push(...a.terms);
    } catch {
      // An unreadable application does not block a proposal.
    }
  }
  return out;
}

async function dictionaryOf(store: DataStore, library: Library): Promise<SkillDictionary> {
  return buildSkillDictionary(library, await allOfferTerms(store));
}

/** Writes a new proposal (validated like any data file), under the lock already held. */
async function writeProposal(
  store: DataStore,
  value: NewProposal,
  now: Date,
): Promise<{ id: string; write: WriteRef }> {
  const id = nextUlid(now.getTime());
  const { value: valid, issues } = prepare(proposalFile, {
    schemaVersion: 1,
    revision: 1,
    id,
    status: 'pending',
    createdAt: now.toISOString(),
    resolution: null,
    ...value,
  });
  if (!valid) throw new StoreError('INVALID_DATA', `proposition invalide : ${issuesText(issues)}`, { issues });
  const saved = await store.write(`proposals/${id}.json`, valid, { locked: true });
  return { id, write: { file: `proposals/${id}.json`, revision: saved.revision } };
}

function staleRevision(file: string, current: number, expected: number): StoreError {
  return new StoreError(
    'STALE_REVISION',
    `${file} a changé depuis sa lecture (révision ${current}, attendue ${expected})`,
    { file, currentRevision: current },
    'relisez les éléments (get_items, get_preset ou get_application), puis proposez de nouveau',
  );
}

// ---------------------------------------------------------------------------------------------------
// Variants (MCP-13)

export interface VariantInput {
  target: { kind: 'bullet' | 'summary' | 'title'; id: string };
  text: { fr?: string | null; en?: string | null };
  label?: string | null;
  rationale: string;
}

interface Owner {
  collection: CollectionName;
  item: AnyRecord & { id: string; skills?: string[]; end?: string | null };
  bullet: (AnyRecord & { id: string; skills: string[] }) | null;
  variants: Array<{ id: string; text: Bilingual }>;
  max: number | null;
  ongoing: boolean;
}

function findOwner(library: Library, target: VariantInput['target']): Owner | null {
  if (target.kind === 'bullet') {
    for (const collection of ['experiences', 'education', 'projects'] as const) {
      for (const item of library[collection]) {
        const bullet = item.bullets.find((b) => b.id === target.id);
        if (bullet) {
          return {
            collection,
            item: item as unknown as Owner['item'],
            bullet: bullet as unknown as Owner['bullet'],
            variants: bullet.variants,
            max: BULLET_MAX_CHARS,
            ongoing: collection === 'experiences' && (item as { end: string | null }).end === null,
          };
        }
      }
    }
    return null;
  }
  const collection = target.kind === 'summary' ? 'summaries' : 'titles';
  const item = library[collection].find((x) => x.id === target.id);
  if (!item) return null;
  return {
    collection,
    item: item as unknown as Owner['item'],
    bullet: null,
    variants: item.variants,
    max: target.kind === 'summary' ? SUMMARY_MAX_CHARS : null,
    ongoing: false,
  };
}

/**
 * New variants of a bullet, a summary or a title (MCP-13). Reference source (annex C): every FR and EN
 * variant of the same owner, plus the `skills` of the bullet and of its item. A variant identical to an
 * existing one (or to a pending proposal) is reported as `duplicateOf`.
 */
export async function proposeVariants(
  store: DataStore,
  items: VariantInput[],
  opts: { baseRevision?: Partial<Record<CollectionName, number>> } = {},
  now = new Date(),
): Promise<ProposeOutcome> {
  return store.withLock(async () => {
    const { library, revisions } = await store.loadLibraryFiles();
    const dict = await dictionaryOf(store, library);
    const pending = (await store.listProposals()).filter(isOpen);
    const outcome: ProposeOutcome = { results: [], proposalIds: [], writes: [] };
    for (const [index, input] of items.entries()) {
      const owner = findOwner(library, input.target);
      if (!owner) {
        outcome.results.push({
          index,
          status: 'rejected',
          reasons: [`élément introuvable : ${input.target.id}`],
          checks: [],
        });
        continue;
      }
      const expected = opts.baseRevision?.[owner.collection];
      if (expected !== undefined && expected !== revisions[owner.collection]) {
        throw staleRevision(`library/${owner.collection}.json`, revisions[owner.collection], expected);
      }
      const { value: textValue, issues } = prepare(bilingual, { fr: input.text.fr ?? null, en: input.text.en ?? null });
      const { value: label, issues: labelIssues } = prepare(text.nullable(), input.label ?? null);
      const { value: rationale, issues: whyIssues } = prepare(text, input.rationale);
      if (!textValue || label === undefined || !rationale || (textValue.fr === null && textValue.en === null)) {
        const all = [...issues, ...labelIssues, ...whyIssues];
        outcome.results.push({
          index,
          status: 'rejected',
          reasons: [
            all.length ? `saisie refusée : ${issuesText(all)}` : 'texte vide : donnez au moins le FR ou l\u2019EN',
          ],
          checks: [],
        });
        continue;
      }
      const langs = (['fr', 'en'] as const).filter((l) => textValue[l] !== null);
      const sameText = (t: Bilingual) => langs.every((l) => t[l] === textValue[l]);
      const existing = owner.variants.find((v) => sameText(v.text));
      if (existing) {
        outcome.results.push({
          index,
          status: 'duplicateOf',
          duplicateOf: existing.id,
          proposalIds: [],
          hint: 'variante déjà présente : choisissez-la avec propose_selection (variantChoice)',
        });
        continue;
      }
      const dup = pending.find(
        (p) =>
          p.type === 'variant' &&
          p.target.itemId === owner.item.id &&
          p.target.bulletId === (owner.bullet?.id ?? null) &&
          sameText(p.payload.text),
      );
      if (dup) {
        outcome.results.push({
          index,
          status: 'duplicateOf',
          duplicateOf: dup.id,
          proposalIds: [],
          hint: 'déjà proposée, en attente',
        });
        continue;
      }
      const sources = owner.variants.flatMap((v) =>
        (['fr', 'en'] as const).filter((l) => v.text[l]).map((l) => ({ lang: l, text: v.text[l]! })),
      );
      const checks = runGuardrails({
        texts: langs.map((l) => ({ lang: l, text: textValue[l]!, max: owner.max })),
        sources,
        dictionary: dict,
        allowedSkillIds: [...(owner.bullet?.skills ?? []), ...(owner.item.skills ?? [])],
        ongoing: owner.ongoing,
        similarity: true,
      });
      if (isRejected(checks)) {
        outcome.results.push({ index, status: 'rejected', reasons: rejectionReasons(checks), checks });
        continue;
      }
      const subject = owner.bullet ?? owner.item;
      const { id, write } = await writeProposal(
        store,
        {
          type: 'variant',
          origin: 'claude',
          source: 'offre',
          target: {
            collection: owner.collection,
            itemId: owner.item.id,
            bulletId: owner.bullet?.id ?? null,
            variantId: null,
            field: null,
          },
          base: {
            file: `library/${owner.collection}.json`,
            revision: revisions[owner.collection],
            hash: hashSubject(subject),
            snapshot: subject,
          },
          payload: { label, text: textValue },
          rationale,
          checks,
          dependsOn: [],
          supersedes: null,
          sourceFile: null,
          userStatement: null,
        } as unknown as NewProposal,
        now,
      );
      outcome.results.push({ index, status: 'created', proposalId: id, checks });
      outcome.proposalIds.push(id);
      outcome.writes.push(write);
    }
    return outcome;
  });
}

// ---------------------------------------------------------------------------------------------------
// New items (MCP-15) and imports (MCP-21): one deduplication and one writer for Claude and LinkedIn

export interface ItemInput {
  type: ItemType;
  data: unknown;
  source: 'dictee' | 'import-cv' | 'import-linkedin' | 'offre';
  sourceFile?: string | null;
  userStatement?: string | null;
  rationale?: string | null;
}

/** Text of a PDF or DOCX of import/ (F-IMP-03), provided by the caller (the MCP server, through render). */
export type ImportTextReader = (fileName: string) => Promise<{ text: string; hasTextLayer: boolean }>;

export interface ProposeItemsOptions {
  importDir: string | null;
  /** Reads a PDF or a DOCX of import/: reference source of `import-cv` (annex C). */
  readImportText?: ImportTextReader;
}

/** Every string of a value, ids and references excluded (reference source « la bibliothèque »). */
function stringsOf(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => stringsOf(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (['id', 'tags', 'skills', 'category'].includes(k)) continue;
      stringsOf(v, out);
    }
  }
  return out;
}

/** Proposed texts of a new item, with the maximum length of bullets and summaries. */
function proposedTexts(type: ItemType, item: AnyRecord): ProposedText[] {
  const out: ProposedText[] = [];
  const bilingualValues = (v: unknown, max: number | null) => {
    if (v && typeof v === 'object' && 'fr' in v && 'en' in v) {
      for (const l of ['fr', 'en'] as const) {
        const t = (v as Bilingual)[l];
        if (t) out.push({ lang: l, text: t, max });
      }
    }
  };
  for (const [k, v] of Object.entries(item)) {
    if (['id', 'tags', 'skills', 'category', 'bullets', 'variants', 'start', 'end', 'date'].includes(k)) continue;
    if (typeof v === 'string') out.push({ lang: null, text: v, max: null });
    // Lists of strings (aliases) or of links (repositories of a project, ADR 0027: URLs checked too).
    else if (Array.isArray(v)) stringsOf(v).forEach((x) => out.push({ lang: null, text: x, max: null }));
    else if (v && typeof v === 'object' && 'fr' in v) bilingualValues(v, null);
    else if (v && typeof v === 'object') stringsOf(v).forEach((x) => out.push({ lang: null, text: x, max: null }));
  }
  for (const variant of (item.variants as AnyRecord[] | undefined) ?? []) {
    bilingualValues(variant.text, type === 'summary' ? SUMMARY_MAX_CHARS : null);
  }
  out.push(...bulletTexts((item.bullets as AnyRecord[] | undefined) ?? []));
  // Years of the dates (never the months, which a statement rarely writes in figures).
  const years = ['start', 'end', 'date']
    .map((k) => item[k])
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.slice(0, 4));
  if (years.length) out.push({ lang: null, text: years.join(' '), max: null });
  return out;
}

function bulletTexts(bullets: AnyRecord[]): ProposedText[] {
  const out: ProposedText[] = [];
  for (const b of bullets) {
    for (const variant of (b.variants as AnyRecord[] | undefined) ?? []) {
      const t = variant.text as Bilingual | undefined;
      for (const l of ['fr', 'en'] as const) if (t?.[l]) out.push({ lang: l, text: t[l]!, max: BULLET_MAX_CHARS });
    }
  }
  return out;
}

function overlaps(a: { start: string | null; end: string | null }, b: { start: string | null; end: string | null }) {
  const lo = (s: string | null) => (s ? s.padEnd(7, '-00') : '0000-00');
  const hi = (s: string | null) => (s ? (s.length === 4 ? `${s}-12` : s) : '9999-99');
  return lo(a.start) <= hi(b.end) && lo(b.start) <= hi(a.end);
}

/** F-IMP-04: the element of the same kind that this one duplicates, if any. */
export function duplicateIn(type: ItemType, item: AnyRecord, candidates: AnyRecord[]): AnyRecord | null {
  const variantKeys = (x: AnyRecord) =>
    ((x.variants as Array<{ text: Bilingual }> | undefined) ?? []).flatMap((v) => [
      looseKey(v.text.fr),
      looseKey(v.text.en),
    ]);
  const bil = (x: unknown) =>
    x && typeof x === 'object' ? [looseKey((x as Bilingual).fr), looseKey((x as Bilingual).en)] : [];
  const meets = (a: string[], b: string[]) => a.some((k) => k && b.includes(k));
  return (
    candidates.find((c) => {
      switch (type) {
        case 'title':
        case 'summary':
          return meets(variantKeys(item), variantKeys(c));
        case 'experience':
          return (
            looseKey(item.organization as string) === looseKey(c.organization as string) &&
            overlaps(item as { start: string; end: string | null }, c as { start: string; end: string | null })
          );
        case 'education':
          return (
            looseKey(item.institution as string) === looseKey(c.institution as string) &&
            meets(bil(item.degree), bil(c.degree))
          );
        case 'project': {
          // Same name, or a shared link or repository (ADR 0027: a repository read on GitHub).
          const links = (x: AnyRecord) =>
            [x.url as Link | null, ...((x.repos as Link[] | undefined) ?? [])].flatMap((l) =>
              l ? [linkKey(l.url)] : [],
            );
          return meets(bil(item.name), bil(c.name)) || meets(links(item), links(c));
        }
        case 'certification':
          return meets(bil(item.name), bil(c.name));
        case 'skill': {
          const forms = (x: AnyRecord) => [x.short as string, ...((x.aliases as string[] | undefined) ?? [])];
          return forms(item).some((f) => forms(c).some((g) => sameTerm(f, g)));
        }
        case 'language':
          return item.code === c.code;
        case 'interest':
          return meets(bil(item.text), bil(c.text));
        case 'category':
          return meets(bil(item.label), bil(c.label));
      }
      return false;
    }) ?? null
  );
}

/** `{ fr: "…" }` → `{ fr: "…", en: null }`: a missing translation is null (§9.3), never a refusal. */
function fillBilingual(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(fillBilingual);
  if (!value || typeof value !== 'object') return value;
  const o = value as AnyRecord;
  const keys = Object.keys(o);
  if (keys.length > 0 && keys.every((k) => k === 'fr' || k === 'en')) return { fr: o.fr ?? null, en: o.en ?? null };
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, fillBilingual(v)]));
}

/** Gives blank ids to the element and its bullets (the server assigns them) and default variant ids. */
function blankIds(item: AnyRecord): AnyRecord {
  const copy = fillBilingual(structuredClone(item)) as AnyRecord;
  copy.id = '';
  const fillVariants = (variants: unknown) => {
    if (!Array.isArray(variants)) return;
    const used: string[] = [];
    variants.forEach((v: AnyRecord, i) => {
      if (!v || typeof v !== 'object') return;
      const ok = typeof v.id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.id) && !used.includes(v.id);
      if (!ok) v.id = i === 0 ? 'principale' : `variante-${i + 1}`;
      used.push(v.id as string);
    });
  };
  fillVariants(copy.variants);
  if (Array.isArray(copy.bullets)) {
    for (const b of copy.bullets as AnyRecord[]) {
      if (b && typeof b === 'object') {
        b.id = '';
        fillVariants(b.variants);
      }
    }
  }
  return copy;
}

/** Check recorded with a proposal (guardrail of annex C, or import remark such as « date à vérifier »). */
export interface ProposalCheck {
  rule: string;
  ok: boolean;
  level: 'error' | 'warning';
  value?: number;
  found?: string[];
  message?: string;
}

/** An element to propose, once its reference source is known. */
export interface ItemCandidate {
  type: ItemType;
  data: unknown;
  origin: 'claude' | 'import-linkedin';
  source: 'dictee' | 'import-cv' | 'import-linkedin' | 'offre';
  /** Reference source of the guardrails (annex C); `offre` uses the library, read under the lock. */
  sources: string[];
  sourceFile: string | null;
  userStatement: string | null;
  rationale: string | null;
  /** Remarks of the import shown with the proposal (date à vérifier, catégorie à vérifier…). */
  extraChecks?: ProposalCheck[];
  /** max-length: an error for Claude, a warning for a deterministic import (ADR 0015). */
  lengthLevel?: 'error' | 'warning';
}

/** Two bullets whose texts (same language) share this Jaccard or more: the new one is a variant (ADR 0015). */
export const COMPLEMENT_SIMILARITY = 0.6;

const sameBulletText = (a: AnyRecord, b: AnyRecord) => {
  const texts = (x: AnyRecord) =>
    ((x.variants as Array<{ text: Bilingual }> | undefined) ?? []).flatMap((v) => [
      looseKey(v.text.fr),
      looseKey(v.text.en),
    ]);
  const ta = texts(a);
  return texts(b).some((k) => k && ta.includes(k));
};

/** Closest existing bullet (same language), when similar enough to be a reformulation of it. */
function similarBullet(bullets: AnyRecord[], b: AnyRecord): AnyRecord | null {
  const first = ((b.variants as Array<{ text: Bilingual }>)[0]?.text ?? { fr: null, en: null }) as Bilingual;
  let best: { bullet: AnyRecord; score: number } | null = null;
  for (const x of bullets) {
    for (const v of (x.variants as Array<{ text: Bilingual }> | undefined) ?? []) {
      for (const l of ['fr', 'en'] as const) {
        if (!first[l] || !v.text[l]) continue;
        const score = jaccard(first[l]!, v.text[l]!);
        if (score >= COMPLEMENT_SIMILARITY && (!best || score > best.score)) best = { bullet: x, score };
      }
    }
  }
  return best?.bullet ?? null;
}

/**
 * Deduplicates (F-IMP-04, against the library, the pending proposals and the elements of the same call),
 * applies the guardrails and writes the proposals, under the lock. A duplicate of a validated element
 * with new bullets becomes a complement (`item` with `duplicateOf`), a bullet close to an existing one a
 * `variant`, a skill's new form an `alias` (ADR 0014, 0015). Shared by propose_item and import_linkedin.
 */
async function commitCandidates(
  store: DataStore,
  candidates: Array<ItemCandidate & { index: number }>,
  now: Date,
): Promise<ProposeOutcome> {
  const { library, revisions } = await store.loadLibraryFiles();
  const dict = await dictionaryOf(store, library);
  const registry = await store.readIds();
  const idsBefore = JSON.stringify(registry.ids);
  const pending = (await store.listProposals()).filter(isOpen);
  // A skill may target a pending category (ADR 0023): integrity is checked against both.
  const pendingCats = openCategoryProposals(pending);
  const known = {
    ...library,
    categories: [...library.categories, ...[...pendingCats.values()].map((p) => p.payload.item)],
  } as Library;
  const durations = durationNumbers(experienceDurations(library, now));
  const outcome: ProposeOutcome = { results: [], proposalIds: [], writes: [] };
  const reject = (index: number, reasons: string[], checks: GuardrailCheck[] = []) =>
    outcome.results.push({ index, status: 'rejected', reasons, checks });
  /** Proposals to write once ids.json is saved; `main` is the new element of its candidate. */
  const toWrite: Array<{
    index: number;
    main: boolean;
    value: NewProposal;
    checks: ProposalCheck[];
    itemId?: string;
  }> = [];
  /** New elements of this call, for the deduplication between them. */
  const batch: Array<{ index: number; type: ItemType; item: AnyRecord }> = [];
  /** Bullets already proposed as a complement of each validated element (pending or in this call). */
  const complements = new Map<string, AnyRecord[]>();
  for (const p of pending) {
    if (p.type === 'item' && p.payload.duplicateOf) {
      const list = complements.get(p.payload.duplicateOf) ?? [];
      list.push(...(((p.payload.item as AnyRecord).bullets as AnyRecord[] | undefined) ?? []));
      complements.set(p.payload.duplicateOf, list);
    }
  }
  const inBatchDup: Array<{ index: number; of: number }> = [];

  for (const c of candidates) {
    const { index } = c;
    const collection = ITEM_COLLECTION[c.type];
    if (!collection) {
      reject(index, [`type inconnu : ${String(c.type)}`]);
      continue;
    }
    if (!c.data || typeof c.data !== 'object' || Array.isArray(c.data)) {
      reject(index, ['data : objet attendu']);
      continue;
    }
    // Sanitized and validated first with temporary ids: a refused element consumes no identifier.
    const raw = blankIds(c.data as AnyRecord);
    const { value: sanitized, issues: refusals } = sanitizeDeep(raw, '$');
    if (refusals.length) {
      reject(index, [`saisie refusée : ${refusals.map((r) => `${r.path} : ${r.detail ?? r.message}`).join(' ; ')}`]);
      continue;
    }
    let n = 0;
    const draft = structuredClone(sanitized) as AnyRecord;
    assignIds(registry, collection, draft, { placeholder: () => `tmp-${++n}` });
    const schema = collectionItemSchemas[collection] as z.ZodType<AnyRecord>;
    const checked = schema.safeParse(draft);
    if (!checked.success) {
      reject(index, [
        `données invalides : ${checked.error.issues.map((i) => `${i.path.join('.')} : ${i.message}`).join(' ; ')}`,
      ]);
      continue;
    }
    const item = checked.data;
    if (c.type === 'category') {
      const label = item.label as Bilingual;
      if (label.fr === null && label.en === null) {
        reject(index, ['label : au moins une langue (fr ou en)']);
        continue;
      }
    }
    const before = new Set(checkLibraryIntegrity(known).errors.map((e) => e.message));
    const withItem = { ...known, [collection]: [...(known[collection] as unknown[]), item] } as Library;
    const fresh = checkLibraryIntegrity(withItem).errors.filter((e) => !before.has(e.message));
    if (fresh.length) {
      const reasons = [`incohérence : ${fresh.map((e) => e.message).join(' ; ')}`];
      if (fresh.some((e) => e.path.endsWith('.category'))) {
        reasons.push(
          'proposez d\u2019abord la catégorie (propose_item type category) dans un appel séparé, puis visez l\u2019itemId renvoyé',
        );
      }
      reject(index, reasons);
      continue;
    }
    const sources = c.source === 'offre' ? stringsOf(library) : c.sources;
    const extraNumbers = c.source === 'offre' ? durations : [];
    const common = {
      origin: c.origin,
      source: c.source,
      dependsOn: [],
      supersedes: null,
      sourceFile: c.sourceFile,
      userStatement: c.userStatement,
    };
    const guard = (texts: ProposedText[], extraSources: string[] = []) =>
      runGuardrails({
        texts,
        sources: [...sources, ...extraSources].map((s) => ({ lang: null, text: s })),
        dictionary: dict,
        extraNumbers,
        ongoing: c.type === 'experience' && item.end === null,
        ...(c.lengthLevel ? { lengthLevel: c.lengthLevel } : {}),
      });

    // F-IMP-04, against the library.
    const inLibrary = duplicateIn(c.type, item, library[collection] as unknown as AnyRecord[]);
    if (inLibrary) {
      const extra: Array<{ value: NewProposal; checks: ProposalCheck[] }> = [];
      let hint: string;
      if (c.type === 'skill') {
        hint = 'compétence déjà présente : ses nouvelles formes sont proposées comme alias';
        const known = [
          inLibrary.short as string,
          ...((inLibrary.aliases as string[]) ?? []),
          ...((inLibrary.related as string[]) ?? []),
        ];
        const forms = [item.short as string, ...((item.aliases as string[]) ?? [])].filter(
          (f) => !known.some((k) => sameTerm(k, f)),
        );
        for (const alias of forms) {
          const dup = pending.some(
            (p) => p.type === 'alias' && p.payload.skillId === inLibrary.id && sameTerm(p.payload.alias, alias),
          );
          if (dup) continue;
          extra.push({
            checks: [],
            value: {
              ...common,
              type: 'alias',
              target: {
                collection: 'skills',
                itemId: inLibrary.id as string,
                bulletId: null,
                variantId: null,
                field: null,
              },
              base: {
                file: 'library/skills.json',
                revision: revisions.skills,
                hash: hashSubject(inLibrary),
                snapshot: inLibrary,
              },
              payload: { skillId: inLibrary.id as string, alias, kind: 'alias', sourceTerm: null },
              rationale: `Forme de « ${inLibrary.short as string} » trouvée dans un élément proposé (doublon).`,
              checks: [],
            } as unknown as NewProposal,
          });
        }
      } else if (Array.isArray(item.bullets) && Array.isArray(inLibrary.bullets)) {
        // Complement (ADR 0015): new bullets added to the validated element, close ones as variants.
        const existing = inLibrary.bullets as AnyRecord[];
        const already = complements.get(inLibrary.id as string) ?? [];
        const added: number[] = [];
        const variants: Array<{ bullet: AnyRecord; text: Bilingual }> = [];
        (item.bullets as AnyRecord[]).forEach((b, i) => {
          if (existing.some((x) => sameBulletText(x, b)) || already.some((x) => sameBulletText(x, b))) return;
          const close = similarBullet(existing, b);
          if (!close) {
            added.push(i);
            return;
          }
          const text = (b.variants as Array<{ text: Bilingual }>)[0]!.text;
          const dup = pending.some(
            (p) =>
              p.type === 'variant' &&
              p.target.bulletId === close.id &&
              (['fr', 'en'] as const).some((l) => text[l] && p.payload.text[l] === text[l]),
          );
          if (!dup) variants.push({ bullet: close, text });
        });
        const texts = [
          ...bulletTexts(added.map((i) => (item.bullets as AnyRecord[])[i]!)),
          ...variants.flatMap((v) => bulletTexts([{ variants: [{ text: v.text }] }])),
        ];
        if (texts.length) {
          const checks = [...guard(texts), ...(c.extraChecks ?? [])];
          if (isRejected(checks as GuardrailCheck[])) {
            reject(index, rejectionReasons(checks as GuardrailCheck[]), checks as GuardrailCheck[]);
            continue;
          }
          const base = {
            file: `library/${collection}.json`,
            revision: revisions[collection],
            hash: hashSubject(inLibrary),
            snapshot: inLibrary,
          };
          if (added.length) {
            const final = structuredClone(sanitized) as AnyRecord;
            final.bullets = added.map((i) => (final.bullets as AnyRecord[])[i]);
            assignIds(registry, collection, final, { itemId: inLibrary.id as string });
            const value = schema.parse(final);
            complements.set(inLibrary.id as string, [...already, ...(value.bullets as AnyRecord[])]);
            extra.push({
              checks,
              value: {
                ...common,
                type: 'item',
                target: { collection, itemId: inLibrary.id as string, bulletId: null, variantId: null, field: null },
                base,
                payload: { itemType: c.type, item: value, duplicateOf: inLibrary.id as string },
                rationale:
                  c.rationale ??
                  `Complément de l'élément existant : ${added.length} puce${added.length > 1 ? 's' : ''} absente${added.length > 1 ? 's' : ''} de la bibliothèque (source : ${c.source}).`,
                checks,
              } as unknown as NewProposal,
            });
          }
          for (const v of variants) {
            const bullet = v.bullet;
            const variantChecks = [...guard(bulletTexts([{ variants: [{ text: v.text }] }])), ...(c.extraChecks ?? [])];
            extra.push({
              checks: variantChecks,
              value: {
                ...common,
                type: 'variant',
                target: {
                  collection,
                  itemId: inLibrary.id as string,
                  bulletId: bullet.id as string,
                  variantId: null,
                  field: null,
                },
                base: {
                  file: `library/${collection}.json`,
                  revision: revisions[collection],
                  hash: hashSubject(bullet),
                  snapshot: bullet,
                },
                payload: { label: c.source === 'import-linkedin' ? 'linkedin' : 'cv', text: v.text },
                rationale: `Formulation proche d'une puce existante, trouvée dans ${c.sourceFile ?? c.source}.`,
                checks: variantChecks,
              } as unknown as NewProposal,
            });
          }
        }
        hint = extra.length
          ? 'élément déjà présent : ses puces nouvelles sont proposées en complément, les formulations proches en variantes'
          : 'élément déjà présent, sans puce nouvelle';
      } else if (c.type === 'category') {
        hint = 'catégorie déjà présente : visez son identifiant (itemId) dans le champ category des compétences';
      } else {
        hint =
          c.type === 'title' || c.type === 'summary'
            ? 'texte déjà présent dans la bibliothèque'
            : 'élément déjà présent : complétez-le avec propose_variant (puces) ou propose_edit (champ)';
      }
      for (const e of extra) toWrite.push({ index, main: false, ...e });
      outcome.results.push({
        index,
        status: 'duplicateOf',
        duplicateOf: inLibrary.id as string,
        proposalIds: [],
        hint,
        itemId: inLibrary.id as string,
      });
      continue;
    }
    // Against the pending proposals (T-02: « sans doublon de l'import LinkedIn encore en attente »).
    const pendingDup = pending.find(
      (p) =>
        p.type === 'item' &&
        !p.payload.duplicateOf &&
        p.payload.itemType === c.type &&
        duplicateIn(c.type, item, [p.payload.item as AnyRecord]),
    );
    if (pendingDup) {
      outcome.results.push({
        index,
        status: 'duplicateOf',
        duplicateOf: pendingDup.id,
        proposalIds: [],
        hint:
          c.type === 'category'
            ? 'catégorie déjà proposée, en attente : visez son itemId dans le champ category des compétences'
            : 'élément déjà proposé, en attente dans « À valider » : acceptez-le ou rejetez-le d\u2019abord, puis complétez-le',
        itemId: pendingDup.type === 'item' ? ((pendingDup.payload.item as AnyRecord).id as string) : null,
      });
      continue;
    }
    // Against the elements of this call.
    const batchDup = batch.find((b) => b.type === c.type && duplicateIn(c.type, item, [b.item]));
    if (batchDup) {
      inBatchDup.push({ index, of: batchDup.index });
      continue;
    }

    const checks: ProposalCheck[] = [...guard(proposedTexts(c.type, item)), ...(c.extraChecks ?? [])];
    if (isRejected(checks as GuardrailCheck[])) {
      reject(index, rejectionReasons(checks as GuardrailCheck[]), checks as GuardrailCheck[]);
      continue;
    }
    // Final ids, reserved in ids.json (never reused, even if the proposal is rejected).
    const final = structuredClone(sanitized) as AnyRecord;
    assignIds(registry, collection, final);
    const value = schema.parse(final);
    batch.push({ index, type: c.type, item: value });
    const { value: rationale } = prepare(text, c.rationale ?? null);
    // A skill in a pending category depends on that proposal (F-PRO-03, ADR 0023).
    const dep = c.type === 'skill' ? pendingCats.get(value.category as string) : undefined;
    toWrite.push({
      index,
      main: true,
      checks,
      itemId: value.id as string,
      value: {
        ...common,
        dependsOn: dep ? [dep.id] : [],
        type: 'item',
        target: { collection, itemId: null, bulletId: null, variantId: null, field: null },
        base: null,
        payload: { itemType: c.type, item: value, duplicateOf: null },
        rationale: rationale ?? `Proposé par Claude (source : ${c.source}).`,
        checks,
      } as unknown as NewProposal,
    });
  }

  if (JSON.stringify(registry.ids) !== idsBefore) {
    const saved = await store.write('ids.json', registry, { locked: true });
    outcome.writes.push({ file: 'ids.json', revision: saved.revision });
  }
  const mainOf = new Map<number, string>();
  for (const w of toWrite) {
    const { id, write } = await writeProposal(store, w.value, now);
    outcome.proposalIds.push(id);
    outcome.writes.push(write);
    if (w.main) {
      mainOf.set(w.index, id);
      outcome.results.push({
        index: w.index,
        status: 'created',
        proposalId: id,
        checks: w.checks as GuardrailCheck[],
        itemId: w.itemId!,
        dependsOn: w.value.dependsOn ?? [],
      });
    } else {
      const r = outcome.results.find((x) => x.index === w.index);
      if (r?.status === 'duplicateOf') r.proposalIds.push(id);
    }
  }
  for (const d of inBatchDup) {
    outcome.results.push({
      index: d.index,
      status: 'duplicateOf',
      duplicateOf: mainOf.get(d.of) ?? `élément ${d.of}`,
      proposalIds: [],
      hint: 'doublon d\u2019un autre élément du même envoi',
      itemId: (batch.find((b) => b.index === d.of)?.item.id as string | undefined) ?? null,
    });
  }
  outcome.results.sort((a, b) => a.index - b.index);
  return outcome;
}

/**
 * New elements (MCP-15), nested (an experience with its bullets). The server assigns the ids and
 * reserves them in ids.json, deduplicates against the library and the pending proposals (F-IMP-04),
 * and applies the guardrails against the reference source: `userStatement` (dictée), the text of
 * `sourceFile` (.md, .txt, and since lot 6 .pdf and .docx of import/), or the library and the computed
 * durations for a title or a summary built from it (`offre`).
 */
export async function proposeItems(
  store: DataStore,
  items: ItemInput[],
  opts: ProposeItemsOptions,
  now = new Date(),
): Promise<ProposeOutcome> {
  const candidates: Array<ItemCandidate & { index: number }> = [];
  const early: ProposeResult[] = [];
  const texts = new Map<string, string | StoreError>();
  for (const [index, input] of items.entries()) {
    const reject = (reasons: string[]) => early.push({ index, status: 'rejected', reasons, checks: [] });
    let sources: string[] = [];
    let userStatement: string | null = null;
    let sourceFile: string | null = null;
    if (input.source === 'dictee') {
      const { value } = prepare(text, (input.userStatement ?? '').replace(/\s*\n\s*/g, ' ').trim() || null);
      if (!value) {
        reject(['source dictee : userStatement (ce que l\u2019utilisateur a dit) est obligatoire']);
        continue;
      }
      userStatement = value;
      sources = [value];
    } else if (input.source === 'import-cv') {
      if (!input.sourceFile) {
        reject(['source import-cv : sourceFile (nom du fichier de import/) est obligatoire']);
        continue;
      }
      if (!texts.has(input.sourceFile)) {
        try {
          texts.set(input.sourceFile, await readSourceText(opts, input.sourceFile));
        } catch (err) {
          if (!(err instanceof StoreError)) throw err;
          texts.set(input.sourceFile, err);
        }
      }
      const got = texts.get(input.sourceFile)!;
      if (got instanceof StoreError) {
        reject([`${got.code} : ${got.message}${got.hint ? ` (${got.hint})` : ''}`]);
        continue;
      }
      sources = [got];
      sourceFile = input.sourceFile;
    } else if (input.source === 'offre') {
      if (input.type !== 'title' && input.type !== 'summary') {
        reject([
          'source offre : réservée à un titre ou une accroche construits à partir de la bibliothèque ; un fait nouveau vient de l\u2019utilisateur (dictee) ou de son CV (import-cv)',
        ]);
        continue;
      }
    } else {
      reject(['source import-linkedin : réservée à import_linkedin']);
      continue;
    }
    candidates.push({
      index,
      type: input.type,
      data: input.data,
      origin: 'claude',
      source: input.source,
      sources,
      sourceFile,
      userStatement,
      rationale: input.rationale ?? null,
    });
  }
  const outcome = await store.withLock(() => commitCandidates(store, candidates, now));
  outcome.results.push(...early);
  outcome.results.sort((a, b) => a.index - b.index);
  return outcome;
}

/** Reference text of `sourceFile`: .md and .txt by the store, .pdf and .docx by the reader of the caller. */
async function readSourceText(opts: ProposeItemsOptions, fileName: string): Promise<string> {
  if (/\.(?:pdf|docx)$/i.test(fileName)) {
    if (!opts.readImportText) {
      throw new StoreError('NOT_AVAILABLE', `lecture de ${fileName} indisponible ici`, {}, NO_TEXT_LAYER);
    }
    const r = await opts.readImportText(fileName);
    if (!r.hasTextLayer) {
      throw new StoreError('NOT_AVAILABLE', `${fileName} n'a pas de couche texte (PDF scanné)`, {}, NO_TEXT_LAYER);
    }
    return r.text;
  }
  return readImportTextFile(opts.importDir, fileName);
}

const NO_TEXT_LAYER = 'joignez le fichier directement dans la conversation, ou fournissez le DOCX';

/** Proposals of a deterministic import (LinkedIn, MCP-21): the same deduplication and writer as propose_item. */
export async function proposeImported(
  store: DataStore,
  candidates: ItemCandidate[],
  now = new Date(),
): Promise<ProposeOutcome> {
  return store.withLock(() =>
    commitCandidates(
      store,
      candidates.map((c, index) => ({ ...c, index })),
      now,
    ),
  );
}

// ---------------------------------------------------------------------------------------------------
// Translations (MCP-14, F-IMP-05)

export interface TranslationInput {
  target: {
    collection: CollectionName;
    itemId: string;
    bulletId?: string | null;
    variantId?: string | null;
    field: string;
  };
  lang: 'fr' | 'en';
  text: string;
  rationale?: string | null;
}

/** At most 25 translations per call (§7.2). */
export const MAX_BATCH = 25;

/**
 * Translations FR ↔ EN of bilingual fields (MCP-14). A translation only fills an empty language: an
 * existing one is never overwritten (ADR 0010), the target must be a field listed by
 * list({kind: untranslated}). Reference source (annex C): every FR and EN variant of the same bullet,
 * title or summary (every bilingual field of the element otherwise), plus the bullet's and the item's
 * `skills`. A pending translation of the same field is reported as `duplicateOf`.
 */
export async function proposeTranslations(
  store: DataStore,
  items: TranslationInput[],
  now = new Date(),
): Promise<ProposeOutcome> {
  return store.withLock(async () => {
    const { library, revisions } = await store.loadLibraryFiles();
    const dict = await dictionaryOf(store, library);
    const pending = (await store.listProposals()).filter(isOpen);
    const outcome: ProposeOutcome = { results: [], proposalIds: [], writes: [] };
    /** Translations created by this call, by target and language (a second one is a duplicate). */
    const sameCall = new Map<string, string>();
    for (const [index, input] of items.entries()) {
      const reject = (reasons: string[], checks: GuardrailCheck[] = []) =>
        outcome.results.push({ index, status: 'rejected', reasons, checks });
      const t = input.target;
      if ((t.collection as string) === 'profile') {
        reject([
          "les champs de l'identité (pays, permis, autorisation de travail) se traduisent dans l'interface, écran Identité",
        ]);
        continue;
      }
      if (!(t.collection in revisions)) {
        reject([`collection inconnue : ${String(t.collection)}`]);
        continue;
      }
      const item = (library[t.collection] as unknown as AnyRecord[]).find((x) => x.id === t.itemId);
      if (!item) {
        reject([`élément introuvable : ${t.itemId}`]);
        continue;
      }
      if (item.archived) {
        reject([`élément archivé : ${t.itemId}`]);
        continue;
      }
      const field = bilingualFields(t.collection, item as never).find(
        (f) =>
          f.field === t.field &&
          (f.bulletId ?? null) === (t.bulletId ?? null) &&
          (f.variantId ?? null) === (t.variantId ?? null),
      );
      if (!field) {
        reject([
          `champ bilingue introuvable : ${t.collection}/${t.itemId}${t.bulletId ? `/${t.bulletId}` : ''}${t.variantId ? ` variante ${t.variantId}` : ''} ${t.field} (cibles : list({kind: untranslated}))`,
        ]);
        continue;
      }
      const other = input.lang === 'fr' ? 'en' : 'fr';
      if (field.value[input.lang] !== null) {
        reject([
          `déjà traduit (${input.lang.toUpperCase()} : « ${field.value[input.lang]} ») : une traduction ne remplit qu'une langue vide, elle n'écrase jamais l'existante`,
        ]);
        continue;
      }
      if (field.value[other] === null) {
        reject([`rien à traduire : le champ est vide dans les deux langues`]);
        continue;
      }
      const { value: translated, issues } = prepare(text, input.text);
      const { value: rationale } = prepare(text.nullable(), input.rationale ?? null);
      if (!translated) {
        reject([`saisie refusée : ${issuesText(issues)}`]);
        continue;
      }
      const key = [t.collection, t.itemId, t.bulletId ?? '', t.variantId ?? '', t.field, input.lang].join('|');
      const dup =
        pending.find(
          (p) =>
            p.type === 'translation' &&
            p.payload.lang === input.lang &&
            p.target.collection === t.collection &&
            p.target.itemId === t.itemId &&
            (p.target.bulletId ?? null) === (t.bulletId ?? null) &&
            (p.target.variantId ?? null) === (t.variantId ?? null) &&
            p.target.field === t.field,
        )?.id ?? sameCall.get(key);
      if (dup) {
        outcome.results.push({
          index,
          status: 'duplicateOf',
          duplicateOf: dup,
          proposalIds: [],
          hint: 'traduction déjà proposée, en attente dans « À valider »',
        });
        continue;
      }
      const bullet = t.bulletId
        ? (((item.bullets as AnyRecord[] | undefined) ?? []).find((b) => b.id === t.bulletId) ?? null)
        : null;
      const owner = bullet ?? item;
      const sourceFields = bullet
        ? bilingualFields(t.collection, item as never).filter((f) => f.bulletId === t.bulletId)
        : t.variantId
          ? bilingualFields(t.collection, item as never).filter((f) => f.variantId && !f.bulletId)
          : bilingualFields(t.collection, item as never).filter((f) => !f.bulletId);
      const max = bullet ? BULLET_MAX_CHARS : t.collection === 'summaries' ? SUMMARY_MAX_CHARS : null;
      const checks = runGuardrails({
        texts: [{ lang: input.lang, text: translated, max }],
        sources: sourceFields.flatMap((f) =>
          (['fr', 'en'] as const).filter((l) => f.value[l]).map((l) => ({ lang: l, text: f.value[l]! })),
        ),
        dictionary: dict,
        allowedSkillIds: [
          ...((bullet?.skills as string[] | undefined) ?? []),
          ...((item.skills as string[] | undefined) ?? []),
          ...(t.collection === 'skills' ? [item.id as string] : []),
        ],
        ongoing: t.collection === 'experiences' && item.end === null,
      });
      if (isRejected(checks)) {
        reject(rejectionReasons(checks), checks);
        continue;
      }
      const { id, write } = await writeProposal(
        store,
        {
          type: 'translation',
          origin: 'claude',
          source: 'bibliotheque',
          target: {
            collection: t.collection,
            itemId: t.itemId,
            bulletId: t.bulletId ?? null,
            variantId: t.variantId ?? null,
            field: t.field,
          },
          base: {
            file: `library/${t.collection}.json`,
            revision: revisions[t.collection],
            hash: hashSubject(owner),
            snapshot: owner,
          },
          payload: { lang: input.lang, text: translated },
          rationale: rationale ?? null,
          checks,
          dependsOn: [],
          supersedes: null,
          sourceFile: null,
          userStatement: null,
        } as unknown as NewProposal,
        now,
      );
      outcome.results.push({ index, status: 'created', proposalId: id, checks });
      sameCall.set(key, id);
      outcome.proposalIds.push(id);
      outcome.writes.push(write);
    }
    return outcome;
  });
}

// ---------------------------------------------------------------------------------------------------
// Edit of a field (MCP-16)

export interface EditInput {
  target: { collection: CollectionName; itemId: string; bulletId?: string | null };
  field: string;
  newValue: unknown;
  rationale: string;
  /** What the user said: added to the reference source (the old value, annex C). */
  userStatement?: string | null;
  baseRevision?: number;
}

export interface SingleOutcome {
  proposalId: string;
  checks: GuardrailCheck[];
  writes: WriteRef[];
  /** Proposals this one depends on (a skill moved to a pending category, ADR 0023; pending variants). */
  dependsOn: string[];
}

function guardrailError(checks: GuardrailCheck[]): StoreError {
  return new StoreError(
    'GUARDRAIL_REJECTED',
    `proposition refusée par les garde-fous : ${rejectionReasons(checks).join(' ; ')}`,
    { checks },
    'corrigez la proposition sans rien ajouter qui ne soit dans la source, ou demandez à l\u2019utilisateur',
  );
}

/**
 * Correction of a field (MCP-16), with the old value kept in the proposal. organization, position,
 * start and end are sensitive facts (F-PRO-06): accepted one by one in the interface. Reference source:
 * the old value, plus what the user said.
 */
export async function proposeEdit(store: DataStore, input: EditInput, now = new Date()): Promise<SingleOutcome> {
  return store.withLock(async () => {
    const { library, revisions } = await store.loadLibraryFiles();
    const collection = input.target.collection;
    if (!(collection in revisions)) throw new StoreError('NOT_FOUND', `collection inconnue : ${String(collection)}`);
    if (input.baseRevision !== undefined && input.baseRevision !== revisions[collection]) {
      throw staleRevision(`library/${collection}.json`, revisions[collection], input.baseRevision);
    }
    const item = (library[collection] as unknown as AnyRecord[]).find((x) => x.id === input.target.itemId);
    if (!item) throw new StoreError('NOT_FOUND', `élément introuvable : ${input.target.itemId}`);
    const bullet = input.target.bulletId
      ? (((item.bullets as AnyRecord[] | undefined) ?? []).find((b) => b.id === input.target.bulletId) ?? null)
      : null;
    if (input.target.bulletId && !bullet)
      throw new StoreError('NOT_FOUND', `puce introuvable : ${input.target.bulletId}`);
    const owner = bullet ?? item;
    const root = input.field.split('.')[0]!;
    if (['id', 'bullets', 'variants'].includes(root)) {
      throw new StoreError(
        'INVALID_DATA',
        `champ non modifiable par une proposition : ${input.field}`,
        {},
        'proposez une variante (propose_variant)',
      );
    }
    const oldValue = getPath(owner, input.field);
    if (oldValue === undefined) throw new StoreError('NOT_FOUND', `champ inconnu : ${input.field}`);
    const { value: newValue, issues } = sanitizeDeep(input.newValue, '$');
    if (issues.length)
      throw new StoreError('INVALID_DATA', `valeur refusée : ${issues.map((i) => i.detail ?? i.message).join(' ; ')}`);
    if (sameJson(oldValue, newValue)) throw new StoreError('NOT_APPLICABLE', 'valeur identique à la valeur actuelle');
    // The edited element must stay valid.
    const edited = structuredClone(item);
    const editedOwner = bullet
      ? ((edited.bullets as AnyRecord[]).find((b) => b.id === bullet.id) as AnyRecord)
      : edited;
    try {
      setPath(editedOwner, input.field, structuredClone(newValue));
    } catch {
      throw new StoreError('NOT_FOUND', `champ introuvable : ${input.field}`);
    }
    const valid = (collectionItemSchemas[collection] as z.ZodType<AnyRecord>).safeParse(edited);
    if (!valid.success) {
      throw new StoreError(
        'INVALID_DATA',
        `valeur invalide : ${valid.error.issues.map((i) => `${i.path.join('.')} : ${i.message}`).join(' ; ')}`,
      );
    }
    // The category of a skill: a validated category, or a pending one the proposal then depends on (ADR 0023).
    const isCategory = collection === 'skills' && root === 'category';
    let dependsOn: string[] = [];
    if (isCategory) {
      const v = newValue as string;
      if (!library.categories.some((c) => c.id === v)) {
        const dep = openCategoryProposals(await store.listProposals()).get(v);
        if (!dep) {
          throw new StoreError(
            'INVALID_DATA',
            `catégorie inconnue : ${v}`,
            {},
            'visez une catégorie de get_library, ou proposez-la d\u2019abord (propose_item type category) et visez son itemId',
          );
        }
        dependsOn = [dep.id];
      }
    }
    const { value: rationale } = prepare(text, input.rationale);
    if (!rationale) throw new StoreError('INVALID_DATA', 'rationale : justification obligatoire');
    const { value: statement } = prepare(text, (input.userStatement ?? '').replace(/\s*\n\s*/g, ' ').trim() || null);

    const sensitive = (SENSITIVE_FIELDS as readonly string[]).includes(root);
    const dates = root === 'start' || root === 'end' || root === 'date';
    // Dates and a category id are structured values, not text checked against the source.
    const structured = dates || isCategory;
    const pairs = (v: unknown): Array<{ lang: 'fr' | 'en' | null; text: string }> =>
      typeof v === 'string'
        ? [{ lang: null, text: v }]
        : v && typeof v === 'object' && 'fr' in v && 'en' in v
          ? (['fr', 'en'] as const)
              .filter((l) => (v as Bilingual)[l])
              .map((l) => ({ lang: l, text: (v as Bilingual)[l]! }))
          : stringsOf(v).map((t) => ({ lang: null, text: t }));
    const checks = runGuardrails({
      // Dates are a sensitive fact the user checks, not counted as numbers; a category is an id.
      texts: structured ? [] : pairs(newValue).map((p) => ({ ...p, max: bullet ? BULLET_MAX_CHARS : null })),
      sources: [...pairs(oldValue), ...(statement ? [{ lang: null, text: statement }] : [])],
      dictionary: await dictionaryOf(store, library),
      allowedSkillIds: [
        ...((bullet?.skills as string[] | undefined) ?? []),
        ...((item.skills as string[] | undefined) ?? []),
      ],
      ongoing: collection === 'experiences' && item.end === null,
      similarity: !structured,
      sensitiveField: sensitive ? root : null,
    });
    if (isRejected(checks)) throw guardrailError(checks);
    const { id, write } = await writeProposal(
      store,
      {
        type: 'edit',
        origin: 'claude',
        source: statement ? 'dictee' : 'offre',
        target: {
          collection,
          itemId: item.id as string,
          bulletId: (bullet?.id as string) ?? null,
          variantId: null,
          field: input.field,
        },
        base: {
          file: `library/${collection}.json`,
          revision: revisions[collection],
          hash: hashSubject(owner),
          snapshot: owner,
        },
        payload: { field: input.field, oldValue, newValue, sensitive },
        rationale,
        checks,
        dependsOn,
        supersedes: null,
        sourceFile: null,
        userStatement: statement,
      } as unknown as NewProposal,
      now,
    );
    return { proposalId: id, checks, writes: [write], dependsOn };
  });
}

// ---------------------------------------------------------------------------------------------------
// Alias or related term of a skill (MCP-17)

export interface AliasInput {
  skillId: string;
  alias: string;
  kind: 'alias' | 'related';
  sourceTerm?: string | null;
  rationale?: string | null;
}

/**
 * An alias (strict equivalent: it counts for coverage) or a related term (never counted) of a skill, for
 * the group (b) of F-OFF-03. An alias that is another known skill is refused: an alias must not make a
 * term covered that the candidate does not have.
 */
export async function proposeAlias(
  store: DataStore,
  input: AliasInput,
  now = new Date(),
): Promise<SingleOutcome | { duplicateOf: string }> {
  return store.withLock(async () => {
    const { library, revisions } = await store.loadLibraryFiles();
    const skill = library.skills.find((s) => s.id === input.skillId && !s.archived);
    if (!skill) throw new StoreError('NOT_FOUND', `compétence introuvable : ${input.skillId}`);
    const { value: alias, issues } = prepare(text, input.alias);
    if (!alias) throw new StoreError('INVALID_DATA', `alias refusé : ${issuesText(issues)}`);
    const known = [skill.short, ...skill.aliases, ...skill.related, skill.long?.fr, skill.long?.en].filter(
      (x): x is string => !!x,
    );
    if (known.some((k) => sameTerm(k, alias))) {
      throw new StoreError('NOT_APPLICABLE', `« ${alias} » figure déjà dans la compétence ${skill.short}`);
    }
    const dup = (await store.listProposals()).find(
      (p) => isOpen(p) && p.type === 'alias' && p.payload.skillId === skill.id && sameTerm(p.payload.alias, alias),
    );
    if (dup) return { duplicateOf: dup.id };

    const dict = await dictionaryOf(store, library);
    const self = dict.canonical(skill.id);
    const other = detectSkills(dict, [alias]).filter(
      (d) => d.id !== self && dict.entries.find((e) => e.id === d.id)?.forms.some((f) => sameTerm(f, alias)),
    );
    const checks: GuardrailCheck[] = [
      input.kind === 'alias' && other.length
        ? {
            rule: 'no-new-skills',
            ok: false,
            level: 'error',
            found: other.map((o) => o.label),
            message: `« ${alias} » est une autre compétence (${other.map((o) => o.label).join(', ')}) : un alias doit être un équivalent strict ; proposez un terme voisin (related) ou un nouvel élément`,
          }
        : { rule: 'no-new-skills', ok: true, level: 'error' },
      checkForeignContent([alias], []),
    ];
    if (isRejected(checks)) throw guardrailError(checks);
    const { value: sourceTerm } = prepare(text.nullable(), input.sourceTerm ?? null);
    const { value: rationale } = prepare(text, input.rationale ?? null);
    const { id, write } = await writeProposal(
      store,
      {
        type: 'alias',
        origin: 'claude',
        source: 'offre',
        target: { collection: 'skills', itemId: skill.id, bulletId: null, variantId: null, field: null },
        base: { file: 'library/skills.json', revision: revisions.skills, hash: hashSubject(skill), snapshot: skill },
        payload: { skillId: skill.id, alias, kind: input.kind, sourceTerm: sourceTerm ?? null },
        rationale:
          rationale ??
          (input.kind === 'alias'
            ? `Équivalent strict de « ${skill.short} » employé par l'offre.`
            : `Terme voisin de « ${skill.short} » employé par l'offre (ne compte pas pour la couverture).`),
        checks,
        dependsOn: [],
        supersedes: null,
        sourceFile: null,
        userStatement: null,
      } as unknown as NewProposal,
      now,
    );
    return { proposalId: id, checks, writes: [write], dependsOn: [] };
  });
}

// ---------------------------------------------------------------------------------------------------
// Selection (MCP-12)

export interface SelectionInput {
  target: { kind: 'preset' | 'application'; id: string };
  selection: unknown;
  rationale?: Record<string, string>;
  dependsOn?: string[];
  supersedes?: string | null;
  baseRevision?: number;
}

export interface SelectionOutcome extends SingleOutcome {
  delta: SelectionDelta;
  /** Differences of the candidate that a delta cannot carry (sections, order, title, summary). */
  ignored: string[];
  superseded: string | null;
}

/** Delta between the current selection and a candidate (MCP-12: additions, removals, variants). */
export function selectionDeltaOf(current: Selection, candidate: Selection): SelectionDelta {
  const variantChoice: Record<string, string> = {};
  for (const [k, v] of Object.entries(candidate.variantChoice))
    if (current.variantChoice[k] !== v) variantChoice[k] = v;
  return {
    add: candidate.include.filter((x) => !current.include.includes(x)),
    remove: current.include.filter((x) => !candidate.include.includes(x)),
    variantChoice,
  };
}

/**
 * A selection proposal (MCP-12), stored as a delta. One active proposal per target: a new one must name
 * the active one in `supersedes`, which then becomes `superseded`. F-SEL-10 is applied by the server
 * (no whole experience hidden, no locked element unchecked). `prop:<ULID>` variants are dependencies.
 */
export async function proposeSelection(
  store: DataStore,
  input: SelectionInput,
  now = new Date(),
): Promise<SelectionOutcome> {
  return store.withLock(async () => {
    const rel =
      input.target.kind === 'preset'
        ? `presets/${input.target.id}.json`
        : `applications/${input.target.id}/selection.json`;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.target.id) || !(await store.exists(rel))) {
      throw new StoreError(
        'NOT_FOUND',
        `${input.target.kind === 'preset' ? 'preset' : 'candidature'} introuvable : ${input.target.id}`,
      );
    }
    const file = await store.read<PresetFile | ApplicationSelectionFile>(rel);
    if (input.baseRevision !== undefined && input.baseRevision !== file.revision) {
      throw staleRevision(rel, file.revision, input.baseRevision);
    }
    const { value: candidate, issues } = prepare(selectionSchema, input.selection);
    if (!candidate) throw new StoreError('INVALID_DATA', `sélection invalide : ${issuesText(issues)}`, { issues });
    const current = file.selection;
    const delta = selectionDeltaOf(current, candidate);
    if (!delta.add.length && !delta.remove.length && !Object.keys(delta.variantChoice).length) {
      throw new StoreError('NOT_APPLICABLE', 'aucune différence avec la sélection actuelle (coches et variantes)');
    }
    const library = await store.loadLibrary();
    const known = new Set<string>();
    for (const list of Object.values(library) as AnyRecord[][]) {
      for (const it of list) {
        known.add(it.id as string);
        for (const b of (it.bullets as AnyRecord[] | undefined) ?? []) known.add(b.id as string);
      }
    }
    const unknown = delta.add.filter((x) => !known.has(x));
    if (unknown.length)
      throw new StoreError('INVALID_DATA', `identifiant inconnu : ${unknown.join(', ')}`, { unknown });

    // Dependencies: the pending variants named by `prop:<ULID>`, plus `dependsOn`.
    const proposals = await store.listProposals();
    const byId = new Map(proposals.map((p) => [p.id, p]));
    const deps = new Set(input.dependsOn ?? []);
    for (const [owner, ref] of Object.entries(delta.variantChoice)) {
      if (!ref.startsWith('prop:')) continue;
      const p = byId.get(ref.slice(5));
      if (!p || p.type !== 'variant' || !isOpen(p) || (p.target.bulletId ?? p.target.itemId) !== owner) {
        throw new StoreError('INVALID_DATA', `variante en attente introuvable pour ${owner} : ${ref}`);
      }
      deps.add(p.id);
    }
    for (const d of deps) {
      const p = byId.get(d);
      if (!p || !isOpen(p)) throw new StoreError('INVALID_DATA', `dépendance introuvable ou déjà traitée : ${d}`);
    }

    // What acceptance would give: F-SEL-10 and the differences a delta cannot carry.
    const applied = applySelectionDelta(current, delta, null, (ref) => ({ variantId: `prop-${ref.toLowerCase()}` }));
    revealAdded(library, applied.selection, delta.add, file.options.regulatoryPlacement);
    const violations = checkSelectionRule(library, current, applied.selection);
    if (violations.length) {
      const ids = [...new Set(violations.map((v) => v.id))];
      throw new StoreError(
        'SELECTION_RULE',
        `proposition refusée (F-SEL-10) : ${violations.map((v) => v.message).join(' ; ')}`,
        { ids, violations },
        `gardez ces éléments (${ids.join(', ')}) : réduisez plutôt les puces d'une expérience`,
      );
    }
    const ignored: string[] = [];
    const sectionsDiff = candidate.sections
      .filter((s) => s.enabled !== applied.selection.sections.find((x) => x.key === s.key)?.enabled)
      .map((s) => `${s.key} ${s.enabled ? 'activée' : 'désactivée'}`);
    if (sectionsDiff.length) ignored.push(`sections : ${sectionsDiff.join(', ')}`);
    if (!sameJson(candidate.order, current.order)) ignored.push('ordre des éléments');
    if (candidate.titleId !== current.titleId) ignored.push('titre choisi');
    if (candidate.summaryId !== current.summaryId) ignored.push('accroche choisie');
    if (!sameJson(candidate.overrides, current.overrides)) ignored.push('titre saisi (overrides)');

    // One active proposal per target.
    const active = proposals.filter(
      (p) =>
        p.type === 'selection' && isOpen(p) && p.target.kind === input.target.kind && p.target.id === input.target.id,
    );
    if (active.length && !active.some((p) => p.id === input.supersedes)) {
      throw new StoreError(
        'SUPERSEDES_REQUIRED',
        `une proposition de sélection est déjà active pour cette cible : ${active.map((p) => p.id).join(', ')}`,
        { active: active.map((p) => p.id) },
        `repassez la proposition avec supersedes: "${active[0]!.id}" pour la remplacer`,
      );
    }
    if (input.supersedes && !active.some((p) => p.id === input.supersedes)) {
      throw new StoreError(
        'INVALID_DATA',
        `supersedes : aucune proposition active ${input.supersedes} pour cette cible`,
      );
    }
    const rationaleSchema = z.record(idSchema, text);
    const { value: rationale, issues: whyIssues } = prepare(rationaleSchema, input.rationale ?? {});
    if (!rationale) throw new StoreError('INVALID_DATA', `rationale invalide : ${issuesText(whyIssues)}`);

    const checks: GuardrailCheck[] = [
      { rule: 'selection-rule' as GuardrailCheck['rule'], ok: true, level: 'error', message: 'F-SEL-10 respectée' },
      ...(ignored.length
        ? [
            {
              rule: 'selection-delta' as GuardrailCheck['rule'],
              ok: false,
              level: 'warning' as const,
              message: `non transmis (seules les coches et les variantes le sont) : ${ignored.join(' ; ')}`,
            },
          ]
        : []),
    ];
    const { id, write } = await writeProposal(
      store,
      {
        type: 'selection',
        origin: 'claude',
        source: 'offre',
        target: input.target,
        base: { file: rel, revision: file.revision, hash: hashSubject(current), snapshot: current },
        payload: delta,
        rationale,
        checks,
        dependsOn: [...deps],
        supersedes: input.supersedes ?? null,
        sourceFile: null,
        userStatement: null,
      } as unknown as NewProposal,
      now,
    );
    const writes = [write];
    let superseded: string | null = null;
    if (input.supersedes) {
      const old = byId.get(input.supersedes)!;
      const saved = await store.write(
        `proposals/${old.id}.json`,
        {
          ...old,
          status: 'superseded',
          resolution: { at: now.toISOString(), action: 'superseded', finalValue: { by: id }, reason: null },
        } as ProposalFile,
        { locked: true },
      );
      writes.push({ file: `proposals/${old.id}.json`, revision: saved.revision });
      superseded = old.id;
    }
    return { proposalId: id, checks, writes, dependsOn: [...deps], delta, ignored, superseded };
  });
}
