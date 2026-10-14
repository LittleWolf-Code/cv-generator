// ATS-check (§8.5 step 6, §12.3): runs at every render (ATS-16). A red criterion or a blocking
// projection issue disables the export.
import { readFileSync } from 'node:fs';
import {
  hasRed,
  HUMAN_READING_NOTICE,
  isAtsLayout,
  VISUAL_DOCX_NOTICE,
  type AtsCriterion,
  type AtsReport,
  type LetterProjection,
  type Projection,
} from '@cv/core';
import type { CompileResult } from '../compile.js';
import { THEME_FONTS } from '../fonts.js';
import { templatePath } from '../paths.js';
import * as c from './criteria.js';
import { detectFields } from './detect.js';
import { checkDocxPagination, checkDocxStructure, checkDocxText, extractDocxText } from './docx-check.js';
import {
  extractWithPdfjs,
  extractWithPdftotext,
  listFontsWithPdffonts,
  locatePoppler,
  type PopplerInfo,
} from './extract.js';
import { inspectPdf } from './pdfinfo.js';
import { lintProfileOf, lintTemplate, type LintViolation } from './template-lint.js';

const lintCache = new Map<string, LintViolation[]>();

/** T-ATS-17 of a template, with the profile of its name (ADR 0017): every rule but in the visual layout. */
export function lintLayout(layout: string): LintViolation[] {
  let v = lintCache.get(layout);
  if (!v) {
    v = lintTemplate(readFileSync(templatePath(layout), 'utf8'), lintProfileOf(layout));
    lintCache.set(layout, v);
  }
  return v;
}

export interface AtsCheckInput {
  projection: Projection;
  compiled: Pick<CompileResult, 'pdf' | 'pages' | 'measurePdf' | 'measure'>;
  format: 'pdf' | 'docx';
  docx?: Uint8Array;
  /** Use pdffonts as well (test battery). */
  withPdffonts?: boolean;
  /** Override Poppler lookup (tests); `false` disables pdftotext. */
  poppler?: PopplerInfo | false;
  /** T-ATS-13 at export (interface): hash of the preview shown and of the exported file. */
  previewSha256?: string | null;
  exportedSha256?: string | null;
}

export async function runAtsCheck(input: AtsCheckInput): Promise<AtsReport> {
  const { projection: p, compiled } = input;
  // §12.2: when the CV overflows, the other criteria are computed on the measure PDF (single tall page).
  const textPdf = compiled.pages > 1 ? compiled.measurePdf : compiled.pdf;
  const poppler: PopplerInfo =
    input.poppler === false ? { status: 'absent', detail: 'désactivé' } : (input.poppler ?? (await locatePoppler()));

  const pdfjs = await extractWithPdfjs(textPdf);
  const extractions: c.Extraction[] = [{ name: 'pdf.js', text: pdfjs.text }];
  let pdftotext: string | null = null;
  let pdftotextStatus = poppler.status;
  let pdftotextDetail = poppler.detail;
  if (poppler.status === 'ok') {
    try {
      pdftotext = await extractWithPdftotext(textPdf, poppler);
      extractions.push({ name: 'pdftotext', text: pdftotext });
      pdftotextDetail = `Poppler ${poppler.version ?? ''}`.trim();
    } catch (err) {
      pdftotextStatus = 'error';
      pdftotextDetail = (err as Error).message;
    }
  }
  const info = await inspectPdf(compiled.pdf);
  const pdffonts =
    input.withPdffonts && poppler.status === 'ok' ? await listFontsWithPdffonts(compiled.pdf, poppler) : null;

  const visual = !isAtsLayout(p.layout);
  const atsColumn: AtsCriterion[] = [
    c.checkPages(compiled.pages, compiled.measure.overflowLines, compiled.measure.fillRatio, p.theme.density),
    c.checkTextsFound(p, extractions),
    c.checkGluedWords(p, extractions),
    c.checkForbiddenChars(extractions),
    c.checkSpacedLetters(extractions),
    c.checkOrder(p, extractions),
    c.checkDates(p, extractions),
    c.checkContacts(p, extractions),
    c.checkFonts(info, THEME_FONTS[p.theme.font].postscriptNames, pdffonts),
    c.checkTextSize(pdfjs.items),
    c.checkFileSize(compiled.pdf.byteLength),
    c.checkMetadata(info),
    c.checkPreviewIsExport(input.previewSha256, input.exportedSha256),
    c.checkConversionQuality(pdfjs.text),
    c.checkRegulatoryHeading(p),
    c.checkPhoto(p),
    c.checkTemplate(lintLayout(p.layout), visual),
  ];
  // F-MOD-03: in the visual layout, the layout criteria are orange and the integrity ones stay red.
  const criteria = visual ? atsColumn.map(c.toVisualColumn) : atsColumn;

  const detected = extractions.map((ex) => detectFields(p, ex));
  let docxText: string | null = null;
  if (input.format === 'docx' && input.docx) {
    docxText = await extractDocxText(input.docx);
    criteria.push(
      checkDocxStructure(input.docx, p),
      checkDocxText(docxText, p),
      await checkDocxPagination(input.docx, p.theme.font),
    );
    detected.push(detectFields(p, { name: 'docx', text: docxText }));
  }

  return {
    format: input.format,
    layout: p.layout,
    lang: p.enVariant && p.lang === 'en' ? `${p.lang} (${p.enVariant})` : p.lang,
    pages: compiled.pages,
    fillRatio: compiled.measure.fillRatio,
    overflowLines: compiled.measure.overflowLines,
    criteria,
    blocking: hasRed(criteria) || p.blocking.length > 0,
    complete: pdftotext !== null,
    extractors: { pdfjs: 'ok', pdftotext: pdftotextStatus, ...(pdftotextDetail ? { pdftotextDetail } : {}) },
    projection: { blocking: p.blocking, warnings: p.warnings },
    text: { pdfjs: pdfjs.text, pdftotext, docx: docxText },
    detected,
    ...(visual
      ? { notice: { badge: HUMAN_READING_NOTICE, docx: input.format === 'docx' ? VISUAL_DOCX_NOTICE : null } }
      : {}),
  };
}

