// Typst compilation and measurement (§8.5 steps 3 and 4) with typst-ts-node-compiler 0.7.0
// (Typst 0.14.2). One compiler per process; the template reads `sys.inputs.project`. The photo and the
// icons of the links are given to Typst as shadow files under the workspace (§8.5), never through the
// projection.
import { createHash } from 'node:crypto';
import path from 'node:path';
import { NodeCompiler } from '@myriaddreamin/typst-ts-node-compiler';
import { AVAILABLE_LAYOUTS, linkKind, type LetterProjection, type LinkKind, type Projection } from '@cv/core';
import { capHeightEm, findMissingGlyphs, missingGlyphsIn, type MissingGlyph } from './fonts.js';
import { linkIconSvg } from './icons.js';
import { FONTS_DIR, TEMPLATES_DIR, templatePath } from './paths.js';

export class RenderError extends Error {
  constructor(
    readonly code: 'TYPST_ERROR' | 'UNKNOWN_FONT' | 'MISSING_GLYPH' | 'UNSUPPORTED_LAYOUT' | 'PHOTO_MISSING',
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'RenderError';
  }
}

let compiler: NodeCompiler | null = null;

function getCompiler(): NodeCompiler {
  compiler ??= NodeCompiler.create({ workspace: TEMPLATES_DIR, fontArgs: [{ fontPaths: [FONTS_DIR] }] });
  return compiler;
}

/** Shadow file of the photo currently mapped (absolute path under the workspace). */
let mappedPhoto: string | null = null;

/**
 * Maps the photo bytes as a shadow file and returns its Typst path (POSIX, rooted at the workspace).
 * The name carries the hash of the bytes: a new photo never reuses a cached image.
 */
function mapPhoto(bytes: Uint8Array): string {
  const name = `${createHash('sha256').update(bytes).digest('hex').slice(0, 16)}.jpg`;
  const abs = path.join(TEMPLATES_DIR, '__photo', name);
  const c = getCompiler();
  if (mappedPhoto !== abs) {
    if (mappedPhoto) c.unmapShadow(mappedPhoto);
    c.mapShadow(abs, Buffer.from(bytes));
    mappedPhoto = abs;
  }
  return `/__photo/${name}`;
}

/** Shadow files of the icons already mapped (absolute paths under the workspace). */
const mappedIcons = new Set<string>();

/**
 * Maps the icon of each kind of link in a color (ADR 0025) and returns their Typst paths, by kind. The
 * name carries the color: a new accent never reuses a cached image.
 */
function mapIcons(color: string): Record<LinkKind, string> {
  const out = {} as Record<LinkKind, string>;
  for (const kind of linkKind.options) {
    const name = `${kind}-${color.slice(1).toLowerCase()}.svg`;
    const abs = path.join(TEMPLATES_DIR, '__icons', name);
    if (!mappedIcons.has(abs)) {
      getCompiler().mapShadow(abs, Buffer.from(linkIconSvg(kind, color)));
      mappedIcons.add(abs);
    }
    out[kind] = `/__icons/${name}`;
  }
  return out;
}

/**
 * Projection as given to the template: the photo path is added when the projection has a photo, the
 * paths of the icons (in the accent color) when a contact has one.
 */
function templateInput(projection: Projection, measure: boolean, photo: Uint8Array | null): string {
  if (projection.photo && !photo) {
    throw new RenderError('PHOTO_MISSING', 'photo demandée par la projection, mais aucune image fournie');
  }
  const photoSrc = projection.photo && photo ? mapPhoto(photo) : null;
  const icons = projection.header.contacts.some((c) => c.icon) ? mapIcons(projection.theme.accent) : null;
  return JSON.stringify({ ...projection, measure, photoSrc, icons });
}

interface Diagnostic {
  message: string;
  severity?: number;
}

function messages(d: { shortDiagnostics: unknown[] } | null): string[] {
  return ((d?.shortDiagnostics ?? []) as Diagnostic[]).map((x) => x.message);
}

interface CompiledDoc {
  pdf: Uint8Array;
  pages: number;
  endY: number;
  warnings: string[];
}

function compileOnce(projection: Projection, measure: boolean, photo: Uint8Array | null, withPdf = true): CompiledDoc {
  return compileTemplate(projection.layout, templateInput(projection, measure, photo), withPdf);
}

