// Letter routes of lot 7 (F-LET-01 to 07, NF-01, ADR 0016): token, Host and Origin checks; a version is
// added, never overwritten; the export of a letter needs an active version and the preview shown.
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication, DataStore, installFixture } from '@cv/store';
import { createApp } from '../src/app.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const TOKEN = 'c'.repeat(64);
const API = 'http://127.0.0.1:4311';
const UI = 'http://127.0.0.1:4310';
let tmp: string;
let app: ReturnType<typeof createApp>;
let id: string;
let letter: Record<string, unknown>;

beforeAll(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'cv-api-letter-'));
  await installFixture(path.join(ROOT, 'fixtures', 'personas', 'courte'), tmp);
  const store = DataStore.open(tmp);
  const created = await createApplication(
    store,
    {
      company: 'ACME Medical',
      jobTitle: 'Ingénieur logiciel dispositifs médicaux H/F',
      lang: 'fr',
      basePresetId: 'preset-defaut',
      offerText: await readFile(path.join(ROOT, 'fixtures', 'offres', 'offre-logiciel-dm.md'), 'utf8'),
    },
    { importDir: null },
  );
  id = created.application.id;
  const fixture = JSON.parse(
    await readFile(path.join(ROOT, 'fixtures', 'letters', 'lettre-logiciel-dm-fr.json'), 'utf8'),
  );
  letter = { recipient: fixture.recipient, paragraphs: fixture.paragraphs, sourceIds: fixture.sourceIds };
  app = createApp({ store, token: TOKEN, apiPort: 4311, uiOrigins: [UI] });
});
afterAll(() => rm(tmp, { recursive: true, force: true }));

const headers = { 'content-type': 'application/json', origin: UI, 'x-cv-token': TOKEN };
const post = (url: string, body: unknown, h: Record<string, string> = headers) =>
  app.request(`${API}${url}`, { method: 'POST', headers: h, body: JSON.stringify(body) });

describe('routes de la lettre (lot 7)', () => {
  it('403 sans jeton, avec une origine étrangère ou un Host étranger', async () => {
    expect((await app.request(`${API}/api/applications/${id}/letters`)).status).toBe(403);
    for (const url of [
      `/api/applications/${id}/letters/fr`,
      `/api/applications/${id}/letters/fr/active`,
      `/api/applications/${id}/letters/fr/1/final`,
      '/api/letters/render',
      '/api/letters/export',
    ]) {
      expect((await post(url, {}, { ...headers, 'x-cv-token': '' })).status, url).toBe(403);
      expect((await post(url, {}, { ...headers, origin: 'https://evil.example' })).status, url).toBe(403);
    }
    expect(
      (await app.request('http://evil.example:4311/api/applications', { headers: { 'x-cv-token': TOKEN } })).status,
    ).toBe(403);
  });

  it('ajoute des versions, refuse un corps invalide et un export sans version active', async () => {
    const r = await post(`/api/applications/${id}/letters/fr`, letter);
    expect(r.status).toBe(201);
    expect(((await r.json()) as { version: { version: number; origin: string } }).version).toMatchObject({
      version: 1,
      origin: 'utilisateur',
    });
    expect((await post(`/api/applications/${id}/letters/de`, letter)).status).toBe(404);
    expect((await post(`/api/applications/${id}/letters/fr`, { paragraphs: 'x', inconnu: 1 })).status).toBe(400);
    const preview = (await (
      await post('/api/letters/render', { applicationId: id, lang: 'fr', version: 1 })
    ).json()) as {
      sha256: string;
      active: boolean;
    };
    expect(preview.active).toBe(false);
    const refused = await post('/api/letters/export', {
      applicationId: id,
      lang: 'fr',
      format: 'pdf',
      previewSha256: preview.sha256,
    });
    expect(refused.status).toBe(409);
    expect(((await refused.json()) as { code: string }).code).toBe('NO_ACTIVE_LETTER');
    expect((await post(`/api/applications/${id}/letters/fr/1/final`, {})).status).toBe(400);
  });
});
