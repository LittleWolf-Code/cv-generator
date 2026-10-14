// End-to-end rendering of a CV for a target (preset or application): select → project → compile
// → DOCX → ATS-check (§8.5). Shared by the API server, the MCP server and the test battery.
import {
  applyLayout,
  cvFileName,
  hasRed,
  project,
  select,
  type AtsReport,
  type EnVariant,
  type Lang,
  type Layout,
  type Options,
  type Projection,
  type Selection,
  type Template,
} from '@cv/core';
import { StoreError, type DataStore, type Snapshot } from '@cv/store';
import { checkPreviewIsExport } from './ats/criteria.js';
import { runAtsCheck } from './ats/check.js';
import { compileProjection, type CompileResult } from './compile.js';
import { buildDocx } from './docx.js';

export type RenderTarget = { presetId: string } | { applicationId: string };

export interface ResolvedTarget {
  kind: 'preset' | 'application';
  id: string;
  selection: Selection;
  options: Options;
  template: Template;
  lang: Lang;
  enVariant: EnVariant;
  fileLabel: string;
}

export async function resolveTarget(
  store: DataStore,
  snapshot: Snapshot,
  target: RenderTarget,
): Promise<ResolvedTarget> {
  if ('presetId' in target) {
    const preset = snapshot.presets.find((p) => p.id === target.presetId);
    if (!preset) throw new StoreError('NOT_FOUND', `preset introuvable : ${target.presetId}`);
    return {
      kind: 'preset',
      id: preset.id,
      selection: preset.selection,
      options: preset.options,
      template: preset.template,
      lang: preset.lang,
      enVariant: preset.enVariant,
      fileLabel: preset.fileLabel,
    };
  }
  const app = await store.loadApplication(target.applicationId);
  return {
    kind: 'application',
    id: app.application.id,
    selection: app.selection.selection,
    options: app.selection.options,
    template: app.selection.template,
    lang: app.application.lang,
    enVariant: app.application.enVariant,
    fileLabel: app.application.fileLabel,
  };
}

export interface RenderRequest {
  lang?: Lang;
  layout?: Layout;
  format: 'pdf' | 'docx';
}

export interface RenderAssets {
  /**
   * JPEG bytes of the identity photo, used when the photo option is checked. The MCP server passes
   * `placeholderPhoto()` instead of the real photo (§7.5). Missing: rendered without photo, with a
   * PHOTO_MISSING warning.
   */
  photo?: Uint8Array | null;
}

export interface RenderOutput {
  target: ResolvedTarget;
  projection: Projection;
  compiled: CompileResult;
  docx: Uint8Array | null;
  /** Photo bytes actually rendered (null without photo). */
  photo: Uint8Array | null;
  report: AtsReport;
  /** Normalized file name (F-EXP-04), null without identity. */
  fileName: string | null;
}

export async function renderCv(
  snapshot: Snapshot,
  resolved: ResolvedTarget,
  req: RenderRequest,
  assets: RenderAssets = {},
): Promise<RenderOutput> {
  const lang = req.lang ?? resolved.lang;
  // A layout forced by the request (MCP render, preview_selection) gets the defaults of that layout, as
  // the switch of the interface does (ADR 0017): own-section in the visual layout. The photo is unchanged.
  const forced = { template: structuredClone(resolved.template), options: structuredClone(resolved.options) };
  if (req.layout) applyLayout(forced, req.layout);
  const template: Template = forced.template;
  const identity = snapshot.profile.identity;
  let projection = project(select(snapshot.library, resolved.selection), {
    lang,
    enVariant: resolved.enVariant,
    options: forced.options,
    template,
    identity,
  });
  const photo = projection.photo ? (assets.photo ?? null) : null;
  if (projection.photo && !photo) {
    projection = {
      ...projection,
      photo: null,
      warnings: [
        ...projection.warnings,
        {
          code: 'PHOTO_MISSING',
          message: 'photo cochée, mais son fichier est introuvable dans data/assets : importez-la de nouveau',
          target: { collection: 'profile', itemId: 'identity', field: 'photo' },
        },
      ],
    };
  }
  const compiled = compileProjection(projection, photo);
  const docx = req.format === 'docx' ? await buildDocx(projection, photo) : null;
  const report = await runAtsCheck({ projection, compiled, format: req.format, ...(docx ? { docx } : {}) });
  const fileName = identity
    ? cvFileName({
        firstName: identity.firstName,
        lastName: identity.lastName,
        label: resolved.fileLabel,
        lang,
        enVariant: resolved.enVariant,
        format: req.format,
      })
    : null;
  return { target: resolved, projection, compiled, docx, photo, report, fileName };
}

/**
 * T-ATS-13 at export (interface): the report of the exported file, with the comparison of its SHA-256
 * with the one of the preview shown. A difference is red and blocks the export.
 */
export function withPreviewCheck(
  report: AtsReport,
  previewSha256: string,
  exportedSha256: string,
  format: 'pdf' | 'docx' = 'pdf',
): AtsReport {
  const criteria = report.criteria.map((c) =>
    c.id === 'T-ATS-13' ? checkPreviewIsExport(previewSha256, exportedSha256, format) : c,
  );
  return { ...report, criteria, blocking: hasRed(criteria) || report.projection.blocking.length > 0 };
}
