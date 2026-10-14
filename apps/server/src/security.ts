// NF-01: protected API. Host check (DNS rebinding), X-CV-Token on every /api route except the health
// check (including SSE), Origin and JSON content type on every write. The online instance (ADR 0018)
// adds its public origin to the allowed hosts and origins; it is then always behind the passkey sign-in.
import { timingSafeEqual } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';

export interface SecurityOptions {
  token: string;
  /** Port the API listens on (Host header must be 127.0.0.1:<port> or localhost:<port>). */
  apiPort: number;
  /** Origins of the user interface (Vite in development, the API itself with `npm start`). */
  uiOrigins: string[];
  /** Public origin of the online instance (`https://cv.example.org`, behind the reverse proxy), ADR 0018. */
  publicOrigin?: string;
}

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const PUBLIC_PATHS = new Set(['/api/health']);

function sameToken(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Checks a public origin: https, a host name, no path, query, credentials or port (ADR 0018). */
export function parsePublicOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`CV_PUBLIC_ORIGIN invalide : ${value}`);
  }
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.origin !== value) {
    throw new Error(
      `CV_PUBLIC_ORIGIN doit être une origine https sans chemin ni port, par exemple https://cv.example.org : ${value}`,
    );
  }
  return url.origin;
}

const deny = (status: 403 | 415, message: string) =>
  new Response(JSON.stringify({ code: status === 403 ? 'FORBIDDEN' : 'UNSUPPORTED_MEDIA_TYPE', message }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export function security(opts: SecurityOptions): MiddlewareHandler {
  const allowedHosts = new Set([`127.0.0.1:${opts.apiPort}`, `localhost:${opts.apiPort}`]);
  const allowedOrigins = new Set(opts.uiOrigins);
  if (opts.publicOrigin) {
    const origin = parsePublicOrigin(opts.publicOrigin);
    allowedHosts.add(new URL(origin).host);
    allowedOrigins.add(origin);
  }
  return async (c, next) => {
    const host = c.req.header('host') ?? new URL(c.req.url).host;
    if (!allowedHosts.has(host.toLowerCase())) return deny(403, 'hôte non autorisé');

    const pathname = new URL(c.req.url).pathname;
    if (pathname.startsWith('/api/') && !PUBLIC_PATHS.has(pathname)) {
      const token = c.req.header('x-cv-token') ?? '';
      if (!sameToken(token, opts.token)) return deny(403, 'jeton X-CV-Token absent ou invalide');
    }
    if (WRITE_METHODS.has(c.req.method)) {
      const origin = c.req.header('origin');
      if (!origin || !allowedOrigins.has(origin)) return deny(403, 'origine non autorisée');
      const type = c.req.header('content-type') ?? '';
      if (!/^application\/json(?:\s*;|$)/i.test(type)) return deny(415, 'Content-Type: application/json obligatoire');
    }
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Cache-Control', 'no-store');
    c.header('X-Frame-Options', 'DENY');
    c.header('Referrer-Policy', 'no-referrer');
  };
}
