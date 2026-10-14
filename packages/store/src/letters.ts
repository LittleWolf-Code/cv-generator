// Cover letter versions (F-LET-01, F-LET-04, ADR 0016): applications/<id>/letters/<fr|en>/v<n>.json.
// A version is never overwritten: its number is allocated under the lock and the file is created
// exclusively (even with two MCP processes and the interface at the same time). Claude adds versions
// (save_letter_draft); the user adds versions from the interface, chooses the active version and marks
// a version as final, which is irreversible: a final version is never modified again.
import { readdir } from 'node:fs/promises';
import {
  checkLetter,
  checkLetterRoles,
  letterVersionFile,
  unknownSourceIds,
  type Lang,
  type LetterCheck,
  type LetterVersionFile,
} from '@cv/core';
import { readOffer } from './applications.js';
import { StoreError } from './errors.js';
import { prepare, type WriteRef } from './library.js';
import type { DataStore } from './store.js';

const appRel = (id: string, rel: string) => `applications/${id}/${rel}`;
const versionRel = (id: string, lang: Lang, v: number) => appRel(id, `letters/${lang}/v${v}.json`);

/** Numbers of the versions of a letter, ascending. */
async function versionNumbers(store: DataStore, id: string, lang: Lang): Promise<number[]> {
  const dir = appRel(id, `letters/${lang}`);
  if (!(await store.exists(dir))) return [];
  return (await readdir(store.abs(dir)))
    .map((f) => /^v(\d+)\.json$/.exec(f)?.[1])
    .filter((x): x is string => !!x)
    .map(Number)
    .sort((a, b) => a - b);
}

export async function listLetterVersions(store: DataStore, id: string, lang: Lang): Promise<LetterVersionFile[]> {
  await store.loadApplication(id); // NOT_FOUND first
  const out: LetterVersionFile[] = [];
  for (const v of await versionNumbers(store, id, lang))
    out.push(await store.read<LetterVersionFile>(versionRel(id, lang, v)));
  return out;
}

export async function readLetterVersion(
  store: DataStore,
  id: string,
  lang: Lang,
  version: number,
): Promise<LetterVersionFile> {
  const rel = versionRel(id, lang, version);
  if (!Number.isInteger(version) || version < 1 || !(await store.exists(rel))) {
    throw new StoreError('NOT_FOUND', `version de lettre introuvable : ${lang.toUpperCase()} v${version}`);
  }
  return store.read<LetterVersionFile>(rel);
}

export interface LetterDraftInput {
  recipient?: unknown;
  paragraphs: unknown;
  sourceIds?: unknown;
  /** Version this one starts from (same letter), null for a first draft. */
  basedOn?: number | null;
}

export interface LetterWrite {
  version: LetterVersionFile;
  writes: WriteRef[];
}

/**
 * Adds a version (F-LET-04): sanitized and validated like any data file, roles in the allowed order
 * (ADR 0016), sourceIds known to the library (unknown ones are refused). Never modifies another version.
 */
export async function createLetterVersion(
  store: DataStore,
  id: string,
  lang: Lang,
  input: LetterDraftInput,
  origin: 'claude' | 'utilisateur',
  now = new Date(),
): Promise<LetterWrite> {
  await store.loadApplication(id);
  const draft = {
    schemaVersion: 1,
    revision: 1,
    version: 1,
    origin,
    basedOn: input.basedOn ?? null,
    status: 'brouillon',
    createdAt: now.toISOString(),
    recipient: input.recipient ?? null,
    paragraphs: input.paragraphs,
    sourceIds: input.sourceIds ?? [],
  };
  const { value, issues } = prepare(letterVersionFile, draft);
  if (!value) {
    throw new StoreError(
      'INVALID_DATA',
      `lettre invalide : ${issues.map((i) => (i.path ? `${i.path} : ${i.message}` : i.message)).join(' ; ')}`,
      { issues },
    );
  }
  const roles = checkLetterRoles(
    lang,
    value.paragraphs.map((p) => p.role),
  );
  if (roles)
    throw new StoreError('INVALID_DATA', roles, {}, 'respectez l\u2019ordre des rôles (get_guidelines letter)');
  const library = await store.loadLibrary();
  const unknown = unknownSourceIds(value.sourceIds, library);
  if (unknown.length) {
    throw new StoreError(
      'INVALID_DATA',
      `identifiant(s) inconnu(s) dans sourceIds : ${unknown.join(', ')}`,
      { unknown },
      'citez uniquement des éléments de la bibliothèque (get_library, get_items)',
    );
  }
  return store.withLock(async () => {
    const numbers = await versionNumbers(store, id, lang);
    if (value.basedOn !== null && !numbers.includes(value.basedOn)) {
      throw new StoreError('NOT_FOUND', `version de départ introuvable : ${lang.toUpperCase()} v${value.basedOn}`);
    }
    let n = (numbers[numbers.length - 1] ?? 0) + 1;
    for (;;) {
      try {
        const saved = await store.create(versionRel(id, lang, n), { ...value, version: n }, { locked: true });
        return { version: saved, writes: [{ file: versionRel(id, lang, n), revision: saved.revision }] };
      } catch (err) {
        // Another process created this number outside our lock (should not happen): take the next one.
        if (err instanceof StoreError && err.code === 'ALREADY_EXISTS') n++;
        else throw err;
      }
    }
  });
}

