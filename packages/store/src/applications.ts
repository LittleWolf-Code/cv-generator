// Applications (§6.4, F-CAN-01 to 03, §9.1): applications/<id>/ holds application.json (meta),
// selection.json (copied from the starting preset, then diverging without modifying it), offer.md
// (untrusted data, §7.5), analysis.json ({ current, history }) and exports/. Creating an application,
// saving an offer analysis and adding a timestamped export are additive writes (F-PRO-01 exceptions):
// nothing is ever overwritten. Every write runs under the single data lock and returns the files it
// changed with their revision (ADR 0009).
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import {
  applicationSelectionFile,
  applyLanguage,
  cleanUntrusted,
  enVariant,
  fileLabel as fileLabelSchema,
  fileNamePart,
  flagInstructions,
  httpUrl,
  id as idSchema,
  lang as langSchema,
  normalizeForMatch,
  OFFER_MAX_CHARS,
  offerTerm,
  proposeFileLabel,
  SCHEMA_VERSION,
  stripGenderMarkers,
  text,
  truncateAtWord,
  type AnalysisFile,
  type ApplicationFile,
  type ApplicationSelectionFile,
  type ExportEntry,
  type InstructionFlag,
  type IdsFile,
  type Layout,
  type Lang,
  type OfferAnalysis,
  type OfferTerm,
  type PresetFile,
} from '@cv/core';
import { writeFileAtomic } from './atomic.js';
import { StoreError } from './errors.js';
import { readImportOffer } from './import-offers.js';
import { prepare, type FieldIssue, type WriteRef } from './library.js';
import { sha256, type DataStore } from './store.js';

export const appDir = (id: string) => `applications/${id}`;
const appRel = (id: string, file: string) => `${appDir(id)}/${file}`;

export interface ApplicationWrite {
  application: ApplicationFile;
  selection: ApplicationSelectionFile;
  writes: WriteRef[];
}

export interface OfferView {
  /** Cleaned offer (offer.md): untrusted data, displayed, never executed. */
  text: string;
  /** Sentences that look like instructions for an AI (§7.5), computed at each read. */
  flags: InstructionFlag[];
}

const pad = (n: number) => String(n).padStart(2, '0');
/** Local date `YYYY-MM-DD` (the user works in France: the day of the creation, not the UTC day). */
export function localDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** `AAAAMMJJ-HHmmss`, local time (F-CAN-03). */
export function exportStamp(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/**
 * Assigns the id of a new application, `<AAAA-MM-JJ>-<entreprise>-<poste>` (§9.2 example, ADR 0013):
 * gender markers removed, 60 characters at most cut at a word end, `-2`, `-3`… when taken. Recorded
 * in ids.json by the caller; never reused, even after deletion (F-LIB-02).
 */
export function allocateApplicationIdIn(
  registry: IdsFile,
  input: { company: string; jobTitle: string },
  now = new Date(),
): string {
  const date = localDate(now);
  const slug =
    truncateAtWord(fileNamePart(`${input.company} ${stripGenderMarkers(input.jobTitle)}`).toLowerCase(), 60 - 11) ||
    'candidature';
  const stem = `${date}-${slug}`;
  let candidate = stem;
  for (let n = 2; registry.ids[candidate]; n++) candidate = `${stem}-${n}`;
  registry.ids[candidate] = { kind: 'application', createdAt: now.toISOString() };
  return candidate;
}

const createInput = z.strictObject({
  company: text,
  jobTitle: text,
  offerReference: text.nullable(),
  url: httpUrl.nullable(),
  lang: langSchema,
  enVariant,
  fileLabel: fileLabelSchema,
  basePresetId: idSchema,
});

export interface CreateApplicationInput {
  company: unknown;
  jobTitle: unknown;
  offerReference?: unknown;
  url?: unknown;
  lang: unknown;
  enVariant?: unknown;
  /** Proposed from the job title when absent (annex B.4). */
  fileLabel?: unknown;
  basePresetId: unknown;
  /** Exactly one of the two: the offer pasted in the interface, or a file name of import/offres/. */
  offerText?: string | null;
  offerFile?: string | null;
}

const blank = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

function invalid(message: string, issues: FieldIssue[]): StoreError {
  return new StoreError('INVALID_DATA', message, { issues });
}

async function readPreset(store: DataStore, id: string): Promise<PresetFile> {
  const rel = `presets/${id}.json`;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || !(await store.exists(rel))) {
    throw invalid('preset de départ introuvable', [{ path: 'basePresetId', message: `preset introuvable : ${id}` }]);
  }
  return store.read<PresetFile>(rel);
}

