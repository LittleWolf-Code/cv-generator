// Reset of the data directory (F-LIB-09c, ADR 0021): back to the state of `npm run data:init`, from the
// interface only (never through the MCP). Under the lock, a ZIP copy of data/ is written first in the
// backup folder (never overwritten), then the files of the data model are removed and the empty ones
// created again. The id registry is kept (F-LIB-02: an id is never reused), as are .git/ and any file
// outside the data model.
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import type { IdsFile } from '@cv/core';
import { writeFileExclusive } from './atomic.js';
import { backupFileName, zipDataDir } from './backup.js';
import type { WriteRef } from './library.js';
import { emptyDataFiles, initDataDir } from './setup.js';
import type { DataStore } from './store.js';

/** Entries of the data model (§9.1) removed by a reset; ids.json is kept. */
export const RESET_ENTRIES = ['profile.json', 'library', 'presets', 'applications', 'proposals', 'assets'] as const;

export interface ResetResult {
  /** Absolute path of the ZIP copy made before the reset. */
  backupFile: string;
  writes: WriteRef[];
}

/** Writes the ZIP under a free name: `cv-data-<stamp>.zip`, then `-2`, `-3`… within the same second. */
async function writeBackup(backupDir: string, zip: Uint8Array, now: Date): Promise<string> {
  await mkdir(backupDir, { recursive: true });
  const stem = backupFileName(now).replace(/\.zip$/, '');
  for (let n = 1; ; n++) {
    const file = path.join(backupDir, `${stem}${n > 1 ? `-${n}` : ''}.zip`);
    try {
      await writeFileExclusive(file, zip);
      return file;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST' || n >= 100) throw err;
    }
  }
}

export async function resetDataDir(store: DataStore, backupDir: string, now = new Date()): Promise<ResetResult> {
  return store.withLock(async () => {
    const backupFile = await writeBackup(backupDir, await zipDataDir(store.dataDir), now);
    for (const entry of RESET_ENTRIES) {
      // maxRetries: EBUSY / EPERM from an antivirus or an indexer on Windows (§8.4).
      await rm(store.abs(entry), { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
    }
    const created = await initDataDir(store.dataDir);
    const writes: WriteRef[] = created.map((file) => ({ file, revision: 1 }));
    // The registry kept must still know the ids of the default categories and preset.
    const registry = await store.readIds();
    const defaults = (emptyDataFiles(now)['ids.json'] as IdsFile).ids;
    const missing = Object.keys(defaults).filter((id) => !registry.ids[id]);
    if (missing.length) {
      for (const id of missing) registry.ids[id] = defaults[id]!;
      const saved = await store.write('ids.json', registry, { locked: true });
      writes.push({ file: 'ids.json', revision: saved.revision });
    }
    return { backupFile, writes };
  });
}
