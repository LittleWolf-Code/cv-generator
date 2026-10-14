// Export of a preset or an application from the interface (F-EXP-01 to 04, F-CAN-03, ATS-15, T-ATS-13,
// ADR 0012 and 0013). The interface saves its edits, then sends the SHA-256 of the preview buffer it
// shows. The saved target is compiled again: the rendering being deterministic (NF-08), it must give the
// same PDF, otherwise the preview shown is not the saved version and the export is refused. The PDF
// downloaded by the browser is the preview buffer itself. A copy is kept, never overwritten: in
// applications/<id>/exports/<AAAAMMJJ-HHmmss>_<layout>/ with its trace in application.json for an
// application (the same function as `render` with `saveToApplication`), in
// out/exports/<preset>/<AAAAMMJJ-HHmmss>_<layout>/ with export.json for a preset.
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AtsReport, ExportEntry, Lang } from '@cv/core';
import {
  renderCv,
  renderLetter,
  resolveLetterTarget,
  resolveTarget,
  withPreviewCheck,
  type RenderTarget,
} from '@cv/render';
import {
  addApplicationExport,
  exportStamp,
  newTimestampedDir,
  readPhoto,
  sha256,
  type DataStore,
  type WriteRef,
} from '@cv/store';

export type ExportInput = {
  format: 'pdf' | 'docx';
  /** SHA-256 (hex) of the preview buffer shown by the interface. */
  previewSha256: string;
} & ({ presetId: string } | { applicationId: string });

export interface ExportDone {
  fileName: string;
  format: 'pdf' | 'docx';
  /**
   * Copy kept: relative to the data directory for an application (`applications/<id>/exports/…`), to the
   * project root for a preset (`out/exports/…`); null without out/.
   */
  savedTo: string | null;
  /** Trace added to application.json (applications only). */
  entry: ExportEntry | null;
  /** SHA-256 of the exported file (read back from the disk when a copy is kept). */
  sha256: string;
  previewSha256: string;
  report: AtsReport;
  /** DOCX bytes in base64; null for a PDF, which the interface already holds (the preview buffer). */
  fileBase64: string | null;
  createdAt: string;
  writes: WriteRef[];
}

export type ExportResult =
  | { kind: 'done'; value: ExportDone }
  | { kind: 'mismatch'; report: AtsReport }
  | { kind: 'blocked'; report: AtsReport };

export async function exportCv(store: DataStore, input: ExportInput, outDir: string | null): Promise<ExportResult> {
  const snapshot = await store.loadSnapshot();
  const target: RenderTarget =
    'applicationId' in input ? { applicationId: input.applicationId } : { presetId: input.presetId };
  const resolved = await resolveTarget(store, snapshot, target);
  const photo = await readPhoto(store, snapshot.profile.identity);
  const out = await renderCv(snapshot, resolved, { format: input.format }, { photo });
  const renderedSha = sha256(out.compiled.pdf);
  if (renderedSha !== input.previewSha256) {
    return { kind: 'mismatch', report: withPreviewCheck(out.report, input.previewSha256, renderedSha, 'pdf') };
  }
  if (out.report.blocking || !out.fileName) return { kind: 'blocked', report: out.report };

  const now = new Date();
  const bytes = input.format === 'pdf' ? out.compiled.pdf : out.docx!;
  // T-ATS-13: a PDF is the preview buffer (hash of the file written, checked when it is read back); a
  // DOCX comes from the projection of the preview shown (hash of the PDF compiled from the saved target).
  const expected = (fileSha: string) =>
    withPreviewCheck(out.report, input.previewSha256, input.format === 'pdf' ? fileSha : renderedSha, input.format);
  const atsCheck = (r: AtsReport): ExportEntry['atsCheck'] =>
    r.criteria.some((c) => c.status === 'orange') ? 'avertissements' : 'ok';

  if (resolved.kind === 'application') {
    const report = expected(sha256(bytes));
    if (report.blocking) return { kind: 'blocked', report };
    const saved = await addApplicationExport(
      store,
      resolved.id,
      {
        fileName: out.fileName,
        bytes,
        format: input.format,
        lang: out.projection.lang,
        layout: out.projection.layout,
        pages: out.compiled.pages,
        atsCheck: atsCheck(report),
        ...(input.format === 'pdf' ? { expectedSha256: input.previewSha256 } : {}),
      },
      now,
    );
    return {
      kind: 'done',
      value: {
        fileName: out.fileName,
        format: input.format,
        savedTo: saved.file,
        entry: saved.entry,
        sha256: saved.sha256,
        previewSha256: input.previewSha256,
        report: expected(saved.sha256),
        fileBase64: input.format === 'docx' ? Buffer.from(bytes).toString('base64') : null,
        createdAt: saved.entry.createdAt,
        writes: saved.writes,
      },
    };
  }

  let savedTo: string | null = null;
  let fileSha = sha256(bytes);
  let dir: string | null = null;
  if (outDir) {
    const base = path.join(outDir, 'exports', resolved.id);
    dir = path.join(base, await newTimestampedDir(base, exportStamp(now), out.projection.layout));
    const file = path.join(dir, out.fileName);
    await writeFile(file, bytes, { flag: 'wx' });
    fileSha = sha256(await readFile(file));
    savedTo = path.relative(path.dirname(outDir), file).split(path.sep).join('/');
  }
  const report = expected(fileSha);
  if (report.blocking) {
    if (dir) await rm(dir, { recursive: true, force: true });
    return { kind: 'blocked', report };
  }
  if (dir) {
    const trace = {
      createdAt: now.toISOString(),
      kind: 'cv',
      presetId: resolved.id,
      fileName: out.fileName,
      format: input.format,
      lang: out.projection.lang,
      enVariant: out.projection.enVariant,
      layout: out.projection.layout,
      pages: out.compiled.pages,
      photo: out.projection.photo !== null,
      atsCheck: report.criteria.some((c) => c.status === 'orange') ? 'orange' : 'ok',
      complete: report.complete,
      sha256: fileSha,
      previewSha256: input.previewSha256,
      criteria: report.criteria.map((c) => ({ id: c.id, status: c.status })),
    };
    await writeFile(path.join(dir, 'export.json'), `${JSON.stringify(trace, null, 2)}\n`, { flag: 'wx' });
  }
  return {
    kind: 'done',
    value: {
      fileName: out.fileName,
      format: input.format,
      savedTo,
      entry: null,
      sha256: fileSha,
      previewSha256: input.previewSha256,
      report,
      fileBase64: input.format === 'docx' ? Buffer.from(bytes).toString('base64') : null,
      createdAt: now.toISOString(),
      writes: [],
    },
  };
}

