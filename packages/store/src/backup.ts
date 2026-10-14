// Backup (F-LIB-09): ZIP of the data directory, read in memory. The lock, temporary files and .git/
// are left out; everything else (library, presets, applications and their exports, proposals,
// assets) is kept, under a `data/` folder.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { zipSync, type Zippable } from 'fflate';
import { isIgnoredDataPath } from './watch.js';

async function collect(dir: string, base: string, out: Zippable): Promise<void> {
  for (const entry of await readdir(path.join(dir, base), { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (isIgnoredDataPath(rel)) continue;
    if (entry.isDirectory()) await collect(dir, rel, out);
    else if (entry.isFile()) out[`data/${rel}`] = new Uint8Array(await readFile(path.join(dir, ...rel.split('/'))));
  }
}

export async function zipDataDir(dataDir: string): Promise<Uint8Array> {
  const files: Zippable = {};
  await collect(dataDir, '', files);
  return zipSync(files, { level: 6 });
}

/** `cv-data-AAAAMMJJ-HHmmss.zip`, in local time. */
export function backupFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `cv-data-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}.zip`;
}
