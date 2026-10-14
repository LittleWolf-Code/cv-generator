// Theme fonts (ATS-11): static OFL TTF files versioned in packages/render/fonts/, embedded with
// ToUnicode by Typst. Glyph coverage is checked before compiling: with `fallback: false`, a missing
// glyph would silently become U+0000 in the extracted text (ADR 0002).
import { existsSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as fontkit from 'fontkit';
import { DOCX_FALLBACK_FONT, THEME_FONT_META, type Projection, type ThemeFont } from '@cv/core';
import { FONTS_DIR } from './paths.js';

export interface ThemeFontInfo {
  family: string;
  files: string[];
  /** PostScript names expected in the PDF (T-ATS-09). */
  postscriptNames: string[];
  /** Font declared in the DOCX (F-EXP-02): the metric equivalent, otherwise Calibri. */
  docxFamily: string;
  /** False when the DOCX font has other metrics: Word paginates differently from the PDF (T-DOCX-03). */
  docxMetricMatch: boolean;
}

/** Files and PostScript names (Regular, Bold, Italic, BoldItalic) of each theme font (ADR 0007, ADR 0017). */
const FACES: Record<ThemeFont, { files: string[]; postscriptNames: string[] }> = {
  carlito: {
    files: ['Carlito-Regular.ttf', 'Carlito-Bold.ttf', 'Carlito-Italic.ttf', 'Carlito-BoldItalic.ttf'],
    postscriptNames: ['Carlito-Regular', 'Carlito-Bold', 'Carlito-Italic', 'Carlito-BoldItalic'],
  },
  'source-sans-3': {
    files: ['SourceSans3-Regular.ttf', 'SourceSans3-Bold.ttf', 'SourceSans3-It.ttf', 'SourceSans3-BoldIt.ttf'],
    postscriptNames: ['SourceSans3-Regular', 'SourceSans3-Bold', 'SourceSans3-It', 'SourceSans3-BoldIt'],
  },
  'ibm-plex-sans': {
    files: ['IBMPlexSans-Regular.ttf', 'IBMPlexSans-Bold.ttf', 'IBMPlexSans-Italic.ttf', 'IBMPlexSans-BoldItalic.ttf'],
    postscriptNames: ['IBMPlexSans', 'IBMPlexSans-Bold', 'IBMPlexSans-Italic', 'IBMPlexSans-BoldItalic'],
  },
};

export const THEME_FONTS = Object.fromEntries(
  Object.entries(FACES).map(([id, faces]) => {
    const meta = THEME_FONT_META[id as ThemeFont];
    return [
      id,
      {
        family: meta.family,
        ...faces,
        docxFamily: meta.metricEquivalent ?? DOCX_FALLBACK_FONT,
        docxMetricMatch: meta.metricEquivalent !== null,
      },
    ];
  }),
) as Record<ThemeFont, ThemeFontInfo>;

type LoadedFont = {
  hasGlyphForCodePoint(cp: number): boolean;
  postscriptName: string;
  capHeight: number;
  unitsPerEm: number;
};
const cache = new Map<string, LoadedFont[]>();

function loadTheme(font: ThemeFont): LoadedFont[] {
  let fonts = cache.get(font);
  if (!fonts) {
    fonts = THEME_FONTS[font].files.map((f) => fontkit.openSync(path.join(FONTS_DIR, f)) as unknown as LoadedFont);
    cache.set(font, fonts);
  }
  return fonts;
}

/** Cap height of the regular face, in em (used to convert a height into lines). */
export function capHeightEm(font: ThemeFont): number {
  const regular = loadTheme(font)[0]!;
  return regular.capHeight / regular.unitsPerEm;
}

export interface MissingGlyph {
  char: string;
  codePoint: string;
  path: string;
}

/** Every visible string of the projection, with its location. */
export function visibleStrings(p: Projection): Array<{ path: string; text: string }> {
  const out: Array<{ path: string; text: string }> = [];
  const add = (where: string, s: string | null | undefined) => {
    if (s) out.push({ path: where, text: s });
  };
  const addRich = (where: string, r: Array<{ t: string }> | null) => r?.forEach((s, i) => add(`${where}[${i}]`, s.t));
  add('header.name', p.header.name);
  addRich('header.title', p.header.title);
  p.header.contacts.forEach((c, i) => {
    add(`header.contacts[${i}].label`, c.label);
    add(`header.contacts[${i}].text`, c.text);
  });
  addRich('header.summary', p.header.summary);
  for (const s of p.sections) {
    add(`${s.key}.heading`, s.heading);
    for (const e of s.entries) {
      addRich(`${s.key}.${e.id}.title`, e.title);
      add(`${s.key}.${e.id}.dates`, e.dates);
      addRich(`${s.key}.${e.id}.subtitle`, e.subtitle);
      e.bullets.forEach((b) => addRich(`${s.key}.${e.id}.${b.id}`, b.text));
    }
    s.lines.forEach((l, i) => {
      add(`${s.key}.lines[${i}].label`, l.label);
      add(`${s.key}.lines[${i}].sep`, l.sep);
      l.items.forEach((it, j) => addRich(`${s.key}.lines[${i}].items[${j}]`, it));
    });
  }
  add('closing', p.closing);
  for (const [k, v] of Object.entries(p.punct)) add(`punct.${k}`, v);
  return out;
}

/** Characters absent from any face of the theme font (cmap), with the element that contains them. */
export function findMissingGlyphs(p: Projection): MissingGlyph[] {
  return missingGlyphsIn(p.theme.font, visibleStrings(p));
}

/** Same check on any list of visible strings (the letter projection, ADR 0016). */
export function missingGlyphsIn(font: ThemeFont, strings: Array<{ path: string; text: string }>): MissingGlyph[] {
  const fonts = loadTheme(font);
  const missing: MissingGlyph[] = [];
  const seen = new Set<string>();
  for (const { path: where, text } of strings) {
    for (const ch of text) {
      const cp = ch.codePointAt(0)!;
      if (cp === 0x20 || seen.has(`${ch}@${where}`)) continue;
      if (!fonts.every((f) => f.hasGlyphForCodePoint(cp))) {
        seen.add(`${ch}@${where}`);
        missing.push({ char: ch, codePoint: `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`, path: where });
      }
    }
  }
  return missing;
}

/**
 * typst-ts-node-compiler 0.7.0 always loads system fonts (ADR 0002). Custom font paths take
 * precedence, but a system copy of the theme font is reported so a version drift can be explained.
 */
export function systemCopiesOf(font: ThemeFont): string[] {
  const dirs = [
    path.join(process.env.WINDIR ?? 'C:\\Windows', 'Fonts'),
    path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local'), 'Microsoft', 'Windows', 'Fonts'),
    '/usr/share/fonts',
    path.join(os.homedir(), '.fonts'),
  ];
  const family = THEME_FONTS[font].family.toLowerCase();
  const found: string[] = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    try {
      for (const f of readdirSync(dir)) if (f.toLowerCase().startsWith(family)) found.push(path.join(dir, f));
    } catch {
      // Unreadable directory: nothing to report.
    }
  }
  return found;
}
