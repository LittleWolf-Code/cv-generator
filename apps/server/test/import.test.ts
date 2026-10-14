// Import routes of lot 6 (F-IMP-02, NF-01, ADR 0015): token, Host and Origin checks; files designated
// by name only; the LinkedIn import as proposals, never in the validated content; identity found for
// the prefill of the identity form (interface only, behind the token).
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataStore, installFixture } from '@cv/store';
import { createApp } from '../src/app.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ZIP = 'Basic_LinkedInDataExport_fictif.zip';
const TOKEN = 'b'.repeat(64);
const API = 'http://127.0.0.1:4311';
const UI = 'http://127.0.0.1:4310';
let tmp: string;
let dataDir: string;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'cv-api-import-'));
  dataDir = path.join(tmp, 'data');
  const importDir = path.join(tmp, 'import');
  await installFixture(path.join(ROOT, 'fixtures', 'personas', 'courte'), dataDir);
  await mkdir(importDir, { recursive: true });
  await copyFile(path.join(ROOT, 'fixtures', 'imports', ZIP), path.join(importDir, ZIP));
  await copyFile(
    path.join(ROOT, 'fixtures', 'imports', 'CV_Camille_Martin_fictif.pdf'),
    path.join(importDir, 'CV_Camille_Martin_fictif.pdf'),
  );
  app = createApp({ store: DataStore.open(dataDir), token: TOKEN, apiPort: 4311, uiOrigins: [UI], importDir });
});
afterAll(() => rm(tmp, { recursive: true, force: true }));

const headers = { 'content-type': 'application/json', origin: UI, 'x-cv-token': TOKEN };

describe('routes d’import (lot 6)', () => {
  it('403 sans jeton, avec un Host étranger ou une écriture d’une origine étrangère', async () => {
    expect((await app.request(`${API}/api/import/files`)).status).toBe(403);
    expect((await app.request(`${API}/api/import/linkedin/identity`)).status).toBe(403);
    const body = JSON.stringify({ fileName: ZIP });
    expect(
      (
        await app.request(`${API}/api/import/linkedin`, {
          method: 'POST',
          headers: { ...headers, 'x-cv-token': '' },
          body,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await app.request(`${API}/api/import/linkedin`, {
          method: 'POST',
          headers: { ...headers, origin: 'https://evil.example' },
          body,
        })
      ).status,
    ).toBe(403);
    expect(
      (await app.request('http://evil.example:4311/api/import/files', { headers: { 'x-cv-token': TOKEN } })).status,
    ).toBe(403);
  });

  it('liste les fichiers de import/ par nom et type ; refuse un chemin', async () => {
    const res = await app.request(`${API}/api/import/files`, { headers: { 'x-cv-token': TOKEN } });
    const { files } = (await res.json()) as { files: Array<{ name: string; kind: string }> };
    expect(files).toEqual([
      expect.objectContaining({ name: ZIP, kind: 'linkedin' }),
      expect.objectContaining({ name: 'CV_Camille_Martin_fictif.pdf', kind: 'cv' }),
    ]);
    const bad = await app.request(`${API}/api/import/linkedin`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ fileName: '../data/profile.json' }),
    });
    expect(bad.status).toBe(403);
  });

  it('importe en propositions, sans écrire dans la bibliothèque ; identité pour le préremplissage', async () => {
    const before = await readFile(path.join(dataDir, 'library', 'experiences.json'), 'utf8');
    const res = await app.request(`${API}/api/import/linkedin`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ fileName: ZIP }),
    });
    expect(res.status).toBe(200);
    const report = (await res.json()) as { created: number; writes: Array<{ file: string }> };
    expect(report.created).toBeGreaterThan(10);
    expect(report.writes.every((w) => w.file === 'ids.json' || w.file.startsWith('proposals/'))).toBe(true);
    expect(await readFile(path.join(dataDir, 'library', 'experiences.json'), 'utf8')).toBe(before);
    const id = await app.request(`${API}/api/import/linkedin/identity?file=${ZIP}`, {
      headers: { 'x-cv-token': TOKEN },
    });
    expect(((await id.json()) as { identity: { lastName: string } }).identity.lastName).toBe('Martin');
  });
});
