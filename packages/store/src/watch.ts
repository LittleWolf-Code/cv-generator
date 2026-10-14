// Watching the data directory (§8.4): chokidar 5, ignoring the lock, temporary files of atomic writes
// and .git/, with a 100 ms debounce per file. Each event carries the file and its `revision`, so the
// interface can recognize (and ignore) its own writes.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { watch } from 'chokidar';
import { parseJson } from './atomic.js';
import { LOCK_NAME } from './store.js';

export interface DataChange {
  /** Path relative to the data directory, with `/`. */
  file: string;
  /** `revision` of the JSON file after the change; null for a deleted or non-JSON file. */
  revision: number | null;
  deleted: boolean;
}

export interface DataWatcher {
  /** Resolves when the initial scan is done (events before that are not reported). */
  ready: Promise<void>;
  close(): Promise<void>;
}

export const WATCH_DEBOUNCE_MS = 100;

/** True for paths never reported: the lock, temporary files of atomic writes, .git/. */
export function isIgnoredDataPath(rel: string): boolean {
  const parts = rel.split(/[\\/]/);
  if (parts.includes('.git')) return true;
  if (parts[0] === LOCK_NAME || parts.some((p) => p.endsWith('.lock'))) return true;
  const base = parts[parts.length - 1] ?? '';
  return base.endsWith('.tmp') || base.endsWith('~');
}

async function revisionOf(abs: string): Promise<number | null> {
  if (!abs.endsWith('.json')) return null;
  try {
    const value = parseJson(await readFile(abs, 'utf8')) as { revision?: unknown };
    return typeof value.revision === 'number' ? value.revision : null;
  } catch {
    return null; // Partially written by hand, or invalid: the next change will be reported.
  }
}

export function watchDataDir(
  dataDir: string,
  onChange: (change: DataChange) => void,
  opts: { debounceMs?: number } = {},
): DataWatcher {
  const debounceMs = opts.debounceMs ?? WATCH_DEBOUNCE_MS;
  const timers = new Map<string, NodeJS.Timeout>();
  const rel = (abs: string) => path.relative(dataDir, abs).split(path.sep).join('/');

  const watcher = watch(dataDir, {
    ignoreInitial: true,
    ignored: (p: string) => {
      const r = rel(p);
      return r !== '' && isIgnoredDataPath(r);
    },
  });

  const schedule = (abs: string) => {
    const file = rel(abs);
    if (!file || file.startsWith('..') || isIgnoredDataPath(file)) return;
    clearTimeout(timers.get(file));
    timers.set(
      file,
      setTimeout(() => {
        timers.delete(file);
        const deleted = !existsSync(abs);
        void (deleted ? Promise.resolve(null) : revisionOf(abs)).then((revision) =>
          onChange({ file, revision, deleted }),
        );
      }, debounceMs),
    );
  };

  watcher.on('add', schedule).on('change', schedule).on('unlink', schedule);
  watcher.on('error', (err) => console.error(`surveillance de ${dataDir} : ${(err as Error).message}`));
  const ready = new Promise<void>((resolve) => watcher.once('ready', () => resolve()));

  return {
    ready,
    async close() {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
      await watcher.close();
    },
  };
}
