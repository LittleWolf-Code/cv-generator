// Local API (Hono): library (read and edit), identity and photo, presets, applications (offer, selection,
// analysis, F-CAN-01 to 03), proposals queue, render (PDF + ATS report + offer coverage, also of an
// unsaved draft), export (PDF and DOCX, F-EXP-01 to 04), backup ZIP, reset of the data, journal of the
// MCP requests (ADR 0024) and server-sent events fed by the data watcher.
import path from 'node:path';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import {
  checkLibraryIntegrity,
  COLLECTIONS,
  computeCoverage,
  MCP_LOG_MONTH_RE,
  OFFER_MAX_CHARS,
  openCategoryProposals,
  pick,
  presetFile,
  untranslatedFields,
  type CollectionName,
  type Coverage,
  type Lang,
} from '@cv/core';
import { exportCv, exportLetter, type ExportResult } from './export.js';
import {
  acceptBatch,
  acceptProposal,
  backupFileName,
  checkItem,
  createApplication,
  createItem,
  createLetterVersion,
  createPreset,
  deleteItem,
  finalizeLetter,
  letterChecks,
  listLetterVersions,
  duplicateItem,
  importLinkedIn,
  isLinkedInFile,
  linkedInIdentity,
  listApplications,
  listImportFiles,
  listImportOffers,
  prepare,
  readOffer,
  readPhoto,
  rejectProposal,
  removePhoto,
  resetDataDir,
  saveIdentity,
  setActiveLetter,
  saveOfferAnalysis,
  savePhoto,
  setDefaultPreset,
  setItemArchived,
  setPresetArchived,
  sha256,
  StoreError,
  subjectContext,
  updateApplicationSelection,
  updateItem,
  updatePreset,
  zipDataDir,
  type DataChange,
  type DataStore,
} from '@cv/store';
import {
  PhotoError,
  processPhoto,
  renderCv,
  renderLetter,
  resolveLetterTarget,
  resolveTarget,
  RenderError,
} from '@cv/render';
import { PasskeyAuth, type AuthOptions } from './auth.js';
import type { DataEvents } from './events.js';
import { readMcpLog } from './mcp-log.js';
import { buildProposalViews } from './proposal-views.js';
import { security, type SecurityOptions } from './security.js';
import { libraryTree } from './tree.js';

export interface AppOptions extends SecurityOptions {
  store: DataStore;
  /** Changes of the data directory, relayed to SSE clients. */
  events?: DataEvents;
  version?: string;
  /** Root of the timestamped export copies of presets (`out/`); without it, they are only downloaded. */
  outDir?: string;
  /** `import/` (offers in import/offres/, §7.6); a copy of the fictitious offers in the demo. */
  importDir?: string | null;
  /** Passkey sign-in, required with a public origin and only with one (ADR 0018). */
  auth?: AuthOptions;
}

