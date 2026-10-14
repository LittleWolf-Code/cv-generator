// Passkey sign-in of the online instance (ADR 0018, NF-01): WebAuthn with the user's security key
// (YubiKey), an in-memory session behind a cookie, and a one-time enrolment code that can only be read
// on the server (over SSH, hence with the same key). The registered keys live in their own folder,
// outside data/: never in a backup ZIP, never visible to the MCP server.
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import type { Context, Hono, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import { loginPage } from './login-page.js';

export interface AuthOptions {
  /** Folder of the registered keys and of the pending enrolment code (`CV_AUTH_DIR`). */
  dir: string;
  /** Clock, for the tests. */
  now?: () => number;
}

const SESSION_COOKIE = 'cv-session';
const SESSION_TTL_MS = 12 * 3600_000;
const CHALLENGE_TTL_MS = 5 * 60_000;
const MAX_PENDING_CHALLENGES = 50;
export const ENROLMENT_CODE_TTL_MS = 15 * 60_000;
const ENROLMENT_MAX_ATTEMPTS = 5;
const FAILURE_WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 20;
const MAX_KEYS = 10;
/** Unambiguous letters and digits of the enrolment code (no 0/o, 1/l/i). */
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const CODE_LENGTH = 20;

const KEYS_FILE = 'keys.json';
const CODE_FILE = 'enrolment-code.json';

const base64url = z.string().regex(/^[\w-]+$/);
const storedKey = z.strictObject({
  id: base64url.max(1024),
  publicKey: base64url.max(1024),
  counter: z.number().int().nonnegative(),
  transports: z.array(z.string().max(32)).max(10).optional(),
  label: z.string().max(80),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
});
const keysFile = z.strictObject({ version: z.literal(1), keys: z.array(storedKey).max(MAX_KEYS) });
const codeFile = z.strictObject({
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  expiresAt: z.number(),
  attempts: z.number().int().nonnegative(),
});
const credentialBody = z.strictObject({
  challengeId: z.string().max(64),
  response: z.record(z.string(), z.unknown()),
});
const enrolBody = z.strictObject({ code: z.string().max(64), label: z.string().max(200).optional() });

type StoredKey = z.infer<typeof storedKey>;
interface PendingChallenge {
  challenge: string;
  kind: 'login' | 'register';
  expiresAt: number;
  /** Registration: hash of the code the options were issued for, and the name of the key. */
  codeHash?: string;
  label?: string;
}

const sha256hex = (text: string) => createHash('sha256').update(text).digest('hex');
const normalizeCode = (code: string) => code.toLowerCase().replace(/[\s-]/g, '');
const isMissing = (err: unknown) => (err as NodeJS.ErrnoException).code === 'ENOENT';

function sameHex(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${randomBytes(6).toString('hex')}.tmp`;
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  await rename(tmp, file);
}

/** A label without control characters, 80 characters at most. */
function cleanLabel(label: string | undefined): string {
  const text = (label ?? '')
    .replace(/\p{Cc}|\p{Cf}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return text || 'Clé de sécurité';
}

/** Path to come back to after the sign-in: a local path only (no open redirect). */
export function safeNext(value: string | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
  if (value === '/connexion' || value.startsWith('/connexion?')) return '/';
  return value;
}

/**
 * Creates the one-time enrolment code (`npm run auth:code`, run on the server): 20 characters, valid
 * 15 minutes, 5 attempts. Only its hash is stored; a new code replaces the previous one.
 */
export async function createEnrolmentCode(dir: string, now = Date.now()): Promise<{ code: string; expiresAt: Date }> {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  const expiresAt = now + ENROLMENT_CODE_TTL_MS;
  await writeJson(path.join(dir, CODE_FILE), { sha256: sha256hex(code), expiresAt, attempts: 0 });
  return { code: code.match(/.{5}/g)!.join('-'), expiresAt: new Date(expiresAt) };
}

export class PasskeyAuth {
  readonly origin: string;
  readonly rpID: string;
  private readonly dir: string;
  private readonly now: () => number;
  private readonly sessions = new Map<string, number>();
  private readonly challenges = new Map<string, PendingChallenge>();
  private failures: number[] = [];
  private queue: Promise<unknown> = Promise.resolve();

  constructor(origin: string, opts: AuthOptions) {
    this.origin = origin;
    this.rpID = new URL(origin).hostname;
    this.dir = opts.dir;
    this.now = opts.now ?? Date.now;
  }

  /** Runs the read-modify-write sequences on the key files one at a time. */
  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async keys(): Promise<StoredKey[]> {
    try {
      return keysFile.parse(JSON.parse(await readFile(path.join(this.dir, KEYS_FILE), 'utf8'))).keys;
    } catch (err) {
      if (isMissing(err)) return [];
      throw err;
    }
  }

  private saveKeys(keys: StoredKey[]): Promise<void> {
    return writeJson(path.join(this.dir, KEYS_FILE), { version: 1, keys });
  }

  private async readCode(): Promise<z.infer<typeof codeFile> | null> {
    try {
      return codeFile.parse(JSON.parse(await readFile(path.join(this.dir, CODE_FILE), 'utf8')));
    } catch (err) {
      if (isMissing(err)) return null;
      throw err;
    }
  }

  private dropCode(): Promise<void> {
    return rm(path.join(this.dir, CODE_FILE), { force: true });
  }

  /** Checks a typed code; a wrong code costs one of the 5 attempts, an expired or spent code is removed. */
  private checkCode(code: string): Promise<'ok' | 'none' | 'expired' | 'invalid'> {
    return this.exclusive(async () => {
      const file = await this.readCode();
      if (!file) return 'none';
      if (file.expiresAt <= this.now()) {
        await this.dropCode();
        return 'expired';
      }
      if (sameHex(sha256hex(normalizeCode(code)), file.sha256)) return 'ok';
      const attempts = file.attempts + 1;
      if (attempts >= ENROLMENT_MAX_ATTEMPTS) await this.dropCode();
      else await writeJson(path.join(this.dir, CODE_FILE), { ...file, attempts });
      return 'invalid';
    });
  }

  hasSession(c: Context): boolean {
    const id = getCookie(c, SESSION_COOKIE, 'host');
    if (!id) return false;
    const expiresAt = this.sessions.get(id);
    if (expiresAt === undefined) return false;
    if (expiresAt <= this.now()) {
      this.sessions.delete(id);
      return false;
    }
    return true;
  }

  private openSession(c: Context): void {
    for (const [id, expiresAt] of this.sessions) if (expiresAt <= this.now()) this.sessions.delete(id);
    const id = randomBytes(32).toString('base64url');
    this.sessions.set(id, this.now() + SESSION_TTL_MS);
    setCookie(c, SESSION_COOKIE, id, {
      prefix: 'host',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
      maxAge: SESSION_TTL_MS / 1000,
    });
  }

  private newChallenge(entry: Omit<PendingChallenge, 'expiresAt'>): string {
    const now = this.now();
    for (const [id, pending] of this.challenges) if (pending.expiresAt <= now) this.challenges.delete(id);
    // Unauthenticated requests create challenges: their number is capped (the oldest goes first).
    while (this.challenges.size >= MAX_PENDING_CHALLENGES) this.challenges.delete(this.challenges.keys().next().value!);
    const id = randomBytes(16).toString('base64url');
    this.challenges.set(id, { ...entry, expiresAt: now + CHALLENGE_TTL_MS });
    return id;
  }

  /** A challenge is used once, whatever the outcome. */
  private takeChallenge(id: string, kind: PendingChallenge['kind']): PendingChallenge | null {
    const pending = this.challenges.get(id);
    this.challenges.delete(id);
    if (!pending || pending.kind !== kind || pending.expiresAt <= this.now()) return null;
    return pending;
  }

  private throttled(): boolean {
    const since = this.now() - FAILURE_WINDOW_MS;
    this.failures = this.failures.filter((at) => at > since);
    return this.failures.length >= MAX_FAILURES;
  }

  private fail(c: Context, message = 'clé de sécurité non reconnue') {
    this.failures.push(this.now());
    return c.json({ code: 'AUTH_FAILED', message, hint: 'recommencez la connexion depuis la page' }, 403);
  }

  /** Every route except the sign-in page, its API and the health check requires a session. */
  gate(): MiddlewareHandler {
    return async (c, next) => {
      const url = new URL(c.req.url);
      const p = url.pathname;
      if (p === '/connexion' || p.startsWith('/auth/') || p === '/api/health') return next();
      if (this.hasSession(c)) return next();
      if (c.req.method === 'GET' && !p.startsWith('/api/')) {
        return c.redirect(`/connexion?suite=${encodeURIComponent(p + url.search)}`, 302);
      }
      return c.json(
        { code: 'UNAUTHENTICATED', message: 'connexion requise', hint: 'reconnectez-vous avec votre clé de sécurité' },
        401,
      );
    };
  }

  routes(app: Hono): void {
    const parse = async <T>(c: Context, schema: z.ZodType<T>): Promise<T | null> => {
      const parsed = schema.safeParse(await c.req.json().catch(() => null));
      return parsed.success ? parsed.data : null;
    };
    const throttledResponse = (c: Context) =>
      c.json({ code: 'TOO_MANY_ATTEMPTS', message: "trop d'échecs récents", hint: 'réessayez dans 15 minutes' }, 429);

    app.get('/connexion', (c) => {
      if (this.hasSession(c)) return c.redirect(safeNext(c.req.query('suite')), 302);
      const page = loginPage();
      c.header('Content-Security-Policy', page.csp);
      return c.html(page.html);
    });

    app.get('/auth/status', async (c) =>
      c.json({ enrolled: (await this.keys()).length > 0, authenticated: this.hasSession(c) }),
    );

    app.post('/auth/login/options', async (c) => {
      if (this.throttled()) return throttledResponse(c);
      const keys = await this.keys();
      if (!keys.length) {
        return c.json(
          {
            code: 'NOT_ENROLLED',
            message: "aucune clé de sécurité n'est enregistrée",
            hint: 'enregistrez une clé avec un code généré sur le serveur',
          },
          409,
        );
      }
      const options = await generateAuthenticationOptions({
        rpID: this.rpID,
        allowCredentials: keys.map((k) => ({ id: k.id, ...(k.transports ? { transports: k.transports } : {}) })),
        userVerification: 'preferred',
      });
      return c.json({ challengeId: this.newChallenge({ challenge: options.challenge, kind: 'login' }), options });
    });

    app.post('/auth/login/verify', async (c) => {
      if (this.throttled()) return throttledResponse(c);
      const input = await parse(c, credentialBody);
      const pending = input ? this.takeChallenge(input.challengeId, 'login') : null;
      if (!input || !pending) return this.fail(c, 'demande de connexion expirée ou inconnue');
      const response = input.response as unknown as AuthenticationResponseJSON;
      const ok = await this.exclusive(async () => {
        const keys = await this.keys();
        const key = keys.find((k) => k.id === response.id);
        if (!key) return false;
        try {
          const { verified, authenticationInfo } = await verifyAuthenticationResponse({
            response,
            expectedChallenge: pending.challenge,
            expectedOrigin: this.origin,
            expectedRPID: this.rpID,
            credential: {
              id: key.id,
              publicKey: isoBase64URL.toBuffer(key.publicKey),
              counter: key.counter,
              ...(key.transports ? { transports: key.transports } : {}),
            },
            requireUserVerification: false,
          });
          if (!verified) return false;
          key.counter = authenticationInfo.newCounter;
          key.lastUsedAt = new Date(this.now()).toISOString();
          await this.saveKeys(keys);
          return true;
        } catch {
          return false;
        }
      });
      if (!ok) return this.fail(c);
      this.openSession(c);
      return c.json({ ok: true });
    });

    app.post('/auth/register/options', async (c) => {
      if (this.throttled()) return throttledResponse(c);
      const input = await parse(c, enrolBody);
      if (!input) return c.json({ code: 'INVALID_BODY', message: 'corps de requête invalide' }, 400);
      const keys = await this.keys();
      if (keys.length >= MAX_KEYS) {
        return c.json({ code: 'TOO_MANY_KEYS', message: `${MAX_KEYS} clés au plus`, hint: null }, 409);
      }
      const status = await this.checkCode(input.code);
      if (status !== 'ok') {
        const message = {
          none: "aucun code d'enregistrement en cours",
          expired: "code d'enregistrement expiré",
          invalid: "code d'enregistrement incorrect",
        }[status];
        this.failures.push(this.now());
        return c.json(
          { code: 'INVALID_CODE', message, hint: 'générez un nouveau code sur le serveur : npm run auth:code' },
          403,
        );
      }
      const options = await generateRegistrationOptions({
        rpName: 'Générateur de CV',
        rpID: this.rpID,
        userName: 'cv',
        userDisplayName: 'Générateur de CV',
        attestationType: 'none',
        excludeCredentials: keys.map((k) => ({ id: k.id, ...(k.transports ? { transports: k.transports } : {}) })),
        authenticatorSelection: { residentKey: 'discouraged', userVerification: 'preferred' },
        preferredAuthenticatorType: 'securityKey',
      });
      const challengeId = this.newChallenge({
        challenge: options.challenge,
        kind: 'register',
        codeHash: sha256hex(normalizeCode(input.code)),
        label: cleanLabel(input.label),
      });
      return c.json({ challengeId, options });
    });

    app.post('/auth/register/verify', async (c) => {
      if (this.throttled()) return throttledResponse(c);
      const input = await parse(c, credentialBody);
      const pending = input ? this.takeChallenge(input.challengeId, 'register') : null;
      if (!input || !pending) return this.fail(c, "demande d'enregistrement expirée ou inconnue");
      let verification;
      try {
        verification = await verifyRegistrationResponse({
          response: input.response as unknown as RegistrationResponseJSON,
          expectedChallenge: pending.challenge,
          expectedOrigin: this.origin,
          expectedRPID: this.rpID,
          requireUserVerification: false,
        });
      } catch {
        return this.fail(c, "réponse d'enregistrement invalide");
      }
      if (!verification.verified) return this.fail(c, "réponse d'enregistrement invalide");
      const { credential } = verification.registrationInfo;
      const outcome = await this.exclusive(async () => {
        // The code is spent only now, and only if it is still the one the options were issued for.
        const code = await this.readCode();
        if (!code || code.expiresAt <= this.now() || !sameHex(code.sha256, pending.codeHash ?? '')) return 'code';
        const keys = await this.keys();
        if (keys.some((k) => k.id === credential.id)) return 'duplicate';
        if (keys.length >= MAX_KEYS) return 'full';
        const at = new Date(this.now()).toISOString();
        keys.push({
          id: credential.id,
          publicKey: isoBase64URL.fromBuffer(credential.publicKey),
          counter: credential.counter,
          ...(credential.transports?.length ? { transports: credential.transports.slice(0, 10) } : {}),
          label: pending.label ?? 'Clé de sécurité',
          createdAt: at,
          lastUsedAt: at,
        });
        await this.saveKeys(keys);
        await this.dropCode();
        return 'ok';
      });
      if (outcome === 'code') {
        return c.json(
          {
            code: 'INVALID_CODE',
            message: "code d'enregistrement expiré ou déjà utilisé",
            hint: 'générez un nouveau code sur le serveur : npm run auth:code',
          },
          403,
        );
      }
      if (outcome === 'duplicate')
        return c.json({ code: 'ALREADY_EXISTS', message: 'cette clé est déjà enregistrée' }, 409);
      if (outcome === 'full') return c.json({ code: 'TOO_MANY_KEYS', message: `${MAX_KEYS} clés au plus` }, 409);
      this.openSession(c);
      return c.json({ ok: true, label: pending.label });
    });

    app.post('/auth/logout', (c) => {
      const id = getCookie(c, SESSION_COOKIE, 'host');
      if (id) this.sessions.delete(id);
      deleteCookie(c, SESSION_COOKIE, { prefix: 'host', path: '/', secure: true });
      return c.json({ ok: true });
    });
  }
}
