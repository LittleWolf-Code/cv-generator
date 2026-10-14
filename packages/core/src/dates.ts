// Date rendering (§5.1): `numerique` (03/2022 – aujourd'hui, default, safest for ATS) or `lettres`
// (mars 2022 – aujourd'hui), never mixed in a document. A year-only date renders as `2022`.
import type { Lang } from './schema/common.js';
import { labelsFor } from './labels.js';

export type DateStyle = 'numerique' | 'lettres';

export function formatYearMonth(ym: string, style: DateStyle, lang: Lang): string {
  const [year, month] = ym.split('-');
  if (!month) return year!;
  if (style === 'numerique') return `${month}/${year}`;
  return `${labelsFor(lang).months[Number(month) - 1]} ${year}`;
}

/**
 * Range of an entry. `end === null` means "ongoing" when there is a start date.
 * Returns null when there is no date at all.
 */
export function formatRange(start: string | null, end: string | null, style: DateStyle, lang: Lang): string | null {
  const labels = labelsFor(lang);
  if (start && end) {
    if (start === end) return formatYearMonth(start, style, lang);
    return `${formatYearMonth(start, style, lang)}${labels.rangeSep}${formatYearMonth(end, style, lang)}`;
  }
  if (start) return `${formatYearMonth(start, style, lang)}${labels.rangeSep}${labels.present}`;
  if (end) return formatYearMonth(end, style, lang);
  return null;
}

/** Regex matching a whole range in the given style (T-ATS-07). */
export function rangePattern(style: DateStyle, lang: Lang): RegExp {
  const labels = labelsFor(lang);
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const one = style === 'numerique' ? '(?:\\d{2}/)?\\d{4}' : `(?:(?:${labels.months.map(escape).join('|')}) )?\\d{4}`;
  return new RegExp(`^${one}(?:${escape(labels.rangeSep)}(?:${one}|${escape(labels.present)}))?$`, 'u');
}

/** Month precision of a stored date. */
export function hasMonth(ym: string | null): boolean {
  return ym !== null && ym.includes('-');
}
