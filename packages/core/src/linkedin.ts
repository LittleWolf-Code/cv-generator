// Deterministic LinkedIn import (F-IMP-02, MCP-21, ADR 0015): CSV reading, columns matched by name
// (case and BOM ignored, unknown columns logged, Birth Date / Address / Zip Code / Maiden Name ignored),
// dates (« Jan 2020 » → 2020-01, « 2015 » → 2015, empty end → ongoing, anything else kept as « date à
// vérifier »), languages (« Native or bilingual » → native, otherwise no CEFR level), descriptions split
// into bullets. Pure and Zod-free: the store turns the candidates into proposals (same deduplication
// as propose_item, F-IMP-04); nothing here writes anything.
import { REGULATORY_CATEGORY } from './constants.js';
import type { Bilingual, Lang } from './schema/common.js';
import type { CefrLevel } from './schema/library.js';
import { foldWord, sameTerm } from './text/normalize.js';
import { formatCodePoint } from './text/sanitize.js';
import { ANNEX_A, annexForms } from './vocab/annex-a.js';
import { TECH_KIND, TECH_VOCABULARY } from './vocab/tech.js';

// ---------------------------------------------------------------------------------------------------
// Expected files and columns (§6.11; columns of Projects, Email Addresses and PhoneNumbers to confirm on
// the real export, ADR 0015).

export interface LinkedInFileSpec {
  /** Columns read (or known and deliberately unused). */
  columns: readonly string[];
  /** Columns never read (§5.2: absent from the data model). */
  ignored?: readonly string[];
}

export const LINKEDIN_FILES = {
  'Profile.csv': {
    columns: ['First Name', 'Last Name', 'Headline', 'Summary', 'Geo Location'],
    ignored: ['Birth Date', 'Address', 'Zip Code', 'Maiden Name'],
  },
  'Positions.csv': { columns: ['Company Name', 'Title', 'Description', 'Location', 'Started On', 'Finished On'] },
  'Education.csv': { columns: ['School Name', 'Degree Name', 'Notes', 'Start Date', 'End Date'] },
  'Skills.csv': { columns: ['Name'] },
  'Languages.csv': { columns: ['Name', 'Proficiency'] },
  'Certifications.csv': { columns: ['Name', 'Url', 'Authority', 'Started On'] },
  'Projects.csv': { columns: ['Title', 'Description', 'Url', 'Started On', 'Finished On'] },
  'Email Addresses.csv': { columns: ['Email Address', 'Confirmed', 'Primary', 'Updated On'] },
  'PhoneNumbers.csv': { columns: ['Extension', 'Number', 'Type'] },
} as const satisfies Record<string, LinkedInFileSpec>;

export type LinkedInFileName = keyof typeof LINKEDIN_FILES;
export const LINKEDIN_FILE_NAMES = Object.keys(LINKEDIN_FILES) as LinkedInFileName[];

/** The expected file a name designates (case ignored), or null. */
export function linkedInFileOf(name: string): LinkedInFileName | null {
  const lower = name.toLowerCase();
  return LINKEDIN_FILE_NAMES.find((f) => f.toLowerCase() === lower) ?? null;
}

// ---------------------------------------------------------------------------------------------------
// CSV (RFC 4180): quoted fields, doubled quotes, line breaks inside quotes, BOM, CRLF or LF.

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field === '') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

const headerKey = (s: string) =>
  s
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

export interface LinkedInColumns {
  /** Expected columns found (spec names). */
  known: string[];
  /** Columns that are neither expected nor ignored: logged (F-IMP-02). */
  unknown: string[];
  /** Columns ignored on purpose (Birth Date, Address, Zip Code, Maiden Name): their values are never read. */
  ignored: string[];
  /** Expected columns absent from the file. */
  missing: string[];
}

export interface LinkedInTable {
  file: LinkedInFileName;
  columns: LinkedInColumns;
  /** Rows keyed by the spec column name; ignored and unknown columns are dropped. */
  rows: Array<Record<string, string>>;
}

/**
 * Reads an expected LinkedIn CSV. Columns are matched by name, case and BOM ignored. The header is the
 * first of the first five rows that names an expected column (some exports start with a note).
 */