/**
 * Creates an application (F-CAN-01): the id is assigned by the server and recorded in ids.json; the
 * selection, options and template are copied from the starting preset (selection.json), which is
 * never modified; the offer is cleaned (invisible characters removed) and stored in offer.md.
 */
export async function createApplication(
  store: DataStore,
  input: CreateApplicationInput,
  opts: { importDir: string | null },
  now = new Date(),
): Promise<ApplicationWrite & { offer: OfferView & { removed: number } }> {
  const issues: FieldIssue[] = [];
  const hasText = !blank(input.offerText);
  const hasFile = !blank(input.offerFile);
  if (hasText === hasFile) {
    issues.push({
      path: 'offer',
      message: "collez le texte de l'offre ou choisissez un fichier de import/offres/ (un seul des deux)",
    });
  }
  const jobTitle = typeof input.jobTitle === 'string' ? input.jobTitle : '';
  const label = blank(input.fileLabel)
    ? proposeFileLabel(jobTitle) || 'CV'
    : proposeFileLabel(typeof input.fileLabel === 'string' ? input.fileLabel : '');
  const { value: meta, issues: metaIssues } = prepare(createInput, {
    company: input.company,
    jobTitle: input.jobTitle,
    offerReference: blank(input.offerReference) ? null : input.offerReference,
    url: blank(input.url) ? null : typeof input.url === 'string' ? input.url.trim() : input.url,
    lang: input.lang,
    enVariant: input.enVariant ?? 'en-GB',
    fileLabel: label,
    basePresetId: input.basePresetId,
  });
  issues.push(...metaIssues);

  let raw = '';
  if (hasText && !hasFile) raw = String(input.offerText);
  else if (hasFile && !hasText) {
    try {
      raw = await readImportOffer(opts.importDir, String(input.offerFile));
    } catch (err) {
      if (!(err instanceof StoreError)) throw err;
      issues.push({ path: 'offerFile', message: err.message });
    }
  }
  const offer = cleanUntrusted(raw);
  if ((hasText || hasFile) && !issues.some((i) => i.path === 'offerFile')) {
    if (!offer.text) issues.push({ path: 'offer', message: "texte de l'offre vide" });
    else if (offer.text.length > OFFER_MAX_CHARS) {
      issues.push({
        path: 'offer',
        message: `offre trop longue (${offer.text.length} caractères, ${OFFER_MAX_CHARS} au plus)`,
      });
    }
  }
  if (issues.length || !meta) throw invalid('candidature invalide', issues);

  return store.withLock(async () => {
    const preset = await readPreset(store, meta.basePresetId);
    const registry = await store.readIds();
    let id = allocateApplicationIdIn(registry, meta, now);
    // A folder left by hand under the same name is never reused either.
    // The id just recorded is taken: allocating again gives the next suffix.
    while (await store.exists(appDir(id))) id = allocateApplicationIdIn(registry, meta, now);

    const copy = {
      lang: preset.lang,
      enVariant: preset.enVariant,
      options: structuredClone(preset.options),
    };
    // §5.4: the photo is unchecked when the application is in English and the preset in French.
    applyLanguage(copy, meta.lang === 'fr' ? 'fr' : meta.enVariant);

    const idsSaved = await store.write('ids.json', registry, { locked: true });
    const application = await store.write<ApplicationFile>(
      appRel(id, 'application.json'),
      {
        schemaVersion: SCHEMA_VERSION,
        revision: 1,
        id,
        createdAt: localDate(now),
        company: meta.company,
        jobTitle: meta.jobTitle,
        offerReference: meta.offerReference,
        url: meta.url,
        lang: meta.lang,
        enVariant: meta.enVariant,
        basePresetId: preset.id,
        fileLabel: meta.fileLabel,
        activeLetter: { fr: null, en: null },
        exports: [],
        tracking: null,
      },
      { locked: true },
    );
    const selection = await store.write<ApplicationSelectionFile>(
      appRel(id, 'selection.json'),
      {
        schemaVersion: SCHEMA_VERSION,
        revision: 1,
        selection: structuredClone(preset.selection),
        options: copy.options,
        template: structuredClone(preset.template),
      },
      { locked: true },
    );
    await writeFileAtomic(store.abs(appRel(id, 'offer.md')), `${offer.text}\n`);
    return {
      application,
      selection,
      offer: { text: offer.text, removed: offer.removed, flags: flagInstructions(offer.text) },
      writes: [
        { file: 'ids.json', revision: idsSaved.revision },
        { file: appRel(id, 'application.json'), revision: application.revision },
        { file: appRel(id, 'selection.json'), revision: selection.revision },
        { file: appRel(id, 'offer.md'), revision: null },
      ],
    };
  });
}