/** Compiles a template of packages/render/templates/ with its JSON input (CV or letter projection). */
function compileTemplate(layout: string, input: string, withPdf = true): CompiledDoc {
  const c = getCompiler();
  const res = c.compile({ mainFilePath: templatePath(layout), inputs: { project: input } });
  if (res.hasError() || !res.result) {
    const errs = messages(res.takeDiagnostics());
    throw new RenderError('TYPST_ERROR', `compilation Typst impossible : ${errs.join(' ; ')}`, { diagnostics: errs });
  }
  const warnings = messages(res.takeWarnings());
  // §8.5: any "unknown font family" diagnostic is blocking (text would silently disappear).
  const unknownFont = warnings.filter((w) => /unknown font family/i.test(w));
  if (unknownFont.length > 0) {
    throw new RenderError('UNKNOWN_FONT', `police du thème introuvable : ${unknownFont.join(' ; ')}`, {
      diagnostics: unknownFont,
    });
  }
  const doc = res.result;
  const pdf = withPdf ? c.pdf(doc) : new Uint8Array();
  const marks = c.query(doc, { selector: '<cv-end>', field: 'value' }) as Array<{ page: number; y: string }>;
  const last = marks[marks.length - 1];
  const endY = last ? parseFloat(last.y) : 0;
  return { pdf: new Uint8Array(pdf), pages: doc.numOfPages, endY, warnings };
}

const PAPER_HEIGHT_PT = { a4: 841.89, 'us-letter': 792 } as const;
const CM_TO_PT = 72 / 2.54;

export interface Measure {
  /** Height of the content, in pt (measure compile with `page(height: auto)`). */
  contentHeight: number;
  /** Usable height of the page, in pt. */
  usableHeight: number;
  /** contentHeight / usableHeight (1 = full page). */
  fillRatio: number;
  /** Approximate overflow in lines of body text; 0 when the content fits. */
  overflowLines: number;
  linePitch: number;
}

export interface CompileResult {
  /** The A4/Letter PDF: what is previewed and exported (ATS-15). */
  pdf: Uint8Array;
  pages: number;
  /** Single tall page PDF used to measure, and to check the text of an overflowing CV (§12.2). */
  measurePdf: Uint8Array;
  measure: Measure;
  warnings: string[];
  ms: number;
}

/** Blocks characters absent from the theme font, citing the character and the element. */
export function assertGlyphs(projection: Projection): void {
  const missing: MissingGlyph[] = findMissingGlyphs(projection);
  if (missing.length > 0) {
    const list = missing.map((m) => `« ${m.char} » (${m.codePoint}) dans ${m.path}`).join(' ; ');
    throw new RenderError('MISSING_GLYPH', `caractère absent de la police du thème : ${list}`, { missing });
  }
}

/** Compiles the A4/Letter PDF and the measure PDF. `photo`: JPEG bytes, required when `projection.photo` is set. */
export function compileProjection(projection: Projection, photo: Uint8Array | null = null): CompileResult {
  if (!(AVAILABLE_LAYOUTS as readonly string[]).includes(projection.layout)) {
    throw new RenderError(
      'UNSUPPORTED_LAYOUT',
      `mise en page non disponible : ${projection.layout} (prévue en V2) ; choisissez ats-classique ou visuel`,
    );
  }
  const t0 = performance.now();
  assertGlyphs(projection);
  const main = compileOnce(projection, false, photo);
  const measured = compileOnce(projection, true, photo);
  return toResult(projection, main, measured, t0);
}

/** Page, measure and overflow of a compiled document (CV or letter): same rules (§8.5 step 4). */
function toResult(
  p: Pick<Projection, 'theme' | 'paper'>,
  main: CompiledDoc,
  measured: CompiledDoc,
  t0: number,
): CompileResult {
  const margin = p.theme.margin * CM_TO_PT;
  const usableHeight = PAPER_HEIGHT_PT[p.paper] - 2 * margin;
  const contentHeight = Math.max(0, measured.endY - margin);
  const linePitch = (capHeightEm(p.theme.font) + p.theme.leading) * p.theme.bodySize;
  const overflow = contentHeight - usableHeight;
  getCompiler().evictCache(30);
  return {
    pdf: main.pdf,
    pages: main.pages,
    measurePdf: measured.pdf,
    measure: {
      contentHeight,
      usableHeight,
      fillRatio: contentHeight / usableHeight,
      overflowLines: main.pages > 1 || overflow > 0 ? Math.max(1, Math.ceil(overflow / linePitch)) : 0,
      linePitch,
    },
    warnings: [...new Set([...main.warnings, ...measured.warnings])],
    ms: performance.now() - t0,
  };
}

