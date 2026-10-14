// Render JSON (§8.5 step 2): the single input of the Typst and DOCX templates. Flat, resolved for
// one language, with every visible string (labels included) and the expected texts per field.
import type { DateStyle } from './dates.js';
import type { Labels } from './labels.js';
import type { EnVariant, Lang } from './schema/common.js';
import type { Density, Layout, SectionKey, ThemeFont } from './schema/preset.js';
import type { LinkKind } from './schema/profile.js';
import type { Segment } from './text/segments.js';

export type Rich = Segment[];

export interface ProjectionTheme {
  font: ThemeFont;
  /** Typst family name of the theme font. */
  family: string;
  /** Word spacing of the theme font (Typst `text.spacing`, 1 = its own space). */
  wordSpacing: number;
  accent: string;
  /** Secondary text (organization, place) of the visual layout, >= 4.5:1 on white and on the tint. */
  muted: string;
  /** Background of the visual band, sidebar and pills (tint of the accent), or null if the contrast is too low. */
  tint: string | null;
  density: Density;
  bodySize: number;
  nameSize: number;
  titleSize: number;
  headingSize: number;
  /**
   * Line spacing (Typst `par.leading`, from a baseline to the cap height of the next line), in em:
   * the pitch of the density minus the cap height of the font (ADR 0020).
   */
  leading: number;
  /**
   * Line breaking of the paragraphs (Typst `par.linebreaks`): `optimized` weighs the whole paragraph,
   * which evens the rag and, with the runt cost of the templates, avoids a last line of one word (ADR
   * 0020). A string, so it comes from the projection (no literal text in a template).
   */
  linebreaks: 'optimized';
  /** Page margin, in cm (>= 1.5). */
  margin: number;
  /** Vertical gaps, in pt. */
  sectionGap: number;
  entryGap: number;
}

export interface ProjectedContact {
  kind: 'email' | 'phone' | 'location' | 'link';
  label: string | null;
  text: string;
  url: string | null;
  /**
   * Icon drawn before the text (link of the `icon` style, ADR 0025): visual layout only, null elsewhere
   * (ATS-08), where the URL stands alone; the DOCX never draws it (T-DOCX-01). `alt`: the name of the
   * link, in the PDF tags only (never visible).
   */
  icon: { kind: LinkKind; alt: string } | null;
}

export interface ProjectedEntry {
  id: string;
  title: Rich;
  dates: string | null;
  subtitle: Rich | null;
  bullets: Array<{ id: string; text: Rich }>;
}

export interface ProjectedLine {
  label: string | null;
  items: Rich[];
  /** Separator between items. */
  sep: string;
}

/** Both arrays are always present (one is empty): the template iterates without string tests. */
export interface ProjectedSection {
  key: Exclude<SectionKey, 'summary'>;
  heading: string;
  /** Visual layout: section of the sidebar (left column, ADR 0019); always false in the ATS layouts. */
  side: boolean;
  entries: ProjectedEntry[];
  lines: ProjectedLine[];
}

/** Photo of the header (§5.2): image only, placed top right by the template's photo() function. */
export interface ProjectedPhoto {
  /** Width on the page, in cm (the height follows the 3:4 ratio). */
  width: number;
  /** Gap between the identity block and the photo, in cm (the identity block is narrowed by width + gap). */
  gap: number;
  /** Alternative text (« Photo de Prénom Nom »), in the PDF tags only (ADR 0020). */
  alt: string;
}

export interface ExpectedField {
  /** Readable location (`experience.exp-medtech-2023.bullets.b-1`). */
  path: string;
  text: string;
}

export interface ProjectionIssue {
  code:
    | 'UNTRANSLATED'
    | 'LANGUAGE_LEVEL_MISSING'
    | 'IDENTITY_MISSING'
    | 'ORPHAN_REF'
    | 'UNKNOWN_VARIANT'
    | 'PENDING_VARIANT'
    | 'MIXED_DATE_PRECISION'
    | 'EMPTY_SELECTION'
    | 'PHOTO_MISSING'
    | 'SPELLING_VARIANT'
    | 'FORMULA_MISMATCH';
  message: string;
  /** Target of the fix (§7.2 `list untranslated` shape). */
  target?: { collection: string; itemId: string; bulletId?: string; variantId?: string; field: string };
}

export interface Projection {
  version: 1;
  layout: Layout;
  lang: Lang;
  enVariant: EnVariant;
  paper: 'a4' | 'us-letter';
  /** Set by the renderer: `true` compiles with `page(height: auto)` to measure the real height. */
  measure: boolean;
  dateStyle: DateStyle;
  regulatoryPlacement: 'skills-subgroup' | 'own-section';
  /** Set when the photo option is checked and the identity has a photo; never carries the image itself. */
  photo: ProjectedPhoto | null;
  meta: { title: string; author: string };
  theme: ProjectionTheme;
  punct: Pick<Labels, 'labelSep' | 'listSep' | 'pipeSep' | 'space'>;
  header: {
    name: string;
    title: Rich | null;
    contacts: ProjectedContact[];
    summary: Rich | null;
  };
  sections: ProjectedSection[];
  closing: string | null;
  /** Active, non-empty section headings, in order (T-ATS-06). */
  headings: string[];
  /** Expected rendered texts, field by field (T-ATS-02, T-ATS-03). */
  expected: ExpectedField[];
  /** Entries with their date range (T-ATS-07). */
  datedEntries: Array<{ id: string; title: string; dates: string }>;
  /** Identity values to find before the first heading (T-ATS-08). */
  identity: {
    fullName: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    city: string;
    country: string;
  } | null;
  warnings: ProjectionIssue[];
  /** Any blocking issue forbids the export (F-EXP-03). */
  blocking: ProjectionIssue[];
}