/** Active version of a letter (interface only, F-LET-01): null for none. */
export async function setActiveLetter(
  store: DataStore,
  id: string,
  lang: Lang,
  version: number | null,
): Promise<{ activeLetter: { fr: number | null; en: number | null }; writes: WriteRef[] }> {
  return store.withLock(async () => {
    const { application } = await store.loadApplication(id);
    if (version !== null) await readLetterVersion(store, id, lang, version);
    const activeLetter = { ...application.activeLetter, [lang]: version };
    const saved = await store.write(
      appRel(id, 'application.json'),
      { ...application, activeLetter },
      { expectedRevision: application.revision, locked: true },
    );
    return { activeLetter, writes: [{ file: appRel(id, 'application.json'), revision: saved.revision }] };
  });
}

/** Marks a version as final (interface only, irreversible, ADR 0016): it is never modified again. */
export async function finalizeLetter(store: DataStore, id: string, lang: Lang, version: number): Promise<LetterWrite> {
  return store.withLock(async () => {
    const current = await readLetterVersion(store, id, lang, version);
    if (current.status === 'finale') {
      throw new StoreError('ALREADY_RESOLVED', `la version ${lang.toUpperCase()} v${version} est déjà finale`);
    }
    const rel = versionRel(id, lang, version);
    const saved = await store.write(
      rel,
      { ...current, status: 'finale' as const },
      {
        expectedRevision: current.revision,
        locked: true,
      },
    );
    return { version: saved, writes: [{ file: rel, revision: saved.revision }] };
  });
}

/** The active version of a letter, or NO_ACTIVE_LETTER (the export never picks a version itself). */
export async function activeLetterVersion(store: DataStore, id: string, lang: Lang): Promise<LetterVersionFile> {
  const { application } = await store.loadApplication(id);
  const active = application.activeLetter[lang];
  if (active === null) {
    throw new StoreError(
      'NO_ACTIVE_LETTER',
      `aucune version active pour la lettre ${lang.toUpperCase()}`,
      {},
      'choisissez la version active dans l\u2019interface (écran Candidatures, Lettre)',
    );
  }
  return readLetterVersion(store, id, lang, active);
}

/**
 * Warnings of a letter version (F-LET-06, annex C letter-facts), computed on read like `stale`: against
 * the cited elements, offer.md, the analyses of the offer and the selection of the application.
 */
export async function letterChecks(
  store: DataStore,
  id: string,
  version: Pick<LetterVersionFile, 'paragraphs' | 'sourceIds'>,
  now = new Date(),
): Promise<LetterCheck[]> {
  const { selection, analysis } = await store.loadApplication(id);
  const library = await store.loadLibrary();
  const offer = await readOffer(store, id);
  const terms = analysis ? [analysis.current, ...analysis.history].flatMap((a) => (a ? a.terms : [])) : [];
  return checkLetter({
    paragraphs: version.paragraphs,
    sourceIds: version.sourceIds,
    library,
    selection: selection.selection,
    offerText: offer.text,
    offerTerms: terms,
    now,
  });
}