/** The offer of an application (offer.md), with the sentences to check; empty when absent. */
export async function readOffer(store: DataStore, id: string): Promise<OfferView> {
  const rel = appRel(id, 'offer.md');
  if (!(await store.exists(rel))) return { text: '', flags: [] };
  const text = (await store.readRaw(rel))
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .trimEnd();
  return { text, flags: flagInstructions(text) };
}

export interface ApplicationSummary {
  id: string;
  createdAt: string;
  company: string;
  jobTitle: string;
  offerReference: string | null;
  lang: Lang;
  enVariant: ApplicationFile['enVariant'];
  basePresetId: string;
  exports: number;
  analysis: { createdAt: string; terms: number; history: number } | null;
}

/** Applications, newest first. An unreadable folder is reported instead of hiding the others. */
export async function listApplications(
  store: DataStore,
): Promise<{ applications: ApplicationSummary[]; invalid: Array<{ id: string; message: string }> }> {
  const applications: ApplicationSummary[] = [];
  const invalidList: Array<{ id: string; message: string }> = [];
  for (const id of await store.listApplicationIds()) {
    try {
      const { application: a, analysis } = await store.loadApplication(id);
      applications.push({
        id: a.id,
        createdAt: a.createdAt,
        company: a.company,
        jobTitle: a.jobTitle,
        offerReference: a.offerReference,
        lang: a.lang,
        enVariant: a.enVariant,
        basePresetId: a.basePresetId,
        exports: a.exports.length,
        analysis: analysis?.current
          ? {
              createdAt: analysis.current.createdAt,
              terms: analysis.current.terms.length,
              history: analysis.history.length,
            }
          : null,
      });
    } catch (err) {
      const e = err as StoreError;
      const issues = (e.details?.issues as string[] | undefined) ?? [];
      invalidList.push({ id, message: [e.message, ...issues.slice(0, 3)].join(' ; ') });
    }
  }
  applications.sort((x, y) => y.createdAt.localeCompare(x.createdAt) || y.id.localeCompare(x.id));
  return { applications, invalid: invalidList };
}

const selectionInput = z.strictObject({ lang: langSchema, enVariant, fileLabel: fileLabelSchema });

/**
 * Saves the selection of an application edited in the interface (selection.json, with the revision
 * read: 409 STALE_REVISION otherwise). Language, English variant and file label live in
 * application.json (§9.2): they are merged there when they change. The starting preset is untouched.
 */
