// File naming and PDF metadata (F-EXP-04, annex B.4).
import type { EnVariant, Lang } from './schema/common.js';

const GENDER_MARKERS =
  /(?:\s*[-–])?\s*\(?(?<![\p{L}\p{N}])(?:H\/F\/X|F\/H\/NB|H\/F|F\/H|M\/F|m\/w\/d)(?![\p{L}\p{N}])\)?/giu;

/** Removes gender markers (H/F, F/H, (H/F), H/F/X, F/H/NB, M/F, (m/w/d)). */
export function stripGenderMarkers(title: string): string {
  return title
    .replace(GENDER_MARKERS, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const TRANSLIT: Record<string, string> = {
  œ: 'oe',
  Œ: 'Oe',
  æ: 'ae',
  Æ: 'Ae',
  ß: 'ss',
  ø: 'o',
  Ø: 'O',
  ł: 'l',
  Ł: 'L',
};

export function transliterate(s: string): string {
  return s
    .replace(/[œŒæÆßøØłŁ]/g, (c) => TRANSLIT[c]!)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .normalize('NFC');
}

/** File-name part: transliterated, any character outside [A-Za-z0-9-] becomes "-". */
export function fileNamePart(s: string): string {
  return transliterate(s)
    .replace(/[^A-Za-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

/** Cut at most `max` characters, at the end of a word ("-" boundary) when possible. */
export function truncateAtWord(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max + 1);
  const at = cut.lastIndexOf('-');
  return (at > 0 ? cut.slice(0, at) : s.slice(0, max)).replace(/-$/, '');
}

const WINDOWS_RESERVED = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i;

export function isWindowsReservedName(name: string): boolean {
  return WINDOWS_RESERVED.test(name);
}

/** `<Libellé>` proposed from a job title: no gender marker, 40 characters at most. */
export function proposeFileLabel(jobTitle: string): string {
  return truncateAtWord(fileNamePart(stripGenderMarkers(jobTitle)), 40);
}

export interface CvFileNameInput {
  firstName: string;
  lastName: string;
  label: string;
  lang: Lang;
  enVariant: EnVariant;
  format: 'pdf' | 'docx';
}

/** `CV_<Prénom>_<Nom>_<Libellé>_<FR|EN>.<ext>` (`Resume_` in en-US), 80 characters at most. */
export function cvFileName(input: CvFileNameInput): string {
  const prefix = input.lang === 'en' && input.enVariant === 'en-US' ? 'Resume' : 'CV';
  const suffix = `_${input.lang.toUpperCase()}.${input.format}`;
  const first = fileNamePart(input.firstName);
  const last = fileNamePart(input.lastName);
  const label = truncateAtWord(fileNamePart(input.label), 40);
  let stem = [prefix, first, last, label].filter(Boolean).join('_');
  const room = 80 - suffix.length;
  if (stem.length > room) stem = truncateAtWord(stem, room).replace(/_$/, '');
  if (isWindowsReservedName(stem)) throw new Error(`nom de fichier réservé par Windows : ${stem}`);
  return stem + suffix;
}

export interface LetterFileNameInput {
  firstName: string;
  lastName: string;
  company: string;
  lang: Lang;
  format: 'pdf' | 'docx';
}

/** `LM_<Prénom>_<Nom>_<Entreprise>_<FR|EN>.<ext>` (`CoverLetter_` in English), 80 characters at most. */
export function letterFileName(input: LetterFileNameInput): string {
  const prefix = input.lang === 'en' ? 'CoverLetter' : 'LM';
  const suffix = `_${input.lang.toUpperCase()}.${input.format}`;
  const company = truncateAtWord(fileNamePart(input.company), 40);
  let stem = [prefix, fileNamePart(input.firstName), fileNamePart(input.lastName), company].filter(Boolean).join('_');
  const room = 80 - suffix.length;
  if (stem.length > room) stem = truncateAtWord(stem, room).replace(/_$/, '');
  if (isWindowsReservedName(stem)) throw new Error(`nom de fichier réservé par Windows : ${stem}`);
  return stem + suffix;
}

/** Title metadata of a letter: `Lettre de motivation – <Prénom Nom> – <Entreprise>` (EN: `Cover letter – …`). */
export function letterDocumentTitle(fullName: string, company: string, lang: Lang): string {
  return `${lang === 'en' ? 'Cover letter' : 'Lettre de motivation'} – ${fullName} – ${company}`;
}

/** PDF/DOCX Title metadata of a CV: `CV – <Prénom Nom> – <titre du CV>`. */
export function cvDocumentTitle(fullName: string, cvTitle: string | null): string {
  return cvTitle ? `CV – ${fullName} – ${cvTitle}` : `CV – ${fullName}`;
}
