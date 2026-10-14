// `npm run dev`: one command (NF-05). Starts the local API (Hono, 127.0.0.1) and the Vite dev
// server, with a /api proxy (single origin) and the X-CV-Token injected into the page (NF-01).
// `npm run dev:demo` (or `npm run dev -- --fixture courte`) works on a temporary copy of a
// fictitious fixture instead of data/, with a temporary import/ holding the fictitious offers (offres/),
// LinkedIn export and CV.
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, type Plugin } from 'vite';
import { startServer, newToken } from '@cv/server';
import { createApplication, createLetterVersion, DataStore, installFixture } from '@cv/store';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** Fictitious files of fixtures/imports/ copied to the demo's import/ (ADR 0015). */
const DEMO_IMPORTS = [
  'Basic_LinkedInDataExport_fictif.zip',
  'CV_Camille_Martin_fictif.pdf',
  'CV_Camille_Martin_fictif.docx',
  'CV_Camille_Martin_fictif_scan.pdf',
];
if (existsSync(path.join(ROOT, '.env'))) process.loadEnvFile(path.join(ROOT, '.env'));

function tokenPlugin(token: string): Plugin {
  return {
    name: 'cv-token',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { name: 'cv-token', content: token }, injectTo: 'head' }],
  };
}

/**
 * Demo application (lot 7, ADR 0016): the fictitious offer « logiciel DM » and its cover letter v1 (a
 * Claude version, not active: the user chooses the active version in the interface).
 */
async function demoApplication(store: DataStore, importDir: string): Promise<void> {
  const { application } = await createApplication(
    store,
    {
      company: 'ACME Medical',
      jobTitle: 'Ingénieur logiciel dispositifs médicaux H/F',
      offerReference: 'ACME-1234',
      lang: 'fr',
      basePresetId: 'preset-defaut',
      offerFile: 'offre-logiciel-dm.md',
    },
    { importDir },
  );
  const letter = JSON.parse(
    await readFile(path.join(ROOT, 'fixtures', 'letters', 'lettre-logiciel-dm-fr.json'), 'utf8'),
  );
  try {
    await createLetterVersion(store, application.id, 'fr', letter, 'claude');
  } catch (err) {
    // The fictitious letter cites elements of « courte »; another persona simply has no letter yet.
    console.log(`  Lettre de démo non créée : ${(err as Error).message}`);
  }
}

async function main(): Promise<void> {
  const fixtureArg = process.argv.indexOf('--fixture');
  const fixture = fixtureArg >= 0 ? process.argv[fixtureArg + 1] : undefined;
  let dataDir: string;
  let importDir = path.join(ROOT, 'import');
  let cleanup: (() => Promise<void>) | null = null;
  if (fixture) {
    if (!/^[a-z]+$/.test(fixture) || !existsSync(path.join(ROOT, 'fixtures', 'personas', fixture))) {
      throw new Error(`fixture inconnue : ${fixture}`);
    }
    dataDir = await mkdtemp(path.join(os.tmpdir(), `cv-demo-${fixture}-`));
    await installFixture(path.join(ROOT, 'fixtures', 'personas', fixture), dataDir);
    importDir = `${dataDir}-import`;
    await mkdir(importDir, { recursive: true });
    await cp(path.join(ROOT, 'fixtures', 'offres'), path.join(importDir, 'offres'), { recursive: true });
    // Fictitious import files (lot 6): the LinkedIn export (ZIP) and the CV (PDF, DOCX, scanned PDF).
    for (const name of DEMO_IMPORTS) await cp(path.join(ROOT, 'fixtures', 'imports', name), path.join(importDir, name));
    cleanup = async () => {
      await rm(dataDir, { recursive: true, force: true });
      await rm(importDir, { recursive: true, force: true });
    };
  } else {
    const override = process.env.CV_DATA_DIR;
    if (override && !path.isAbsolute(override)) throw new Error(`CV_DATA_DIR doit être un chemin absolu : ${override}`);
    dataDir = override ?? path.join(ROOT, 'data');
  }
  const store = DataStore.open(dataDir);
  if (fixture) await demoApplication(store, importDir);

  const uiPort = Number(process.env.CV_PORT ?? 4310);
  const apiPort = uiPort + 1;
  const uiOrigins = [`http://127.0.0.1:${uiPort}`, `http://localhost:${uiPort}`];
  const token = newToken();
  const outDir = path.join(ROOT, 'out');
  const { server: api, watcher } = await startServer({ store, apiPort, uiOrigins, token, outDir, importDir });

  const vite = await createServer({
    root: path.join(ROOT, 'apps', 'web'),
    configFile: path.join(ROOT, 'apps', 'web', 'vite.config.ts'),
    plugins: [tokenPlugin(token)],
    server: {
      host: '127.0.0.1',
      port: uiPort,
      strictPort: true,
      proxy: { '/api': { target: `http://127.0.0.1:${apiPort}`, changeOrigin: true } },
    },
  });
  await vite.listen();

  console.log('');
  if (fixture) {
    console.log(`  Démo : copie temporaire de la fixture fictive « ${fixture} »`);
    console.log(`  Dossier de données (effacé à l'arrêt) : ${dataDir}`);
    console.log(
      `  Propositions de démonstration : copiez un fichier de fixtures/proposals/ dans ${path.join(dataDir, 'proposals')}`,
    );
    console.log(`  Offres fictives (import/offres/ de la démo) : ${path.join(importDir, 'offres')}`);
    console.log(`  Imports fictifs (import/ de la démo) : ${DEMO_IMPORTS.join(', ')}`);
  } else {
    console.log(`  Données : ${dataDir}`);
  }
  console.log(
    `  Exports : téléchargés par le navigateur ; copie horodatée dans la candidature, ou dans ${path.join(outDir, 'exports')} pour un preset`,
  );
  if (!fixture) console.log(`  Offres à importer : ${path.join(importDir, 'offres')} (.md ou .txt)`);
  console.log(`  Interface : http://127.0.0.1:${uiPort}/`);
  console.log(`  API locale : http://127.0.0.1:${apiPort}/api/health (127.0.0.1 uniquement, jeton requis)`);
  console.log('  Ctrl+C pour arrêter.');

  const stop = async () => {
    await watcher.close();
    await vite.close();
    api.close();
    if (cleanup) await cleanup();
    process.exit(0);
  };
  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());
}

main().catch((err: unknown) => {
  console.error(`npm run dev : ${(err as Error).message}`);
  const hint = (err as { hint?: string }).hint;
  if (hint) console.error(`  → ${hint}`);
  process.exit(1);
});