export interface LetterExportInput {
  applicationId: string;
  lang: Lang;
  format: 'pdf' | 'docx';
  /** SHA-256 of the letter preview shown by the interface (the active version, the day of the export). */
  previewSha256: string;
}

/**
 * Export of the active letter of an application (F-LET-07, ADR 0016): same rules as the CV. The active
 * version is compiled again; a different SHA-256 means the preview shown is not that version (or the
 * day changed since the preview: the date is the day of the rendering). A copy is kept in
 * exports/<AAAAMMJJ-HHmmss>_lettre/ by addApplicationExport, with its trace.
 */
export async function exportLetter(store: DataStore, input: LetterExportInput): Promise<ExportResult> {
  const target = await resolveLetterTarget(store, { applicationId: input.applicationId, lang: input.lang });
  const snapshot = await store.loadSnapshot();
  const out = await renderLetter(snapshot, target, { format: input.format });
  const renderedSha = sha256(out.compiled.pdf);
  if (renderedSha !== input.previewSha256) {
    return { kind: 'mismatch', report: withPreviewCheck(out.report, input.previewSha256, renderedSha, 'pdf') };
  }
  if (out.report.blocking || !out.fileName) return { kind: 'blocked', report: out.report };
  const bytes = input.format === 'pdf' ? out.compiled.pdf : out.docx!;
  const expected = (fileSha: string) =>
    withPreviewCheck(out.report, input.previewSha256, input.format === 'pdf' ? fileSha : renderedSha, input.format);
  const report = expected(sha256(bytes));
  if (report.blocking) return { kind: 'blocked', report };
  const saved = await addApplicationExport(store, input.applicationId, {
    kind: 'letter',
    fileName: out.fileName,
    bytes,
    format: input.format,
    lang: input.lang,
    layout: target.selection.template.layout,
    pages: out.compiled.pages,
    atsCheck: report.criteria.some((c) => c.status === 'orange') ? 'avertissements' : 'ok',
    ...(input.format === 'pdf' ? { expectedSha256: input.previewSha256 } : {}),
  });
  return {
    kind: 'done',
    value: {
      fileName: out.fileName,
      format: input.format,
      savedTo: saved.file,
      entry: saved.entry,
      sha256: saved.sha256,
      previewSha256: input.previewSha256,
      report: expected(saved.sha256),
      fileBase64: input.format === 'docx' ? Buffer.from(bytes).toString('base64') : null,
      createdAt: saved.entry.createdAt,
      writes: saved.writes,
    },
  };
}
