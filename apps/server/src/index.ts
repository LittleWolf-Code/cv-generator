import { randomBytes } from 'node:crypto';
import { serve, type ServerType } from '@hono/node-server';
import { watchDataDir, type DataStore, type DataWatcher } from '@cv/store';
import type { AuthOptions } from './auth.js';
import { createApp } from './app.js';
import { DataEvents } from './events.js';
import { serveWeb } from './web.js';

export { createApp } from './app.js';
export { DataEvents } from './events.js';
export { security } from './security.js';
export { libraryTree } from './tree.js';
export { buildProposalViews } from './proposal-views.js';
export { exportCv } from './export.js';
export { createEnrolmentCode, PasskeyAuth, safeNext, type AuthOptions } from './auth.js';
export { parsePublicOrigin } from './security.js';
export { serveWeb } from './web.js';

export interface StartOptions {
  store: DataStore;
  apiPort: number;
  uiOrigins: string[];
  /** Random token generated at each start (NF-01); injected into the page. */
  token?: string;
  /** Root of the timestamped export copies of presets (`<project>/out`). */
  outDir?: string;
  /** `<project>/import` (offers in import/offres/), or a demo copy. */
  importDir?: string | null;
  /** Public origin of the online instance, always with the passkey sign-in (ADR 0018). */
  publicOrigin?: string;
  auth?: AuthOptions;
  /** apps/web/dist: the API also serves the built interface (`npm start`). */
  webDistDir?: string;
}

export function newToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Starts the API on 127.0.0.1 only (a reverse proxy publishes the online instance, ADR 0018), with the
 * data watcher feeding the SSE stream.
 */
export async function startServer(
  opts: StartOptions,
): Promise<{ server: ServerType; token: string; watcher: DataWatcher }> {
  const token = opts.token ?? newToken();
  const events = new DataEvents();
  const app = createApp({
    store: opts.store,
    events,
    token,
    apiPort: opts.apiPort,
    uiOrigins: opts.uiOrigins,
    ...(opts.outDir ? { outDir: opts.outDir } : {}),
    importDir: opts.importDir ?? null,
    ...(opts.publicOrigin ? { publicOrigin: opts.publicOrigin } : {}),
    ...(opts.auth ? { auth: opts.auth } : {}),
  });
  if (opts.webDistDir) await serveWeb(app, { distDir: opts.webDistDir, token, online: Boolean(opts.publicOrigin) });
  return new Promise((resolve, reject) => {
    const server = serve({ fetch: app.fetch, port: opts.apiPort, hostname: '127.0.0.1' }, () => {
      const watcher = watchDataDir(opts.store.dataDir, (change) => events.publish(change));
      resolve({ server, token, watcher });
    });
    server.once('error', (err: NodeJS.ErrnoException) =>
      reject(
        err.code === 'EADDRINUSE'
          ? Object.assign(new Error(`le port ${opts.apiPort} est déjà utilisé`), {
              hint: "arrêtez l'autre instance de « npm run dev », ou changez CV_PORT dans .env",
            })
          : err,
      ),
    );
  });
}
