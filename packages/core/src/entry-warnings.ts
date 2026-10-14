// ATS-22 (DEVRAIT): job titles written in full and the full name of the organization. These are
// warnings shown while typing, never a refusal: a heuristic cannot know every legitimate acronym.
import type { CollectionName } from './schema/library.js';

export interface FieldWarning {
  /** Dot path inside the element (`position.fr`, `organization`). */
  path: string;
  message: string;
}

/** Common French and English abbreviations of job titles, compared in lowercase as whole words. */
const TITLE_ABBREVIATIONS = new Set([
  'ing',
  'resp',
  'dev',
  'dév',
  'devs',
  'mgr',
  'eng',
  'engr',
  'sr',
  'jr',
  'snr',
  'asst',
  'assist',
  'dir',
  'coord',
  'proj',
  'dvp',
  'dvpt',
  'adm',
  'admin',
  'qual',
  'techn',
  'mkt',
]);

/** Words of a title that look abbreviated: a known abbreviation, or 1 to 5 letters followed by a dot. */
export function abbreviatedWords(title: string): string[] {
  const found: string[] = [];
  for (const m of title.matchAll(/(?<![\p{L}\p{N}])(\p{L}+)(\.?)(?![\p{L}\p{N}])/gu)) {
    const word = m[1]!;
    const dotted = m[2] === '.' && word.length <= 5;
    if (dotted || TITLE_ABBREVIATIONS.has(word.toLocaleLowerCase('fr'))) found.push(m[0]);
  }
  return [...new Set(found)];
}

/** An organization name reduced to an acronym of 5 characters at most ("CEA", "CHU", "R&D"). */
export function isBareAcronym(name: string): boolean {
  return /^[\p{Lu}\p{N}&]{2,5}$/u.test(name.trim());
}

const title = (path: string, words: string[]): FieldWarning => ({
  path,
  message: `intitulé peut-être abrégé (${words.map((w) => `« ${w} »`).join(', ')}) : écrivez l'intitulé en entier, tel qu'il figure dans les offres (ATS-22)`,
});
const organization = (path: string, name: string): FieldWarning => ({
  path,
  message: `nom réduit à un sigle (« ${name} ») : préférez le nom complet, suivi du sigle si besoin (ATS-22)`,
});

/** ATS-22 warnings of an element being edited. Unknown shapes simply give no warning. */
export function entryWarnings(collection: CollectionName, item: unknown): FieldWarning[] {
  const out: FieldWarning[] = [];
  if (!item || typeof item !== 'object') return out;
  const it = item as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : null);
  if (collection === 'experiences') {
    const position = it.position as Record<string, unknown> | null | undefined;
    for (const lang of ['fr', 'en'] as const) {
      const value = str(position?.[lang]);
      const words = value ? abbreviatedWords(value) : [];
      if (words.length) out.push(title(`position.${lang}`, words));
    }
  }
  const orgKey = collection === 'experiences' ? 'organization' : collection === 'education' ? 'institution' : null;
  const org = orgKey ? str(it[orgKey]) : null;
  if (orgKey && org && isBareAcronym(org)) out.push(organization(orgKey, org));
  return out;
}
