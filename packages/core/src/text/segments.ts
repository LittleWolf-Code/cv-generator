// Splits a projected text into segments; `nb` segments are rendered as non-breaking `box`es
// (spec §8.5: protected terms, standards, compound words with "-", "–" or "/", grouped numbers).
import { PROTECTED_TERMS } from './normalize.js';

export interface Segment {
  /** Text of the segment. */
  t: string;
  /** Non-breaking block. */
  nb: boolean;
  /** Link target when the segment is a displayed URL (always present: templates read `s.url`). */
  url: string | null;
}

const RULES: RegExp[] = [
  // Standards and regulations (body + number + parts + edition), e.g. "NF EN ISO 13485:2016".
  /(?:(?:NF|BS|DIN)\s+)?(?:EN\s+)?(?:ISO\/IEC|ISO|IEC|CEI|EN)\s*-?\s*\d{3,6}(?:-\d+)*(?:[:+/](?:AMD|A)?\d+(?::\d{4})?)*/gu,
  /21\s+CFR\s+(?:Part\s+)?\d+/gu,
  /(?:MDR|IVDR|RGPD|GDPR)\s+\((?:UE|EU)\)\s+\d{4}\/\d{3}/gu,
  // Year ranges written in a text ("2019 - 2021").
  /\b\d{4}\s?[-–]\s?\d{4}\b/gu,
  // Grouped numbers ("1 200 patients") and French percentages ("45 %").
  /\b\d{1,3}(?: \d{3})+\b/gu,
  /\b\d+(?:[.,]\d+)? %/gu,
  // Any run of non-space characters that contains "-", "–", "/" or "@" (compound words, URLs, handles).
  /\S*[-–/@]\S*/gu,
  // A spaced dash used as a separator stays with the word before it: no line starts with a dash (French
  // typography; ADR 0020).
  /\S+ [-–—](?= )/gu,
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

export function segmentText(text: string, protectedPhrases: readonly string[] = []): Segment[] {
  const phrases = [...new Set([...PROTECTED_TERMS, ...protectedPhrases].filter((p) => p.trim().length > 1))].sort(
    (a, b) => b.length - a.length,
  );
  const rules = [...RULES];
  if (phrases.length > 0) {
    rules.unshift(new RegExp(`(?<![\\p{L}\\p{N}])(?:${phrases.map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}])`, 'gu'));
  }

  const ranges: Array<[number, number]> = [];
  for (const re of rules) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const raw = m[0].replace(/\s+$/u, '');
      // A lone separator ("-" between spaces) needs no box.
      if (raw.length === 0 || /^[-–/@]$/u.test(raw)) continue;
      ranges.push([m.index, m.index + raw.length]);
    }
  }
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] < last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }

  const out: Segment[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) out.push({ t: text.slice(cursor, start), nb: false, url: null });
    out.push({ t: text.slice(start, end), nb: true, url: null });
    cursor = end;
  }
  if (cursor < text.length) out.push({ t: text.slice(cursor), nb: false, url: null });
  return out;
}

export function plainText(segments: readonly Segment[]): string {
  return segments.map((s) => s.t).join('');
}