export function readLinkedInTable(file: LinkedInFileName, text: string): LinkedInTable {
  const spec: LinkedInFileSpec = LINKEDIN_FILES[file];
  const expected = new Map(spec.columns.map((c) => [headerKey(c), c]));
  const ignored = new Map((spec.ignored ?? []).map((c) => [headerKey(c), c]));
  const rows = parseCsv(text);
  const headerIndex = rows.slice(0, 5).findIndex((r) => r.some((h) => expected.has(headerKey(h))));
  const columns: LinkedInColumns = { known: [], unknown: [], ignored: [], missing: [] };
  if (headerIndex < 0) {
    columns.missing = [...spec.columns];
    if (rows[0]) columns.unknown = rows[0].map((h) => h.trim()).filter(Boolean);
    return { file, columns, rows: [] };
  }
  const header = rows[headerIndex]!;
  const keep: Array<{ index: number; name: string }> = [];
  header.forEach((h, index) => {
    const key = headerKey(h);
    if (!key) return;
    const name = expected.get(key);
    if (name) {
      if (!columns.known.includes(name)) {
        columns.known.push(name);
        keep.push({ index, name });
      }
    } else if (ignored.has(key)) columns.ignored.push(ignored.get(key)!);
    else columns.unknown.push(h.replace(/^\uFEFF/, '').trim());
  });
  columns.missing = spec.columns.filter((c) => !columns.known.includes(c));
  const out = rows.slice(headerIndex + 1).map((r) => {
    const rec: Record<string, string> = {};
    for (const { index, name } of keep) rec[name] = (r[index] ?? '').trim();
    return rec;
  });
  return { file, columns, rows: out };
}

// ---------------------------------------------------------------------------------------------------
// Values.

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export type LinkedInDate =
  | { kind: 'empty' }
  | { kind: 'ok'; value: string }
  /** Unreadable value: kept for the « date à vérifier » check, with the year it contains, if any. */
  | { kind: 'check'; raw: string; year: string | null };

/** « Jan 2020 » → 2020-01, « 2015 » → 2015, empty → empty; anything else is a date to check. */
export function parseLinkedInDate(raw: string | undefined): LinkedInDate {
  const s = (raw ?? '').trim();
  if (!s) return { kind: 'empty' };
  const m = /^([A-Za-z]{3})\s+(\d{4})$/.exec(s);
  if (m) {
    const month = MONTHS.indexOf(m[1]!.toLowerCase());
    if (month >= 0) return { kind: 'ok', value: `${m[2]}-${String(month + 1).padStart(2, '0')}` };
  }
  if (/^\d{4}$/.test(s)) return { kind: 'ok', value: s };
  const year = /(?<!\d)(19\d{2}|20\d{2})(?!\d)/.exec(s);
  return { kind: 'check', raw: s, year: year ? year[1]! : null };
}

/** Format of a date value, for the dry run (counts only, never the values). */
export function linkedInDateFormat(raw: string | undefined): 'MMM AAAA' | 'AAAA' | 'vide' | 'autre' {
  const d = parseLinkedInDate(raw);
  if (d.kind === 'empty') return 'vide';
  if (d.kind === 'check') return 'autre';
  return d.value.length === 4 ? 'AAAA' : 'MMM AAAA';
}

/** « Native or bilingual proficiency » (and the French export's wording) → native; otherwise null. */
export function proficiencyToCefr(raw: string | undefined): CefrLevel | null {
  const f = foldWord((raw ?? '').trim());
  if (/\bnative or bilingual\b/.test(f) || /\bbilingue ou langue maternelle\b/.test(f)) return 'native';
  return null;
}

