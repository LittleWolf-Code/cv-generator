// Online instance (ADR 0018): passkey sign-in end to end with a software authenticator (ES256, real
// WebAuthn signatures), session gate, one-time enrolment code, public Host and Origin.
import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isoBase64URL, isoCBOR } from '@simplewebauthn/server/helpers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataStore, installFixture } from '@cv/store';
import { createApp } from '../src/app.js';
import { createEnrolmentCode, safeNext } from '../src/auth.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const TOKEN = 'b'.repeat(64);
const ORIGIN = 'https://cv.example.org';
const HOST = 'cv.example.org';
let dir: string;
let authDir: string;
let store: DataStore;
let clock = Date.UTC(2026, 9, 7, 8, 0, 0);
let app: ReturnType<typeof createApp>;

/** Security key simulated in software: one P-256 key pair per credential, signature counter. */
class SoftKey {
  readonly id = randomBytes(32);
  private readonly privateKey: KeyObject;
  private readonly x: Buffer;
  private readonly y: Buffer;
  counter = 0;

  constructor() {
    const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    this.privateKey = pair.privateKey;
    const jwk = pair.publicKey.export({ format: 'jwk' });
    this.x = Buffer.from(jwk.x!, 'base64url');
    this.y = Buffer.from(jwk.y!, 'base64url');
  }

  get credentialId(): string {
    return isoBase64URL.fromBuffer(this.id);
  }

  private authData(rpID: string, flags: number, attested: Uint8Array | null): Buffer {
    const count = Buffer.alloc(4);
    count.writeUInt32BE(this.counter);
    const rpIdHash = createHash('sha256').update(rpID).digest();
    return Buffer.concat([rpIdHash, Buffer.from([flags]), count, ...(attested ? [attested] : [])]);
  }

  private clientData(type: string, challenge: string, origin: string): Buffer {
    return Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
  }

  create(options: { challenge: string; rp: { id: string } }, origin = ORIGIN) {
    const cose = isoCBOR.encode(
      new Map<number, number | Uint8Array>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, this.x],
        [-3, this.y],
      ]),
    );
    const idLength = Buffer.alloc(2);
    idLength.writeUInt16BE(this.id.length);
    const attested = Buffer.concat([Buffer.alloc(16), idLength, this.id, Buffer.from(cose)]);
    const authData = this.authData(options.rp.id, 0x41, attested);
    const attestationObject = isoCBOR.encode(
      new Map<string, string | Uint8Array | Map<string, never>>([
        ['fmt', 'none'],
        ['attStmt', new Map()],
        ['authData', authData],
      ]),
    );
    return {
      id: this.credentialId,
      rawId: this.credentialId,
      type: 'public-key',
      clientExtensionResults: {},
      response: {
        clientDataJSON: isoBase64URL.fromBuffer(this.clientData('webauthn.create', options.challenge, origin)),
        attestationObject: isoBase64URL.fromBuffer(attestationObject),
        transports: ['usb'],
      },
    };
  }

  get(options: { challenge: string; rpId: string }, origin = ORIGIN) {
    this.counter += 1;
    const authData = this.authData(options.rpId, 0x01, null);
    const clientData = this.clientData('webauthn.get', options.challenge, origin);
    const signed = Buffer.concat([authData, createHash('sha256').update(clientData).digest()]);
    return {
      id: this.credentialId,
      rawId: this.credentialId,
      type: 'public-key',
      clientExtensionResults: {},
      response: {
        clientDataJSON: isoBase64URL.fromBuffer(clientData),
        authenticatorData: isoBase64URL.fromBuffer(authData),
        signature: isoBase64URL.fromBuffer(sign('sha256', signed, this.privateKey)),
      },
    };
  }
}

function newApp() {
  return createApp({
    store,
    token: TOKEN,
    apiPort: 4310,
    uiOrigins: ['http://127.0.0.1:4310', 'http://localhost:4310'],
    publicOrigin: ORIGIN,
    auth: { dir: authDir, now: () => clock },
  });
}

const headers = (cookie?: string, extra: Record<string, string> = {}) => ({
  host: HOST,
  origin: ORIGIN,
  'content-type': 'application/json',
  'x-cv-token': TOKEN,
  ...(cookie ? { cookie } : {}),
  ...extra,
});

async function post(p: string, body: unknown, cookie?: string) {
  return app.request(`${ORIGIN}${p}`, { method: 'POST', headers: headers(cookie), body: JSON.stringify(body) });
}

function sessionCookie(res: Response): string {
  const raw = res.headers.get('set-cookie') ?? '';
  const match = /__Host-cv-session=([^;]+)/.exec(raw);
  if (!match) throw new Error(`pas de cookie de session : ${raw}`);
  return `__Host-cv-session=${match[1]}`;
}

