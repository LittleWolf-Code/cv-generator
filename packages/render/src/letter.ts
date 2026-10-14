// Rendering of a cover letter (F-LET-07, F-MOD-05, ADR 0016): the letter projection is the single input
// of the Typst template `lettre.typ` (PDF, one page strict) and of the DOCX (same projection, page count
// not guaranteed). Shared by the API (preview, export) and the MCP server (save_letter_draft, render,
// check_ats). The date is the day of the rendering.
import { AlignmentType, Document, Packer, Paragraph, TextRun } from 'docx';
import {
  letterFileName,
  projectLetter,
  type ApplicationFile,
  type ApplicationSelectionFile,
  type AtsReport,
  type Lang,
  type LetterProjection,
  type LetterVersionFile,
  type Rich,
} from '@cv/core';
import { activeLetterVersion, readLetterVersion, StoreError, type DataStore, type Snapshot } from '@cv/store';
import { runLetterAtsCheck } from './ats/check.js';
import { compileLetter, type CompileResult } from './compile.js';
import { THEME_FONTS } from './fonts.js';

const CM_TO_TWIP = 567;
const PAGE_TWIPS = { a4: { width: 11906, height: 16838 }, 'us-letter': { width: 12240, height: 15840 } } as const;
const halfPoints = (pt: number) => Math.round(pt * 2);

export interface LetterTarget {
  application: ApplicationFile;
  /** selection.json of the application: its template gives the theme of the letter (F-MOD-05). */
  selection: ApplicationSelectionFile;
  version: LetterVersionFile;
  /** Language of the letter (its folder letters/<lang>/). */
  lang: Lang;
}

export interface LetterRenderOutput {
  projection: LetterProjection;
  compiled: CompileResult;
  docx: Uint8Array | null;
  report: AtsReport;
  fileName: string | null;
}

/**
 * The version a rendering targets (ADR 0016): the active one, or the `version` given (a preview). An
 * export always uses the active version: with `requireActive`, another version is refused.
 */
export async function resolveLetterTarget(
  store: DataStore,
  req: { applicationId: string; lang?: Lang; version?: number | null; requireActive?: boolean },
): Promise<LetterTarget> {
  const { application, selection } = await store.loadApplication(req.applicationId);
  const lang = req.lang ?? application.lang;
  let version: LetterVersionFile;
  if (req.version !== undefined && req.version !== null) {
    if (req.requireActive && application.activeLetter[lang] !== req.version) {
      throw new StoreError(
        'NO_ACTIVE_LETTER',
        `la version ${lang.toUpperCase()} v${req.version} n'est pas la version active : seule la version active s'exporte`,
        { active: application.activeLetter[lang] },
        'choisissez la version active dans l\u2019interface (écran Candidatures, Lettre)',
      );
    }
    version = await readLetterVersion(store, req.applicationId, lang, req.version);
  } else {
    version = await activeLetterVersion(store, req.applicationId, lang);
  }
  return { application, selection, version, lang };
}

/** The letter projection of a version, for a given day. */
export function letterProjection(snapshot: Snapshot, t: LetterTarget, date: Date): LetterProjection {
  return projectLetter({
    version: t.version,
    lang: t.lang,
    enVariant: t.application.enVariant,
    application: {
      company: t.application.company,
      jobTitle: t.application.jobTitle,
      offerReference: t.application.offerReference,
    },
    identity: snapshot.profile.identity,
    template: t.selection.template,
    protectedTerms: [...new Set(snapshot.library.skills.filter((s) => !s.archived).map((s) => s.short))],
    date,
  });
}

export async function renderLetter(
  snapshot: Snapshot,
  t: LetterTarget,
  req: { format: 'pdf' | 'docx'; date?: Date },
): Promise<LetterRenderOutput> {
  const projection = letterProjection(snapshot, t, req.date ?? new Date());
  const compiled = compileLetter(projection);
  const docx = req.format === 'docx' ? await buildLetterDocx(projection) : null;
  const report = await runLetterAtsCheck({ projection, compiled, format: req.format, ...(docx ? { docx } : {}) });
  const identity = snapshot.profile.identity;
  const fileName = identity
    ? letterFileName({
        firstName: identity.firstName,
        lastName: identity.lastName,
        company: t.application.company,
        lang: t.lang,
        format: req.format,
      })
    : null;
  return { projection, compiled, docx, report, fileName };
}

const plain = (r: Rich) => r.map((s) => s.t).join('');

/** DOCX of a letter (F-LET-07): native paragraphs, no table, frame or text box, no embedded font. */
export async function buildLetterDocx(p: LetterProjection): Promise<Uint8Array> {
  const font = THEME_FONTS[p.theme.font].docxFamily;
  const accent = p.theme.accent.replace('#', '').toUpperCase();
  const page = PAGE_TWIPS[p.paper];
  const margin = Math.round(p.theme.margin * CM_TO_TWIP);
  const lines = (list: string[], right: boolean, after: number) =>
    new Paragraph({
      alignment: right ? AlignmentType.RIGHT : AlignmentType.LEFT,
      spacing: { after },
      children: list.map((l, i) => new TextRun({ text: l, ...(i > 0 ? { break: 1 } : {}) })),
    });
  const children: Paragraph[] = [
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: p.sender.name, bold: true, color: accent, size: halfPoints(p.theme.titleSize) })],
    }),
    lines(p.sender.lines, false, 280),
    lines(p.recipient.lines, p.recipient.right, 240),
    lines([p.date.text], p.date.right, 280),
    new Paragraph({
      spacing: { after: 280 },
      children: [
        ...(p.subject.label ? [new TextRun({ text: `${p.subject.label}${p.space}`, bold: true })] : []),
        new TextRun({ text: plain(p.subject.text), bold: true }),
      ],
    }),
    new Paragraph({ spacing: { after: 200 }, children: [new TextRun(p.salutation)] }),
    ...p.paragraphs.map(
      (para) => new Paragraph({ spacing: { after: 200 }, children: [new TextRun(plain(para.text))] }),
    ),
    new Paragraph({ spacing: { after: 320 }, children: [new TextRun(p.closing)] }),
    new Paragraph({ spacing: { after: 320 }, children: [new TextRun({ text: p.signature, bold: true })] }),
    new Paragraph({ children: [new TextRun(p.enclosure)] }),
  ];
  const doc = new Document({
    creator: p.meta.author,
    lastModifiedBy: p.meta.author,
    title: p.meta.title,
    styles: { default: { document: { run: { font, size: halfPoints(p.theme.bodySize) } } } },
    sections: [
      {
        properties: { page: { size: page, margin: { top: margin, right: margin, bottom: margin, left: margin } } },
        children,
      },
    ],
  });
  return new Uint8Array(await Packer.toBuffer(doc));
}
