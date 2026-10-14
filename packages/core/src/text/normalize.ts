// Matching normalization for keyword coverage and guardrails (spec annex B.3).
// Matching is done on token sequences, never on substrings.

export type MatchTokenKind = 'word' | 'protected' | 'standard';

export interface MatchToken {
  kind: MatchTokenKind;
  /** Comparison key. Standards: `std:<number-with-parts>`; protected terms: the term itself. */
  norm: string;
  /** Source text of the token (case preserved), used for case-exact comparisons. */
  raw: string;
  /** Edition suffix of a standard (`2016`, `2006+AMD1:2015`…), ignored for coverage. */
  edition?: string | null;
}

/** B.3 step 7: compared as is. */
export const PROTECTED_TERMS = [
  'C++',
  'C#',
  '.NET',
  'Node.js',
  'CI/CD',
  '510(k)',
  'V&V',
  'RA/QA',
  'QA/RA',
  'IQ/OQ/PQ',
  '2017/745',
  '2017/746',
  'IIa',
  'IIb',
] as const;

/** B.3 step 8: ambiguous acronyms (case-exact, never in a "classe X" pattern). */
export const AMBIGUOUS_TERMS = ['C', 'R', 'Go', 'MDR', 'DM', 'CE', 'PMS', 'SAC', 'RA'] as const;
/** Ambiguous acronyms that belong to the medical-device vocabulary (annex A). */
export const DM_AMBIGUOUS_TERMS = ['MDR', 'DM', 'CE', 'PMS', 'SAC', 'RA'] as const;

const ELISIONS = ["jusqu'", "lorsqu'", "puisqu'", "qu'", "l'", "d'", "j'", "m'", "n'", "s'", "t'", "c'"];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

const PROTECTED_RE = new RegExp(
  `(?<![\\p{L}\\p{N}+#.])(?:${[...PROTECTED_TERMS]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|')})(?![\\p{L}\\p{N}+#])`,
  'gu',
);

// B.3 step 9. Prefixes NF, EN, BS EN, DIN EN ignored; CEI = IEC; ISO/IEC = ISO; optional space or dash
// between body and number; edition suffix captured separately.
const STANDARD_RE =
  /(?<![\p{L}\p{N}])(?:(?:NF|BS|DIN)\s+)?(?:EN\s+)?(?:(?:ISO\/IEC|ISO|IEC|CEI)\s*-?\s*|EN\s+(?=\d))(\d{3,6}(?:-\d+)*)((?:[:+/](?:AMD|A)?\d+(?::\d{4})?)*)(?![\p{L}\p{N}])/gu;
const CFR_RE = /(?<![\p{L}\p{N}])21\s+CFR\s+(?:Part\s+)?(\d+)(?![\p{L}\p{N}])/gu;

