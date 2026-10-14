import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataStore, installFixture, type Snapshot } from '@cv/store';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const FIXTURES = path.join(ROOT, 'fixtures');

/** Installs a fictitious persona in a temporary data directory (sanitizing write path). */
export async function loadPersona(
  name: string,
): Promise<{ snapshot: Snapshot; store: DataStore; dir: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), `cv-test-${name}-`));
  await installFixture(path.join(FIXTURES, 'personas', name), dir);
  const store = DataStore.open(dir);
  return { snapshot: await store.loadSnapshot(), store, dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}
