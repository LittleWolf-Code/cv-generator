// LinkedIn import (F-IMP-02, MCP-21, ADR 0015): the export is read in memory, never extracted to disk.
// Only the expected CSV files at the first level of the ZIP are read, 20 MB decompressed at most; CSV
// files dropped directly in import/ are read the same way. The result is a set of proposals (origin and
// source `import-linkedin`) that the user accepts or rejects in « À valider »; `dryRun` returns only the
// names of the files and columns and counts, never a value (to confirm the columns of a real export).
import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { Unzip, UnzipInflate } from 'fflate';
import {
  LINKEDIN_FILE_NAMES,
  linkedInCandidates,
  linkedInDateFormat,
  linkedInFileOf,
  proficiencyToCefr,
  readLinkedInTable,
  type Lang,
  type LinkedInColumns,
  type LinkedInFileName,
  type LinkedInIdentity,
  type LinkedInIncomplete,
  type LinkedInTable,
} from '@cv/core';
import { StoreError } from './errors.js';
import type { WriteRef } from './library.js';
import { assertSafeFileName, resolveInside } from './paths.js';
import { proposeImported, type ItemCandidate } from './propose.js';
import type { DataStore } from './store.js';

/** F-IMP-02: decompressed size of the expected CSV files, at most. */
export const LINKEDIN_MAX_BYTES = 20 * 1024 * 1024;
/** Size of the ZIP file itself (a « complete » export also holds files that are not read). */
export const LINKEDIN_ZIP_MAX_BYTES = 100 * 1024 * 1024;
/** The ZIP is pushed to the decompressor in small chunks: a bomb is stopped after a few megabytes. */
const CHUNK = 4096;

const DATE_COLUMNS = ['Started On', 'Finished On', 'Start Date', 'End Date'];

export interface LinkedInSource {
  /** Readable origin: the ZIP or CSV name, or « CSV de import/ ». */
  label: string;
  /** `sourceFile` recorded in the proposals. */
  sourceFile: string | null;
  tables: LinkedInTable[];
  /** Entries of the ZIP not read (nested, or not an expected CSV): names only. */
  skipped: string[];
}

const tooBig = () =>
  new StoreError(
    'INVALID_DATA',
    `export LinkedIn trop volumineux : plus de ${LINKEDIN_MAX_BYTES / 1024 / 1024} Mo décompressés dans les CSV attendus`,
    {},
    'déposez le ZIP « Basic » de LinkedIn, ou seulement les CSV utiles (Profile.csv, Positions.csv…)',
  );

