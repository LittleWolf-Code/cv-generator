// Offers dropped in import/offres/ (F-CAN-01, F-IMP-01, §7.6): the interface only receives file names,
// never paths. Lot 4 reads text and Markdown (ADR 0013); PDF and DOCX extraction comes with lot 6.
import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { StoreError } from './errors.js';
import { assertSafeFileName, resolveInside } from './paths.js';

export const OFFER_FILE_RE = /\.(?:md|txt)$/i;
/** An offer file is a few kilobytes: anything above is refused. */
export const OFFER_FILE_MAX_BYTES = 1024 * 1024;

export interface ImportOfferFile {
  name: string;
  size: number;
  modifiedAt: string;
}

function isOfferName(name: string): boolean {
  try {
    assertSafeFileName(name);
  } catch {
    return false;
  }
  return OFFER_FILE_RE.test(name);
}

/** Names (and sizes) of the offers of import/offres/, sorted; empty when the folder does not exist. */
export async function listImportOffers(importDir: string | null): Promise<ImportOfferFile[]> {
  if (!importDir) return [];
  const dir = path.join(importDir, 'offres');
  if (!existsSync(dir)) return [];
  const out: ImportOfferFile[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !isOfferName(entry.name)) continue;
    const s = await stat(path.join(dir, entry.name));
    out.push({ name: entry.name, size: s.size, modifiedAt: s.mtime.toISOString() });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/** Reads an offer of import/offres/ by its file name, inside the file scope of §7.6. */
export async function readImportOffer(importDir: string | null, fileName: string): Promise<string> {
  if (!importDir) throw new StoreError('NOT_FOUND', 'dossier import/ indisponible');
  assertSafeFileName(fileName);
  if (!OFFER_FILE_RE.test(fileName)) {
    throw new StoreError(
      'FORBIDDEN_PATH',
      `format d'offre non pris en charge : ${fileName}`,
      {},
      'offres acceptées : .md ou .txt',
    );
  }
  const dir = path.join(importDir, 'offres');
  if (!existsSync(dir)) throw new StoreError('NOT_FOUND', 'dossier import/offres/ introuvable');
  const abs = resolveInside(dir, fileName);
  if (!existsSync(abs)) throw new StoreError('NOT_FOUND', `offre introuvable dans import/offres/ : ${fileName}`);
  const s = await stat(abs);
  if (!s.isFile()) throw new StoreError('FORBIDDEN_PATH', `pas un fichier : ${fileName}`);
  if (s.size > OFFER_FILE_MAX_BYTES)
    throw new StoreError('INVALID_DATA', `offre trop volumineuse (1 Mo au plus) : ${fileName}`);
  return (await readFile(abs, 'utf8')).replace(/^\uFEFF/, '');
}

/**
 * Text of a file of import/ by its name (reference source of propose_item with `sourceFile`, annex C).
 * Lot 5 reads .md and .txt only; PDF and DOCX extraction comes with get_import_file_text (lot 6).
 */
export async function readImportTextFile(importDir: string | null, fileName: string): Promise<string> {
  if (!importDir) throw new StoreError('NOT_FOUND', 'dossier import/ indisponible');
  assertSafeFileName(fileName);
  if (!OFFER_FILE_RE.test(fileName)) {
    throw new StoreError(
      'NOT_AVAILABLE',
      `lecture de ${fileName} indisponible au lot 5 : seuls les fichiers .md et .txt sont lus`,
      {},
      'joignez le fichier directement dans la conversation, ou attendez get_import_file_text (lot 6)',
    );
  }
  if (!existsSync(importDir)) throw new StoreError('NOT_FOUND', 'dossier import/ introuvable');
  const abs = resolveInside(importDir, fileName);
  if (!existsSync(abs)) throw new StoreError('NOT_FOUND', `fichier introuvable dans import/ : ${fileName}`);
  const s = await stat(abs);
  if (!s.isFile()) throw new StoreError('FORBIDDEN_PATH', `pas un fichier : ${fileName}`);
  if (s.size > OFFER_FILE_MAX_BYTES) {
    throw new StoreError('INVALID_DATA', `fichier trop volumineux (1 Mo au plus) : ${fileName}`);
  }
  return (await readFile(abs, 'utf8')).replace(/^\uFEFF/, '');
}

export interface ImportFile {
  name: string;
  /** `import`: the root of import/ (CV, LinkedIn export); `offres`: import/offres/. */
  folder: 'import' | 'offres';
  type: string;
  size: number;
}

/** Files of import/ and import/offres/ that a tool may designate by name (§7.6), sorted. */
export async function listImportFiles(importDir: string | null): Promise<ImportFile[]> {
  if (!importDir || !existsSync(importDir)) return [];
  const out: ImportFile[] = [];
  for (const [folder, dir] of [
    ['import', importDir],
    ['offres', path.join(importDir, 'offres')],
  ] as const) {
    if (!existsSync(dir)) continue;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      try {
        assertSafeFileName(entry.name);
      } catch {
        continue;
      }
      const s = await stat(path.join(dir, entry.name));
      out.push({ name: entry.name, folder, type: path.extname(entry.name).slice(1).toLowerCase(), size: s.size });
    }
  }
  return out.sort((a, b) => a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name, 'fr'));
}

/** Bytes of a file of import/ (or import/offres/) by its name, inside the file scope of §7.6. */
export async function readImportBytes(
  importDir: string | null,
  folder: 'import' | 'offres',
  fileName: string,
): Promise<Uint8Array> {
  if (!importDir) throw new StoreError('NOT_FOUND', 'dossier import/ indisponible');
  assertSafeFileName(fileName);
  const dir = folder === 'offres' ? path.join(importDir, 'offres') : importDir;
  const abs = resolveInside(dir, fileName);
  if (!existsSync(abs)) throw new StoreError('NOT_FOUND', `fichier introuvable : ${fileName}`);
  return new Uint8Array(await readFile(abs));
}
