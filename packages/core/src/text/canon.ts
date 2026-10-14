// Extraction comparison helpers (spec annex B.2).

const APOSTROPHES = /[\u2019\u2018\u02BC]/g;
const HYPHENS = /[\u2010\u2011]/g;

/** Canonical form for T-ATS-02 and heading equality: whitespace-insensitive and case-insensitive. */
export function canon(s: string): string {
  return s
    .normalize('NFKC')
    .replace(APOSTROPHES, "'")
    .replace(HYPHENS, '-')
    .toLocaleLowerCase('fr')
    .replace(/\s+/gu, '');
}

/** Splits raw extracted text into lines, without any other normalization. */
export function rawLines(text: string): string[] {
  return text.split(/\r?\n/);
}

/** Collapses runs of whitespace into one space (used only to locate fields on a raw line). */
export function collapseSpaces(s: string): string {
  return s.replace(/\s+/gu, ' ').trim();
}
