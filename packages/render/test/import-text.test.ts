// MCP-08 extraction (F-IMP-03, ADR 0015): the fictitious CV of fixtures/imports/ as a PDF with a text
// layer (pdf.js), a DOCX (mammoth) and a scanned PDF (an image only: no text layer).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { extractImportText } from '../src/index.js';

const IMPORTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'fixtures', 'imports');
const bytes = async (name: string) => new Uint8Array(await readFile(path.join(IMPORTS, name)));

describe("texte d'un CV importé (MCP-08)", () => {
  it('PDF avec couche texte : texte, pages, hasTextLayer', async () => {
    const r = await extractImportText(await bytes('CV_Camille_Martin_fictif.pdf'), 'pdf');
    expect(r.hasTextLayer).toBe(true);
    expect(r.pages).toBe(1);
    expect(r.text).toContain('Stagiaire ingénieure biomédicale');
    expect(r.text).toContain('IEC 62304 (classe B)');
  });

  it('DOCX par mammoth', async () => {
    const r = await extractImportText(await bytes('CV_Camille_Martin_fictif.docx'), 'docx');
    expect(r.hasTextLayer).toBe(true);
    expect(r.text).toContain('Randonnée en montagne'.toLowerCase().slice(1));
    expect(r.text).toContain('École Fictive d');
  });

  it('PDF scanné : aucune couche texte, texte vide', async () => {
    const r = await extractImportText(await bytes('CV_Camille_Martin_fictif_scan.pdf'), 'pdf');
    expect(r).toEqual({ text: '', pages: 1, hasTextLayer: false });
  });

  it('refuse un type non pris en charge', async () => {
    await expect(extractImportText(new Uint8Array([1, 2, 3]), 'zip')).rejects.toThrow(/non pris en charge/);
  });
});
