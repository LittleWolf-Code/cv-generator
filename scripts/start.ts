// `npm start`: production mode (ADR 0018). A single server on 127.0.0.1:<CV_PORT> serves the API and
// the built interface (`npm run build` first), with the X-CV-Token injected into the page. With
// CV_PUBLIC_ORIGIN (online instance behind a reverse proxy), the passkey sign-in is always on.
// Folders: CV_DATA_DIR, CV_IMPORT_DIR, CV_OUT_DIR and CV_AUTH_DIR (absolute), by default data/,
// import/, out/ and auth/ at the project root.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newToken, parsePublicOrigin, startServer } from '@cv/server';
import { DataStore } from '@cv/store';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (existsSync(path.join(ROOT, '.env'))) process.loadEnvFile(path.join(ROOT, '.env'));

function folder(variable: string, fallback: string): string {
  const value = process.env[variable];
  if (!value) return path.join(ROOT, fallback);
  if (!path.isAbsolute(value)) throw new Error(`${variable} doit être un chemin absolu : ${value}`);
  return path.resolve(value);
}

async function main(): Promise<void> {
  const port = Number(process.env.CV_PORT ?? 4310);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error(`CV_PORT invalide : ${process.env.CV_PORT}`);
  const publicOrigin = process.env.CV_PUBLIC_ORIGIN ? parsePublicOrigin(process.env.CV_PUBLIC_ORIGIN) : undefined;
  const dataDir = folder('CV_DATA_DIR', 'data');
  const importDir = folder('CV_IMPORT_DIR', 'import');
  const outDir = folder('CV_OUT_DIR', 'out');
  const authDir = folder('CV_AUTH_DIR', 'auth');
  const webDistDir = path.join(ROOT, 'apps', 'web', 'dist');
  if (!existsSync(path.join(webDistDir, 'index.html'))) {
    throw new Error("interface non compilée : lancez « npm run build » d'abord");
  }
  if (!existsSync(path.join(dataDir, 'profile.json'))) {
    throw new Error(`dossier de données introuvable : ${dataDir}. Lancez « npm run data:init ».`);
  }

  const { server, watcher } = await startServer({
    store: DataStore.open(dataDir),
    apiPort: port,
    uiOrigins: [`http://127.0.0.1:${port}`, `http://localhost:${port}`],
    token: newToken(),
    outDir,
    importDir,
    webDistDir,
    ...(publicOrigin ? { publicOrigin, auth: { dir: authDir } } : {}),
  });

  console.log(`Générateur de CV : http://127.0.0.1:${port}`);
  if (publicOrigin) console.log(`  Instance en ligne : ${publicOrigin} (connexion par clé de sécurité)`);
  console.log(`  Données : ${dataDir}`);

  const stop = () => {
    void watcher.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err: unknown) => {
  console.error(`start : ${(err as Error).message}`);
  process.exit(1);
});