export async function updateApplicationSelection(
  store: DataStore,
  id: string,
  input: {
    selection: unknown;
    options: unknown;
    template: unknown;
    lang: unknown;
    enVariant: unknown;
    fileLabel: unknown;
    expectedRevision: number;
  },
): Promise<ApplicationWrite> {
  return store.withLock(async () => {
    const loaded = await store.loadApplication(id);
    const current = loaded.selection;
    if (current.revision !== input.expectedRevision) {
      throw new StoreError(
        'STALE_REVISION',
        'cette candidature a été modifiée ailleurs depuis son chargement',
        {
          file: appRel(id, 'selection.json'),
          currentRevision: current.revision,
          current: { application: loaded.application, selection: current },
        },
        'rechargez la version enregistrée, ou gardez vos modifications pour les enregistrer par-dessus',
      );
    }
    const { value, issues } = prepare(applicationSelectionFile, {
      schemaVersion: current.schemaVersion,
      revision: current.revision,
      selection: input.selection,
      options: input.options,
      template: input.template,
    });
    const { value: meta, issues: metaIssues } = prepare(selectionInput, {
      lang: input.lang,
      enVariant: input.enVariant,
      fileLabel: input.fileLabel,
    });
    if (!value || !meta) throw invalid('sélection de candidature invalide', [...issues, ...metaIssues]);

    const writes: WriteRef[] = [];
    const selection = await store.write(appRel(id, 'selection.json'), value, {
      expectedRevision: current.revision,
      locked: true,
    });
    writes.push({ file: appRel(id, 'selection.json'), revision: selection.revision });
    let application = loaded.application;
    if (
      application.lang !== meta.lang ||
      application.enVariant !== meta.enVariant ||
      application.fileLabel !== meta.fileLabel
    ) {
      application = await store.write(appRel(id, 'application.json'), { ...application, ...meta }, { locked: true });
      writes.push({ file: appRel(id, 'application.json'), revision: application.revision });
    }
    return { application, selection, writes };
  });
}

export interface RejectedTerm {
  index: number;
  term: string | null;
  reason: string;
}

/** Terms of an analysis file: `{ terms }`, or the shape of analysis.json (`{ current: { terms } }`). */
function termsOf(input: unknown): { terms: unknown[]; origin: OfferAnalysis['origin'] } | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  const src = o.current && typeof o.current === 'object' ? (o.current as Record<string, unknown>) : o;
  if (!Array.isArray(src.terms)) return null;
  return { terms: src.terms, origin: src.origin === 'claude' ? 'claude' : 'utilisateur' };
}

const sentenceKey = (s: string) => ` ${normalizeForMatch(s)} `;

/**
 * Adds an offer analysis to the history (F-CAN-02, the rule of MCP-10): the current analysis moves to
 * `history`, nothing is deleted. A term whose `sourceSentence`, once normalized, is not a substring of
 * offer.md is rejected, like an invalid term; the others are saved. Lot 4: the interface imports a JSON
 * file; `save_offer_analysis` (MCP-10) calls this same function.
 */
export async function saveOfferAnalysis(
  store: DataStore,
  id: string,
  input: unknown,
  now = new Date(),
): Promise<{ analysis: AnalysisFile; rejected: RejectedTerm[]; writes: WriteRef[] }> {
  const parsed = termsOf(input);
  if (!parsed) {
    throw invalid('analyse invalide', [
      { path: 'terms', message: 'liste de termes attendue ({ terms: [...] } ou analysis.json)' },
    ]);
  }
  await store.loadApplication(id); // NOT_FOUND first
  const offerKey = sentenceKey((await readOffer(store, id)).text);
  const accepted: OfferTerm[] = [];
  const rejected: RejectedTerm[] = [];
  parsed.terms.forEach((raw, index) => {
    const { value, issues } = prepare(offerTerm, raw);
    const name =
      raw && typeof raw === 'object' && typeof (raw as { term?: unknown }).term === 'string'
        ? (raw as { term: string }).term
        : null;
    if (!value) {
      rejected.push({
        index,
        term: name,
        reason: issues.map((i) => (i.path ? `${i.path} : ${i.message}` : i.message)).join(' ; '),
      });
    } else if (!offerKey.includes(sentenceKey(value.sourceSentence))) {
      rejected.push({ index, term: value.term, reason: "phrase source absente de l'offre (offer.md)" });
    } else accepted.push(value);
  });
  if (accepted.length === 0) {
    throw new StoreError('INVALID_DATA', 'analyse refusée : aucun terme valide', {
      issues: rejected.map((r) => ({ path: `terms.${r.index}`, message: `${r.term ?? '?'} : ${r.reason}` })),
      rejected,
    });
  }
  return store.withLock(async () => {
    const rel = appRel(id, 'analysis.json');
    const current: AnalysisFile = (await store.exists(rel))
      ? await store.read<AnalysisFile>(rel)
      : { schemaVersion: SCHEMA_VERSION, revision: 0, current: null, history: [] };
    const next: AnalysisFile = {
      ...current,
      history: current.current ? [...current.history, current.current] : current.history,
      current: { origin: parsed.origin, createdAt: now.toISOString(), terms: accepted },
    };
    const saved = await store.write(rel, next, {
      locked: true,
      ...(current.revision > 0 ? { expectedRevision: current.revision } : {}),
    });
    return { analysis: saved, rejected, writes: [{ file: rel, revision: saved.revision }] };
  });
}

