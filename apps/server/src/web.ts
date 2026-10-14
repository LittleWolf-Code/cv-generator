// Built interface served by the API itself with `npm start` (ADR 0018): index.html with the
// X-CV-Token injected (as Vite does in development), the files of apps/web/dist/assets, and the
// single-page fallback for the interface routes (/a-valider, /candidatures/<id>/lettre…).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Hono } from 'hono';

const TYPES: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.json': 'application/json; charset=utf-8',
};
const ASSET_NAME = /^[\w-][\w.-]*$/;

export interface WebOptions {
  /** apps/web/dist (`npm run build`). */
  distDir: string;
  token: string;
  /** Online instance: the page knows it can sign out. */
  online?: boolean;
}

export async function serveWeb(app: Hono, opts: WebOptions): Promise<void> {
  if (!/^[0-9a-f]{32,}$/.test(opts.token)) throw new Error('jeton X-CV-Token invalide');
  const source = await readFile(path.join(opts.distDir, 'index.html'), 'utf8');
  if (!source.includes('</head>')) throw new Error(`index.html sans </head> : ${opts.distDir}`);
  const metas = [`<meta name="cv-token" content="${opts.token}" />`];
  if (opts.online) metas.push('<meta name="cv-online" content="1" />');
  const index = source.replace('</head>', `${metas.join('')}</head>`);
  const assetsDir = path.join(opts.distDir, 'assets');

  app.get('/assets/:name', async (c) => {
    const name = c.req.param('name');
    const type = TYPES[path.extname(name).toLowerCase()];
    if (!ASSET_NAME.test(name) || !type) return c.notFound();
    try {
      return c.body(await readFile(path.join(assetsDir, name)), 200, { 'Content-Type': type });
    } catch {
      return c.notFound();
    }
  });

  app.get('*', (c) => {
    const p = new URL(c.req.url).pathname;
    if (p.startsWith('/api/') || p.startsWith('/auth/') || p.startsWith('/assets/')) return c.notFound();
    return c.html(index);
  });
}