const renderBody = z.union([
  /** `draft`: unsaved preset being edited (selection, options, template, language), rendered without any write. */
  z.strictObject({ presetId: z.string(), lang: z.enum(['fr', 'en']).optional(), draft: z.unknown().optional() }),
  /** `draft`: unsaved selection of the application being edited (same shape as a preset draft). */
  z.strictObject({ applicationId: z.string(), lang: z.enum(['fr', 'en']).optional(), draft: z.unknown().optional() }),
]);
const presetDraft = presetFile.pick({ lang: true, enVariant: true, template: true, selection: true, options: true });
const collectionParam = z.enum(COLLECTIONS);
const revisionField = z.number().int().nonnegative();
const bodies = {
  create: z.strictObject({ item: z.unknown() }),
  /** `withPendingCategories`: form of "modifier puis accepter", a skill may target a pending category (ADR 0023). */
  check: z.strictObject({
    item: z.unknown(),
    id: z.string().nullable().optional(),
    withPendingCategories: z.boolean().optional(),
  }),
  update: z.strictObject({ item: z.unknown(), expectedRevision: revisionField, base: z.unknown().optional() }),
  archive: z.strictObject({ archived: z.boolean() }),
  remove: z.strictObject({ confirm: z.literal(true) }),
  reset: z.strictObject({ confirm: z.literal(true) }),
  identity: z.strictObject({ identity: z.unknown(), expectedRevision: revisionField, base: z.unknown().optional() }),
  accept: z.strictObject({
    edited: z.unknown().optional(),
    elements: z.array(z.string()).optional(),
    withDependencies: z.boolean().optional(),
  }),
  reject: z.strictObject({ reason: z.string().max(2000).nullable().optional() }),
  batch: z.strictObject({ ids: z.array(z.string()).min(1).max(500) }),
  presetCreate: z.strictObject({ name: z.unknown(), from: z.string().nullable().optional() }),
  presetUpdate: z.strictObject({ preset: z.unknown(), expectedRevision: revisionField }),
  /** Base64 JPEG/PNG/WebP (data URL accepted), already cropped by the interface: well under the 1 MB body limit. */
  photo: z.strictObject({ image: z.string().min(1), expectedRevision: revisionField }),
  photoRemove: z.strictObject({ confirm: z.literal(true), expectedRevision: revisionField }),
  export: z.union([
    z.strictObject({
      presetId: z.string(),
      format: z.enum(['pdf', 'docx']),
      previewSha256: z.string().regex(/^[0-9a-f]{64}$/),
    }),
    z.strictObject({
      applicationId: z.string(),
      format: z.enum(['pdf', 'docx']),
      previewSha256: z.string().regex(/^[0-9a-f]{64}$/),
    }),
  ]),
  applicationCreate: z.strictObject({
    company: z.unknown(),
    jobTitle: z.unknown(),
    offerReference: z.unknown().optional(),
    url: z.unknown().optional(),
    lang: z.unknown(),
    enVariant: z.unknown().optional(),
    fileLabel: z.unknown().optional(),
    basePresetId: z.unknown(),
    offerText: z
      .string()
      .max(OFFER_MAX_CHARS * 2)
      .nullable()
      .optional(),
    offerFile: z.string().max(255).nullable().optional(),
  }),
  applicationSelection: z.strictObject({
    selection: z.unknown(),
    options: z.unknown(),
    template: z.unknown(),
    lang: z.unknown(),
    enVariant: z.unknown(),
    fileLabel: z.unknown(),
    expectedRevision: revisionField,
  }),
  analysis: z.strictObject({ analysis: z.unknown() }),
  letterDraft: z.strictObject({
    recipient: z.unknown().optional(),
    paragraphs: z.unknown(),
    sourceIds: z.unknown().optional(),
    basedOn: z.number().int().positive().nullable().optional(),
  }),
  letterActive: z.strictObject({ version: z.number().int().positive().nullable() }),
  letterFinal: z.strictObject({ confirm: z.literal(true) }),
  letterRender: z.strictObject({
    applicationId: z.string(),
    lang: z.enum(['fr', 'en']),
    version: z.number().int().positive(),
  }),
  letterExport: z.strictObject({
    applicationId: z.string(),
    lang: z.enum(['fr', 'en']),
    format: z.enum(['pdf', 'docx']),
    previewSha256: z.string().regex(/^[0-9a-f]{64}$/),
  }),
  linkedin: z.strictObject({
    fileName: z.string().max(255).nullable().optional(),
    lang: z.enum(['fr', 'en']).optional(),
    dryRun: z.boolean().optional(),
  }),
  empty: z.strictObject({}),
};

type Status = 400 | 403 | 404 | 409 | 422 | 500 | 503;
const STATUS: Record<string, Status> = {
  NOT_FOUND: 404,
  STALE_REVISION: 409,
  NOT_ARCHIVED: 409,
  IN_USE: 409,
  ALREADY_RESOLVED: 409,
  ALREADY_EXISTS: 409,
  NO_ACTIVE_LETTER: 409,
  DEPENDENCY_PENDING: 409,
  IS_DEFAULT: 409,
  ARCHIVED: 409,
  SELECTION_RULE: 422,
  INVALID_DATA: 422,
  NOT_APPLICABLE: 422,
  SCHEMA_VERSION: 422,
  FORBIDDEN_PATH: 403,
  LOCKED: 503,
  MISSING_GLYPH: 422,
  UNKNOWN_FONT: 500,
  TYPST_ERROR: 500,
  PHOTO_MISSING: 500,
  INVALID_PHOTO: 422,
  NOT_AVAILABLE: 422,
};