async function enrol(key: SoftKey, label = 'YubiKey principale') {
  const { code } = await createEnrolmentCode(authDir, clock);
  const optionsRes = await post('/auth/register/options', { code, label });
  expect(optionsRes.status).toBe(200);
  const { challengeId, options } = (await optionsRes.json()) as {
    challengeId: string;
    options: { challenge: string; rp: { id: string } };
  };
  return post('/auth/register/verify', { challengeId, response: key.create(options) });
}

async function signIn(key: SoftKey, origin = ORIGIN) {
  const optionsRes = await post('/auth/login/options', {});
  const { challengeId, options } = (await optionsRes.json()) as {
    challengeId: string;
    options: { challenge: string; rpId: string; allowCredentials: Array<{ id: string }> };
  };
  return { res: await post('/auth/login/verify', { challengeId, response: key.get(options, origin) }), options };
}

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'cv-auth-'));
  authDir = path.join(dir, 'auth');
  await installFixture(path.join(ROOT, 'fixtures', 'personas', 'courte'), path.join(dir, 'data'));
  store = DataStore.open(path.join(dir, 'data'));
  app = newApp();
});
afterAll(() => rm(dir, { recursive: true, force: true }));

describe('instance en ligne : connexion par clé de sécurité (ADR 0018)', () => {
  it("refuse une origine publique sans connexion, et l'inverse", () => {
    const base = { store, token: TOKEN, apiPort: 4310, uiOrigins: [] };
    expect(() => createApp({ ...base, publicOrigin: ORIGIN })).toThrow(/clé de sécurité/);
    expect(() => createApp({ ...base, auth: { dir: authDir } })).toThrow(/clé de sécurité/);
    expect(() => createApp({ ...base, publicOrigin: 'http://cv.example.org', auth: { dir: authDir } })).toThrow(
      /https/,
    );
  });

  it('sans session : 401 sur /api, redirection vers /connexion pour une page, health libre', async () => {
    const api = await app.request(`${ORIGIN}/api/library`, { headers: headers() });
    expect(api.status).toBe(401);
    expect(await api.json()).toMatchObject({ code: 'UNAUTHENTICATED' });
    const page = await app.request(`${ORIGIN}/candidatures?x=1`, { headers: { host: HOST } });
    expect(page.status).toBe(302);
    expect(page.headers.get('location')).toBe('/connexion?suite=%2Fcandidatures%3Fx%3D1');
    const health = await app.request(`${ORIGIN}/api/health`, { headers: { host: HOST } });
    expect(health.status).toBe(200);
  });

  it('la page de connexion est autonome, sous une CSP stricte', async () => {
    const res = await app.request(`${ORIGIN}/connexion`, { headers: { host: HOST } });
    expect(res.status).toBe(200);
    const csp = res.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("default-src 'none'");
    expect(csp).toMatch(/script-src 'sha256-[\w+/=]+'/);
    expect(csp).toContain("frame-ancestors 'none'");
    const html = await res.text();
    expect(html).toContain('Se connecter avec ma clé de sécurité');
    expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+href=/);
  });

  it('Host et Origin : seule l’origine publique déclarée est acceptée', async () => {
    const evil = await app.request('https://evil.example/connexion', { headers: { host: 'evil.example' } });
    expect(evil.status).toBe(403);
    const foreignOrigin = await app.request(`${ORIGIN}/auth/login/options`, {
      method: 'POST',
      headers: headers(undefined, { origin: 'https://evil.example' }),
      body: '{}',
    });
    expect(foreignOrigin.status).toBe(403);
  });

  it('sans clé enregistrée, la connexion renvoie NOT_ENROLLED', async () => {
    const res = await post('/auth/login/options', {});
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'NOT_ENROLLED' });
    expect(await (await app.request(`${ORIGIN}/auth/status`, { headers: { host: HOST } })).json()).toEqual({
      enrolled: false,
      authenticated: false,
    });
  });

  it("code d'enregistrement : absent, faux 5 fois puis épuisé", async () => {
    expect((await post('/auth/register/options', { code: 'abcde' })).status).toBe(403);
    const { code } = await createEnrolmentCode(authDir, clock);
    expect(code).toMatch(/^[a-z2-9]{5}(-[a-z2-9]{5}){3}$/);
    const stored = await readFile(path.join(authDir, 'enrolment-code.json'), 'utf8');
    expect(stored).not.toContain(code.replaceAll('-', ''));
    for (let i = 0; i < 5; i++) {
      const res = await post('/auth/register/options', { code: 'mauvais-code' });
      expect(await res.json()).toMatchObject({ code: 'INVALID_CODE', message: "code d'enregistrement incorrect" });
    }
    expect(existsSync(path.join(authDir, 'enrolment-code.json'))).toBe(false);
    const after = await post('/auth/register/options', { code });
    expect(await after.json()).toMatchObject({ message: "aucun code d'enregistrement en cours" });
  });

  it('enregistre une clé avec le code (une seule fois), ouvre une session, puis donne accès à l’API', async () => {
    const key = new SoftKey();
    const res = await enrol(key);
    expect(res.status).toBe(200);
    const raw = res.headers.get('set-cookie') ?? '';
    expect(raw).toMatch(/__Host-cv-session=[\w-]{40,}/);
    expect(raw).toMatch(/Path=\//);
    expect(raw).toMatch(/HttpOnly/);
    expect(raw).toMatch(/Secure/);
    expect(raw).toMatch(/SameSite=Lax/);
    expect(existsSync(path.join(authDir, 'enrolment-code.json'))).toBe(false);
    const keys = JSON.parse(await readFile(path.join(authDir, 'keys.json'), 'utf8')) as {
      keys: Array<{ id: string; label: string; counter: number }>;
    };
    expect(keys.keys).toEqual([expect.objectContaining({ id: key.credentialId, label: 'YubiKey principale' })]);

    const library = await app.request(`${ORIGIN}/api/library`, { headers: headers(sessionCookie(res)) });
    expect(library.status).toBe(200);
    const withoutToken = await app.request(`${ORIGIN}/api/library`, {
      headers: { host: HOST, cookie: sessionCookie(res) },
    });
    expect(withoutToken.status).toBe(403);
  });

  it('se connecte avec la clé ; une réponse rejouée, une autre clé ou une autre origine sont refusées', async () => {
    const key = new SoftKey();
    await enrol(key, 'Clé de secours');
    const { res, options } = await signIn(key);
    expect(res.status).toBe(200);
    expect(options.rpId).toBe(HOST);
    expect(options.allowCredentials.map((c) => c.id)).toContain(key.credentialId);
    const cookie = sessionCookie(res);
    expect((await app.request(`${ORIGIN}/api/presets`, { headers: headers(cookie) })).status).toBe(200);

    const stranger = new SoftKey();
    expect((await signIn(stranger)).res.status).toBe(403);
    expect((await signIn(key, 'https://evil.example')).res.status).toBe(403);

    const optionsRes = await post('/auth/login/options', {});
    const fresh = (await optionsRes.json()) as { challengeId: string; options: { challenge: string; rpId: string } };
    const response = key.get(fresh.options);
    expect((await post('/auth/login/verify', { challengeId: fresh.challengeId, response })).status).toBe(200);
    expect((await post('/auth/login/verify', { challengeId: fresh.challengeId, response })).status).toBe(403);
  });

  it('la session expire après 12 h, et la déconnexion la ferme', async () => {
    const key = new SoftKey();
    await enrol(key);
    const cookie = sessionCookie((await signIn(key)).res);
    expect((await app.request(`${ORIGIN}/api/presets`, { headers: headers(cookie) })).status).toBe(200);
    expect((await post('/auth/logout', {}, cookie)).status).toBe(200);
    expect((await app.request(`${ORIGIN}/api/presets`, { headers: headers(cookie) })).status).toBe(401);

    const second = sessionCookie((await signIn(key)).res);
    clock += 12 * 3600_000 + 1;
    expect((await app.request(`${ORIGIN}/api/presets`, { headers: headers(second) })).status).toBe(401);
  });

  it("un code expiré entre les options et la vérification n'enregistre rien", async () => {
    const before = JSON.parse(await readFile(path.join(authDir, 'keys.json'), 'utf8')) as { keys: unknown[] };
    const { code } = await createEnrolmentCode(authDir, clock);
    clock += 14 * 60_000;
    const { challengeId, options } = (await (await post('/auth/register/options', { code })).json()) as {
      challengeId: string;
      options: { challenge: string; rp: { id: string } };
    };
    // The challenge (5 minutes) is still valid, the code (15 minutes) is not.
    clock += 2 * 60_000;
    const res = await post('/auth/register/verify', { challengeId, response: new SoftKey().create(options) });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'INVALID_CODE' });
    const after = JSON.parse(await readFile(path.join(authDir, 'keys.json'), 'utf8')) as { keys: unknown[] };
    expect(after.keys).toHaveLength(before.keys.length);
  });

  it('après 20 échecs en 15 minutes, la connexion est suspendue (429)', async () => {
    const local = createApp({
      store,
      token: TOKEN,
      apiPort: 4310,
      uiOrigins: [],
      publicOrigin: ORIGIN,
      auth: { dir: authDir, now: () => clock },
    });
    const attempt = () =>
      local.request(`${ORIGIN}/auth/login/verify`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ challengeId: 'inconnu', response: {} }),
      });
    for (let i = 0; i < 20; i++) expect((await attempt()).status).toBe(403);
    expect((await attempt()).status).toBe(429);
  });

  it('retour après connexion : chemin local seulement', () => {
    expect(safeNext('/candidatures?x=1')).toBe('/candidatures?x=1');
    expect(safeNext('//evil.example')).toBe('/');
    expect(safeNext('/\\evil.example')).toBe('/');
    expect(safeNext('https://evil.example')).toBe('/');
    expect(safeNext('/connexion?suite=/')).toBe('/');
    expect(safeNext(undefined)).toBe('/');
  });
});
