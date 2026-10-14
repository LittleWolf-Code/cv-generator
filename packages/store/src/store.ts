// Data directory access shared by the API server and the MCP processes (§8.4): validated reads,
// atomic writes under a single lock (data/.lock), per-file `revision`, id registry.
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import lockfile from 'proper-lockfile';
import { z } from 'zod';
import {
  analysisFile,
  applicationFile,
  applicationSelectionFile,
  checkLibraryIntegrity,
  collectionFileSchemas,
  COLLECTIONS,
  fileNamePart,
  ID_PREFIX,
  idsFile,
  letterVersionFile,
  presetFile,
  profileFile,
  proposalFile,
  SCHEMA_VERSION,
  type AnalysisFile,
  type ApplicationFile,
  type ApplicationSelectionFile,
  type CollectionName,
  type IdKind,
  type IdsFile,
  type Library,
  type LibraryIssue,
  type PresetFile,
  type ProfileFile,
  type ProposalFile,
} from '@cv/core';
import { parseJson, serializeJson, writeFileAtomic, writeFileExclusive } from './atomic.js';
import { StoreError } from './errors.js';

export const LOCK_NAME = '.lock';

/** Schema of a data file, from its path relative to the data directory. */
export function schemaForPath(rel: string): z.ZodType | null {
  const p = rel.replace(/\\/g, '/');
  if (p === 'profile.json') return profileFile;
  if (p === 'ids.json') return idsFile;
  const lib = /^library\/([a-z]+)\.json$/.exec(p);
  if (lib && (COLLECTIONS as readonly string[]).includes(lib[1]!))
    return collectionFileSchemas[lib[1] as CollectionName];
  if (/^presets\/[^/]+\.json$/.test(p)) return presetFile;
  if (/^applications\/[^/]+\/application\.json$/.test(p)) return applicationFile;
  if (/^applications\/[^/]+\/selection\.json$/.test(p)) return applicationSelectionFile;
  if (/^applications\/[^/]+\/analysis\.json$/.test(p)) return analysisFile;
  if (/^applications\/[^/]+\/letters\/(fr|en)\/v\d+\.json$/.test(p)) return letterVersionFile;
  if (/^proposals\/[0-9A-HJKMNP-TV-Z]{26}\.json$/.test(p)) return proposalFile;
  return null;
}

