// PDF inspection with pdf-lib (T-ATS-09, T-ATS-12): embedded fonts, ToUnicode, metadata, encryption.
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRef } from 'pdf-lib';

export interface PdfFontInfo {
  subtype: string;
  baseFont: string;
  /** BaseFont without the subset prefix (`ABCDEF+`). */
  postscriptName: string;
  toUnicode: boolean;
  embedded: boolean;
}

export interface PdfInfo {
  fonts: PdfFontInfo[];
  title: string | undefined;
  author: string | undefined;
  subject: string | undefined;
  keywords: string | undefined;
  encrypted: boolean;
  pageCount: number;
}

function name(dict: PDFDict, key: string): string {
  return dict.get(PDFName.of(key))?.toString().replace(/^\//, '') ?? '';
}

export async function inspectPdf(pdf: Uint8Array): Promise<PdfInfo> {
  const doc = await PDFDocument.load(pdf, { ignoreEncryption: true, updateMetadata: false });
  const ctx = doc.context;
  const lookupDict = (v: unknown): PDFDict | undefined => {
    const o = v instanceof PDFRef ? ctx.lookup(v) : v;
    return o instanceof PDFDict ? o : undefined;
  };
  const fonts: PdfFontInfo[] = [];
  for (const [, obj] of ctx.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFDict) || name(obj, 'Type') !== 'Font') continue;
    const subtype = name(obj, 'Subtype');
    if (subtype === 'CIDFontType2' || subtype === 'CIDFontType0') continue; // reported through their Type0 parent
    const baseFont = name(obj, 'BaseFont');
    let descriptor = lookupDict(obj.get(PDFName.of('FontDescriptor')));
    if (subtype === 'Type0') {
      const descendants = obj.get(PDFName.of('DescendantFonts'));
      const arr = descendants instanceof PDFRef ? ctx.lookup(descendants) : descendants;
      const first = arr instanceof PDFArray ? lookupDict(arr.get(0)) : undefined;
      descriptor = first ? lookupDict(first.get(PDFName.of('FontDescriptor'))) : undefined;
    }
    const embedded =
      subtype === 'Type3' ||
      (!!descriptor && ['FontFile', 'FontFile2', 'FontFile3'].some((k) => descriptor!.has(PDFName.of(k))));
    fonts.push({
      subtype,
      baseFont,
      postscriptName: baseFont.replace(/^[A-Z]{6}\+/, '').replace(/-Identity-H$/, ''),
      toUnicode: obj.has(PDFName.of('ToUnicode')),
      embedded,
    });
  }
  return {
    fonts,
    title: doc.getTitle(),
    author: doc.getAuthor(),
    subject: doc.getSubject(),
    keywords: doc.getKeywords(),
    encrypted: doc.isEncrypted,
    pageCount: doc.getPageCount(),
  };
}
