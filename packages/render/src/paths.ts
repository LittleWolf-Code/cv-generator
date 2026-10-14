// Locations of the versioned assets of this package (templates, fonts). Resolved from the module
// location, valid from src/ (tsx, Vitest) and from dist/ (build): both sit one level below the
// package root.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TEMPLATES_DIR = path.join(PACKAGE_ROOT, 'templates');
export const FONTS_DIR = path.join(PACKAGE_ROOT, 'fonts');

export function templatePath(layout: string): string {
  return path.join(TEMPLATES_DIR, `${layout}.typ`);
}
