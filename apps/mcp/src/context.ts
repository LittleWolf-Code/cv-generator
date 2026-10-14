// Shared parts of the MCP tools (§7.2): options, annotations, ATS summary, error mapping, render
// assets (the photo never leaves the interface: a grey placeholder of the same size, ADR 0012),
// review link of the proposals, untrusted-text marking (§7.5).
import { z } from 'zod';
import { lowerFirst, markUntrusted, newNonce, type AtsReport, type UntrustedSource } from '@cv/core';
import {
  extractImportText,
  placeholderPhoto,
  renderPreviewPng,
  RenderError,
  type ImportText,
  type RenderAssets,
  type RenderOutput,
} from '@cv/render';
import { assertSafeFileName, readImportBytes, StoreError, type DataStore, type Snapshot } from '@cv/store';
import { log } from './log.js';
import { makeMasker, toolError, type Masker, type ToolResult } from './results.js';

export interface CvServerOptions {
  dataDir: string;
  outDir: string;
  /** import/ (offers in import/offres/, CV text files); null when unavailable. */
  importDir?: string | null;
  /** Port of the interface (CV_PORT, 4310 by default): reviewUrl of the proposals. */
  uiPort?: number;
  /** Public origin of the online instance (CV_PUBLIC_ORIGIN, ADR 0018): base of the review links. */
  publicOrigin?: string;
}

export interface ToolContext {
  store: DataStore;
  opts: CvServerOptions;
  masker(): Promise<Masker>;
}

export function makeContext(store: DataStore, opts: CvServerOptions): ToolContext {
  return {
    store,
    opts,
    async masker() {
      try {
        return makeMasker((await store.loadProfile()).identity);
      } catch {
        return makeMasker(null);
      }
    },
  };
}

// §7.2: openWorldHint false and destructiveHint false for every tool (true by construction: every
// write is additive); propose_*, render and check_ats are not idempotent.
export const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;
export const FILE_WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;
/** Additions (application, analysis) and proposals: never an overwrite of validated content. */
export const ADDITION = FILE_WRITE;

export const target = z.union([
  z.strictObject({ applicationId: z.string().describe('Identifiant de candidature') }),
  z.strictObject({ presetId: z.string().describe('Identifiant de preset') }),
]);