/**
 * Creates `<base>/<stamp>[-n]_<suffix>/` and returns its name. `mkdir` without `recursive` fails on an
 * existing folder, so two exports in the same second never share one (no export overwrites another).
 */
export async function newTimestampedDir(base: string, stamp: string, suffix: string): Promise<string> {
  await mkdir(base, { recursive: true });
  for (let n = 1; ; n++) {
    const name = `${stamp}${n > 1 ? `-${n}` : ''}_${suffix}`;
    try {
      await mkdir(path.join(base, name));
      return name;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
    }
  }
}

export interface ApplicationExportInput {
  /** `letter`: a cover letter, in exports/<AAAAMMJJ-HHmmss>_lettre/ (ADR 0016); `cv` by default. */
  kind?: 'cv' | 'letter';
  fileName: string;
  bytes: Uint8Array;
  format: 'pdf' | 'docx';
  lang: Lang;
  layout: Layout;
  pages: number;
  /** Exports are refused on a blocking criterion: only these two outcomes are traced. */
  atsCheck: ExportEntry['atsCheck'];
  /**
   * SHA-256 the file must have once read back (T-ATS-13: the PDF is the preview buffer). On a difference,
   * the folder just created is removed and nothing is traced.
   */
  expectedSha256?: string;
}

/**
 * Adds a timestamped export to an application (F-CAN-03): `exports/<AAAAMMJJ-HHmmss>[-n]_<layout>/`,
 * file written with `wx`, read back for its SHA-256, then traced in application.json (date, language,
 * model, ATS-check result, sha256, `sent: false`). Shared by the interface export and by `render` with
 * `saveToApplication` (MCP-19): one function, one trace.
 */
export async function addApplicationExport(
  store: DataStore,
  id: string,
  input: ApplicationExportInput,
  now = new Date(),
): Promise<{ entry: ExportEntry; file: string; absolutePath: string; sha256: string; writes: WriteRef[] }> {
  await store.loadApplication(id); // NOT_FOUND before any write
  const base = store.abs(appRel(id, 'exports'));
  const kind = input.kind ?? 'cv';
  const dirName = await newTimestampedDir(base, exportStamp(now), kind === 'letter' ? 'lettre' : input.layout);
  const absolutePath = path.join(base, dirName, input.fileName);
  await writeFile(absolutePath, input.bytes, { flag: 'wx' });
  const digest = sha256(await readFile(absolutePath));
  if (input.expectedSha256 && digest !== input.expectedSha256) {
    await rm(path.join(base, dirName), { recursive: true, force: true });
    throw new StoreError(
      'INVALID_DATA',
      "copie de l'export altérée à l'écriture : SHA-256 différent de l'aperçu (T-ATS-13)",
      {
        file: appRel(id, `exports/${dirName}/${input.fileName}`),
      },
    );
  }
  const entry: ExportEntry = {
    dir: `exports/${dirName}/`,
    file: input.fileName,
    kind,
    format: input.format,
    lang: input.lang,
    layout: input.layout,
    createdAt: now.toISOString(),
    pages: input.pages,
    atsCheck: input.atsCheck,
    sha256: digest,
    sent: false,
  };
  const saved = await store.withLock(async () => {
    const { application } = await store.loadApplication(id);
    return store.write(
      appRel(id, 'application.json'),
      { ...application, exports: [...application.exports, entry] },
      { expectedRevision: application.revision, locked: true },
    );
  });
  const file = appRel(id, `${entry.dir}${entry.file}`);
  return {
    entry,
    file,
    absolutePath,
    sha256: digest,
    writes: [
      { file: appRel(id, 'application.json'), revision: saved.revision },
      { file, revision: null },
    ],
  };
}
