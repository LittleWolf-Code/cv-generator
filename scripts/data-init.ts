// `npm run data:init`: creates an empty but valid data directory (data/ or CV_DATA_DIR). Never
// overwrites an existing file and never writes any personal data.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataStore, initDataDir } from '@cv/store';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (existsSync(path.join(ROOT, '.env'))) process.loadEnvFile(path.join(ROOT, '.env'));

async function main(): Promise<void> {
  const override = process.env.CV_DATA_DIR;
  if (override && !path.isAbsolute(override)) throw new Error(`CV_DATA_DIR doit être un chemin absolu : ${override}`);
  const dataDir = override ?? path.join(ROOT, 'data');
  const created = await initDataDir(dataDir);
  const snapshot = await DataStore.open(dataDir).loadSnapshot();
  console.log(`Dossier de données : ${dataDir}`);
  console.log(
    created.length ? `Fichiers créés : ${created.join(', ')}` : 'Rien à créer : le dossier est déjà initialisé.',
  );
  console.log(
    `Validation : OK (${snapshot.presets.length} preset, ${snapshot.library.categories.length} catégories de compétences).`,
  );
  console.log("Remplissez ensuite la bibliothèque depuis l'interface (lot 1) ou par import (lot 6).");
}

main().catch((err: unknown) => {
  console.error(`data:init : ${(err as Error).message}`);
  process.exit(1);
});
