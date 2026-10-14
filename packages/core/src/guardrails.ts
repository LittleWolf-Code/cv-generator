// Guardrails against invention (annex C, §7.4), applied by the server to every proposal from Claude.
// Each rule compares the proposed texts with the reference source of the tool (the other variants of
// the same bullet, the old value of an edited field, the user's statement…) and returns a check of the
// shape stored in `proposal.checks`. An `error` rejects the proposal; a `warning` is only shown in
// « À valider ». Pure functions (ADR 0014).
import { contentStems } from './coverage.js';
import { flagInstructions } from './offer-text.js';
import type { OfferTerm } from './schema/application.js';
import type { Library } from './schema/library.js';
import { EMAIL_RE } from './text/contacts.js';
import {
  findTerm,
  foldWord,
  isAmbiguousTerm,
  normalizeForMatch,
  stripCodes,
  tokenizeForMatch,
  type MatchToken,
} from './text/normalize.js';
import { ANNEX_A, annexForms } from './vocab/annex-a.js';
import { ALLOWED_EDITIONS } from './vocab/editions.js';
import { TECH_VOCABULARY } from './vocab/tech.js';

export type GuardrailRule =
  | 'no-new-numbers'
  | 'protected-facts'
  | 'no-new-skills'
  | 'immutable-fields'
  | 'max-length'
  | 'similarity'
  | 'allowed-editions'
  | 'no-foreign-content';

export interface GuardrailCheck {
  rule: GuardrailRule;
  ok: boolean;
  level: 'error' | 'warning';
  value?: number;
  found?: string[];
  message?: string;
}

/** Annex C: 200 characters per bullet by default. */
export const BULLET_MAX_CHARS = 200;
/** Annex C: a summary of 3 lines at most, about 95 characters per line of body text (ADR 0014). */
export const SUMMARY_MAX_CHARS = 3 * 95;
/** Annex C: Jaccard of the content words below this value gives a warning. */
export const SIMILARITY_MIN = 0.45;

export const isRejected = (checks: readonly GuardrailCheck[]) => checks.some((c) => !c.ok && c.level === 'error');

/** Messages of the checks that reject, each citing its rule. */
export function rejectionReasons(checks: readonly GuardrailCheck[]): string[] {
  return checks.filter((c) => !c.ok && c.level === 'error').map((c) => `${c.rule} : ${c.message ?? 'échec'}`);
}

// ---------------------------------------------------------------------------------------------------
// no-new-numbers

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
  treize: 13,
  quatorze: 14,
  quinze: 15,
  seize: 16,
  'dix-sept': 17,
  'dix-huit': 18,
  'dix-neuf': 19,
  vingt: 20,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};
// « un », « une » and « one » are articles far more often than numbers: they are not converted.
const NUMBER_WORD_RE = new RegExp(
  `(?<![\\p{L}\\p{N}-])(${Object.keys(NUMBER_WORDS)
    .sort((a, b) => b.length - a.length)
    .join('|')})(?![\\p{L}\\p{N}-])`,
  'gu',
);

// Codes other than standards: regulations (2016/679, 93/42/CEE), MDCG guidance, versions.
const OTHER_CODES = [
  /(?<![\p{L}\p{N}])\d{2}\/\d{2}\/(?:CEE|EEC|CE|EC)(?![\p{L}\p{N}])/gu,
  /(?<![\p{L}\p{N}/])\d{4}\/\d{3,4}(?![\p{L}\p{N}/])/gu,
  /(?<![\p{L}\p{N}])MDCG\s+\d{4}-\d+(?:\s*\(r[eé]v\.\s*\d+\))?/gu,
  /(?<![\p{L}\p{N}])v\d+(?:\.\d+)*(?![\p{L}\p{N}])/gu,
  /(?<![\p{L}\p{N}.])\d+\.\d+\.\d+(?:\.\d+)*(?![\p{L}\p{N}])/gu,
  // Qualification frameworks (§5.4: « EQF level 7 » is the international marker of a French degree).
  /(?<![\p{L}\p{N}])(?:EQF|CEC|NQF)\s+(?:level|niveau)\s+[1-8](?![\p{L}\p{N}])/giu,
  /(?<![\p{L}\p{N}])(?:level|niveau)\s+[1-8]\s+(?:(?:of\s+the|du)\s+)?(?:EQF|CEC)(?![\p{L}\p{N}])/giu,
];
const NUMBER_RE =
  /(?<![\p{L}\p{N}])[x×]?(\d{1,3}(?:[ \u00A0\u202F]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)*)(?:\s?(Md|k|K|M|%|€|\$|x|×))?(?![\p{L}\p{N}])/gu;