export interface LetterAtsCheckInput {
  projection: LetterProjection;
  compiled: Pick<CompileResult, 'pdf' | 'pages' | 'measurePdf' | 'measure'>;
  format: 'pdf' | 'docx';
  docx?: Uint8Array;
  withPdffonts?: boolean;
  poppler?: PopplerInfo | false;
  previewSha256?: string | null;
  exportedSha256?: string | null;
}

/**
 * ATS check of a letter: the « Lettre » column of §12.3 (T-ATS-01 to 05, 09 to 14 and 17; 06 to 08, 15
 * and 16 do not apply), and T-DOCX-01 to 03 for a DOCX (ADR 0016).
 */
export async function runLetterAtsCheck(input: LetterAtsCheckInput): Promise<AtsReport> {
  const { projection: p, compiled } = input;
  const textPdf = compiled.pages > 1 ? compiled.measurePdf : compiled.pdf;
  const poppler: PopplerInfo =
    input.poppler === false ? { status: 'absent', detail: 'désactivé' } : (input.poppler ?? (await locatePoppler()));
  const pdfjs = await extractWithPdfjs(textPdf);
  const extractions: c.Extraction[] = [{ name: 'pdf.js', text: pdfjs.text }];
  let pdftotext: string | null = null;
  let pdftotextStatus = poppler.status;
  let pdftotextDetail = poppler.detail;
  if (poppler.status === 'ok') {
    try {
      pdftotext = await extractWithPdftotext(textPdf, poppler);
      extractions.push({ name: 'pdftotext', text: pdftotext });
      pdftotextDetail = `Poppler ${poppler.version ?? ''}`.trim();
    } catch (err) {
      pdftotextStatus = 'error';
      pdftotextDetail = (err as Error).message;
    }
  }
  const info = await inspectPdf(compiled.pdf);
  const pdffonts =
    input.withPdffonts && poppler.status === 'ok' ? await listFontsWithPdffonts(compiled.pdf, poppler) : null;
  const criteria: AtsCriterion[] = [
    c.checkPages(compiled.pages, compiled.measure.overflowLines, compiled.measure.fillRatio, p.theme.density, 'letter'),
    c.checkTextsFound(p, extractions),
    c.checkGluedWords(p, extractions),
    c.checkForbiddenChars(extractions),
    c.checkSpacedLetters(extractions),
    c.checkFonts(info, THEME_FONTS[p.theme.font].postscriptNames, pdffonts),
    c.checkTextSize(pdfjs.items),
    c.checkFileSize(compiled.pdf.byteLength),
    c.checkMetadata(info),
    c.checkPreviewIsExport(input.previewSha256, input.exportedSha256),
    c.checkConversionQuality(pdfjs.text),
    c.checkTemplate(lintLayout(p.layout)),
  ];
  let docxText: string | null = null;
  if (input.format === 'docx' && input.docx) {
    docxText = await extractDocxText(input.docx);
    criteria.push(
      checkDocxStructure(input.docx, letterShim(p)),
      checkLetterDocxText(docxText, p),
      await checkDocxPagination(input.docx, p.theme.font),
    );
  }
  return {
    format: input.format,
    layout: p.layout,
    lang: p.lang === 'en' ? `en (${p.enVariant})` : 'fr',
    pages: compiled.pages,
    fillRatio: compiled.measure.fillRatio,
    overflowLines: compiled.measure.overflowLines,
    criteria,
    blocking: hasRed(criteria) || p.blocking.length > 0,
    complete: pdftotext !== null,
    extractors: { pdfjs: 'ok', pdftotext: pdftotextStatus, ...(pdftotextDetail ? { pdftotextDetail } : {}) },
    projection: { blocking: p.blocking, warnings: p.warnings },
    text: { pdfjs: pdfjs.text, pdftotext, docx: docxText },
    detected: [],
  };
}

/** What T-DOCX-01 reads of a projection, for a letter: no photo, no link, the theme font. */
function letterShim(p: LetterProjection): Projection {
  return { photo: null, header: { contacts: [] }, sections: [], theme: p.theme } as unknown as Projection;
}

/** T-DOCX-02 of a letter: mammoth text through T-ATS-02 and 04 (06 and 08 do not apply to a letter). */
function checkLetterDocxText(text: string, p: LetterProjection): AtsCriterion {
  const ex: c.Extraction[] = [{ name: 'docx', text }];
  const sub = [c.checkTextsFound(p, ex), c.checkForbiddenChars(ex)];
  const red = sub.filter((x) => x.status === 'red');
  return {
    id: 'T-DOCX-02',
    label: 'Texte DOCX',
    status: red.length ? 'red' : 'green',
    message: red.length ? red.map((x) => `${x.id} : ${x.message}`).join(' ; ') : 'Texte DOCX conforme (T-ATS-02 et 04)',
    details: { checks: sub.map((x) => ({ id: x.id, status: x.status })) },
  };
}