/** Expected CSV files at the first level of a ZIP, decompressed in memory with a size limit. */
export function unzipLinkedIn(bytes: Uint8Array): { files: Map<LinkedInFileName, Uint8Array>; skipped: string[] } {
  const files = new Map<LinkedInFileName, Uint8Array>();
  const skipped: string[] = [];
  const chunks = new Map<LinkedInFileName, Uint8Array[]>();
  const done = new Set<LinkedInFileName>();
  let total = 0;
  let failure: StoreError | null = null;
  const unzip = new Unzip((file) => {
    const expected = file.name.includes('/') || file.name.includes('\\') ? null : linkedInFileOf(file.name);
    if (!expected || chunks.has(expected)) {
      if (!file.name.endsWith('/')) skipped.push(file.name);
      return;
    }
    chunks.set(expected, []);
    file.ondata = (err, data, final) => {
      if (failure) return;
      if (err) {
        failure = new StoreError(
          'INVALID_DATA',
          `archive illisible (${file.name}) : ${err.message}`,
          {},
          'archive chiffrée ou compression non prise en charge : déposez les CSV directement dans import/',
        );
        return;
      }
      total += data.length;
      if (total > LINKEDIN_MAX_BYTES) {
        failure = tooBig();
        file.terminate();
        return;
      }
      chunks.get(expected)!.push(data);
      if (final) done.add(expected);
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  try {
    for (let i = 0; i < bytes.length && !failure; i += CHUNK) {
      unzip.push(bytes.subarray(i, i + CHUNK), i + CHUNK >= bytes.length);
    }
  } catch (err) {
    if (!failure) throw new StoreError('INVALID_DATA', `archive ZIP illisible : ${(err as Error).message}`);
  }
  if (failure) throw failure;
  for (const [name, parts] of chunks) {
    if (!done.has(name)) throw new StoreError('INVALID_DATA', `archive ZIP tronquée : ${name} incomplet`);
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let offset = 0;
    for (const p of parts) {
      out.set(p, offset);
      offset += p.length;
    }
    files.set(name, out);
  }
  return { files, skipped };
}

const decode = (bytes: Uint8Array) => new TextDecoder('utf-8').decode(bytes);

/**
 * Reads the export designated by `fileName` in import/: a ZIP, one expected CSV, or (no name) every
 * expected CSV at the root of import/. File scope of §7.6 (names only, realpath, lowercase comparison).
 */
export async function readLinkedInSource(importDir: string | null, fileName?: string | null): Promise<LinkedInSource> {
  if (!importDir || !existsSync(importDir)) throw new StoreError('NOT_FOUND', 'dossier import/ introuvable');
  const tablesOf = (files: Map<LinkedInFileName, Uint8Array>) =>
    LINKEDIN_FILE_NAMES.filter((f) => files.has(f)).map((f) => readLinkedInTable(f, decode(files.get(f)!)));

  if (fileName) {
    assertSafeFileName(fileName);
    const abs = resolveInside(importDir, fileName);
    if (!existsSync(abs)) throw new StoreError('NOT_FOUND', `fichier introuvable dans import/ : ${fileName}`);
    const s = await stat(abs);
    if (!s.isFile()) throw new StoreError('FORBIDDEN_PATH', `pas un fichier : ${fileName}`);
    if (/\.zip$/i.test(fileName)) {
      if (s.size > LINKEDIN_ZIP_MAX_BYTES) {
        throw new StoreError(
          'INVALID_DATA',
          `archive trop volumineuse (${LINKEDIN_ZIP_MAX_BYTES / 1024 / 1024} Mo au plus) : ${fileName}`,
        );
      }
      const { files, skipped } = unzipLinkedIn(new Uint8Array(await readFile(abs)));
      if (files.size === 0) {
        throw new StoreError(
          'NOT_FOUND',
          `aucun CSV attendu au premier niveau de ${fileName}`,
          { skipped },
          `fichiers attendus : ${LINKEDIN_FILE_NAMES.join(', ')}`,
        );
      }
      return { label: fileName, sourceFile: fileName, tables: tablesOf(files), skipped };
    }
    if (/\.csv$/i.test(fileName)) {
      const expected = linkedInFileOf(fileName);
      if (!expected) {
        throw new StoreError(
          'NOT_APPLICABLE',
          `${fileName} n'est pas un fichier de l'export LinkedIn pris en charge`,
          {},
          `fichiers attendus : ${LINKEDIN_FILE_NAMES.join(', ')}`,
        );
      }
      if (s.size > LINKEDIN_MAX_BYTES) throw tooBig();
      return {
        label: fileName,
        sourceFile: fileName,
        tables: [readLinkedInTable(expected, decode(new Uint8Array(await readFile(abs))))],
        skipped: [],
      };
    }
    throw new StoreError('NOT_APPLICABLE', `import LinkedIn : ZIP ou CSV attendu, pas ${fileName}`);
  }

  const files = new Map<LinkedInFileName, Uint8Array>();
  let total = 0;
  for (const entry of await readdir(importDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const expected = linkedInFileOf(entry.name);
    if (!expected) continue;
    const abs = resolveInside(importDir, entry.name);
    total += (await stat(abs)).size;
    if (total > LINKEDIN_MAX_BYTES) throw tooBig();
    files.set(expected, new Uint8Array(await readFile(abs)));
  }
  if (files.size === 0) {
    throw new StoreError(
      'NOT_FOUND',
      'aucun CSV de l\u2019export LinkedIn à la racine de import/',
      {},
      `déposez le ZIP, ou les CSV attendus (${LINKEDIN_FILE_NAMES.join(', ')})`,
    );
  }
  return { label: 'CSV de import/', sourceFile: null, tables: tablesOf(files), skipped: [] };
}

export interface LinkedInFileReport {
  file: LinkedInFileName;
  rows: number;
  columns: LinkedInColumns;
  /** Dry run: count of each date format per date column (never the values). */
  dateFormats?: Record<string, Record<string, number>>;
  /** Dry run: languages whose level gives a CEFR (native) and those to specify. */
  levels?: { native: number; toSpecify: number };
}

export interface LinkedInImportReport {
  dryRun: boolean;
  source: string;
  files: LinkedInFileReport[];
  skipped: string[];
  /** « Fichier : colonne », logged (F-IMP-02). */
  unknownColumns: string[];
  ignoredColumns: string[];
  created: number;
  proposalIds: string[];
  duplicates: Array<{
    type: string;
    label: string;
    duplicateOf: string;
    inPending: boolean;
    proposalIds: string[];
    hint: string;
  }>;
  rejected: Array<{ type: string; label: string; reasons: string[] }>;
  incomplete: LinkedInIncomplete[];
  datesToVerify: number;
  languagesWithoutLevel: string[];
  /** Identity fields found (never their values here: prefill through the interface only). */
  identityFound: Record<keyof LinkedInIdentity, boolean>;
  writes: WriteRef[];
}

function fileReports(source: LinkedInSource, dryRun: boolean): LinkedInFileReport[] {
  return source.tables.map((t) => {
    const r: LinkedInFileReport = { file: t.file, rows: t.rows.length, columns: t.columns };
    if (dryRun) {
      const formats: Record<string, Record<string, number>> = {};
      for (const col of DATE_COLUMNS.filter((c) => t.columns.known.includes(c))) {
        formats[col] = {};
        for (const row of t.rows) {
          const f = linkedInDateFormat(row[col]);
          formats[col][f] = (formats[col][f] ?? 0) + 1;
        }
      }
      if (Object.keys(formats).length) r.dateFormats = formats;
      if (t.file === 'Languages.csv') {
        const native = t.rows.filter((row) => proficiencyToCefr(row.Proficiency) === 'native').length;
        r.levels = { native, toSpecify: t.rows.length - native };
      }
    }
    return r;
  });
}

const identityFlags = (id: LinkedInIdentity): Record<keyof LinkedInIdentity, boolean> => ({
  firstName: !!id.firstName,
  lastName: !!id.lastName,
  email: !!id.email,
  phone: !!id.phone,
  location: !!id.location,
});

export interface LinkedInImportOptions {
  importDir: string | null;
  fileName?: string | null;
  /** Language the texts of the export are written in (French by default); the other stays « non traduit ». */
  lang?: Lang;
  dryRun?: boolean;
  now?: Date;
}

/**
 * Deterministic LinkedIn import (F-IMP-02), shared by the interface, `npm run import:linkedin` and
 * import_linkedin (MCP-21). Writes only proposals (and ids.json), never the validated content.
 */
export async function importLinkedIn(store: DataStore, opts: LinkedInImportOptions): Promise<LinkedInImportReport> {
  const source = await readLinkedInSource(opts.importDir, opts.fileName);
  const dryRun = opts.dryRun ?? false;
  const report: LinkedInImportReport = {
    dryRun,
    source: source.label,
    files: fileReports(source, dryRun),
    skipped: source.skipped,
    unknownColumns: source.tables.flatMap((t) => t.columns.unknown.map((c) => `${t.file} : ${c}`)),
    ignoredColumns: source.tables.flatMap((t) => t.columns.ignored.map((c) => `${t.file} : ${c}`)),
    created: 0,
    proposalIds: [],
    duplicates: [],
    rejected: [],
    incomplete: [],
    datesToVerify: 0,
    languagesWithoutLevel: [],
    identityFound: { firstName: false, lastName: false, email: false, phone: false, location: false },
    writes: [],
  };
  const library = await store.loadLibrary();
  const extraction = linkedInCandidates(
    source.tables,
    opts.lang ?? 'fr',
    library.categories.map((c) => c.id),
  );
  report.identityFound = identityFlags(extraction.identity);
  if (dryRun) return report;

  report.incomplete = extraction.incomplete;
  const candidates: ItemCandidate[] = extraction.candidates.map((c) => ({
    type: c.type,
    data: c.data,
    origin: 'import-linkedin',
    source: 'import-linkedin',
    sources: [c.sourceText],
    sourceFile: source.sourceFile,
    userStatement: null,
    rationale: `Import LinkedIn : ${c.file}, ligne ${c.row}.`,
    extraChecks: c.checks,
    lengthLevel: 'warning',
  }));
  const outcome = await proposeImported(store, candidates, opts.now ?? new Date());
  report.writes = outcome.writes;
  report.proposalIds = outcome.proposalIds;
  for (const r of outcome.results) {
    const c = extraction.candidates[r.index]!;
    if (r.status === 'created') {
      report.created++;
      if (c.checks.some((k) => k.rule === 'date-to-verify')) report.datesToVerify++;
      if (c.type === 'language' && c.checks.some((k) => k.rule === 'cefr-to-specify')) {
        report.languagesWithoutLevel.push(c.label);
      }
    } else if (r.status === 'duplicateOf') {
      report.created += r.proposalIds.length;
      report.duplicates.push({
        type: c.type,
        label: c.label,
        duplicateOf: r.duplicateOf,
        inPending: /^[0-9A-HJKMNP-TV-Z]{26}$/.test(r.duplicateOf),
        proposalIds: r.proposalIds,
        hint: r.hint,
      });
    } else {
      report.rejected.push({ type: c.type, label: c.label, reasons: r.reasons });
    }
  }
  return report;
}

/** Identity found in the export, for the « préremplir » button of the identity form (interface only). */
export async function linkedInIdentity(importDir: string | null, fileName?: string | null): Promise<LinkedInIdentity> {
  const source = await readLinkedInSource(importDir, fileName);
  return linkedInCandidates(source.tables, 'fr', []).identity;
}

/** Whether a file of import/ can be imported as a LinkedIn export (ZIP or expected CSV). */
export function isLinkedInFile(name: string): boolean {
  return /\.zip$/i.test(name) || linkedInFileOf(name) !== null;
}
