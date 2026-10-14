// Minimal DOCX export (F-EXP-02) from the same projection as the PDF: native heading styles and
// paragraphs, no table, text box or frame, contacts in the body, dates aligned by a right tab stop,
// single-level "•" bullets, no embedded font (Carlito is declared as its metric equivalent Calibri).
// The photo (§5.2) is an inline ImageRun in the name paragraph, pushed to the right margin by a right
// tab stop: never floating, never in a header.
import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  Tab,
  TabStopType,
  TextRun,
  type ParagraphChild,
} from 'docx';
import type { Projection, Rich } from '@cv/core';
import { THEME_FONTS } from './fonts.js';

const CM_TO_TWIP = 567;
const PAGE_TWIPS = { a4: { width: 11906, height: 16838 }, 'us-letter': { width: 12240, height: 15840 } } as const;
const BULLETS = 'bullets';

const halfPoints = (pt: number) => Math.round(pt * 2);
/** docx sizes images in pixels at 96 dpi. */
const CM_TO_PX = 96 / 2.54;

function runs(r: Rich, style: { bold?: boolean; italics?: boolean } = {}): ParagraphChild[] {
  return r.map((s) =>
    s.url
      ? new ExternalHyperlink({ link: s.url, children: [new TextRun({ text: s.t, style: 'Hyperlink', ...style })] })
      : new TextRun({ text: s.t, ...style }),
  );
}

/** `photo`: JPEG bytes, required when `p.photo` is set (same rule as the Typst compilation). */
export async function buildDocx(p: Projection, photo: Uint8Array | null = null): Promise<Uint8Array> {
  const font = THEME_FONTS[p.theme.font].docxFamily;
  const accent = p.theme.accent.replace('#', '').toUpperCase();
  const page = PAGE_TWIPS[p.paper];
  const margin = Math.round(p.theme.margin * CM_TO_TWIP);
  const usableWidth = page.width - 2 * margin;
  // Vertical scale of the PDF (ADR 0020). Word's single line spacing already puts about 1.2 times the
  // size between two baselines, as the leading of the PDF does: paragraphs of one entry get no extra
  // space, and the entries and headings get what the PDF adds above the blank between two lines.
  const lineGap = p.theme.leading * p.theme.bodySize;
  const extra = (gap: number) => Math.max(0, Math.round((gap - lineGap) * 20));

  const children: Paragraph[] = [];
  const name: ParagraphChild[] = [new TextRun({ text: p.header.name, bold: true, size: halfPoints(p.theme.nameSize) })];
  if (p.photo) {
    if (!photo) throw new Error('photo demandée par la projection, mais aucune image fournie');
    name.push(
      new TextRun({ children: [new Tab()] }),
      new ImageRun({
        type: 'jpg',
        data: photo,
        transformation: {
          width: Math.round(p.photo.width * CM_TO_PX),
          height: Math.round(((p.photo.width * 4) / 3) * CM_TO_PX),
        },
        altText: { name: p.photo.alt, description: p.photo.alt },
      }),
    );
  }
  children.push(
    new Paragraph({
      ...(p.photo ? { tabStops: [{ type: TabStopType.RIGHT, position: usableWidth }] } : {}),
      children: name,
    }),
  );
  if (p.header.title) {
    children.push(
      new Paragraph({
        children: p.header.title.map(
          (s) => new TextRun({ text: s.t, bold: true, color: accent, size: halfPoints(p.theme.titleSize) }),
        ),
      }),
    );
  }
  if (p.header.contacts.length > 0) {
    const parts: ParagraphChild[] = [];
    p.header.contacts.forEach((c, i) => {
      if (i > 0) parts.push(new TextRun(p.punct.pipeSep));
      if (c.label) parts.push(new TextRun(`${c.label}${p.punct.space}`));
      // The icon of a link is never drawn (T-DOCX-01: the photo is the only drawing): the URL stands
      // alone, as in the ATS layout (ADR 0025).
      // Only displayed URLs are hyperlinks (T-DOCX-01: the text of each hyperlink is the URL shown).
      if (c.kind === 'link' && c.url) {
        parts.push(
          new ExternalHyperlink({ link: c.url, children: [new TextRun({ text: c.text, style: 'Hyperlink' })] }),
        );
      } else {
        parts.push(new TextRun(c.text));
      }
    });
    children.push(new Paragraph({ children: parts }));
  }
  if (p.header.summary) children.push(new Paragraph({ spacing: { before: 120 }, children: runs(p.header.summary) }));

  for (const s of p.sections) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(s.heading)] }));
    for (const e of s.entries) {
      const head: ParagraphChild[] = runs(e.title, { bold: true });
      if (e.dates) head.push(new TextRun({ children: [new Tab(), e.dates] }));
      children.push(
        new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: usableWidth }],
          spacing: { before: extra(p.theme.entryGap) },
          keepNext: true,
          children: head,
        }),
      );
      if (e.subtitle)
        children.push(new Paragraph({ keepNext: e.bullets.length > 0, children: runs(e.subtitle, { italics: true }) }));
      for (const b of e.bullets)
        children.push(new Paragraph({ numbering: { reference: BULLETS, level: 0 }, children: runs(b.text) }));
    }
    for (const l of s.lines) {
      const parts: ParagraphChild[] = [];
      if (l.label) parts.push(new TextRun({ text: l.label, bold: true }), new TextRun(p.punct.labelSep));
      l.items.forEach((it, i) => {
        if (i > 0) parts.push(new TextRun(l.sep));
        parts.push(...runs(it));
      });
      children.push(new Paragraph({ children: parts }));
    }
  }
  if (p.closing)
    children.push(
      new Paragraph({ spacing: { before: extra(p.theme.sectionGap) }, children: [new TextRun(p.closing)] }),
    );

  const doc = new Document({
    creator: p.meta.author,
    lastModifiedBy: p.meta.author,
    title: p.meta.title,
    styles: {
      default: {
        document: {
          run: { font, size: halfPoints(p.theme.bodySize) },
          paragraph: { spacing: { after: 0 } },
        },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font, bold: true, size: halfPoints(p.theme.headingSize), color: accent },
          paragraph: { spacing: { before: extra(p.theme.sectionGap), after: 80 }, keepNext: true },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: BULLETS,
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 240 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: { page: { size: page, margin: { top: margin, right: margin, bottom: margin, left: margin } } },
        children,
      },
    ],
  });
  return new Uint8Array(await Packer.toBuffer(doc));
}
