// Text of a file of import/ (MCP-08 get_import_file_text, F-IMP-03): a PDF by pdf.js, a DOCX by
// mammoth, Markdown and text as they are. A PDF without a text layer (scanned) has no usable text: the
// caller answers « joignez le fichier directement dans la conversation, ou fournissez le DOCX ». The
// text is external, untrusted data (§7.5): the caller marks it and masks the contact details.
import { unzipSync } from 'fflate';
import { extractDocxText } from './ats/docx-check.js';
import { extractWithPdfjs } from './ats/extract.js';

export interface ImportText {
  text: string;
  /** Pages of a PDF; for a DOCX, the count saved by Word (docProps/app.xml), null when absent. */
  pages: number | null;
  /** false for a scanned PDF (fewer than MIN_LETTERS letters extracted). */
  hasTextLayer: boolean;
}

/** Below this many letters, a PDF is considered scanned (no usable text layer). */
export const MIN_LETTERS = 30;

export const NO_TEXT_LAYER_HINT = 'joignez le fichier directement dans la conversation, ou fournissez le DOCX';

const letters = (s: string) => (s.match(/\p{L}/gu) ?? []).length;

function docxPages(bytes: Uint8Array): number | null {
  try {
    const files = unzipSync(bytes, { filter: (f) => f.name === 'docProps/app.xml' });
    const xml = files['docProps/app.xml'];
    if (!xml) return null;
    const m = /<Pages>(\d+)<\/Pages>/.exec(new TextDecoder().decode(xml));
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

/** Extracts the text of an imported file by its type (`pdf`, `docx`, `md`, `txt`). */
export async function extractImportText(bytes: Uint8Array, type: string): Promise<ImportText> {
  switch (type.toLowerCase()) {
    case 'pdf': {
      const { text, pages } = await extractWithPdfjs(bytes);
      const hasTextLayer = letters(text) >= MIN_LETTERS;
      return { text: hasTextLayer ? text : '', pages, hasTextLayer };
    }
    case 'docx': {
      const text = await extractDocxText(bytes);
      return { text, pages: docxPages(bytes), hasTextLayer: letters(text) > 0 };
    }
    case 'md':
    case 'txt': {
      const text = new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
      return { text, pages: null, hasTextLayer: true };
    }
    default:
      throw new Error(`type de fichier non pris en charge : ${type}`);
  }
}