function parseNumber(raw: string, suffix: string | undefined): number | null {
  let s = raw.replace(/[ \u00A0\u202F]/g, '');
  const seps = [...s.matchAll(/[.,]/g)];
  if (seps.length > 0) {
    const last = seps[seps.length - 1]!;
    const kinds = new Set(seps.map((m) => m[0]));
    const intPart = s.slice(0, seps[0]!.index);
    const groupsOf3 = s
      .slice(seps[0]!.index + 1)
      .split(/[.,]/)
      .every((g) => g.length === 3);
    if (kinds.size === 2) {
      // « 1.234,5 » / « 1,234.5 »: the last separator is the decimal one.
      s = s.slice(0, last.index).replace(/[.,]/g, '') + '.' + s.slice(last.index + 1);
    } else if (groupsOf3 && intPart !== '0' && intPart.length <= 3) {
      s = s.replace(/[.,]/g, ''); // thousands: « 1,200 », « 12.000 »
    } else if (seps.length === 1) {
      s = s.replace(',', '.'); // decimal: « 3,5 », « 0,123 »
    } else return null;
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const factor = suffix === 'k' || suffix === 'K' ? 1e3 : suffix === 'M' ? 1e6 : suffix === 'Md' ? 1e9 : 1;
  return Math.round(n * factor * 1e6) / 1e6;
}

/** Numbers of a text (annex C): codes removed, separators and units normalized, number words converted. */
export function numbersIn(text: string): number[] {
  let s = stripCodes(text);
  for (const re of OTHER_CODES) s = s.replace(re, ' ');
  const out: number[] = [];
  for (const m of s.matchAll(NUMBER_RE)) {
    const n = parseNumber(m[1]!, m[2]);
    if (n !== null) out.push(n);
  }
  const folded = s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  for (const m of folded.matchAll(NUMBER_WORD_RE)) out.push(NUMBER_WORDS[m[1]!]!);
  return out;
}

export function checkNumbers(texts: string[], sources: string[], extra: number[] = []): GuardrailCheck {
  const allowed = new Set([...sources.flatMap(numbersIn), ...extra]);
  const found = [...new Set(texts.flatMap(numbersIn))].filter((n) => !allowed.has(n));
  return found.length
    ? {
        rule: 'no-new-numbers',
        ok: false,
        level: 'error',
        found: found.map(String),
        message: `chiffre absent de la source : ${found.join(', ')}`,
      }
    : { rule: 'no-new-numbers', ok: true, level: 'error' };
}

// ---------------------------------------------------------------------------------------------------
// protected-facts: device classes (I, II, IIa, IIb, III) and software safety classes (A, B, C).

const CLASS_RE = /(?<![\p{L}\p{N}])class(?:e|es)?\s+(III|IIb|IIa|II|I|A|B|C)(?![\p{L}\p{N}])/giu;

function classesIn(text: string): string[] {
  return [...text.matchAll(CLASS_RE)].map((m) => m[1]!);
}

export function checkProtectedFacts(texts: string[], sources: string[]): GuardrailCheck {
  const allowed = new Set(sources.flatMap(classesIn));
  const found = [...new Set(texts.flatMap(classesIn))].filter((c) => !allowed.has(c));
  return found.length
    ? {
        rule: 'protected-facts',
        ok: false,
        level: 'error',
        found: found.map((c) => `classe ${c}`),
        message: `classe absente de la source ou modifiée : ${found.map((c) => `classe ${c}`).join(', ')}`,
      }
    : { rule: 'protected-facts', ok: true, level: 'error' };
}

// ---------------------------------------------------------------------------------------------------
// no-new-skills: detection by identifier, with an extended dictionary.

export interface SkillEntry {
  /** Library skill id, or `annexe:…`, `tech:…`, `offre:…`. */
  id: string;
  label: string;
  forms: string[];
  /** Neighbouring terms of a library skill (never counted, but a reformulation may use them). */
  related: string[];
}

export interface SkillDictionary {
  entries: SkillEntry[];
  /** Canonical id of a library skill id (or of any entry id). */
  canonical: (id: string) => string;
  ambiguous: (form: string) => boolean;
}

/**
 * Dictionary of annex C: library skills and aliases, annex A, terms and aliases of the saved offer
 * analyses, reference tech vocabulary. Entries sharing a normalized form are one skill (moving from an
 * alias or an acronym to another one of the same skill is not new); the library id wins.
 */
export function buildSkillDictionary(library: Library, offerTerms: readonly OfferTerm[] = []): SkillDictionary {
  const ambiguousForms = new Set<string>();
  for (const k of library.skills) if (k.ambiguous) [k.short, ...k.aliases].forEach((f) => ambiguousForms.add(f.trim()));
  for (const e of ANNEX_A) if (e.ambiguous) ambiguousForms.add(e.short);
  for (const e of TECH_VOCABULARY) if (e.ambiguous) [e.short, ...e.aliases].forEach((f) => ambiguousForms.add(f));
  const ambiguous = (form: string) => isAmbiguousTerm(form) || ambiguousForms.has(form.trim());
  const keyOf = (form: string) => (ambiguous(form) ? `A:${form.trim()}` : normalizeForMatch(form));

  const raw: SkillEntry[] = [
    ...library.skills
      .filter((k) => !k.archived)
      .map((k) => ({
        id: k.id,
        label: k.short,
        forms: [k.short, ...k.aliases, k.long?.fr, k.long?.en].filter((x): x is string => !!x),
        related: k.related,
      })),
    ...ANNEX_A.map((e) => ({ id: `annexe:${e.short}`, label: e.short, forms: annexForms(e), related: [] })),
    ...TECH_VOCABULARY.map((e) => ({
      id: `tech:${e.short}`,
      label: e.short,
      forms: [e.short, ...e.aliases],
      related: [],
    })),
    ...offerTerms.map((t) => ({ id: `offre:${t.term}`, label: t.term, forms: [t.term, ...t.aliases], related: [] })),
  ];
  const byKey = new Map<string, string>();
  const canonicalOf = new Map<string, string>();
  const entries: SkillEntry[] = [];
  for (const e of raw) {
    const keys = e.forms.map(keyOf).filter(Boolean);
    const existing = keys.map((k) => byKey.get(k)).find((x) => x !== undefined);
    const canonical = existing ?? e.id;
    canonicalOf.set(e.id, canonical);
    for (const k of keys) if (!byKey.has(k)) byKey.set(k, canonical);
    const target = entries.find((x) => x.id === canonical);
    if (target) target.forms.push(...e.forms.filter((f) => !target.forms.includes(f)));
    else entries.push({ id: canonical, label: e.label, forms: [...e.forms], related: [...e.related] });
  }
  return { entries, canonical: (id) => canonicalOf.get(id) ?? id, ambiguous };
}

export interface DetectedSkill {
  id: string;
  label: string;
  /** Found only through ambiguous forms (annex B.3): a warning, never a rejection. */
  viaAmbiguous: boolean;
}

/** Skills of the dictionary contained in the texts (token sequences, annex B.3). */
export function detectSkills(dict: SkillDictionary, texts: string[]): DetectedSkill[] {
  const tokens: MatchToken[][] = texts.map(tokenizeForMatch);
  const out: DetectedSkill[] = [];
  for (const e of dict.entries) {
    let plain = false;
    let amb = false;
    for (const form of e.forms) {
      const ambiguous = dict.ambiguous(form);
      if (tokens.some((t) => findTerm(t, form, { ambiguous }) >= 0)) {
        if (ambiguous) amb = true;
        else plain = true;
      }
      if (plain) break;
    }
    if (plain || amb) out.push({ id: e.id, label: e.label, viaAmbiguous: !plain });
  }
  return out;
}

export function checkSkills(
  dict: SkillDictionary,
  texts: string[],
  sources: string[],
  allowedSkillIds: readonly string[] = [],
): GuardrailCheck[] {
  const allowed = new Set([...detectSkills(dict, sources).map((d) => d.id), ...allowedSkillIds.map(dict.canonical)]);
  const fresh = detectSkills(dict, texts).filter((d) => !allowed.has(d.id));
  // The exact wording of an offer term is admitted when the source already says it under another label
  // (same content words, F-OFF-03 b) or as a related term of a linked skill; a warning then asks to check.
  const sourceStems = sources.map((s) => new Set(contentStems(tokenizeForMatch(s))));
  const related = dict.entries.filter((e) => allowed.has(e.id)).flatMap((e) => e.related);
  const rephrased = (d: DetectedSkill) =>
    (dict.entries.find((e) => e.id === d.id)?.forms ?? []).some((form) => {
      const stems = contentStems(tokenizeForMatch(form));
      return (
        (stems.length > 1 && sourceStems.some((have) => stems.every((w) => have.has(w)))) ||
        related.some((r) => normalizeForMatch(r) === normalizeForMatch(form))
      );
    });
  const errors = fresh.filter((d) => !d.viaAmbiguous && !rephrased(d)).map((d) => d.label);
  const relabelled = fresh.filter((d) => !d.viaAmbiguous && rephrased(d)).map((d) => d.label);
  const warnings = fresh.filter((d) => d.viaAmbiguous).map((d) => d.label);
  const checks: GuardrailCheck[] = [];
  checks.push(
    errors.length
      ? {
          rule: 'no-new-skills',
          ok: false,
          level: 'error',
          found: errors,
          message: `compétence absente de la source : ${errors.join(', ')} (si c'est vrai, proposez-la avec propose_item)`,
        }
      : { rule: 'no-new-skills', ok: true, level: 'error' },
  );
  if (relabelled.length) {
    checks.push({
      rule: 'no-new-skills',
      ok: false,
      level: 'warning',
      found: relabelled,
      message: `terme de l'offre repris pour ce que la source dit autrement : ${relabelled.join(', ')} (vérifiez l'équivalence)`,
    });
  }
  if (warnings.length) {
    checks.push({
      rule: 'no-new-skills',
      ok: false,
      level: 'warning',
      found: warnings,
      message: `sigle ambigu absent de la source : ${warnings.join(', ')} (à vérifier)`,
    });
  }
  return checks;
}

// ---------------------------------------------------------------------------------------------------
// allowed-editions: editions of table A.2 only; historical terms never for an ongoing experience.

/** Historical terms (annex A): valid only for an experience that ended before they were replaced. */
export const HISTORICAL_TERMS = [
  'QSR',
  'Quality System Regulation',
  'DHF',
  'DMR',
  'DHR',
  'MDD',
  'exigences essentielles',
  'essential requirements',
  '93/42/CEE',
  '93/42/EEC',
  'directive 93/42',
] as const;

const tableCodeOf = new Map(
  ALLOWED_EDITIONS.map((e) => [tokenizeForMatch(e.code)[0]?.norm ?? e.code, e] as const).filter(
    ([norm]) => norm.startsWith('std:') || norm.startsWith('cfr:'),
  ),
);

function editionsIn(text: string): Array<{ raw: string; norm: string; edition: string }> {
  return tokenizeForMatch(text)
    .filter((t) => t.kind === 'standard' && t.edition)
    .map((t) => ({ raw: t.raw, norm: t.norm, edition: t.edition! }));
}

export function checkEditions(texts: string[], sources: string[], ongoing: boolean): GuardrailCheck {
  const inSource = new Set(sources.flatMap(editionsIn).map((e) => `${e.norm}:${e.edition}`));
  const bad: string[] = [];
  for (const e of texts.flatMap(editionsIn)) {
    if (inSource.has(`${e.norm}:${e.edition}`)) continue; // the edition applied at the time (A.2)
    const allowed = tableCodeOf.get(e.norm);
    if (!allowed || !(e.edition === allowed.edition || e.edition.startsWith(`${allowed.edition}/`))) bad.push(e.raw);
  }
  const historical = ongoing
    ? HISTORICAL_TERMS.filter((h) => {
        const amb = !h.includes(' ') && !h.includes('/');
        const has = (s: string) => findTerm(tokenizeForMatch(s), h, { ambiguous: amb }) >= 0;
        return texts.some(has) && !sources.some(has);
      })
    : [];
  const found = [...new Set(bad), ...historical];
  if (!found.length) return { rule: 'allowed-editions', ok: true, level: 'error' };
  const parts = [];
  if (bad.length) parts.push(`édition hors de la table A.2 : ${[...new Set(bad)].join(', ')}`);
  if (historical.length) parts.push(`terme historique pour une expérience en cours : ${historical.join(', ')}`);
  return { rule: 'allowed-editions', ok: false, level: 'error', found, message: parts.join(' ; ') };
}

// ---------------------------------------------------------------------------------------------------
// no-foreign-content: URL, e-mail address or instruction absent from the source.

const URL_RE =
  /(?:https?:\/\/|www\.)[^\s)>\]]+|(?<![\p{L}\p{N}@.\-/])[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|fr|io|org|net|dev|app|ai|eu|co|uk|de|be|ch|ca|me|info)(?:\/[^\s)>\]]*)?(?![\p{L}\p{N}])/gu;

