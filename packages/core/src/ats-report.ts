// Shape of the ATS readability report (§12.3), shared by the API, the MCP server and the UI.
import type { ProjectionIssue } from './projection.js';

/** green = vert, orange, red = rouge (blocks the export), na = sans objet. */
export type CriterionStatus = 'green' | 'orange' | 'red' | 'na';

export interface AtsCriterion {
  /** `T-ATS-01`…`T-ATS-17`, `T-DOCX-01`…`T-DOCX-03`. */
  id: string;
  label: string;
  status: CriterionStatus;
  /** French, actionable message. Never contains the e-mail or the phone number. */
  message: string;
  details?: Record<string, unknown>;
}

export type ExtractorStatus = 'ok' | 'absent' | 'not-poppler' | 'error';

/**
 * Fields detected in one extraction (F-ATS-02), with the same definitions as T-ATS-06 to 08. The
 * contact values are the user's own: the MCP server never returns this part of the report.
 */
export interface DetectedFields {
  /** `pdf.js`, `pdftotext` or `docx`. */
  extractor: string;
  /** First non-empty line, expected to be "Prénom Nom" (T-ATS-06). */
  name: { line: string | null; ok: boolean };
  /** Lines equal (canon) to a heading, in reading order, against `projection.headings` (T-ATS-06). */
  headings: { found: string[]; expected: string[]; ok: boolean };
  /** Before the first heading, each on one line (T-ATS-08); null without identity. */
  contacts: {
    /** Addresses found by the annex B.5 pattern before the first heading. */
    emails: string[];
    /** Numbers found by libphonenumber before the first heading. */
    phones: string[];
    email: boolean;
    phone: boolean;
    location: boolean;
    /** Other addresses and numbers anywhere in the text (orange in T-ATS-08). */
    otherEmails: number;
    otherPhones: number;
  } | null;
  /** One date range per entry, whole on the title line or the next one (T-ATS-07). */
  entries: Array<{ id: string; title: string; dates: string; line: string | null; ok: boolean }>;
}

export interface AtsReport {
  format: 'pdf' | 'docx';
  layout: string;
  lang: string;
  pages: number;
  fillRatio: number;
  overflowLines: number;
  criteria: AtsCriterion[];
  /** True when a criterion is red or the projection has a blocking issue: export refused. */
  blocking: boolean;
  /** False when only pdf.js could run (Poppler missing): the report is "incomplet". */
  complete: boolean;
  extractors: { pdfjs: ExtractorStatus; pdftotext: ExtractorStatus; pdftotextDetail?: string };
  projection: { blocking: ProjectionIssue[]; warnings: ProjectionIssue[] };
  /** Raw extracted texts (pdf.js lines rebuilt with hasEOL; pdftotext -raw; mammoth for DOCX). */
  text: { pdfjs: string; pdftotext: string | null; docx: string | null };
  /** Fields detected in each extraction (F-ATS-02). */
  detected: DetectedFields[];
  /**
   * Visual layout (F-MOD-03, ADR 0017): the badge « destiné à une lecture humaine… », and for a DOCX the
   * remark that it stays one column. Absent for the ATS layouts and the letter.
   */
  notice?: { badge: string; docx: string | null };
}

export function hasRed(criteria: readonly AtsCriterion[]): boolean {
  return criteria.some((c) => c.status === 'red');
}
