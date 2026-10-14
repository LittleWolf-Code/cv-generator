// Layouts and themes (F-MOD-01 to 03, ADR 0017). Zod-free on purpose: the interface imports this module
// through `@cv/core/selection`, like the selection operations.
import { contrastBetween, contrastOnWhite, formatRatio, tintOf } from './color.js';

/** Layouts available in the MVP; `ats-moderne` (F-MOD-04) stays in the schema for the V2. */
export const AVAILABLE_LAYOUTS = ['ats-classique', 'visuel'] as const;
export type AvailableLayout = (typeof AVAILABLE_LAYOUTS)[number];

export const LAYOUT_LABELS: Record<AvailableLayout, string> = {
  'ats-classique': 'ATS classique',
  visuel: 'Visuel',
};

/** Badge of the visual layout (F-MOD-03), in the interface, the ATS report and the MCP responses. */
export const HUMAN_READING_NOTICE = 'Destiné à une lecture humaine, déconseillé pour les portails ATS';

/** The badge inside a sentence: first letter in lower case only (« ATS » stays as is). */
export function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** Remark on the DOCX of the visual layout: F-EXP-02 forbids tables and text boxes, so it stays one column. */
export const VISUAL_DOCX_NOTICE =
  "Le DOCX garde une seule colonne : la mise en page visuelle n'existe qu'en PDF (un DOCX ne peut avoir ni tableau ni zone de texte, F-EXP-02)";

/** True for the layouts whose layout rules are imposed by the code (§4): every one but `visuel`. */
export function isAtsLayout(layout: string): boolean {
  return layout !== 'visuel';
}

/** Theme fonts: static OFL TTF files of packages/render/fonts/ (ATS-11). */
export const THEME_FONT_IDS = ['carlito', 'source-sans-3', 'ibm-plex-sans'] as const;
export type ThemeFontId = (typeof THEME_FONT_IDS)[number];

export interface ThemeFontMeta {
  label: string;
  /** Typst family name. */
  family: string;
  /** Font with the same metrics in Word (F-EXP-02), or null: the DOCX then declares Calibri, with a warning. */
  metricEquivalent: string | null;
  /**
   * Word spacing (Typst `text.spacing`, 1 = the font's own space). Poppler's pdftotext glues words whose
   * gap is narrower than about 0.21 em: Source Sans 3 (space of 0.20 em) is widened to 0.25 em, the width
   * of IBM Plex Sans (ADR 0017, found when Poppler was installed).
   */
  wordSpacing: number;
  /**
   * Cap height of the regular face, in em (OS/2 table; fonts.test.ts compares it with the TTF). Typst
   * measures `par.leading` from the baseline to the cap height of the next line: the line pitch is
   * cap height + leading, so the leading of a given pitch depends on the font (ADR 0020).
   */
  capHeight: number;
}

export const THEME_FONT_META: Record<ThemeFontId, ThemeFontMeta> = {
  carlito: {
    label: 'Carlito (métriques de Calibri)',
    family: 'Carlito',
    metricEquivalent: 'Calibri',
    wordSpacing: 1,
    capHeight: 0.6416,
  },
  'source-sans-3': {
    label: 'Source Sans 3',
    family: 'Source Sans 3',
    metricEquivalent: null,
    wordSpacing: 1.25,
    capHeight: 0.66,
  },
  'ibm-plex-sans': {
    label: 'IBM Plex Sans',
    family: 'IBM Plex Sans',
    metricEquivalent: null,
    wordSpacing: 1,
    capHeight: 0.698,
  },
};

/** Font declared in the DOCX: the metric equivalent of the theme font, otherwise Calibri (F-EXP-02). */
export const DOCX_FALLBACK_FONT = 'Calibri';

/** NF-10, F-MOD-01: minimum contrast of the accent color on white. */
export const MIN_CONTRAST = 4.5;

/** Accent swatches offered by the interface; any other color is allowed if its contrast is enough. */
export const ACCENT_SWATCHES: ReadonlyArray<{ name: string; hex: string }> = [
  { name: 'Marine', hex: '#1F4E79' },
  { name: 'Pétrole', hex: '#0B5563' },
  { name: 'Forêt', hex: '#2E5E3A' },
  { name: 'Bordeaux', hex: '#7B2C3F' },
  { name: 'Prune', hex: '#5B3A73' },
  { name: 'Graphite', hex: '#37474F' },
];

/** Refusal message of an accent color, or null when it is valid (#RRGGBB, contrast >= 4.5:1 on white). */
export function accentProblem(hex: string): string | null {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return 'couleur #RRGGBB attendue';
  const ratio = contrastOnWhite(hex);
  if (ratio < MIN_CONTRAST) {
    return `contraste de ${formatRatio(ratio)} sur blanc, insuffisant (minimum 4,5:1) : choisissez une couleur plus foncée`;
  }
  return null;
}

/** Color of secondary text (organization, place) in the visual layout: 8,4:1 on white. */
export const MUTED_TEXT = '#4D4D4D';

/** Share of the accent in the tint of the visual layout. */
const TINT_SHARE = 0.08;

/**
 * Background of the band, the sidebar and the section pills of the visual layout (ADR 0019): a light tint
 * of the accent, kept only if the accent and the muted text still reach 4.5:1 on it (ATS-14: no text with
 * a low contrast); otherwise no background.
 */
export function sidebarTint(accent: string): string | null {
  const tint = tintOf(accent, TINT_SHARE);
  return contrastBetween(accent, tint) >= MIN_CONTRAST && contrastBetween(MUTED_TEXT, tint) >= MIN_CONTRAST
    ? tint
    : null;
}
