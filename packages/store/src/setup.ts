// Creation of data directories: an empty valid one (`npm run data:init`) or a copy of a fictitious
// fixture written through the sanitizing write path (tests, demo).
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { COLLECTIONS, SCHEMA_VERSION, SECTION_KEYS, sanitizeDeep, type SanitizeIssue } from '@cv/core';
import { parseJson, serializeJson, writeFileAtomic } from './atomic.js';
import { StoreError } from './errors.js';
import { isJpeg, PHOTO_STORED_MAX_BYTES } from './photo.js';
import { schemaForPath, validateDataFile } from './store.js';

const DEFAULT_CATEGORIES = [
  { id: 'langages', label: { fr: 'Langages', en: 'Programming languages' } },
  { id: 'outils', label: { fr: 'Outils', en: 'Tools' } },
  { id: 'methodes', label: { fr: 'Méthodes', en: 'Methods' } },
  { id: 'reglementaire', label: { fr: 'Normes et réglementation', en: 'Standards & Regulatory' } },
];

/**
 * A preset with nothing checked: French, A4, `ats-classique`, normal density, every section enabled
 * except projects and certifications (§2.2), default options (F-SEL-05).
 */
export function blankPreset(id: string, name: string, fileLabel: string, isDefault = false) {
  return {
    schemaVersion: SCHEMA_VERSION,
    revision: 1,
    id,
    name,
    isDefault,
    archived: false,
    lang: 'fr' as const,
    enVariant: 'en-GB' as const,
    template: {
      layout: 'ats-classique' as const,
      theme: { font: 'carlito' as const, accent: '#1F4E79', density: 'normale' as const },
    },
    selection: {
      titleId: null,
      summaryId: null,
      sections: SECTION_KEYS.map((key) => ({ key, enabled: key !== 'projects' && key !== 'certifications' })),
      include: [] as string[],
      order: {} as Record<string, string[]>,
      variantChoice: {} as Record<string, string>,
      overrides: {},
    },
    options: {
      photo: false,
      drivingLicense: false,
      workAuthorization: false,
      links: [] as string[],
      dateStyle: 'numerique' as const,
      regulatoryPlacement: 'skills-subgroup' as const,
      referencesNote: false,
    },
    fileLabel,
  };
}

/** Files of an empty but valid data directory. Contains no personal data. */
export function emptyDataFiles(now = new Date()): Record<string, unknown> {
  const createdAt = now.toISOString();
  const files: Record<string, unknown> = {
    'profile.json': { schemaVersion: SCHEMA_VERSION, revision: 1, identity: null },
    'ids.json': {
      schemaVersion: SCHEMA_VERSION,
      revision: 1,
      ids: {
        ...Object.fromEntries(DEFAULT_CATEGORIES.map((c) => [c.id, { kind: 'category', createdAt }])),
        'preset-defaut': { kind: 'preset', createdAt },
      },
    },
    'presets/preset-defaut.json': blankPreset('preset-defaut', 'CV par défaut', 'CV', true),
  };
  for (const name of COLLECTIONS) {
    files[`library/${name}.json`] = {
      schemaVersion: SCHEMA_VERSION,
      revision: 1,
      items: name === 'categories' ? DEFAULT_CATEGORIES : [],
    };
  }
  return files;
}

/**
 * Creates the missing files of an empty data directory. Never overwrites an existing file.
 * Returns the created relative paths.
 */
export async function initDataDir(dataDir: string): Promise<string[]> {
  const created: string[] = [];
  for (const dir of ['library', 'presets', 'applications', 'proposals', 'assets']) {
    await mkdir(path.join(dataDir, dir), { recursive: true });
  }
  for (const [rel, value] of Object.entries(emptyDataFiles())) {
    const abs = path.join(dataDir, ...rel.split('/'));
    if (existsSync(abs)) continue;
    const schema = schemaForPath(rel)!;
    await writeFileAtomic(abs, serializeJson(validateDataFile(rel, schema, value)));
    created.push(rel);
  }
  return created;
}

async function listFiles(dir: string, base = ''): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(path.join(dir, base), { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...(await listFiles(dir, rel)));
    else out.push(rel);
  }
  return out.sort();
}

export interface InstallReport {
  files: string[];
  /** Strings refused by sanitization (emoji, control characters…), with their JSON path. */
  refused: SanitizeIssue[];
}

/**
 * Copies a fixture directory into `destDir` through the write-time path: every string is sanitized
 * (annex B.1), then validated by the schema. Files that are not part of the data model are skipped
 * (documentation, refused-input samples).
 */
export async function installFixture(fixtureDir: string, destDir: string): Promise<InstallReport> {
  const files = await listFiles(fixtureDir);
  const refused: SanitizeIssue[] = [];
  const written: string[] = [];
  for (const rel of files) {
    const src = path.join(fixtureDir, ...rel.split('/'));
    const dest = path.join(destDir, ...rel.split('/'));
    const schema = rel.endsWith('.json') ? schemaForPath(rel) : null;
    await mkdir(path.dirname(dest), { recursive: true });
    if (!schema) {
      if (rel.endsWith('.md') && rel.startsWith('applications/')) {
        await copyFile(src, dest);
        written.push(rel);
      } else if (/^assets\/[\w.-]+\.jpe?g$/.test(rel)) {
        // Fictitious photo, generated already processed (scripts/make-fixture-photo.ts): checked, copied.
        const bytes = await readFile(src);
        if (!isJpeg(bytes) || bytes.byteLength > PHOTO_STORED_MAX_BYTES) {
          throw new StoreError('INVALID_DATA', `${rel} : JPEG de 300 Ko au plus attendu`);
        }
        await copyFile(src, dest);
        written.push(rel);
      }
      continue;
    }
    const { value, issues } = sanitizeDeep(parseJson(await readFile(src, 'utf8')), rel);
    refused.push(...issues);
    if (issues.length > 0) {
      throw new StoreError('INVALID_DATA', `${rel} : texte refusé par l'assainissement`, { issues });
    }
    await writeFileAtomic(dest, serializeJson(validateDataFile(rel, schema, value)));
    written.push(rel);
  }
  for (const dir of ['applications', 'proposals', 'assets']) await mkdir(path.join(destDir, dir), { recursive: true });
  return { files: written, refused };
}
