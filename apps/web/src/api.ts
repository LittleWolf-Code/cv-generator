// API client: same origin through the Vite proxy; every call carries the X-CV-Token injected in the
// page at startup (NF-01). Writes return the files they changed with their new revision: the live
// stream ignores those events, the interface having already reloaded (§8.4).
import type {
  AnalysisFile,
  ApplicationFile,
  ApplicationSelectionFile,
  AtsReport,
  Bilingual,
  CollectionName,
  Coverage,
  ExportEntry,
  InstructionFlag,
  DiffSegment,
  Identity,
  Lang,
  LetterCheck,
  LetterVersionFile,
  Library,
  LinkedInColumns,
  LinkedInIdentity,
  LinkedInIncomplete,
  McpLogEntry,
  PresetFile,
  ProposalFile,
  ProposalStatus,
  SectionKey,
} from '@cv/core';

export type {
  AnalysisFile,
  ApplicationFile,
  ApplicationSelectionFile,
  CollectionName,
  Coverage,
  Library,
  Identity,
  Bilingual,
  Lang,
  DiffSegment,
  McpLogEntry,
  ProposalStatus,
  PresetFile,
  SectionKey,
};

/** Library collections (same list as the core schema, which the browser does not load: no Zod). */
export const COLLECTION_NAMES = [
  'titles',
  'summaries',
  'experiences',
  'education',
  'projects',
  'skills',
  'certifications',
  'languages',
  'interests',
  'categories',
] as const satisfies readonly CollectionName[];

/** A text in both languages (a missing translation falls back on the other language). */
export type Labels = Record<Lang, string>;

/** Library tree, independent of the selection: the interface applies the preset being edited (ADR 0011). */
export interface TreeNode {
  id: string;
  collection: CollectionName;
  parentId: string | null;
  label: Labels;
  detail: string | null;
  archived: boolean;
  locked: boolean;
  category: string | null;
  variants: Array<{ id: string; label: string | null; text: Labels }>;
  untranslated: Lang[];
  warnings: number;
  /** Language without CEFR level: « niveau CECRL à préciser », blocks the export of that language. */
  cefrMissing: boolean;
  search: string;
  children: TreeNode[];
}

export interface TreeGroup {
  key: 'titles' | SectionKey | 'categories';
  label: string;
  collection: CollectionName;
  section: SectionKey | null;
  fixedOrder: boolean;
  categories: Array<{ id: string; label: string }>;
  defaults: Record<string, unknown>;
  items: TreeNode[];
}

export interface LibraryResponse {
  identity: { revision: number; value: Identity | null };
  library: Library;
  revisions: Record<CollectionName, number>;
  groups: TreeGroup[];
  integrity: { errors: Issue[]; warnings: Issue[] };
  untranslated: { fr: number; en: number };
}

export interface RenderResponse {
  /** Coverage of the offer terms (applications with an analysis), recomputed at each preview. */
  coverage: Coverage | null;
  fileName: string | null;
  pdfBase64: string;
  sha256: string;
  pages: number;
  fillRatio: number;
  overflowLines: number;
  compileMs: number;
  report: AtsReport;
}

/** Export of a preset (F-EXP-01 to 04): the report carries T-ATS-13 and, for a DOCX, T-DOCX-01 to 03. */
export interface ExportResponse {
  fileName: string;
  format: 'pdf' | 'docx';
  /** Timestamped copy: in the application (relative to data/), or under out/exports/ for a preset; or null. */
  savedTo: string | null;
  /** Trace added to application.json (applications only). */
  entry: ExportEntry | null;
  writes: WriteRef[];
  sha256: string;
  previewSha256: string;
  report: AtsReport;
  /** DOCX bytes; null for a PDF, which is the preview buffer the interface already holds. */
  fileBase64: string | null;
  createdAt: string;
}

export interface PhotoWrite {
  identity: Identity;
  revision: number;
  writes: WriteRef[];
  photo?: { width: number; height: number; quality: number; bytes: number };
}

export interface Issue {
  path: string;
  message: string;
}

export interface WriteRef {
  file: string;
  /** null for a file without revision (offer.md, an exported file). */
  revision: number | null;
}