class BadRequest extends Error {}

async function body<T>(c: Context, schema: z.ZodType<T>): Promise<T> {
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new BadRequest('corps de requête invalide');
  return parsed.data;
}

function collectionOf(c: Context): CollectionName {
  const parsed = collectionParam.safeParse(c.req.param('collection'));
  if (!parsed.success) throw new StoreError('NOT_FOUND', `collection inconnue : ${c.req.param('collection')}`);
  return parsed.data;
}

export function createApp(opts: AppOptions): Hono {
  if (Boolean(opts.publicOrigin) !== Boolean(opts.auth)) {
    throw new Error('une origine publique exige la connexion par clé de sécurité, et réciproquement (ADR 0018)');
  }
  const app = new Hono();
  const store = opts.store;
  app.use('*', security(opts));
  if (opts.publicOrigin && opts.auth) {
    const auth = new PasskeyAuth(opts.publicOrigin, opts.auth);
    app.use(
      '/auth/*',
      bodyLimit({
        maxSize: 64 * 1024,
        onError: (c) => c.json({ code: 'PAYLOAD_TOO_LARGE', message: 'corps de requête trop volumineux' }, 413),
      }),
    );
    app.use('*', auth.gate());
    auth.routes(app);
  }
  app.use(
    '/api/*',
    bodyLimit({
      maxSize: 1024 * 1024,
      onError: (c) =>
        c.json({ code: 'PAYLOAD_TOO_LARGE', message: 'corps de requête trop volumineux (1 Mo au plus)' }, 413),
    }),
  );

  app.onError((err, c) => {
    if (err instanceof BadRequest) return c.json({ code: 'INVALID_BODY', message: err.message }, 400);
    if (err instanceof PhotoError)
      return c.json({ code: err.code, message: err.message, details: {}, hint: err.hint }, 422);
    if (err instanceof StoreError || err instanceof RenderError) {
      const hint = err instanceof StoreError ? (err.hint ?? null) : null;
      return c.json({ code: err.code, message: err.message, details: err.details, hint }, STATUS[err.code] ?? 500);
    }
    console.error(err);
    return c.json({ code: 'INTERNAL', message: 'erreur interne du serveur' }, 500);
  });

  app.get('/api/health', (c) => c.json({ ok: true, version: opts.version ?? '0.1.0' }));

  // ---- Library (F-LIB-01 to 09) -------------------------------------------------------------------

  app.get('/api/library', async (c) => {
    const [{ library, revisions }, profile] = await Promise.all([store.loadLibraryFiles(), store.loadProfile()]);
    return c.json({
      identity: { revision: profile.revision, value: profile.identity },
      library,
      revisions,
      groups: libraryTree(library),
      integrity: checkLibraryIntegrity(library),
      untranslated: { fr: untranslatedFields(library, 'fr').length, en: untranslatedFields(library, 'en').length },
    });
  });

  app.post('/api/library/:collection/check', async (c) => {
    const { item, id, withPendingCategories } = await body(c, bodies.check);
    return c.json(await checkItem(store, collectionOf(c), item, id ?? null, { withPendingCategories }));
  });

  app.post('/api/library/:collection', async (c) => {
    const { item } = await body(c, bodies.create);
    return c.json(await createItem(store, collectionOf(c), item), 201);
  });

  app.put('/api/library/:collection/:id', async (c) => {
    const input = await body(c, bodies.update);
    return c.json(await updateItem(store, collectionOf(c), c.req.param('id'), input));
  });

  app.post('/api/library/:collection/:id/duplicate', async (c) => {
    await body(c, bodies.empty);
    return c.json(await duplicateItem(store, collectionOf(c), c.req.param('id')), 201);
  });

  app.post('/api/library/:collection/:id/archive', async (c) => {
    const { archived } = await body(c, bodies.archive);
    return c.json(await setItemArchived(store, collectionOf(c), c.req.param('id'), archived));
  });

  app.delete('/api/library/:collection/:id', async (c) => {
    await body(c, bodies.remove);
    return c.json(await deleteItem(store, collectionOf(c), c.req.param('id')));
  });

  app.put('/api/profile', async (c) => {
    const input = await body(c, bodies.identity);
    return c.json(await saveIdentity(store, input));
  });

  // ---- Photo (§5.2) ---------------------------------------------------------------------------------
  // Sent as base64 JSON (NF-01: JSON only, token, 1 MB body): the interface crops the zone chosen by the
  // user to 3:4 and scales it to 600 × 800 at most; sharp then re-encodes it here (ADR 0012).

  app.get('/api/profile/photo', async (c) => {
    const bytes = await readPhoto(store, (await store.loadProfile()).identity);
    if (!bytes) return c.json({ code: 'NOT_FOUND', message: 'aucune photo' }, 404);
    return c.body(bytes as Uint8Array<ArrayBuffer>, 200, { 'content-type': 'image/jpeg' });
  });

  app.post('/api/profile/photo', async (c) => {
    const { image, expectedRevision } = await body(c, bodies.photo);
    const processed = await processPhoto(new Uint8Array(Buffer.from(image.replace(/^data:[^,]*,/, ''), 'base64')));
    const saved = await savePhoto(store, processed.jpeg, expectedRevision);
    return c.json({
      ...saved,
      photo: {
        width: processed.width,
        height: processed.height,
        quality: processed.quality,
        bytes: processed.jpeg.byteLength,
      },
    });
  });

  app.delete('/api/profile/photo', async (c) => {
    const { expectedRevision } = await body(c, bodies.photoRemove);
    return c.json(await removePhoto(store, expectedRevision));
  });

  // Backup (F-LIB-09): read-only, so a GET; the token is required like on every /api route.
  app.get('/api/backup.zip', async (c) => {
    const zip = await zipDataDir(store.dataDir);
    return c.body(zip as Uint8Array<ArrayBuffer>, 200, {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${backupFileName()}"`,
    });
  });

  // Reset (F-LIB-09c, ADR 0021): from the interface only, never through the MCP. A ZIP copy of data/ is
  // kept first in out/backups/: without out/, the reset is refused.
  app.post('/api/reset', async (c) => {
    await body(c, bodies.reset);
    if (!opts.outDir) {
      throw new StoreError(
        'NOT_AVAILABLE',
        'réinitialisation impossible : aucun dossier out/ pour la copie de sécurité',
      );
    }
    const { backupFile, writes } = await resetDataDir(store, path.join(opts.outDir, 'backups'));
    return c.json({ backup: path.relative(path.dirname(opts.outDir), backupFile).split(path.sep).join('/'), writes });
  });

  // ---- Presets (F-PRE-01/02, ADR 0011) ------------------------------------------------------------

  app.get('/api/presets', async (c) => c.json({ presets: await store.listPresets() }));

  app.post('/api/presets', async (c) => {
    const { name, from } = await body(c, bodies.presetCreate);
    return c.json(await createPreset(store, { name, from: from ?? null }), 201);
  });

  app.put('/api/presets/:id', async (c) => {
    const input = await body(c, bodies.presetUpdate);
    return c.json(await updatePreset(store, c.req.param('id'), input));
  });

  app.post('/api/presets/:id/archive', async (c) => {
    const { archived } = await body(c, bodies.archive);
    return c.json(await setPresetArchived(store, c.req.param('id'), archived));
  });

  app.post('/api/presets/:id/default', async (c) => {
    await body(c, bodies.empty);
    return c.json(await setDefaultPreset(store, c.req.param('id')));
  });

  // ---- Applications (F-CAN-01 to 03, F-UI-04, ADR 0013) -------------------------------------------
  // Offers of import/offres/ are designated by their file name only (§7.6). The offer is untrusted data
  // (§7.5): cleaned when stored, its suspicious sentences flagged at each read.

  app.get('/api/offers', async (c) => c.json({ files: await listImportOffers(opts.importDir ?? null) }));

  app.get('/api/applications', async (c) => c.json(await listApplications(store)));

  app.post('/api/applications', async (c) => {
    const input = await body(c, bodies.applicationCreate);
    return c.json(await createApplication(store, input, { importDir: opts.importDir ?? null }), 201);
  });

  app.get('/api/applications/:id', async (c) => {
    const id = c.req.param('id');
    const loaded = await store.loadApplication(id);
    const presets = await store.listPresets();
    const base = presets.find((p) => p.id === loaded.application.basePresetId) ?? null;
    return c.json({
      ...loaded,
      offer: await readOffer(store, id),
      basePreset: base ? { id: base.id, name: base.name, archived: base.archived } : null,
    });
  });

  app.put('/api/applications/:id/selection', async (c) => {
    const input = await body(c, bodies.applicationSelection);
    return c.json(await updateApplicationSelection(store, c.req.param('id'), input));
  });

  app.post('/api/applications/:id/analysis', async (c) => {
    const { analysis } = await body(c, bodies.analysis);
    return c.json(await saveOfferAnalysis(store, c.req.param('id'), analysis));
  });

  // ---- Cover letter (F-LET-01 to 07, F-UI-04, ADR 0016) ---------------------------------------------
  // Versions are added, never overwritten; the active version and the final status change here only (never
  // through the MCP). Warnings of the guardrails are computed on read. Preview and export like the CV.

  const langParam = (c: Context): Lang => {
    const lang = c.req.param('lang');
    if (lang !== 'fr' && lang !== 'en') throw new StoreError('NOT_FOUND', `langue de lettre inconnue : ${lang}`);
    return lang;
  };

  app.get('/api/applications/:id/letters', async (c) => {
    const id = c.req.param('id');
    const { application } = await store.loadApplication(id);
    const letters: Record<Lang, unknown[]> = { fr: [], en: [] };
    for (const lang of ['fr', 'en'] as const) {
      for (const v of await listLetterVersions(store, id, lang)) {
        letters[lang].push({ ...v, checks: await letterChecks(store, id, v) });
      }
    }
    return c.json({ active: application.activeLetter, letters });
  });

  app.post('/api/applications/:id/letters/:lang', async (c) => {
    const input = await body(c, bodies.letterDraft);
    const id = c.req.param('id');
    const w = await createLetterVersion(store, id, langParam(c), input, 'utilisateur');
    return c.json({ ...w, checks: await letterChecks(store, id, w.version) }, 201);
  });

  app.post('/api/applications/:id/letters/:lang/active', async (c) => {
    const { version } = await body(c, bodies.letterActive);
    return c.json(await setActiveLetter(store, c.req.param('id'), langParam(c), version));
  });

  app.post('/api/applications/:id/letters/:lang/:version/final', async (c) => {
    await body(c, bodies.letterFinal);
    return c.json(await finalizeLetter(store, c.req.param('id'), langParam(c), Number(c.req.param('version'))));
  });

  /** Preview of any version of a letter, the day of the request (ADR 0016): nothing is written. */
  app.post('/api/letters/render', async (c) => {
    const input = await body(c, bodies.letterRender);
    const target = await resolveLetterTarget(store, input);
    const out = await renderLetter(await store.loadSnapshot(), target, { format: 'pdf' });
    return c.json({
      fileName: out.fileName,
      pdfBase64: Buffer.from(out.compiled.pdf).toString('base64'),
      sha256: sha256(out.compiled.pdf),
      pages: out.compiled.pages,
      fillRatio: out.compiled.measure.fillRatio,
      overflowLines: out.compiled.measure.overflowLines,
      compileMs: Math.round(out.compiled.ms),
      report: out.report,
      active: target.application.activeLetter[input.lang] === input.version,
    });
  });

  /** Export of the active version (T-ATS-13: the preview shown must be that version, the same day). */
  app.post('/api/letters/export', async (c) => {
    const input = await body(c, bodies.letterExport);
    return exportResponse(c, await exportLetter(store, input));
  });

  // ---- Imports (F-IMP-01 and 02, ADR 0015) ---------------------------------------------------------
  // Files of import/ are designated by name only (§7.6). The LinkedIn import is the function shared
  // with `npm run import:linkedin` and import_linkedin (MCP-21): proposals only, never validated content.

  app.get('/api/import/files', async (c) => {
    const files = (await listImportFiles(opts.importDir ?? null))
      .filter((f) => f.folder === 'import')
      .map((f) => ({
        name: f.name,
        type: f.type,
        size: f.size,
        kind: isLinkedInFile(f.name) ? 'linkedin' : f.type === 'pdf' || f.type === 'docx' ? 'cv' : 'other',
      }));
    return c.json({ files, available: !!opts.importDir });
  });

  app.post('/api/import/linkedin', async (c) => {
    const input = await body(c, bodies.linkedin);
    const report = await importLinkedIn(store, {
      importDir: opts.importDir ?? null,
      fileName: input.fileName ?? null,
      lang: input.lang ?? 'fr',
      dryRun: input.dryRun ?? false,
    });
    return c.json(report);
  });

  /** Identity found in the export (prefill of the identity form, never saved without the user). */
  app.get('/api/import/linkedin/identity', async (c) => {
    const fileName = c.req.query('file') || null;
    return c.json({ identity: await linkedInIdentity(opts.importDir ?? null, fileName) });
  });

  // ---- Proposals (F-PRO-01 to 06, F-UI-03) --------------------------------------------------------

  app.get('/api/proposals', async (c) => {
    const { proposals, invalid } = await store.scanProposals();
    const ctx = await subjectContext(store, proposals);
    const views = buildProposalViews(proposals, ctx).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const open = views.filter((v) => v.status === 'pending' || v.status === 'stale');
    const ids = (c.req.query('ids') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const shown = ids.length ? views.filter((v) => ids.includes(v.id)) : c.req.query('all') ? views : open;
    return c.json({
      proposals: shown,
      invalid,
      counts: { pending: open.length, stale: open.filter((v) => v.status === 'stale').length, total: views.length },
      missing: ids.filter((id) => !views.some((v) => v.id === id)),
      // Categories still proposed (ADR 0023), whatever `?ids=` shows: choices of a skill's category field.
      pendingCategories: [...openCategoryProposals(proposals)].map(([id, p]) => ({
        id,
        label: pick(p.payload.item.label) || id,
        proposalId: p.id,
      })),
    });
  });

  app.post('/api/proposals/accept-batch', async (c) => {
    const { ids } = await body(c, bodies.batch);
    return c.json(await acceptBatch(store, ids));
  });

  app.post('/api/proposals/:id/accept', async (c) => {
    const input = await body(c, bodies.accept);
    return c.json(await acceptProposal(store, c.req.param('id'), input));
  });

  app.post('/api/proposals/:id/reject', async (c) => {
    const { reason } = await body(c, bodies.reject);
    return c.json(await rejectProposal(store, c.req.param('id'), reason ?? null));
  });

  // ---- Render -------------------------------------------------------------------------------------

  app.post('/api/render', async (c) => {
    const parsed = renderBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ code: 'INVALID_BODY', message: 'corps de requête invalide' }, 400);
    const { lang, ...rest } = parsed.data;
    const draftInput = 'draft' in rest ? rest.draft : undefined;
    const target = 'presetId' in rest ? { presetId: rest.presetId } : { applicationId: rest.applicationId };
    const snapshot = await store.loadSnapshot();
    let resolved = await resolveTarget(store, snapshot, target);
    if (draftInput !== undefined) {
      // Live preview of the preset or application being edited (F-SEL-06): validated like a write,
      // never written.
      const { value, issues } = prepare(presetDraft, draftInput);
      if (value === null) throw new StoreError('INVALID_DATA', 'brouillon de sélection invalide', { issues });
      resolved = { ...resolved, ...value };
    }
    const photo = await readPhoto(store, snapshot.profile.identity);
    const out = await renderCv(snapshot, resolved, { format: 'pdf', ...(lang ? { lang } : {}) }, { photo });
    // Coverage of the offer terms (F-OFF-02 to 04), recomputed at each preview on the projected text of
    // the effective selection: the same projection as the PDF (NF-04).
    let coverage: Coverage | null = null;
    if (resolved.kind === 'application') {
      const { analysis } = await store.loadApplication(resolved.id);
      if (analysis?.current) {
        coverage = computeCoverage({
          analysis: analysis.current,
          offerText: (await readOffer(store, resolved.id)).text,
          projection: out.projection,
          library: snapshot.library,
          selection: resolved.selection,
          options: resolved.options,
        });
      }
    }
    return c.json({
      coverage,
      fileName: out.fileName,
      pdfBase64: Buffer.from(out.compiled.pdf).toString('base64'),
      sha256: sha256(out.compiled.pdf),
      pages: out.compiled.pages,
      fillRatio: out.compiled.measure.fillRatio,
      overflowLines: out.compiled.measure.overflowLines,
      compileMs: Math.round(out.compiled.ms),
      report: out.report,
    });
  });

  // ---- Export (F-EXP-01 to 04, ATS-15, T-ATS-13, ADR 0012) ---------------------------------------
  // The saved preset is compiled again: being deterministic, it must give the preview shown (same
  // SHA-256), otherwise the export is refused. The PDF downloaded is the preview buffer itself; a
  // timestamped copy is kept in out/exports/.

  app.post('/api/export', async (c) => {
    const input = await body(c, bodies.export);
    return exportResponse(c, await exportCv(store, input, opts.outDir ?? null));
  });

  function exportResponse(c: Context, result: ExportResult) {
    if (result.kind === 'mismatch') {
      return c.json(
        {
          code: 'PREVIEW_MISMATCH',
          message: "l'aperçu affiché ne correspond pas au preset enregistré",
          hint: "attendez la mise à jour de l'aperçu, puis exportez à nouveau",
          details: { report: result.report },
        },
        409,
      );
    }
    if (result.kind === 'blocked') {
      return c.json(
        {
          code: 'EXPORT_BLOCKED',
          message: 'export refusé : au moins un motif bloquant',
          hint: 'corrigez les motifs listés, puis exportez à nouveau',
          details: { report: result.report },
        },
        422,
      );
    }
    return c.json(result.value);
  }

  // ---- Journal of the MCP requests (ADR 0024) -------------------------------------------------------
  // Written by the MCP server in out/logs/, read here only: never exposed by the MCP itself.

  app.get('/api/mcp-log', async (c) => {
    const month = c.req.query('month') ?? null;
    if (month !== null && !MCP_LOG_MONTH_RE.test(month)) {
      return c.json({ code: 'INVALID_QUERY', message: 'mois invalide (AAAA-MM attendu)' }, 400);
    }
    return c.json(await readMcpLog(opts.outDir ?? null, month));
  });

  // ---- Server-sent events (§8.4) ------------------------------------------------------------------
  // Requires the token like every /api route: the interface reads the stream with fetch (EventSource
  // cannot send X-CV-Token). Each `change` event carries the file and its revision.
  app.get('/api/events', (c) =>
    streamSSE(c, async (stream) => {
      const queue: DataChange[] = [];
      let wake: (() => void) | null = null;
      const unsubscribe = opts.events?.subscribe((change) => {
        queue.push(change);
        wake?.();
      });
      stream.onAbort(() => {
        unsubscribe?.();
        wake?.();
      });
      await stream.writeSSE({ event: 'ready', data: JSON.stringify({ at: new Date().toISOString() }) });
      while (!stream.aborted) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, 25_000);
            wake = () => {
              clearTimeout(timer);
              resolve();
            };
          });
          wake = null;
        }
        if (stream.aborted) break;
        if (queue.length === 0) {
          await stream.writeSSE({ event: 'ping', data: '{}' });
          continue;
        }
        while (queue.length) await stream.writeSSE({ event: 'change', data: JSON.stringify(queue.shift()) });
      }
      unsubscribe?.();
    }),
  );

  return app;
}