/** French, field-designating messages from a Zod error. */
export function formatZodError(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.length ? i.path.join('.') : '(racine)'} : ${i.message}`);
}

/** Validates a data file; an unknown `schemaVersion` is refused explicitly (§8.4). */
export function validateDataFile<T>(rel: string, schema: z.ZodType<T>, value: unknown): T {
  if (value && typeof value === 'object' && 'schemaVersion' in value && value.schemaVersion !== SCHEMA_VERSION) {
    throw new StoreError(
      'SCHEMA_VERSION',
      `${rel} : version de schéma inconnue (${String(value.schemaVersion)}), seule la version ${SCHEMA_VERSION} est prise en charge`,
      { file: rel, schemaVersion: value.schemaVersion },
    );
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new StoreError('INVALID_DATA', `${rel} : données invalides`, {
      file: rel,
      issues: formatZodError(parsed.error),
    });
  }
  return parsed.data;
}

export function sha256(content: string | Uint8Array): string {
  return createHash('sha256').update(content).digest('hex');
}

export interface Snapshot {
  profile: ProfileFile;
  library: Library;
  presets: PresetFile[];
  integrity: { errors: LibraryIssue[]; warnings: LibraryIssue[] };
}

export interface LoadedApplication {
  application: ApplicationFile;
  selection: ApplicationSelectionFile;
  analysis: AnalysisFile | null;
}

export class DataStore {
  private constructor(readonly dataDir: string) {}

  /** Opens an existing data directory; refuses to start without one (§7.6). */
  static open(dataDir: string): DataStore {
    if (!path.isAbsolute(dataDir)) {
      throw new StoreError('DATA_DIR_MISSING', `le dossier de données doit être un chemin absolu : ${dataDir}`);
    }
    if (!existsSync(path.join(dataDir, 'profile.json'))) {
      throw new StoreError(
        'DATA_DIR_MISSING',
        `dossier de données introuvable ou incomplet : ${dataDir}`,
        { dataDir },
        'lancez « npm run data:init » à la racine du projet',
      );
    }
    return new DataStore(dataDir);
  }

  /** For tooling that creates a directory (data:init, fixtures). */
  static unchecked(dataDir: string): DataStore {
    return new DataStore(dataDir);
  }

  abs(rel: string): string {
    return path.join(this.dataDir, ...rel.split('/'));
  }

  async exists(rel: string): Promise<boolean> {
    return existsSync(this.abs(rel));
  }

  async readRaw(rel: string): Promise<string> {
    try {
      return await readFile(this.abs(rel), 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new StoreError('NOT_FOUND', `fichier introuvable : ${rel}`, { file: rel });
      }
      throw err;
    }
  }

  async read<T>(rel: string, schema?: z.ZodType<T>): Promise<T> {
    const s = (schema ?? schemaForPath(rel)) as z.ZodType<T> | null;
    if (!s) throw new StoreError('FORBIDDEN_PATH', `fichier hors du modèle de données : ${rel}`);
    const raw = await this.readRaw(rel);
    let json: unknown;
    try {
      json = parseJson(raw);
    } catch (err) {
      throw new StoreError('INVALID_DATA', `${rel} : JSON invalide (${(err as Error).message})`, { file: rel });
    }
    return validateDataFile(rel, s, json);
  }

  /** Runs `fn` while holding the single data lock shared with the other processes. */
  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await mkdir(this.dataDir, { recursive: true });
    let release: () => Promise<void>;
    try {
      release = await lockfile.lock(this.dataDir, {
        lockfilePath: path.join(this.dataDir, LOCK_NAME),
        realpath: false,
        stale: 10_000,
        retries: { retries: 20, minTimeout: 20, maxTimeout: 250 },
      });
    } catch (err) {
      throw new StoreError('LOCKED', `données verrouillées par un autre processus (${(err as Error).message})`);
    }
    try {
      return await fn();
    } finally {
      await release();
    }
  }

  /**
   * Validates and writes a data file atomically. With `expectedRevision`, a stale revision is refused
   * (HTTP 409 / STALE_REVISION). The stored revision is incremented.
   */
  /**
   * Creates a new data file, validated by the schema of its path, without ever replacing an existing one
   * (`ALREADY_EXISTS`): letter versions (ADR 0016).
   */
  async create<T extends { revision: number }>(rel: string, value: T, opts: { locked?: boolean } = {}): Promise<T> {
    const run = async () => {
      const schema = schemaForPath(rel) as z.ZodType<T> | null;
      if (!schema) throw new StoreError('FORBIDDEN_PATH', `fichier hors du modèle de données : ${rel}`);
      const next = validateDataFile(rel, schema, value);
      await mkdir(path.dirname(this.abs(rel)), { recursive: true });
      try {
        await writeFileExclusive(this.abs(rel), serializeJson(next));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
          throw new StoreError('ALREADY_EXISTS', `${rel} existe déjà : il n'est jamais remplacé`, { file: rel });
        }
        throw err;
      }
      return next;
    };
    return opts.locked ? run() : this.withLock(run);
  }

  async write<T extends { revision: number }>(
    rel: string,
    value: T,
    opts: { expectedRevision?: number; schema?: z.ZodType<T>; locked?: boolean } = {},
  ): Promise<T> {
    const run = async () => {
      const schema = (opts.schema ?? schemaForPath(rel)) as z.ZodType<T> | null;
      if (!schema) throw new StoreError('FORBIDDEN_PATH', `fichier hors du modèle de données : ${rel}`);
      let current: number | null = null;
      if (await this.exists(rel)) {
        const raw = parseJson(await this.readRaw(rel)) as { revision?: unknown };
        current = typeof raw.revision === 'number' ? raw.revision : null;
      }
      if (opts.expectedRevision !== undefined && current !== opts.expectedRevision) {
        throw new StoreError(
          'STALE_REVISION',
          `${rel} a changé depuis sa lecture (révision ${current ?? 'absente'}, attendue ${opts.expectedRevision})`,
          { file: rel, currentRevision: current },
          'relisez le fichier puis réappliquez la modification',
        );
      }
      const next = validateDataFile(rel, schema, { ...value, revision: (current ?? value.revision - 1) + 1 });
      await mkdir(path.dirname(this.abs(rel)), { recursive: true });
      await writeFileAtomic(this.abs(rel), serializeJson(next));
      return next;
    };
    return opts.locked ? run() : this.withLock(run);
  }

  async loadProfile(): Promise<ProfileFile> {
    return this.read('profile.json');
  }

  async loadLibrary(): Promise<Library> {
    const entries = await Promise.all(
      COLLECTIONS.map(async (name) => {
        const rel = `library/${name}.json`;
        if (!(await this.exists(rel))) return [name, []] as const;
        const file = await this.read<{ items: unknown[] }>(rel);
        return [name, file.items] as const;
      }),
    );
    return Object.fromEntries(entries) as unknown as Library;
  }

  async listPresets(): Promise<PresetFile[]> {
    const dir = this.abs('presets');
    if (!existsSync(dir)) return [];
    const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
    return Promise.all(files.map((f) => this.read<PresetFile>(`presets/${f}`)));
  }

  async loadSnapshot(): Promise<Snapshot> {
    const [profile, library, presets] = await Promise.all([this.loadProfile(), this.loadLibrary(), this.listPresets()]);
    return { profile, library, presets, integrity: checkLibraryIntegrity(library) };
  }

  async listApplicationIds(): Promise<string[]> {
    const dir = this.abs('applications');
    if (!existsSync(dir)) return [];
    const out: string[] = [];
    for (const name of await readdir(dir)) {
      if ((await stat(path.join(dir, name))).isDirectory() && existsSync(path.join(dir, name, 'application.json'))) {
        out.push(name);
      }
    }
    return out.sort();
  }

  async loadApplication(applicationId: string): Promise<LoadedApplication> {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(applicationId)) {
      throw new StoreError('NOT_FOUND', `candidature introuvable : ${applicationId}`);
    }
    const base = `applications/${applicationId}`;
    if (!(await this.exists(`${base}/application.json`))) {
      throw new StoreError('NOT_FOUND', `candidature introuvable : ${applicationId}`);
    }
    const [application, selection] = await Promise.all([
      this.read<ApplicationFile>(`${base}/application.json`),
      this.read<ApplicationSelectionFile>(`${base}/selection.json`),
    ]);
    const analysis = (await this.exists(`${base}/analysis.json`))
      ? await this.read<AnalysisFile>(`${base}/analysis.json`)
      : null;
    return { application, selection, analysis };
  }

  /** Valid proposals only; see `scanProposals` for the files that could not be read. */
  async listProposals(): Promise<ProposalFile[]> {
    return (await this.scanProposals()).proposals;
  }

  /**
   * Reads proposals/ one file at a time: a file dropped by hand that is invalid (or still being
   * copied) is reported instead of hiding the whole queue. The name must be `<id>.json`.
   */
  async scanProposals(): Promise<{ proposals: ProposalFile[]; invalid: Array<{ file: string; message: string }> }> {
    const dir = this.abs('proposals');
    if (!existsSync(dir)) return { proposals: [], invalid: [] };
    const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
    const proposals: ProposalFile[] = [];
    const invalid: Array<{ file: string; message: string }> = [];
    for (const f of files) {
      const rel = `proposals/${f}`;
      if (!schemaForPath(rel)) {
        invalid.push({
          file: rel,
          message: 'nom de fichier attendu : <ULID>.json (26 caractères base32 de Crockford)',
        });
        continue;
      }
      try {
        const p = await this.read<ProposalFile>(rel);
        if (`${p.id}.json` !== f) {
          invalid.push({ file: rel, message: `l'identifiant ${p.id} ne correspond pas au nom du fichier` });
        } else proposals.push(p);
      } catch (err) {
        const e = err as StoreError;
        const issues = (e.details?.issues as string[] | undefined) ?? [];
        invalid.push({ file: rel, message: [e.message, ...issues.slice(0, 5)].join(' ; ') });
      }
    }
    return { proposals, invalid };
  }

  async readIds(): Promise<IdsFile> {
    if (!(await this.exists('ids.json'))) return { schemaVersion: SCHEMA_VERSION, revision: 0, ids: {} };
    return this.read('ids.json');
  }

  /**
   * Assigns a new identifier (`<prefix>-<slug>[-n]`) and records it in ids.json. An id is never reused,
   * even after the element is deleted (F-LIB-02).
   */
  async allocateId(kind: IdKind, base: string, now = new Date()): Promise<string> {
    return this.withLock(async () => {
      const registry = await this.readIds();
      const candidate = allocateIdIn(registry, kind, base, now);
      await this.write('ids.json', registry, { locked: true });
      return candidate;
    });
  }

  /** Collection files with their revision (library editing, §8.4). */
  async loadLibraryFiles(): Promise<{ library: Library; revisions: Record<CollectionName, number> }> {
    const library = {} as Record<CollectionName, unknown[]>;
    const revisions = {} as Record<CollectionName, number>;
    await Promise.all(
      COLLECTIONS.map(async (name) => {
        const rel = `library/${name}.json`;
        if (!(await this.exists(rel))) {
          library[name] = [];
          revisions[name] = 0;
          return;
        }
        const file = await this.read<{ revision: number; items: unknown[] }>(rel);
        library[name] = file.items;
        revisions[name] = file.revision;
      }),
    );
    return { library: library as unknown as Library, revisions };
  }
}

/**
 * Assigns a new identifier (`<prefix>-<slug>[-n]`) inside a registry the caller has read under the
 * lock; the caller writes ids.json. Never returns an id already recorded, even a deleted one.
 */
export function allocateIdIn(registry: IdsFile, kind: IdKind, base: string, now = new Date()): string {
  const slug = fileNamePart(base).toLowerCase().slice(0, 50).replace(/-+$/, '') || 'element';
  const stem = `${ID_PREFIX[kind]}-${slug}`;
  let candidate = stem;
  for (let n = 2; registry.ids[candidate]; n++) candidate = `${stem}-${n}`;
  registry.ids[candidate] = { kind, createdAt: now.toISOString() };
  return candidate;
}
