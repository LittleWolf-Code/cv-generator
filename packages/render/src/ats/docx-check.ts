// DOCX checks (F-ATS-06): T-DOCX-01 structure (ZIP read), T-DOCX-02 text (mammoth), T-DOCX-03
// pagination (LibreOffice when installed, otherwise a permanent warning).
import { execFile } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { strFromU8, unzipSync } from 'fflate';
import mammoth from 'mammoth';
import { PDFDocument } from 'pdf-lib';
import { isAtsLayout, type AtsCriterion, type Projection, type ThemeFont } from '@cv/core';
import { THEME_FONTS } from '../fonts.js';
import {
  checkContacts,
  checkForbiddenChars,
  checkOrder,
  checkTextsFound,
  toVisualColumn,
  type Extraction,
} from './criteria.js';

const run = promisify(execFile);

function xmlText(xml: string): string {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
}

/** T-DOCX-01. */
export function checkDocxStructure(docx: Uint8Array, p: Projection): AtsCriterion {
  const files = unzipSync(docx);
  const problems: string[] = [];
  const document = files['word/document.xml'] ? strFromU8(files['word/document.xml']) : '';
  if (!document) problems.push('word/document.xml absent');
  for (const tag of ['w:tbl', 'w:txbxContent', 'wps:txbx', 'v:textbox', 'w:framePr']) {
    if (document.includes(`<${tag}`)) problems.push(`élément interdit : ${tag}`);
  }
  // §5.2: the photo is the only drawing, inline (wp:inline), never floating (wp:anchor).
  const drawings = document.match(/<w:drawing\b/g)?.length ?? 0;
  if (!p.photo && drawings > 0) problems.push('w:drawing présent sans photo');
  if (p.photo && drawings !== 1) problems.push(`${drawings} w:drawing pour une seule photo`);
  if (document.includes('<wp:anchor')) problems.push('image flottante (wp:anchor) : la photo doit être en ligne');
  for (const [name, data] of Object.entries(files)) {
    if (/^word\/(header|footer)\d*\.xml$/.test(name) && xmlText(strFromU8(data)).trim()) {
      problems.push(`texte dans ${name}`);
    }
  }
  const displays = new Set([
    ...p.header.contacts.filter((c) => c.kind === 'link').map((c) => c.text),
    ...p.sections.flatMap((s) => s.entries.flatMap((e) => (e.subtitle ?? []).filter((x) => x.url).map((x) => x.t))),
  ]);
  for (const m of document.matchAll(/<w:hyperlink\b[^>]*>([\s\S]*?)<\/w:hyperlink>/g)) {
    const t = xmlText(m[1]!);
    if (!displays.has(t)) problems.push(`lien dont le texte n'est pas l'URL affichée : ${t}`);
  }
  const core = files['docProps/core.xml'] ? strFromU8(files['docProps/core.xml']) : '';
  if (!/<dc:title>[^<]+<\/dc:title>/.test(core)) problems.push('Title absent de docProps/core.xml');
  if (!/<dc:creator>[^<]+<\/dc:creator>/.test(core)) problems.push('Author (dc:creator) absent de docProps/core.xml');
  // F-EXP-02: no embedded font; every declared font is the metric equivalent of the theme font.
  const fontTable = files['word/fontTable.xml'] ? strFromU8(files['word/fontTable.xml']) : '';
  if (
    Object.keys(files).some((n) => n.startsWith('word/fonts/')) ||
    /<w:embed(?:Regular|Bold|Italic)/.test(fontTable)
  ) {
    problems.push('police incorporée dans le DOCX');
  }
  const declared = THEME_FONTS[p.theme.font].docxFamily;
  const styles = files['word/styles.xml'] ? strFromU8(files['word/styles.xml']) : '';
  const fonts = new Set([...`${styles}${document}`.matchAll(/w:ascii="([^"]+)"/g)].map((m) => m[1]!));
  if (!fonts.has(declared) || fonts.size !== 1) {
    problems.push(`police déclarée : ${[...fonts].join(', ') || 'aucune'} (attendue : ${declared})`);
  }
  // ATS-14: no keyword in the metadata.
  if (/<dc:subject>[^<]+<\/dc:subject>/.test(core)) problems.push('Subject non vide dans docProps/core.xml');
  if (/<cp:keywords>[^<]+<\/cp:keywords>/.test(core)) problems.push('Keywords non vide dans docProps/core.xml');
  return problems.length === 0
    ? {
        id: 'T-DOCX-01',
        label: 'Structure DOCX',
        status: 'green',
        message: `Ni tableau, ni zone de texte, ni cadre ; en-têtes vides ; liens = URL affichées ; ${
          p.photo ? 'photo en ligne dans le corps ; ' : ''
        }police déclarée ${declared}, aucune incorporée ; Title et Author présents, Subject et Keywords vides`,
      }
    : { id: 'T-DOCX-01', label: 'Structure DOCX', status: 'red', message: problems.join(' ; '), details: { problems } };
}

export async function extractDocxText(docx: Uint8Array): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(docx) });
  return value;
}