// Language names (FR and EN) → ISO 639 code and both names. Written for the project.
const LANGUAGE_TABLE: ReadonlyArray<[code: string, fr: string, en: string, aliases?: string[]]> = [
  ['fr', 'Français', 'French'],
  ['en', 'Anglais', 'English'],
  ['de', 'Allemand', 'German'],
  ['es', 'Espagnol', 'Spanish', ['castillan', 'castilian']],
  ['it', 'Italien', 'Italian'],
  ['pt', 'Portugais', 'Portuguese'],
  ['nl', 'Néerlandais', 'Dutch', ['flamand', 'flemish']],
  ['ru', 'Russe', 'Russian'],
  ['zh', 'Chinois', 'Chinese', ['mandarin', 'chinois mandarin', 'mandarin chinese']],
  ['ja', 'Japonais', 'Japanese'],
  ['ko', 'Coréen', 'Korean'],
  ['ar', 'Arabe', 'Arabic'],
  ['he', 'Hébreu', 'Hebrew'],
  ['tr', 'Turc', 'Turkish'],
  ['el', 'Grec', 'Greek'],
  ['pl', 'Polonais', 'Polish'],
  ['cs', 'Tchèque', 'Czech'],
  ['sk', 'Slovaque', 'Slovak'],
  ['sl', 'Slovène', 'Slovenian'],
  ['hr', 'Croate', 'Croatian'],
  ['sr', 'Serbe', 'Serbian'],
  ['bg', 'Bulgare', 'Bulgarian'],
  ['ro', 'Roumain', 'Romanian'],
  ['hu', 'Hongrois', 'Hungarian'],
  ['uk', 'Ukrainien', 'Ukrainian'],
  ['lt', 'Lituanien', 'Lithuanian'],
  ['lv', 'Letton', 'Latvian'],
  ['et', 'Estonien', 'Estonian'],
  ['fi', 'Finnois', 'Finnish'],
  ['sv', 'Suédois', 'Swedish'],
  ['no', 'Norvégien', 'Norwegian'],
  ['da', 'Danois', 'Danish'],
  ['is', 'Islandais', 'Icelandic'],
  ['ga', 'Irlandais', 'Irish'],
  ['cy', 'Gallois', 'Welsh'],
  ['ca', 'Catalan', 'Catalan'],
  ['eu', 'Basque', 'Basque'],
  ['br', 'Breton', 'Breton'],
  ['oc', 'Occitan', 'Occitan'],
  ['co', 'Corse', 'Corsican'],
  ['la', 'Latin', 'Latin'],
  ['hi', 'Hindi', 'Hindi'],
  ['bn', 'Bengali', 'Bengali'],
  ['ur', 'Ourdou', 'Urdu'],
  ['ta', 'Tamoul', 'Tamil'],
  ['fa', 'Persan', 'Persian', ['farsi']],
  ['vi', 'Vietnamien', 'Vietnamese'],
  ['th', 'Thaï', 'Thai'],
  ['id', 'Indonésien', 'Indonesian'],
  ['ms', 'Malais', 'Malay'],
  ['sw', 'Swahili', 'Swahili'],
  ['wo', 'Wolof', 'Wolof'],
  ['ht', 'Créole haïtien', 'Haitian Creole'],
  ['fsl', 'Langue des signes française', 'French Sign Language', ['LSF']],
];

/** Code and names of a language named in French or English (« Anglais », « English (UK) »…), or null. */
export function languageByName(name: string): { code: string; names: { fr: string; en: string } } | null {
  const key = foldWord(name.replace(/\(.*?\)/g, ' ').trim()).replace(/\s+/g, ' ');
  if (!key) return null;
  for (const [code, fr, en, aliases = []] of LANGUAGE_TABLE) {
    if ([fr, en, ...aliases].some((n) => foldWord(n) === key)) return { code, names: { fr, en } };
  }
  return null;
}

// Country names (FR and EN) of a LinkedIn location. Written for the project.
const COUNTRY_TABLE: ReadonlyArray<[fr: string, en: string, aliases?: string[]]> = [
  ['France', 'France'],
  ['Allemagne', 'Germany'],
  ['Suisse', 'Switzerland'],
  ['Belgique', 'Belgium'],
  ['Luxembourg', 'Luxembourg'],
  ['Monaco', 'Monaco'],
  ['Royaume-Uni', 'United Kingdom', ['UK', 'Grande-Bretagne', 'Great Britain']],
  ['Irlande', 'Ireland'],
  ['Espagne', 'Spain'],
  ['Portugal', 'Portugal'],
  ['Italie', 'Italy'],
  ['Pays-Bas', 'Netherlands', ['The Netherlands']],
  ['Autriche', 'Austria'],
  ['Danemark', 'Denmark'],
  ['Suède', 'Sweden'],
  ['Norvège', 'Norway'],
  ['Finlande', 'Finland'],
  ['Pologne', 'Poland'],
  ['Canada', 'Canada'],
  ['États-Unis', 'United States', ['USA', 'United States of America', 'Etats-Unis']],
  ['Maroc', 'Morocco'],
  ['Algérie', 'Algeria'],
  ['Tunisie', 'Tunisia'],
  ['Sénégal', 'Senegal'],
  ['Israël', 'Israel'],
  ['Émirats arabes unis', 'United Arab Emirates', ['UAE']],
  ['Inde', 'India'],
  ['Chine', 'China'],
  ['Japon', 'Japan'],
  ['Singapour', 'Singapore'],
  ['Australie', 'Australia'],
  ['Brésil', 'Brazil'],
  ['Mexique', 'Mexico'],
];