/** B.3 steps 1–2. */
function preNormalize(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[\u2019\u2018\u02BC`\u00B4]/g, "'")
    .replace(/[\u2010-\u2015]/g, '-');
}

/** B.3 step 3: transliteration, lowercase, accents removed. */
export function foldWord(s: string): string {
  return s
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'AE')
    .replace(/ß/g, 'ss')
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .normalize('NFC');
}

interface Span {
  start: number;
  end: number;
  token: MatchToken;
}

function wordTokens(chunk: string): MatchToken[] {
  const tokens: MatchToken[] = [];
  // Words made of letters, digits and inner apostrophes; anything else separates (step 5).
  for (const m of chunk.matchAll(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*'?/gu)) {
    let word = m[0];
    const lower = word.toLocaleLowerCase('fr');
    const elision = ELISIONS.find((e) => lower.startsWith(e) && lower.length > e.length);
    if (elision) word = word.slice(elision.length);
    for (const part of word.split("'")) {
      if (part) tokens.push({ kind: 'word', norm: foldWord(part), raw: part });
    }
  }
  return tokens;
}

/** Tokenizes a text for matching (annex B.3). */
export function tokenizeForMatch(input: string): MatchToken[] {
  const s = preNormalize(input);
  const spans: Span[] = [];
  for (const m of s.matchAll(STANDARD_RE)) {
    const edition = m[2] ? m[2].replace(/^[:/+]/, '') : null;
    spans.push({
      start: m.index,
      end: m.index + m[0].length,
      token: { kind: 'standard', norm: `std:${m[1]}`, raw: m[0], edition: edition || null },
    });
  }
  for (const m of s.matchAll(CFR_RE)) {
    spans.push({
      start: m.index,
      end: m.index + m[0].length,
      token: { kind: 'standard', norm: `cfr:21-${m[1]}`, raw: m[0], edition: null },
    });
  }
  for (const m of s.matchAll(PROTECTED_RE)) {
    spans.push({ start: m.index, end: m.index + m[0].length, token: { kind: 'protected', norm: m[0], raw: m[0] } });
  }
  // Keep the earliest, then longest, non-overlapping spans.
  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: Span[] = [];
  for (const sp of spans) {
    const last = kept[kept.length - 1];
    if (!last || sp.start >= last.end) kept.push(sp);
  }

  const tokens: MatchToken[] = [];
  let cursor = 0;
  for (const sp of kept) {
    tokens.push(...wordTokens(s.slice(cursor, sp.start)));
    tokens.push(sp.token);
    cursor = sp.end;
  }
  tokens.push(...wordTokens(s.slice(cursor)));
  return tokens;
}

/**
 * The text with its codes blanked out: standards (`NF EN ISO 13485:2016`), `21 CFR 820` and protected
 * terms (`510(k)`, `2017/745`). The guardrail `no-new-numbers` (annex C) removes them before counting.
 */
export function stripCodes(input: string): string {
  return preNormalize(input).replace(STANDARD_RE, ' ').replace(CFR_RE, ' ').replace(PROTECTED_RE, ' ');
}

/** String form of the normalized token sequence (annex B.3), mainly for display and tests. */
export function normalizeForMatch(s: string): string {
  return tokenizeForMatch(s)
    .map((t) => t.norm)
    .join(' ');
}

export interface MatchOptions {
  /** The term is an ambiguous acronym (skill `ambiguous: true` or AMBIGUOUS_TERMS). */
  ambiguous?: boolean;
  /**
   * Coverage only. For an ambiguous DM acronym: true when the offer term has `domain: dm`, or the
   * offer contains its long form or another annex A term; false otherwise, and the acronym then
   * never counts. Undefined means "no domain restriction" (guardrails).
   */
  dmContext?: boolean;
}

const CLASS_WORDS = new Set(['class', 'classe', 'classes']);
const CLASS_VALUES = /^(?:[A-C]|I|IIa|IIb|III)$/;

export function isAmbiguousTerm(term: string): boolean {
  return (AMBIGUOUS_TERMS as readonly string[]).includes(term.trim());
}

function tokenEquals(text: MatchToken, term: MatchToken, caseExact: boolean): boolean {
  if (term.kind === 'standard' || text.kind === 'standard') return text.kind === term.kind && text.norm === term.norm;
  if (term.kind === 'protected' || text.kind === 'protected') return text.kind === term.kind && text.raw === term.raw;
  return text.norm === term.norm && (!caseExact || text.raw === term.raw);
}

/** Index of the first occurrence of the term's token sequence in the text tokens, or -1. */
export function findTerm(textTokens: MatchToken[], term: string, options: MatchOptions = {}): number {
  const termTokens = tokenizeForMatch(term);
  if (termTokens.length === 0) return -1;
  const ambiguous = options.ambiguous ?? isAmbiguousTerm(term);
  if (ambiguous && (DM_AMBIGUOUS_TERMS as readonly string[]).includes(term.trim()) && options.dmContext === false) {
    return -1;
  }
  outer: for (let i = 0; i + termTokens.length <= textTokens.length; i++) {
    for (let j = 0; j < termTokens.length; j++) {
      if (!tokenEquals(textTokens[i + j]!, termTokens[j]!, ambiguous)) continue outer;
    }
    // Never inside "classe C" / "Class IIa" (software safety class, device class).
    if (ambiguous && i > 0 && CLASS_WORDS.has(textTokens[i - 1]!.norm) && CLASS_VALUES.test(textTokens[i]!.raw)) {
      continue;
    }
    return i;
  }
  return -1;
}

/** True when the text contains the term (or one of its aliases) as a token sequence. */
export function containsTerm(text: string, term: string, options: MatchOptions = {}): boolean {
  return findTerm(tokenizeForMatch(text), term, options) >= 0;
}

/**
 * True when both strings are the same term once normalized (same token sequence, whole string):
 * `CEI 62304` = `IEC 62304`, `front-end` = `front end`. Ambiguous acronyms compare case-exact.
 */
export function sameTerm(a: string, b: string): boolean {
  const ta = tokenizeForMatch(a);
  const tb = tokenizeForMatch(b);
  if (ta.length === 0 || ta.length !== tb.length) return false;
  return findTerm(tb, a, { ambiguous: isAmbiguousTerm(a) || isAmbiguousTerm(b) }) === 0;
}