const criterionOut = z.object({
  id: z.string(),
  label: z.string(),
  status: z.enum(['green', 'orange', 'red', 'na']),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const atsSummary = z.object({
  blocking: z.boolean(),
  complete: z.boolean().describe('false si un seul extracteur (Poppler absent) : rapport incomplet'),
  extractors: z.object({ pdfjs: z.string(), pdftotext: z.string(), pdftotextDetail: z.string().optional() }),
  pages: z.number(),
  fillRatio: z.number(),
  overflowLines: z.number(),
  criteria: z.array(criterionOut),
  projection: z.object({ blocking: z.array(z.unknown()), warnings: z.array(z.unknown()) }),
  notice: z
    .object({ badge: z.string(), docx: z.string().nullable() })
    .nullable()
    .describe('modèle visuel : badge « destiné à une lecture humaine » (et remarque sur le DOCX) ; null en ATS'),
});

export function summarize(report: AtsReport): z.infer<typeof atsSummary> {
  return {
    blocking: report.blocking,
    complete: report.complete,
    extractors: report.extractors,
    pages: report.pages,
    fillRatio: Math.round(report.fillRatio * 1000) / 1000,
    overflowLines: report.overflowLines,
    criteria: report.criteria,
    projection: report.projection,
    notice: report.notice ?? null,
  };
}

export function criteriaLine(report: AtsReport): string {
  const count = (s: string) => report.criteria.filter((c) => c.status === s).length;
  return `${count('green')} vert(s), ${count('orange')} orange(s), ${count('red')} rouge(s)${report.complete ? '' : ' — rapport incomplet (pdf.js seul)'}${
    report.notice
      ? ` — modèle visuel : ${lowerFirst(report.notice.badge)}${report.notice.docx ? ` ; ${report.notice.docx}` : ''}`
      : ''
  }`;
}

/** Business errors as tool errors {code, message, details, hint} (§7.2). */
export function errorResult(mask: Masker, err: unknown): ToolResult {
  if (err instanceof StoreError) {
    return toolError(mask, {
      code: err.code,
      message: err.message,
      details: err.details,
      hint: err.hint ?? 'vérifiez les identifiants avec get_overview',
    });
  }
  if (err instanceof RenderError) {
    return toolError(mask, {
      code: err.code,
      message: err.message,
      details: err.details,
      hint: "corrigez le contenu signalé dans l'interface",
    });
  }
  log(`erreur inattendue : ${(err as Error).stack ?? String(err)}`);
  return toolError(mask, {
    code: 'INTERNAL',
    message: (err as Error).message,
    details: {},
    hint: 'consultez le journal du serveur MCP',
  });
}

/** Render assets of the MCP server: the placeholder instead of the real photo (§7.5, ADR 0012). */
export async function mcpAssets(snap: Snapshot): Promise<RenderAssets> {
  return { photo: snap.profile.identity?.photo ? await placeholderPhoto() : null };
}

export async function previewImage(
  out: RenderOutput,
): Promise<{ type: 'image'; data: string; mimeType: string } | null> {
  try {
    const png = await renderPreviewPng(out.projection, out.photo);
    return { type: 'image', data: png.toString('base64'), mimeType: 'image/png' };
  } catch (err) {
    log(`aperçu PNG impossible : ${(err as Error).message}`);
    return null;
  }
}

/** Origin of the interface: the online instance (ADR 0018), or the local one. */
export function interfaceOrigin(ctx: ToolContext): string {
  return ctx.opts.publicOrigin ?? `http://127.0.0.1:${ctx.opts.uiPort ?? 4310}`;
}

/** Link of the « À valider » screen filtered on the proposals created (F-PRO-05). */
export function reviewUrl(ctx: ToolContext, ids: readonly string[]): string {
  return `${interfaceOrigin(ctx)}/a-valider?ids=${ids.join(',')}`;
}

export const REVIEW_REMINDER =
  "Rien n'est appliqué : l'utilisateur accepte ou rejette chaque proposition dans l'interface (reviewUrl). Si l'interface locale est fermée, il la lance avec « npm run dev » à la racine du projet ; l'instance en ligne est toujours ouverte (connexion par clé de sécurité).";

/** Marks external text for one response (§7.5): one random nonce per response. */
export function untrustedMarker(): { nonce: string; mark: (text: string, source?: UntrustedSource) => string } {
  const nonce = newNonce();
  return { nonce, mark: (text, source = 'offer') => markUntrusted(text, source, nonce) };
}

/** A CV of import/ is a few hundred kilobytes: anything above 20 MB is refused before extraction. */
export const IMPORT_TEXT_MAX_BYTES = 20 * 1024 * 1024;

/**
 * Text of a file at the root of import/ (MCP-08, reference source of propose_item with sourceFile):
 * PDF by pdf.js, DOCX by mammoth, .md and .txt as they are. File scope of §7.6 (names only).
 */
export async function readImportText(ctx: ToolContext, fileName: string): Promise<ImportText> {
  assertSafeFileName(fileName);
  const type = (/\.([a-z]+)$/i.exec(fileName)?.[1] ?? '').toLowerCase();
  if (!['pdf', 'docx', 'md', 'txt'].includes(type)) {
    throw new StoreError(
      'NOT_APPLICABLE',
      `lecture du texte : PDF, DOCX, .md ou .txt attendu, pas ${fileName}`,
      {},
      "pour l'export LinkedIn (ZIP ou CSV), utilisez import_linkedin",
    );
  }
  const bytes = await readImportBytes(ctx.opts.importDir ?? null, 'import', fileName);
  if (bytes.length > IMPORT_TEXT_MAX_BYTES) {
    throw new StoreError('INVALID_DATA', `fichier trop volumineux (20 Mo au plus) : ${fileName}`);
  }
  try {
    return await extractImportText(bytes, type);
  } catch (err) {
    throw new StoreError('INVALID_DATA', `fichier illisible : ${fileName} (${(err as Error).message})`);
  }
}