/** T-DOCX-02: mammoth text through T-ATS-02, 04, 06 and 08 (06 and 08 orange at most in the visual layout). */
export function checkDocxText(text: string, p: Projection): AtsCriterion {
  const ex: Extraction[] = [{ name: 'docx', text }];
  const all = [checkTextsFound(p, ex), checkForbiddenChars(ex), checkOrder(p, ex), checkContacts(p, ex)];
  const sub = isAtsLayout(p.layout) ? all : all.map(toVisualColumn);
  const red = sub.filter((c) => c.status === 'red');
  const orange = sub.filter((c) => c.status === 'orange');
  const status = red.length ? 'red' : orange.length ? 'orange' : 'green';
  const message =
    status === 'green'
      ? 'Texte DOCX conforme (T-ATS-02, 04, 06 et 08)'
      : [...red, ...orange].map((c) => `${c.id} : ${c.message}`).join(' ; ');
  return {
    id: 'T-DOCX-02',
    label: 'Texte DOCX',
    status,
    message,
    details: { checks: sub.map((c) => ({ id: c.id, status: c.status })) },
  };
}

/** Path of LibreOffice (`soffice`) when installed, for T-DOCX-03; `null` otherwise. */
export function findSoffice(): string | null {
  const names = process.platform === 'win32' ? ['soffice.exe', 'soffice.com'] : ['soffice'];
  const dirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  if (process.platform === 'win32') {
    dirs.push('C:\\Program Files\\LibreOffice\\program', 'C:\\Program Files (x86)\\LibreOffice\\program');
  }
  for (const d of dirs) for (const n of names) if (existsSync(path.join(d, n))) return path.join(d, n);
  return null;
}

// LibreOffice refuses a second instance on the same user profile (a parallel conversion, or the
// user's own LibreOffice window, makes it fail). Each process gets its own profile, removed at exit,
// and its conversions run one at a time. A process killed without its exit handler (a test worker, a
// stopped server) leaves its profile: the profiles of processes that no longer run are removed when a
// new one is created.
const PROFILE_PREFIX = 'cv-soffice-profile-';
let profile: string | null = null;
let queue: Promise<unknown> = Promise.resolve();

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function sofficeProfile(): string {
  if (!profile) {
    try {
      for (const name of readdirSync(os.tmpdir())) {
        const pid = Number(name.slice(PROFILE_PREFIX.length));
        if (name.startsWith(PROFILE_PREFIX) && Number.isInteger(pid) && pid !== process.pid && !isRunning(pid)) {
          rmSync(path.join(os.tmpdir(), name), { recursive: true, force: true });
        }
      }
    } catch {
      // Best effort: a profile left behind only takes some disk space.
    }
    profile = path.join(os.tmpdir(), `${PROFILE_PREFIX}${process.pid}`);
    const dir = profile;
    process.once('exit', () => rmSync(dir, { recursive: true, force: true }));
  }
  return pathToFileURL(profile).href;
}

function oneAtATime<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
}

/**
 * T-DOCX-03 (always orange or green: the DOCX page count is not guaranteed). A theme font without a metric
 * equivalent in Word is declared as Calibri (F-EXP-02): orange in every case, « pagination Word différente
 * du PDF », with the page count LibreOffice gives for that Calibri text when it is installed.
 */
export async function checkDocxPagination(docx: Uint8Array, font: ThemeFont = 'carlito'): Promise<AtsCriterion> {
  const label = 'Pagination DOCX';
  const info = THEME_FONTS[font];
  const result = await measureDocxPages(docx);
  if (!info.docxMetricMatch) {
    const measured = result.pages !== null ? ` ; LibreOffice : ${result.pages} page${result.pages > 1 ? 's' : ''}` : '';
    return {
      id: 'T-DOCX-03',
      label,
      status: 'orange',
      message: `Pagination Word différente du PDF : police déclarée ${info.docxFamily}, ${info.family} n'ayant pas d'équivalent métrique dans Word${measured}`,
      details: { pages: result.pages, declaredFont: info.docxFamily },
    };
  }
  if (result.pages === null) return { id: 'T-DOCX-03', label, status: 'orange', message: result.reason };
  return result.pages > 1
    ? {
        id: 'T-DOCX-03',
        label,
        status: 'orange',
        message: `Word/LibreOffice pagine ce DOCX sur ${result.pages} pages`,
        details: { pages: result.pages },
      }
    : {
        id: 'T-DOCX-03',
        label,
        status: 'green',
        message: '1 page selon LibreOffice (non garanti dans Word)',
        details: { pages: result.pages },
      };
}

/** Page count of a DOCX converted by LibreOffice, or null with the reason. */
async function measureDocxPages(
  docx: Uint8Array,
): Promise<{ pages: number; reason?: never } | { pages: null; reason: string }> {
  const soffice = findSoffice();
  if (!soffice) {
    return { pages: null, reason: '1 page non garantie en DOCX (LibreOffice absent : nombre de pages non mesuré)' };
  }
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cv-docx-'));
  try {
    await writeFile(path.join(dir, 'cv.docx'), docx);
    const args = [`-env:UserInstallation=${sofficeProfile()}`, '--headless', '--convert-to', 'pdf'];
    await oneAtATime(() => run(soffice, [...args, '--outdir', dir, path.join(dir, 'cv.docx')], { timeout: 60_000 }));
    return { pages: (await PDFDocument.load(await readFile(path.join(dir, 'cv.pdf')))).getPageCount() };
  } catch (err) {
    return {
      pages: null,
      reason: `1 page non garantie en DOCX (conversion LibreOffice impossible : ${(err as Error).message})`,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
