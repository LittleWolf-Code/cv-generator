// Write-time sanitization (spec annex B.1). Every user-facing string stored in data/
// must be the output of `sanitize`; the Zod schema refuses anything else.

export type SanitizeRefusal = 'control' | 'emoji' | 'private-use';

export type SanitizeResult =
  { ok: true; value: string } | { ok: false; reason: SanitizeRefusal; char: string; codePoint: string; index: number };

export interface SanitizeOptions {
  /** Multiline fields keep `\n` (CRLF is normalized to LF first). */
  multiline?: boolean;
}

// B.1 step 2: removed outright.
const REMOVED = /[\u00AD\u200B-\u200F\u2060\uFEFF]|\u{E0000}|[\u{E0001}-\u{E007F}]/gu;
// B.1 step 3.
const HYPHENS = /[\u2010\u2011]/g;
// B.1 step 4 (spaces). Tab is a control character and is refused (step 6), not converted.
const SPACES = /[\u00A0\u2007\u2009\u202F\u2028\u2029]/g;
// B.1 step 5.
const APOSTROPHES = /[\u2019\u2018\u02BC]/g;

const REFUSAL_LABELS: Record<SanitizeRefusal, string> = {
  control: 'caractère de contrôle',
  emoji: 'emoji',
  'private-use': 'caractère de la zone privée',
};

function refusalOf(cp: number, multiline: boolean): SanitizeRefusal | null {
  if (cp === 0x0a && multiline) return null;
  if (cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f)) return 'control';
  if ((cp >= 0x1f000 && cp <= 0x1faff) || (cp >= 0x2600 && cp <= 0x27bf)) return 'emoji';
  if (cp >= 0xe000 && cp <= 0xf8ff) return 'private-use';
  return null;
}

export function sanitize(input: string, options: SanitizeOptions = {}): SanitizeResult {
  const multiline = options.multiline ?? false;
  let s = input.normalize('NFC');
  if (multiline) s = s.replace(/\r\n?/g, '\n');

  // Step 6 first, on the NFC text, so the reported index matches what the user typed.
  let index = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    const reason = refusalOf(cp, multiline);
    if (reason) {
      return { ok: false, reason, char: ch, codePoint: formatCodePoint(cp), index };
    }
    index += ch.length;
  }

  s = s.replace(REMOVED, '').replace(HYPHENS, '-').replace(SPACES, ' ').replace(APOSTROPHES, "'");
  if (multiline) {
    s = s
      .split('\n')
      .map((line) => line.replace(/ {2,}/g, ' ').trim())
      .join('\n')
      .trim();
  } else {
    s = s.replace(/ {2,}/g, ' ').trim();
  }
  return { ok: true, value: s };
}

export function formatCodePoint(cp: number): string {
  return `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;
}

/** French message naming the field, for UI and API errors. */
export function describeRefusal(field: string, r: Extract<SanitizeResult, { ok: false }>): string {
  return `${field} : ${REFUSAL_LABELS[r.reason]} interdit (${r.codePoint}) en position ${r.index + 1}`;
}

/** Returns null when `s` is already sanitized, otherwise a French explanation. */
export function checkSanitized(s: string, options: SanitizeOptions = {}): string | null {
  const r = sanitize(s, options);
  if (!r.ok) return `${REFUSAL_LABELS[r.reason]} interdit (${r.codePoint}) en position ${r.index + 1}`;
  if (r.value !== s) return 'texte non assaini (espaces, apostrophes ou caractères invisibles à normaliser)';
  return null;
}

export interface SanitizeIssue {
  path: string;
  message: string;
  /** The message without the path, for forms that show it next to the field. */
  detail?: string;
}

/** Keys whose string values may contain line breaks. */
const MULTILINE_KEYS = new Set(['notes', 'note']);
/** Keys holding identifiers, URLs or machine values: left untouched. */
const VERBATIM_KEYS = new Set(['id', 'url', 'file', 'hash', 'createdAt', 'sentAt', 'at', 'accent']);

/**
 * Sanitizes every string of a JSON value (import path, fixtures, proposals).
 * Refused strings are reported with their JSON path and replaced by null so the
 * caller can decide whether to drop the element.
 */
export function sanitizeDeep<T>(value: T, path = '$'): { value: T; issues: SanitizeIssue[] } {
  const issues: SanitizeIssue[] = [];
  const walk = (v: unknown, p: string, key: string | null): unknown => {
    if (typeof v === 'string') {
      if (key !== null && VERBATIM_KEYS.has(key)) return v;
      const r = sanitize(v, { multiline: key !== null && MULTILINE_KEYS.has(key) });
      if (!r.ok) {
        issues.push({ path: p, message: describeRefusal(p, r), detail: describeRefusal('', r).slice(3) });
        return null;
      }
      return r.value;
    }
    if (Array.isArray(v)) return v.map((x, i) => walk(x, `${p}[${i}]`, null));
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) out[k] = walk(x, `${p}.${k}`, k);
      return out;
    }
    return v;
  };
  return { value: walk(value, path, null) as T, issues };
}