export function countryByName(name: string): { fr: string; en: string } | null {
  const key = foldWord(name.trim());
  for (const [fr, en, aliases = []] of COUNTRY_TABLE) {
    if ([fr, en, ...aliases].some((n) => foldWord(n) === key)) return { fr, en };
  }
  return null;
}

/**
 * « Lyon, Auvergne-Rhône-Alpes, France » → { city: Lyon, country: France/France }. Null when the city or
 * the country cannot be told apart: the location is then left empty, with a « lieu à vérifier » check.
 */
export function parseLinkedInLocation(raw: string | undefined): { city: string; country: Bilingual } | null {
  const parts = (raw ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const country = countryByName(parts[parts.length - 1]!);
  if (!country) return null;
  const city = parts[0]!.replace(/\s+et périphérie$/i, '').trim();
  return city ? { city, country } : null;
}

// ---------------------------------------------------------------------------------------------------
// Text cleaning and bullets.

const STRIPPED = /[\u{1F000}-\u{1FAFF}\u2600-\u27BF\uE000-\uF8FF]|\uFE0E|\uFE0F/gu;

/**
 * Imported text: NFC, line breaks kept, tabs → space; emoji, variation selectors and private-use
 * characters removed (annex B.1 refuses them; in an import they are decoration, so they are dropped
 * and reported instead of losing the whole element, ADR 0015). Other control characters are removed.
 */
export function cleanImportedText(input: string): { text: string; removed: string[] } {
  const removed = new Set<string>();
  let s = input.normalize('NFC').replace(/\r\n?/g, '\n').replace(/\t/g, ' ');
  s = s.replace(STRIPPED, (ch) => {
    if (ch !== '\uFE0F' && ch !== '\uFE0E') removed.add(formatCodePoint(ch.codePointAt(0)!));
    return '';
  });
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g, '');
  return { text: s, removed: [...removed] };
}

/** One-line form of an imported text (title, summary, names). */
export const oneLine = (s: string) => s.replace(/\s*\n\s*/g, ' ').trim();