export type AnyItem = Record<string, unknown>;

export interface ItemWrite {
  item: AnyItem;
  revision: number;
  writes: WriteRef[];
  warnings: Issue[];
}

export interface Line {
  label: string;
  text: string;
  segments?: DiffSegment[];
}

export interface SelectionRow {
  key: string;
  op: 'add' | 'remove' | 'variant';
  id: string;
  label: string;
  detail: string | null;
  rationale: string | null;
  applicable: boolean;
  reason: string | null;
}

export interface ProposalView {
  id: string;
  type: ProposalFile['type'];
  status: ProposalStatus;
  storedStatus: ProposalStatus;
  origin: ProposalFile['origin'];
  source: ProposalFile['source'];
  createdAt: string;
  target: string;
  collection: CollectionName | null;
  rationale: string | null;
  checks: ProposalFile['checks'];
  sensitive: boolean;
  /** Why it is left out of a batch acceptance (sensitive fact, date to check), or null. */
  batchExcluded: string | null;
  staleReason: 'changed' | 'missing' | null;
  applicable: { ok: boolean; reason: string | null };
  dependsOn: Array<{ id: string; status: ProposalStatus | 'introuvable'; label: string }>;
  supersedes: string | null;
  duplicateOf: string | null;
  diff: Array<{ label: string; segments: DiffSegment[] }>;
  conflict: { base: Line[] | null; current: Line[] | null; proposed: Line[] } | null;
  selection: SelectionRow[] | null;
  editable: unknown;
  resolution: ProposalFile['resolution'];
  sourceFile: string | null;
  userStatement: string | null;
  payload: unknown;
}

export interface ProposalsResponse {
  proposals: ProposalView[];
  invalid: Array<{ file: string; message: string }>;
  counts: { pending: number; stale: number; total: number };
  missing: string[];
  /** Categories still proposed (ADR 0023): `id` is the reserved category id. */
  pendingCategories: PendingCategory[];
}

/** A category proposed but not yet validated, a skill may target it (ADR 0023). */
export interface PendingCategory {
  id: string;
  label: string;
  proposalId: string;
}

/** A version of a cover letter, with the warnings of the guardrails computed on read (ADR 0016). */
export type LetterVersion = LetterVersionFile & { checks: LetterCheck[] };

export interface LettersResponse {
  active: Record<Lang, number | null>;
  letters: Record<Lang, LetterVersion[]>;
}

export interface LetterRenderResponse {
  fileName: string | null;
  pdfBase64: string;
  sha256: string;
  pages: number;
  fillRatio: number;
  overflowLines: number;
  compileMs: number;
  report: AtsReport;
  /** The version rendered is the active one (the only one that exports). */
  active: boolean;
}

export interface LetterDraft {
  recipient: LetterVersionFile['recipient'];
  paragraphs: Array<{ role: string; text: string }>;
  sourceIds: string[];
  basedOn: number | null;
}

/** A file of import/ (names only, §7.6). */
export interface ImportFileRow {
  name: string;
  type: string;
  size: number;
  /** `linkedin`: ZIP or expected CSV of the LinkedIn export; `cv`: PDF or DOCX (imported through Claude). */
  kind: 'linkedin' | 'cv' | 'other';
}

/** Report of the LinkedIn import (F-IMP-02, ADR 0015). */
export interface LinkedInReport {
  dryRun: boolean;
  source: string;
  files: Array<{ file: string; rows: number; columns: LinkedInColumns }>;
  skipped: string[];
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
  identityFound: Record<keyof LinkedInIdentity, boolean>;
  writes: WriteRef[];
}

export type { LinkedInIdentity };

/** What the selection screen edits: a preset, or an application shown as a preset (ADR 0013). */
export type EditTarget = { kind: 'preset'; id: string } | { kind: 'application'; id: string };

export interface ApplicationSummary {
  id: string;
  createdAt: string;
  company: string;
  jobTitle: string;
  offerReference: string | null;
  lang: Lang;
  enVariant: 'en-GB' | 'en-US';
  basePresetId: string;
  exports: number;
  analysis: { createdAt: string; terms: number; history: number } | null;
}

