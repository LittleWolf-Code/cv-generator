// Normalized version of an extracted text, shown in the ATS view next to the raw text (F-ATS-01) and
// copied by its "copier" button. It stays readable: accents and case are kept (unlike canon and
// normalizeForMatch); only the invisible differences an ATS indexer would also erase are removed.
// Pure and Zod-free: the interface imports it through `@cv/core/export`.

const APOSTROPHES = /[\u2019\u2018\u02BC]/g;
const HYPHENS = /[\u2010\u2011]/g;
/** Every Unicode space separator and tabulation (line breaks are kept). */
const SPACES = /[\t\p{Zs}]+/gu;
/** Invisible characters (zero widths, soft hyphen, BOM, word joiner). */
const INVISIBLE = /[\u00AD\u200B-\u200D\u2060\uFEFF]/g;

/**
 * NFKC (ligatures and compatibility forms decomposed), curly apostrophes to `'`, U+2010/U+2011 to
 * `-`, invisible characters removed, spaces collapsed into one U+0020, lines trimmed, empty lines
 * removed.
 */
export function normalizeExtracted(text: string): string {
  return text
    .normalize('NFKC')
    .replace(APOSTROPHES, "'")
    .replace(HYPHENS, '-')
    .replace(INVISIBLE, '')
    .split(/\r?\n/)
    .map((l) => l.replace(SPACES, ' ').trim())
    .filter((l) => l.length > 0)
    .join('\n');
}