export interface BulletCost {
  id: string;
  entryId: string;
  section: string;
  /** Lines of body text the bullet takes, spacing included (one decimal). */
  lines: number;
}

/**
 * Line cost of each bullet shown (MCP-11): the measure compile is run again without the bullet, and the
 * difference of height is converted into lines of body text. Exact, and the template is untouched
 * (ADR 0014); one measure compile per bullet, a few milliseconds each.
 */
export function bulletLineCosts(
  projection: Projection,
  photo: Uint8Array | null,
  compiled: CompileResult,
): BulletCost[] {
  const margin = projection.theme.margin * CM_TO_PT;
  const base = compiled.measure.contentHeight;
  const out: BulletCost[] = [];
  projection.sections.forEach((section, si) => {
    section.entries.forEach((entry, ei) => {
      entry.bullets.forEach((bullet) => {
        const sections = projection.sections.map((s, i) =>
          i !== si
            ? s
            : {
                ...s,
                entries: s.entries.map((e, j) =>
                  j !== ei ? e : { ...e, bullets: e.bullets.filter((b) => b.id !== bullet.id) },
                ),
              },
        );
        const without = compileOnce({ ...projection, sections }, true, photo, false);
        const height = Math.max(0, without.endY - margin);
        out.push({
          id: bullet.id,
          entryId: entry.id,
          section: section.key,
          lines: Math.round(((base - height) / compiled.measure.linePitch) * 10) / 10,
        });
      });
    });
  });
  getCompiler().evictCache(30);
  return out;
}

/** SVG of the compiled document (low-resolution preview image for MCP-19). */
export function compileSvg(projection: Projection, photo: Uint8Array | null = null): string {
  const res = getCompiler().compile({
    mainFilePath: templatePath(projection.layout),
    inputs: { project: templateInput(projection, false, photo) },
  });
  if (!res.result) throw new RenderError('TYPST_ERROR', 'compilation Typst impossible');
  return getCompiler().svg(res.result);
}

/** Visible strings of a letter projection, for the glyph check. */
export function letterStrings(p: LetterProjection): Array<{ path: string; text: string }> {
  const out: Array<{ path: string; text: string }> = [];
  const add = (where: string, t: string | null) => {
    if (t) out.push({ path: where, text: t });
  };
  add('sender.name', p.sender.name);
  p.sender.lines.forEach((l, i) => add(`sender.lines[${i}]`, l));
  p.recipient.lines.forEach((l, i) => add(`recipient.lines[${i}]`, l));
  add('date', p.date.text);
  add('subject.label', p.subject.label);
  p.subject.text.forEach((s, i) => add(`subject.text[${i}]`, s.t));
  add('salutation', p.salutation);
  p.paragraphs.forEach((para, i) => para.text.forEach((s, j) => add(`paragraphs[${i}][${j}]`, s.t)));
  add('closing', p.closing);
  add('signature', p.signature);
  add('enclosure', p.enclosure);
  return out;
}

/**
 * Compiles a letter (F-LET-07): the A4/Letter PDF and the measure PDF, with the same glyph check, page
 * and overflow rules as the CV (1 page strict, overflow in lines).
 */
export function compileLetter(projection: LetterProjection): CompileResult {
  const t0 = performance.now();
  const missing = missingGlyphsIn(projection.theme.font, letterStrings(projection));
  if (missing.length > 0) {
    const list = missing.map((m) => `« ${m.char} » (${m.codePoint}) dans ${m.path}`).join(' ; ');
    throw new RenderError('MISSING_GLYPH', `caractère absent de la police du thème : ${list}`, { missing });
  }
  const main = compileTemplate(projection.layout, JSON.stringify({ ...projection, measure: false }));
  const measured = compileTemplate(projection.layout, JSON.stringify({ ...projection, measure: true }));
  return toResult(projection, main, measured, t0);
}