/** The offer (untrusted data, §7.5) with the sentences that look like instructions for an AI. */
export interface OfferView {
  text: string;
  flags: InstructionFlag[];
}

export interface ApplicationDetail {
  application: ApplicationFile;
  selection: ApplicationSelectionFile;
  analysis: AnalysisFile | null;
  offer: OfferView;
  basePreset: { id: string; name: string; archived: boolean } | null;
}

export interface ApplicationWrite {
  application: ApplicationFile;
  selection: ApplicationSelectionFile;
  writes: WriteRef[];
}

export interface CreateApplicationInput {
  company: string;
  jobTitle: string;
  offerReference: string | null;
  url: string | null;
  lang: Lang;
  enVariant: 'en-GB' | 'en-US';
  fileLabel: string | null;
  basePresetId: string;
  offerText: string | null;
  offerFile: string | null;
}

export interface RejectedTerm {
  index: number;
  term: string | null;
  reason: string;
}

/** Part of a preset rendered by the live preview (F-SEL-06). */
export type PresetDraft = Pick<PresetFile, 'lang' | 'enVariant' | 'template' | 'selection' | 'options'>;

/** Journal of the MCP requests (ADR 0024), one month, the most recent requests first. */
export interface McpLogResponse {
  available: boolean;
  months: string[];
  month: string | null;
  entries: McpLogEntry[];
  invalidLines: number;
  truncated: boolean;
}

export interface PresetWrite {
  preset: PresetFile;
  writes: WriteRef[];
}

export interface Resolution {
  proposal: ProposalFile;
  writes: WriteRef[];
  dependencies: string[];
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string | null,
    readonly details: Record<string, unknown>,
    readonly hint: string | null,
  ) {
    super(message);
  }

  /** Field issues of a 422 (sanitization or schema), with their dot path. */
  get issues(): Issue[] {
    const raw = this.details.issues;
    if (!Array.isArray(raw)) return [];
    return raw.map((i) => (typeof i === 'string' ? { path: '', message: i } : (i as Issue)));
  }
}

export function token(): string {
  return document.querySelector<HTMLMetaElement>('meta[name="cv-token"]')?.content ?? '';
}

/** Online instance (ADR 0018): the page then offers to sign out. */
export function isOnline(): boolean {
  return document.querySelector('meta[name="cv-online"]') !== null;
}

/** Online instance: a 401 means the session is over; back to the sign-in page, then here again. */
export function signInAgainIfNeeded(res: Response): void {
  if (res.status !== 401) return;
  const here = window.location.pathname + window.location.search;
  window.location.assign(`/connexion?suite=${encodeURIComponent(here)}`);
}

