// Text extraction for the ATS view and checks (F-ATS-01, §12.2): pdf.js with
// `disableNormalization: true` (lines rebuilt with hasEOL), and `pdftotext -raw` from Poppler.
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { getDocumentProxy } from 'unpdf';
import type { ExtractorStatus } from '@cv/core';

const run = promisify(execFile);

export interface PdfTextItem {
  str: string;
  /** Font size in pt: Math.hypot(t[2], t[3]) on item.transform (T-ATS-10). */
  size: number;
  hasEOL: boolean;
}

export interface PdfjsExtraction {
  text: string;
  items: PdfTextItem[];
  pages: number;
}

export async function extractWithPdfjs(pdf: Uint8Array): Promise<PdfjsExtraction> {
  // pdf.js may transfer the buffer: give it a copy.
  const doc = await getDocumentProxy(pdf.slice());
  const items: PdfTextItem[] = [];
  let text = '';
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent({ disableNormalization: true });
      for (const it of content.items) {
        if (!('str' in it)) continue;
        const t = it.transform as number[];
        items.push({ str: it.str, size: Math.hypot(t[2]!, t[3]!), hasEOL: it.hasEOL });
        text += it.str;
        if (it.hasEOL) text += '\n';
      }
      if (!text.endsWith('\n')) text += '\n';
    }
    return { text, items, pages: doc.numPages };
  } finally {
    await (doc as unknown as { loadingTask: { destroy(): Promise<void> } }).loadingTask.destroy();
  }
}

export interface PopplerInfo {
  status: ExtractorStatus;
  pdftotext?: string;
  pdffonts?: string;
  version?: string;
  detail?: string;
}

const exe = (name: string) => (process.platform === 'win32' ? `${name}.exe` : name);

function candidates(): string[] {
  const dirs: string[] = [];
  if (process.env.POPPLER_BIN) dirs.push(process.env.POPPLER_BIN);
  dirs.push(...(process.env.PATH ?? '').split(path.delimiter).filter(Boolean));
  return dirs;
}

let cached: Promise<PopplerInfo> | null = null;

/**
 * Finds Poppler's pdftotext (POPPLER_BIN first, then PATH). An xpdf pdftotext (bundled with Git for
 * Windows, for example) is not Poppler and is reported as `not-poppler`.
 */
export function locatePoppler(): Promise<PopplerInfo> {
  cached ??= (async () => {
    let notPoppler: PopplerInfo | null = null;
    for (const dir of candidates()) {
      const bin = path.join(dir, exe('pdftotext'));
      if (!existsSync(bin)) continue;
      try {
        const { stdout, stderr } = await run(bin, ['-v'], { timeout: 10_000 }).catch(
          (e: { stdout?: string; stderr?: string }) => ({
            stdout: e.stdout ?? '',
            stderr: e.stderr ?? '',
          }),
        );
        const out = `${stdout}${stderr}`;
        const version = /pdftotext version ([\w.-]+)/i.exec(out)?.[1];
        if (/poppler/i.test(out)) {
          const fonts = path.join(dir, exe('pdffonts'));
          return {
            status: 'ok',
            pdftotext: bin,
            pdffonts: existsSync(fonts) ? fonts : undefined,
            version,
          } satisfies PopplerInfo;
        }
        notPoppler ??= {
          status: 'not-poppler',
          pdftotext: bin,
          version,
          detail: `${bin} n'est pas Poppler (xpdf ${version ?? '?'})`,
        };
      } catch (err) {
        return { status: 'error', detail: (err as Error).message } satisfies PopplerInfo;
      }
    }
    return notPoppler ?? { status: 'absent', detail: 'pdftotext (Poppler) introuvable : définissez POPPLER_BIN' };
  })();
  return cached;
}

/** Resets the Poppler lookup (tests). */
export function resetPopplerCache(): void {
  cached = null;
}

async function withTempPdf<T>(pdf: Uint8Array, fn: (file: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cv-ats-'));
  const file = path.join(dir, 'document.pdf');
  try {
    await writeFile(file, pdf);
    return await fn(file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function extractWithPdftotext(pdf: Uint8Array, poppler: PopplerInfo): Promise<string> {
  if (poppler.status !== 'ok' || !poppler.pdftotext) throw new Error('Poppler indisponible');
  return withTempPdf(pdf, async (file) => {
    const { stdout } = await run(poppler.pdftotext!, ['-raw', '-enc', 'UTF-8', file, '-'], {
      timeout: 30_000,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout.replace(/\f/g, '\n');
  });
}

export interface PdffontsRow {
  name: string;
  type: string;
  emb: boolean;
  uni: boolean;
}

/** `pdffonts` table, when Poppler provides it (T-ATS-09, tests). */
export async function listFontsWithPdffonts(pdf: Uint8Array, poppler: PopplerInfo): Promise<PdffontsRow[] | null> {
  if (poppler.status !== 'ok' || !poppler.pdffonts) return null;
  return withTempPdf(pdf, async (file) => {
    const { stdout } = await run(poppler.pdffonts!, [file], { timeout: 30_000, encoding: 'utf8' });
    const lines = stdout
      .split(/\r?\n/)
      .slice(2)
      .filter((l) => l.trim());
    return lines.map((l) => {
      const cols = l.trim().split(/\s+/);
      // name type... encoding emb sub uni object ID
      const n = cols.length;
      return {
        name: cols[0]!,
        type: cols.slice(1, n - 6).join(' '),
        emb: cols[n - 5] === 'yes',
        uni: cols[n - 3] === 'yes',
      };
    });
  });
}