const MARKER = /^\s*(?:[•‣⁃▪▫●○◦■□►→·*–—-]|\d{1,2}[.)])\s+/u;
const SENTENCE_END = /(?<=[.!?;])\s+(?=[\p{Lu}\p{N}«"(])/u;

/**
 * Description → bullets (ADR 0015, user decision): split on lines and bullet markers; a piece longer
 * than `max` is split again at sentence ends, sentences grouped up to `max`. A single sentence longer
 * than `max` is kept whole (the max-length check warns): the user's text is never lost.
 */
export function splitBullets(description: string | undefined, max = 200): string[] {
  const out: string[] = [];
  for (const line of (description ?? '').split('\n')) {
    const piece = line.replace(MARKER, '').replace(/\s+/g, ' ').trim();
    if (!piece) continue;
    if (piece.length <= max) {
      out.push(piece);
      continue;
    }
    let current = '';
    for (const sentence of piece.split(SENTENCE_END)) {
      if (current && current.length + 1 + sentence.length > max) {
        out.push(current);
        current = sentence;
      } else current = current ? `${current} ${sentence}` : sentence;
    }
    if (current) out.push(current);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------
// Candidates: what the import would propose, before deduplication and guardrails (store).

export interface ImportCheck {
  rule: 'date-to-verify' | 'cefr-to-specify' | 'category-to-verify' | 'location-to-verify' | 'removed-characters';
  ok: false;
  level: 'warning';
  message: string;
}

export type LinkedInItemType =
  'title' | 'summary' | 'experience' | 'education' | 'project' | 'skill' | 'certification' | 'language';

export interface LinkedInCandidate {
  type: LinkedInItemType;
  /** Element without ids (the server assigns them). */
  data: Record<string, unknown>;
  /** Reference source of the guardrails (annex C): the texts of the row. */
  sourceText: string;
  checks: ImportCheck[];
  /** Readable label (report). */
  label: string;
  file: LinkedInFileName;
  /** 1-based data row in its file. */
  row: number;
}

export interface LinkedInIncomplete {
  type: LinkedInItemType;
  label: string;
  file: LinkedInFileName;
  row: number;
  reason: string;
}

/** Identity found in the export: offered to prefill the identity form, never proposed nor returned by the MCP. */
export interface LinkedInIdentity {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  location: { city: string; country: Bilingual } | null;
}

export interface LinkedInExtraction {
  candidates: LinkedInCandidate[];
  incomplete: LinkedInIncomplete[];
  identity: LinkedInIdentity;
}

/** Category suggested for an imported skill: annex A → regulatory, the tech vocabulary → its kind. */
export function suggestSkillCategory(short: string, categories: readonly string[]): string | null {
  const has = (id: string) => categories.includes(id);
  if (has(REGULATORY_CATEGORY) && ANNEX_A.some((e) => annexForms(e).some((f) => sameTerm(f, short)))) {
    return REGULATORY_CATEGORY;
  }
  const term = TECH_VOCABULARY.find((x) => [x.short, ...x.aliases].some((f) => sameTerm(f, short)));
  const kind = term ? TECH_KIND.get(term) : undefined;
  const wanted = kind === 'language' ? 'langages' : kind === 'method' ? 'methodes' : 'outils';
  if (has(wanted)) return wanted;
  return categories.find((c) => c !== REGULATORY_CATEGORY) ?? categories[0] ?? null;
}

/** Whether an imported skill is an ambiguous acronym of the vocabulary (Go, R, C…). */
function isAmbiguousSkill(short: string): boolean {
  return TECH_VOCABULARY.some((x) => x.ambiguous && x.short === short);
}

const urlLink = (raw: string | undefined): { url: string; display: string } | null => {
  const url = (raw ?? '').trim();
  if (!/^https?:\/\/\S+$/.test(url) || url.length > 2048) return null;
  return { url, display: url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') };
};

/**
 * Turns the tables of an export into candidates. `lang` is the language the texts are written in (the
 * other one stays null: « non traduit », F-LIB-04); language and country names known to the tables are
 * filled in both languages.
 */
export function linkedInCandidates(
  tables: readonly LinkedInTable[],
  lang: Lang,
  categories: readonly string[],
): LinkedInExtraction {
  const candidates: LinkedInCandidate[] = [];
  const incomplete: LinkedInIncomplete[] = [];
  const identity: LinkedInIdentity = { firstName: null, lastName: null, email: null, phone: null, location: null };
  const bil = (s: string): Bilingual => (lang === 'fr' ? { fr: s, en: null } : { fr: null, en: s });
  const table = (file: LinkedInFileName) => tables.find((t) => t.file === file);

  /** Cleans the row's values; returns the cleaned values, the source text and the removal check. */
  const prepareRow = (row: Record<string, string>) => {
    const removed = new Set<string>();
    const v: Record<string, string> = {};
    for (const [k, raw] of Object.entries(row)) {
      const c = cleanImportedText(raw);
      c.removed.forEach((r) => removed.add(r));
      v[k] = c.text.trim();
    }
    const checks: ImportCheck[] = removed.size
      ? [
          {
            rule: 'removed-characters',
            ok: false,
            level: 'warning',
            message: `caractères retirés à l'import (emoji ou zone privée) : ${[...removed].join(', ')}`,
          },
        ]
      : [];
    return { v, checks, sourceText: Object.values(v).filter(Boolean).join('\n') };
  };

  /** Date of a field; `required` dates without a year make the element incomplete (returns undefined). */
  const dateOf = (
    raw: string | undefined,
    column: string,
    checks: ImportCheck[],
    opts: { required: boolean; end: boolean },
  ): string | null | undefined => {
    const d = parseLinkedInDate(raw);
    if (d.kind === 'ok') return d.value;
    if (d.kind === 'empty') return opts.required && !opts.end ? undefined : null;
    if (d.year) {
      checks.push({
        rule: 'date-to-verify',
        ok: false,
        level: 'warning',
        message: `date à vérifier : ${column} = « ${d.raw} » (année retenue : ${d.year}, aucun mois inventé)`,
      });
      return d.year;
    }
    if (opts.required || opts.end) return undefined;
    checks.push({
      rule: 'date-to-verify',
      ok: false,
      level: 'warning',
      message: `date à vérifier : ${column} = « ${d.raw} » (illisible, laissée vide)`,
    });
    return null;
  };

  /**
   * Optional range (education, project): an unreadable end without a year would read as « en cours »
   * (end null after a start): both dates are then left empty, with the « date à vérifier » check.
   */
  const optionalRange = (
    rawStart: string | undefined,
    startColumn: string,
    rawEnd: string | undefined,
    endColumn: string,
    checks: ImportCheck[],
  ): { start: string | null; end: string | null } => {
    const start = dateOf(rawStart, startColumn, checks, { required: false, end: false }) ?? null;
    const end = dateOf(rawEnd, endColumn, checks, { required: false, end: true });
    if (end !== undefined) return { start, end };
    checks.push({
      rule: 'date-to-verify',
      ok: false,
      level: 'warning',
      message: `date à vérifier : ${endColumn} = « ${(rawEnd ?? '').trim()} » (illisible) ; dates laissées vides pour ne pas lire « en cours »`,
    });
    return { start: null, end: null };
  };

  const bulletsOf = (text: string | undefined) =>
    splitBullets(text).map((b) => ({
      tags: [],
      skills: [],
      variants: [{ id: 'principale', label: null, text: bil(b) }],
    }));

  // Profile.csv: identity (prefill only), headline → title, summary → summary.
  const profile = table('Profile.csv')?.rows[0];
  if (profile) {
    const { v, checks, sourceText } = prepareRow(profile);
    identity.firstName = v['First Name'] || null;
    identity.lastName = v['Last Name'] || null;
    identity.location = parseLinkedInLocation(v['Geo Location']);
    const headline = oneLine(v.Headline ?? '');
    if (headline) {
      candidates.push({
        type: 'title',
        data: { tags: [], variants: [{ id: 'principale', label: null, text: bil(headline) }] },
        sourceText,
        checks: [...checks],
        label: headline,
        file: 'Profile.csv',
        row: 1,
      });
    }
    const summary = oneLine(v.Summary ?? '');
    if (summary) {
      candidates.push({
        type: 'summary',
        data: { tags: [], variants: [{ id: 'principale', label: null, text: bil(summary) }] },
        sourceText,
        checks: [...checks],
        label: summary,
        file: 'Profile.csv',
        row: 1,
      });
    }
  }
  const emails = table('Email Addresses.csv')?.rows ?? [];
  const primary = emails.find((r) => /^(yes|oui|true)$/i.test(r.Primary ?? '')) ?? emails[0];
  identity.email = primary?.['Email Address']?.trim() || null;
  identity.phone =
    table('PhoneNumbers.csv')
      ?.rows.find((r) => r.Number?.trim())
      ?.Number?.trim() || null;

  table('Positions.csv')?.rows.forEach((row, i) => {
    const { v, checks, sourceText } = prepareRow(row);
    const organization = oneLine(v['Company Name'] ?? '');
    const position = oneLine(v.Title ?? '');
    const label = [position, organization].filter(Boolean).join(' – ') || `ligne ${i + 1}`;
    const miss = (reason: string) =>
      incomplete.push({ type: 'experience', label, file: 'Positions.csv', row: i + 1, reason });
    if (!organization) return miss('entreprise absente');
    if (!position) return miss('intitulé du poste absent');
    const start = dateOf(v['Started On'], 'Started On', checks, { required: true, end: false });
    if (start === undefined) {
      return miss(v['Started On'] ? `date de début illisible (« ${v['Started On']} »)` : 'date de début absente');
    }
    const end = dateOf(v['Finished On'], 'Finished On', checks, { required: false, end: true });
    if (end === undefined)
      return miss(`date de fin illisible (« ${v['Finished On'] ?? ''} »), jamais lue comme « en cours »`);
    const location = parseLinkedInLocation(v.Location);
    if (!location && v.Location) {
      checks.push({
        rule: 'location-to-verify',
        ok: false,
        level: 'warning',
        message: `lieu à vérifier : « ${v.Location} » (non repris)`,
      });
    }
    candidates.push({
      type: 'experience',
      data: {
        tags: [],
        skills: [],
        position: bil(position),
        organization,
        location,
        contract: null,
        start,
        end,
        bullets: bulletsOf(v.Description),
      },
      sourceText,
      checks,
      label,
      file: 'Positions.csv',
      row: i + 1,
    });
  });

  table('Education.csv')?.rows.forEach((row, i) => {
    const { v, checks, sourceText } = prepareRow(row);
    const institution = oneLine(v['School Name'] ?? '');
    const degree = oneLine(v['Degree Name'] ?? '');
    const label = [degree, institution].filter(Boolean).join(' – ') || `ligne ${i + 1}`;
    const miss = (reason: string) =>
      incomplete.push({ type: 'education', label, file: 'Education.csv', row: i + 1, reason });
    if (!institution) return miss('établissement absent');
    if (!degree) return miss('diplôme absent');
    const { start, end } = optionalRange(v['Start Date'], 'Start Date', v['End Date'], 'End Date', checks);
    candidates.push({
      type: 'education',
      data: { tags: [], skills: [], degree: bil(degree), institution, start, end, bullets: bulletsOf(v.Notes) },
      sourceText,
      checks,
      label,
      file: 'Education.csv',
      row: i + 1,
    });
  });

  table('Skills.csv')?.rows.forEach((row, i) => {
    const { v, checks, sourceText } = prepareRow(row);
    const short = oneLine(v.Name ?? '');
    if (!short) return;
    const category = suggestSkillCategory(short, categories);
    if (!category) {
      incomplete.push({
        type: 'skill',
        label: short,
        file: 'Skills.csv',
        row: i + 1,
        reason: 'aucune catégorie de compétences dans la bibliothèque',
      });
      return;
    }
    checks.push({
      rule: 'category-to-verify',
      ok: false,
      level: 'warning',
      message: `catégorie proposée : ${category} (à vérifier)`,
    });
    candidates.push({
      type: 'skill',
      data: {
        tags: [],
        category,
        short,
        long: null,
        code: null,
        edition: null,
        aliases: [],
        related: [],
        ambiguous: isAmbiguousSkill(short),
      },
      sourceText,
      checks,
      label: short,
      file: 'Skills.csv',
      row: i + 1,
    });
  });

  table('Languages.csv')?.rows.forEach((row, i) => {
    const { v, checks, sourceText } = prepareRow(row);
    const name = oneLine(v.Name ?? '');
    if (!name) return;
    const known = languageByName(name);
    if (!known) {
      incomplete.push({
        type: 'language',
        label: name,
        file: 'Languages.csv',
        row: i + 1,
        reason: 'langue non reconnue (code ISO inconnu)',
      });
      return;
    }
    const cefr = proficiencyToCefr(v.Proficiency);
    if (cefr === null) {
      checks.push({
        rule: 'cefr-to-specify',
        ok: false,
        level: 'warning',
        message: `niveau CECRL à préciser${v.Proficiency ? ` (LinkedIn : « ${v.Proficiency} »)` : ''} : bloque l'export de cette langue tant qu'il n'est pas renseigné`,
      });
    }
    candidates.push({
      type: 'language',
      data: { tags: [], code: known.code, language: known.names, cefr, certification: null },
      sourceText: `${sourceText}\n${known.names.fr}\n${known.names.en}`,
      checks,
      label: name,
      file: 'Languages.csv',
      row: i + 1,
    });
  });

  table('Certifications.csv')?.rows.forEach((row, i) => {
    const { v, checks, sourceText } = prepareRow(row);
    const name = oneLine(v.Name ?? '');
    const issuer = oneLine(v.Authority ?? '');
    if (!name) return;
    if (!issuer) {
      incomplete.push({
        type: 'certification',
        label: name,
        file: 'Certifications.csv',
        row: i + 1,
        reason: 'organisme absent (Authority)',
      });
      return;
    }
    const date = dateOf(v['Started On'], 'Started On', checks, { required: false, end: false });
    candidates.push({
      type: 'certification',
      data: { tags: [], skills: [], name: bil(name), issuer, date: date ?? null, url: urlLink(v.Url) },
      sourceText,
      checks,
      label: name,
      file: 'Certifications.csv',
      row: i + 1,
    });
  });

  table('Projects.csv')?.rows.forEach((row, i) => {
    const { v, checks, sourceText } = prepareRow(row);
    const name = oneLine(v.Title ?? '');
    if (!name) return;
    const { start, end } = optionalRange(v['Started On'], 'Started On', v['Finished On'], 'Finished On', checks);
    candidates.push({
      type: 'project',
      data: {
        tags: [],
        skills: [],
        name: bil(name),
        role: null,
        organization: null,
        url: urlLink(v.Url),
        start,
        end,
        bullets: bulletsOf(v.Description),
      },
      sourceText,
      checks,
      label: name,
      file: 'Projects.csv',
      row: i + 1,
    });
  });

  return { candidates, incomplete, identity };
}