export async function signOut(): Promise<void> {
  await fetch('/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  window.location.assign('/connexion');
}

/** `file@revision` of the interface's own writes, consumed by the live stream. */
const ownWrites = new Set<string>();

export function isOwnWrite(file: string, revision: number | null): boolean {
  const key = `${file}@${revision}`;
  if (!ownWrites.has(key)) return false;
  ownWrites.delete(key);
  return true;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('X-CV-Token', token());
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');
  const res = await fetch(path, { ...init, headers });
  signInAgainIfNeeded(res);
  const body = (await res.json().catch(() => ({}))) as {
    message?: string;
    code?: string;
    details?: Record<string, unknown>;
    hint?: string | null;
    writes?: WriteRef[];
  };
  if (!res.ok) {
    throw new ApiError(
      res.status,
      body.message ?? `erreur ${res.status}`,
      body.code ?? null,
      body.details ?? {},
      body.hint ?? null,
    );
  }
  for (const w of body.writes ?? []) ownWrites.add(`${w.file}@${w.revision}`);
  return body as T;
}

const post = <T>(path: string, data: unknown = {}) => call<T>(path, { method: 'POST', body: JSON.stringify(data) });
const lib = (collection: CollectionName, id?: string) =>
  `/api/library/${collection}${id ? `/${encodeURIComponent(id)}` : ''}`;

export const api = {
  library: () => call<LibraryResponse>('/api/library'),
  render: (target: EditTarget, draft?: PresetDraft) =>
    post<RenderResponse>('/api/render', {
      ...(target.kind === 'preset' ? { presetId: target.id } : { applicationId: target.id }),
      ...(draft ? { draft } : {}),
    }),

  presets: () => call<{ presets: PresetFile[] }>('/api/presets'),
  createPreset: (name: string, from: string | null) => post<PresetWrite>('/api/presets', { name, from }),
  savePreset: (preset: PresetFile, expectedRevision: number) =>
    call<PresetWrite>(`/api/presets/${encodeURIComponent(preset.id)}`, {
      method: 'PUT',
      body: JSON.stringify({ preset, expectedRevision }),
    }),
  archivePreset: (id: string, archived: boolean) =>
    post<PresetWrite>(`/api/presets/${encodeURIComponent(id)}/archive`, { archived }),
  setDefaultPreset: (id: string) => post<PresetWrite>(`/api/presets/${encodeURIComponent(id)}/default`),

  check: (
    collection: CollectionName,
    item: unknown,
    id: string | null,
    opts: { withPendingCategories?: boolean } = {},
  ) => post<{ issues: Issue[]; warnings: Issue[] }>(`${lib(collection)}/check`, { item, id, ...opts }),
  create: (collection: CollectionName, item: unknown) => post<ItemWrite>(lib(collection), { item }),
  update: (collection: CollectionName, id: string, item: unknown, expectedRevision: number, base: unknown) =>
    call<ItemWrite>(lib(collection, id), { method: 'PUT', body: JSON.stringify({ item, expectedRevision, base }) }),
  duplicate: (collection: CollectionName, id: string) => post<ItemWrite>(`${lib(collection, id)}/duplicate`),
  archive: (collection: CollectionName, id: string, archived: boolean) =>
    post<ItemWrite>(`${lib(collection, id)}/archive`, { archived }),
  remove: (collection: CollectionName, id: string) =>
    call<{ writes: WriteRef[] }>(lib(collection, id), { method: 'DELETE', body: JSON.stringify({ confirm: true }) }),
  exportCv: (target: EditTarget, format: 'pdf' | 'docx', previewSha256: string) =>
    post<ExportResponse>('/api/export', {
      ...(target.kind === 'preset' ? { presetId: target.id } : { applicationId: target.id }),
      format,
      previewSha256,
    }),

  offers: () => call<{ files: Array<{ name: string; size: number; modifiedAt: string }> }>('/api/offers'),
  importFiles: () => call<{ files: ImportFileRow[]; available: boolean }>('/api/import/files'),
  letters: (id: string) => call<LettersResponse>(`/api/applications/${encodeURIComponent(id)}/letters`),
  saveLetter: (id: string, lang: Lang, draft: LetterDraft) =>
    post<{ version: LetterVersion; checks: LetterCheck[]; writes: WriteRef[] }>(
      `/api/applications/${encodeURIComponent(id)}/letters/${lang}`,
      draft,
    ),
  setActiveLetter: (id: string, lang: Lang, version: number | null) =>
    post<{ writes: WriteRef[] }>(`/api/applications/${encodeURIComponent(id)}/letters/${lang}/active`, { version }),
  finalizeLetter: (id: string, lang: Lang, version: number) =>
    post<{ writes: WriteRef[] }>(`/api/applications/${encodeURIComponent(id)}/letters/${lang}/${version}/final`, {
      confirm: true,
    }),
  renderLetter: (applicationId: string, lang: Lang, version: number) =>
    post<LetterRenderResponse>('/api/letters/render', { applicationId, lang, version }),
  exportLetter: (applicationId: string, lang: Lang, format: 'pdf' | 'docx', previewSha256: string) =>
    post<ExportResponse>('/api/letters/export', { applicationId, lang, format, previewSha256 }),
  importLinkedIn: (fileName: string | null, lang: Lang = 'fr') =>
    post<LinkedInReport>('/api/import/linkedin', { fileName, lang }),
  linkedInIdentity: (fileName: string | null) =>
    call<{ identity: LinkedInIdentity }>(
      `/api/import/linkedin/identity${fileName ? `?file=${encodeURIComponent(fileName)}` : ''}`,
    ),
  applications: () =>
    call<{ applications: ApplicationSummary[]; invalid: Array<{ id: string; message: string }> }>('/api/applications'),
  application: (id: string) => call<ApplicationDetail>(`/api/applications/${encodeURIComponent(id)}`),
  createApplication: (input: CreateApplicationInput) =>
    post<ApplicationWrite & { offer: OfferView & { removed: number } }>('/api/applications', input),
  saveApplicationSelection: (id: string, draft: PresetDraft & { fileLabel: string }, expectedRevision: number) =>
    call<ApplicationWrite>(`/api/applications/${encodeURIComponent(id)}/selection`, {
      method: 'PUT',
      body: JSON.stringify({ ...draft, expectedRevision }),
    }),
  importAnalysis: (id: string, analysis: unknown) =>
    post<{ analysis: AnalysisFile; rejected: RejectedTerm[]; writes: WriteRef[] }>(
      `/api/applications/${encodeURIComponent(id)}/analysis`,
      { analysis },
    ),
  /** `image`: base64 JPEG already cropped to 3:4 by the interface (well under the 1 MB body limit). */
  uploadPhoto: (image: string, expectedRevision: number) =>
    post<PhotoWrite>('/api/profile/photo', { image, expectedRevision }),
  removePhoto: (expectedRevision: number) =>
    call<PhotoWrite>('/api/profile/photo', {
      method: 'DELETE',
      body: JSON.stringify({ confirm: true, expectedRevision }),
    }),
  /** The stored photo as an object URL (fetched with the token), or null without photo. */
  async photoUrl(): Promise<string | null> {
    const res = await fetch('/api/profile/photo', { headers: { 'X-CV-Token': token() } });
    signInAgainIfNeeded(res);
    if (res.status === 404) return null;
    if (!res.ok) throw new ApiError(res.status, `photo illisible (erreur ${res.status})`, null, {}, null);
    return URL.createObjectURL(await res.blob());
  },
  saveIdentity: (identity: unknown, expectedRevision: number, base: unknown) =>
    call<{ identity: Identity; revision: number; writes: WriteRef[] }>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify({ identity, expectedRevision, base }),
    }),

  proposals: (query: { ids?: string[]; all?: boolean } = {}) => {
    const params = new URLSearchParams();
    if (query.ids?.length) params.set('ids', query.ids.join(','));
    if (query.all) params.set('all', '1');
    const qs = params.toString();
    return call<ProposalsResponse>(`/api/proposals${qs ? `?${qs}` : ''}`);
  },
  accept: (id: string, body: { edited?: unknown; elements?: string[]; withDependencies?: boolean } = {}) =>
    post<Resolution>(`/api/proposals/${id}/accept`, body),
  reject: (id: string, reason: string | null) => post<Resolution>(`/api/proposals/${id}/reject`, { reason }),
  acceptBatch: (ids: string[]) =>
    post<{ accepted: string[]; skipped: Array<{ id: string; reason: string }>; writes: WriteRef[] }>(
      '/api/proposals/accept-batch',
      { ids },
    ),

  /** Backup ZIP (F-LIB-09): fetched with the token, then saved by the browser. */
  async backup(): Promise<void> {
    const res = await fetch('/api/backup.zip', { headers: { 'X-CV-Token': token() } });
    signInAgainIfNeeded(res);
    if (!res.ok) throw new ApiError(res.status, `sauvegarde impossible (erreur ${res.status})`, null, {}, null);
    const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'cv-data.zip';
    saveBlob(await res.blob(), name);
  },
  mcpLog: (month: string | null) =>
    call<McpLogResponse>(`/api/mcp-log${month ? `?month=${encodeURIComponent(month)}` : ''}`),
  /** Reset of data/ (F-LIB-09c, ADR 0021); `backup`: the ZIP copy kept on the server (`out/backups/…`). */
  resetData: () => post<{ backup: string; writes: WriteRef[] }>('/api/reset', { confirm: true }),
};

/** Hands a file to the browser's download (a plain link cannot send X-CV-Token). */
export function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** SHA-256 in hexadecimal (Web Crypto: available on 127.0.0.1, a secure context). */
export async function sha256Hex(data: BufferSource): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function decodeBase64(base64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
