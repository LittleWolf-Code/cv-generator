// File scope (§7.6): tools receive identifiers or file names, never paths. Every path is resolved
// with realpath, then compared in lowercase with `root + path.sep`.
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { StoreError } from './errors.js';

const FILE_NAME_RE = /^[\w .()-]+\.(pdf|docx|zip|csv|md|txt)$/i;
const WINDOWS_RESERVED = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i;

/** Validates a bare file name received from a tool (`fileName` of MCP-08, MCP-21…). */
export function assertSafeFileName(fileName: string): string {
  if (path.basename(fileName) !== fileName || fileName.includes('/') || fileName.includes('\\')) {
    throw new StoreError('FORBIDDEN_PATH', `nom de fichier attendu, pas un chemin : ${fileName}`);
  }
  if (!FILE_NAME_RE.test(fileName)) {
    throw new StoreError(
      'FORBIDDEN_PATH',
      `nom de fichier refusé : ${fileName}`,
      {},
      'extensions acceptées : pdf, docx, zip, csv, md, txt',
    );
  }
  if (fileName.includes(':') || WINDOWS_RESERVED.test(fileName)) {
    throw new StoreError('FORBIDDEN_PATH', `nom de fichier réservé ou invalide : ${fileName}`);
  }
  return fileName;
}

/** Rejects UNC (`\\server`), device (`\\?\`) paths and stray colons (allowed only after a drive letter). */
export function assertPlainAbsolutePath(p: string): void {
  if (p.startsWith('\\\\') || p.startsWith('//')) {
    throw new StoreError('FORBIDDEN_PATH', `chemin réseau ou de périphérique refusé : ${p}`);
  }
  const withoutDrive = /^[A-Za-z]:/.test(p) ? p.slice(2) : p;
  if (withoutDrive.includes(':'))
    throw new StoreError('FORBIDDEN_PATH', `caractère « : » refusé dans le chemin : ${p}`);
}

/** Resolves `relative` inside `root` and checks, after realpath, that it does not escape it. */
export function resolveInside(root: string, relative: string): string {
  assertPlainAbsolutePath(root);
  const target = path.resolve(root, relative);
  assertPlainAbsolutePath(target);
  const realRoot = realpathSync.native(root);
  let realTarget: string;
  try {
    realTarget = realpathSync.native(target);
  } catch {
    // Not created yet: check its parent instead.
    realTarget = path.join(realpathSync.native(path.dirname(target)), path.basename(target));
  }
  const rootPrefix = (realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep).toLowerCase();
  if (realTarget.toLowerCase() !== realRoot.toLowerCase() && !realTarget.toLowerCase().startsWith(rootPrefix)) {
    throw new StoreError('FORBIDDEN_PATH', `chemin hors du périmètre autorisé : ${relative}`);
  }
  return realTarget;
}