const looseKey = (s: string) =>
  foldWord(s)
    .replace(/[\s.,;:!?'"«»]+/g, ' ')
    .trim();

export function checkForeignContent(texts: string[], sources: string[]): GuardrailCheck {
  const source = looseKey(sources.join('\n'));
  const found: string[] = [];
  for (const text of texts) {
    for (const m of text.matchAll(URL_RE)) if (!source.includes(looseKey(m[0]))) found.push(m[0]);
    for (const m of text.matchAll(EMAIL_RE)) if (!source.includes(looseKey(m[0]))) found.push(m[0]);
    for (const f of flagInstructions(text)) {
      if (f.level === 'consigne' && !source.includes(looseKey(f.sentence))) found.push(f.sentence);
    }
  }
  const unique = [...new Set(found)];
  return unique.length
    ? {
        rule: 'no-foreign-content',
        ok: false,
        level: 'error',
        found: unique,
        message: `URL, adresse e-mail ou consigne absente de la source : ${unique.join(' ; ')}`,
      }
    : { rule: 'no-foreign-content', ok: true, level: 'error' };
}

// ---------------------------------------------------------------------------------------------------
// max-length, similarity, immutable-fields

export function checkLength(
  texts: Array<{ text: string; max: number | null }>,
  level: 'error' | 'warning' = 'error',
): GuardrailCheck {
  const over = texts.filter((t) => t.max !== null && t.text.length > t.max);
  return over.length
    ? {
        rule: 'max-length',
        ok: false,
        level,
        value: Math.max(...over.map((t) => t.text.length)),
        message: over.map((t) => `${t.text.length} caractères pour ${t.max} au plus`).join(' ; '),
      }
    : { rule: 'max-length', ok: true, level };
}

const STOP_WORDS = new Set(
  (
    'a au aux avec ce ces dans de des du en et il la le les leur lui mais ou par pour qu que qui sa se ses son sur ' +
    'un une d l n s t c j m an and are as at be by for from in into is it of on or the to with was were'
  ).split(' '),
);

function contentWords(text: string): Set<string> {
  return new Set(
    tokenizeForMatch(text)
      .filter((t) => t.kind !== 'word' || (t.norm.length > 1 && !STOP_WORDS.has(t.norm)))
      .map((t) => t.norm),
  );
}

/** Jaccard index of the content words (annex C, `similarity`). */
export function jaccard(a: string, b: string): number {
  const x = contentWords(a);
  const y = contentWords(b);
  if (x.size === 0 && y.size === 0) return 1;
  let inter = 0;
  for (const w of x) if (y.has(w)) inter++;
  return inter / (x.size + y.size - inter);
}

/** Variant or text edit in the same language: closest source text, warning below 0.45. */
export function checkSimilarity(
  texts: Array<{ lang: string | null; text: string }>,
  sources: Array<{ lang: string | null; text: string }>,
): GuardrailCheck {
  let worst: number | null = null;
  for (const t of texts) {
    const same = sources.filter((s) => s.lang === t.lang && s.text.trim());
    if (!same.length) continue;
    const best = Math.max(...same.map((s) => jaccard(t.text, s.text)));
    worst = worst === null ? best : Math.min(worst, best);
  }
  if (worst === null) return { rule: 'similarity', ok: true, level: 'warning', message: 'sans objet' };
  const value = Math.round(worst * 100) / 100;
  return value >= SIMILARITY_MIN
    ? { rule: 'similarity', ok: true, level: 'warning', value }
    : {
        rule: 'similarity',
        ok: false,
        level: 'warning',
        value,
        message: `texte éloigné de la source (similarité ${value} < ${SIMILARITY_MIN}) : vérifiez qu'il dit la même chose`,
      };
}

export function checkImmutable(sensitiveField: string | null): GuardrailCheck {
  return sensitiveField
    ? {
        rule: 'immutable-fields',
        ok: true,
        level: 'error',
        message: `modification explicite de ${sensitiveField} (propose_edit) : fait sensible, à valider un par un`,
      }
    : { rule: 'immutable-fields', ok: true, level: 'error' };
}

// ---------------------------------------------------------------------------------------------------
// Computed durations (reference source of a new summary).

export interface Durations {
  /** Whole years of experience, internships and apprenticeships included. */
  total: number;
  /** Whole years without internships, apprenticeships. */
  withoutInternships: number;
  /** Whole years per tag of the experiences. */
  byTag: Record<string, number>;
}

/**
 * Years of experience computed from the dates (annex C), never inflated (ADR 0014): experiences only,
 * overlapping periods merged, a year without month read as the shortest (start in December, end in
 * January), ongoing up to the current month, rounded down.
 */
export function experienceDurations(library: Library, today = new Date()): Durations {
  const month = (ym: string, bound: 'start' | 'end') => {
    const [y, m] = ym.split('-').map(Number) as [number, number | undefined];
    return y * 12 + (m !== undefined ? m - 1 : bound === 'start' ? 11 : 0);
  };
  const now = today.getFullYear() * 12 + today.getMonth();
  const years = (intervals: Array<[number, number]>) => {
    const sorted = intervals.filter(([a, b]) => b >= a).sort((x, y) => x[0] - y[0]);
    let months = 0;
    let cur: [number, number] | null = null;
    for (const [a, b] of sorted) {
      if (cur && a <= cur[1] + 1) cur[1] = Math.max(cur[1], b);
      else {
        if (cur) months += cur[1] - cur[0] + 1;
        cur = [a, b];
      }
    }
    if (cur) months += cur[1] - cur[0] + 1;
    return Math.floor(months / 12);
  };
  const exps = library.experiences.filter((e) => !e.archived);
  const span = (e: (typeof exps)[number]): [number, number] => [
    month(e.start, 'start'),
    e.end ? month(e.end, 'end') : now,
  ];
  const byTag: Record<string, number> = {};
  for (const tag of new Set(exps.flatMap((e) => e.tags))) {
    byTag[tag] = years(exps.filter((e) => e.tags.includes(tag)).map(span));
  }
  return {
    total: years(exps.map(span)),
    withoutInternships: years(exps.filter((e) => e.contract !== 'stage' && e.contract !== 'alternance').map(span)),
    byTag,
  };
}

export function durationNumbers(d: Durations): number[] {
  return [...new Set([d.total, d.withoutInternships, ...Object.values(d.byTag)])];
}

// ---------------------------------------------------------------------------------------------------
// All rules for a set of proposed texts.

export interface ProposedText {
  lang: 'fr' | 'en' | null;
  text: string;
  /** Maximum length (bullet: 200, summary: 3 lines), null when none applies. */
  max: number | null;
}

export interface GuardrailInput {
  texts: ProposedText[];
  sources: Array<{ lang: 'fr' | 'en' | null; text: string }>;
  dictionary: SkillDictionary;
  /** `skills` of the bullet and of the item: part of the reference source. */
  allowedSkillIds?: readonly string[];
  /** Numbers that are not written in the source but derived from it (durations, years of the dates). */
  extraNumbers?: number[];
  /** The text belongs to an ongoing experience (historical terms forbidden). */
  ongoing?: boolean;
  /** Compare with the source texts of the same language (variant, text edit). */
  similarity?: boolean;
  /** Field changed explicitly by propose_edit when it is a sensitive fact. */
  sensitiveField?: string | null;
  /**
   * Level of max-length: `warning` for a deterministic import (LinkedIn), whose text is the user's own:
   * it is kept and flagged « à raccourcir » instead of lost (ADR 0015).
   */
  lengthLevel?: 'error' | 'warning';
}

/** The 8 rules of annex C, always in the same order. */
export function runGuardrails(input: GuardrailInput): GuardrailCheck[] {
  const texts = input.texts.map((t) => t.text);
  const sources = input.sources.map((s) => s.text);
  return [
    checkNumbers(texts, sources, input.extraNumbers),
    checkProtectedFacts(texts, sources),
    ...checkSkills(input.dictionary, texts, sources, input.allowedSkillIds),
    checkImmutable(input.sensitiveField ?? null),
    checkLength(input.texts, input.lengthLevel),
    ...(input.similarity ? [checkSimilarity(input.texts, input.sources)] : []),
    checkEditions(texts, sources, input.ongoing ?? false),
    checkForeignContent(texts, sources),
  ];
}
