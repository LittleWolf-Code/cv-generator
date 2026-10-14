// Atomic file writes (§8.4): temporary file, then rename, retried on EPERM/EACCES/EBUSY
// (antivirus, indexer on Windows): 5 attempts, exponential wait from 20 to 320 ms.
import { randomBytes } from 'node:crypto';
import { link, open, rename, unlink } from 'node:fs/promises';
import path from 'node:path';

const RETRYABLE = new Set(['EPERM', 'EACCES', 'EBUSY']);
export const RENAME_DELAYS_MS = [20, 40, 80, 160, 320] as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Renames with retries; the first attempt is immediate, then waits 20, 40, 80, 160, 320 ms. */
export async function renameWithRetry(from: string, to: string, renameFn = rename): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await renameFn(from, to);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (!code || !RETRYABLE.has(code) || attempt >= RENAME_DELAYS_MS.length) throw err;
      await sleep(RENAME_DELAYS_MS[attempt]!);
    }
  }
}

export function tempPathFor(file: string): string {
  return path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`);
}

/** Writes `content` to `file` atomically: never a partially written file, even after a crash. */
export async function writeFileAtomic(file: string, content: string | Uint8Array): Promise<void> {
  const tmp = tempPathFor(file);
  const handle = await open(tmp, 'wx');
  try {
    await handle.writeFile(content);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await renameWithRetry(tmp, file);
  } catch (err) {
    await unlink(tmp).catch(() => undefined);
    throw err;
  }
}

/**
 * Creates `file` atomically and exclusively: a temporary file, then a hard link to the final name, which
 * fails with EEXIST when the file already exists (a letter version is never overwritten, ADR 0016).
 */
export async function writeFileExclusive(file: string, content: string | Uint8Array): Promise<void> {
  const tmp = tempPathFor(file);
  const handle = await open(tmp, 'wx');
  try {
    await handle.writeFile(content);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await link(tmp, file);
  } finally {
    await unlink(tmp).catch(() => undefined);
  }
}

/** UTF-8 JSON without BOM, 2-space indentation, trailing newline. */
export function serializeJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** Parses JSON, tolerating a UTF-8 BOM (§8.4). */
export function parseJson(raw: string): unknown {
  return JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
}
