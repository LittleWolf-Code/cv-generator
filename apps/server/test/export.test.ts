// API of lot 3: export from the interface (F-EXP-01 to 04, ATS-15, T-ATS-13), refusal on "debordante"
// (F-EXP-03), photo import, replacement and removal (§5.2), NF-01 on the new routes.
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exportBlockers, type AtsReport, type PresetFile } from '@cv/core';
import { findSoffice, inspectPhoto } from '@cv/render';
import { DataStore, installFixture, sha256 } from '@cv/store';
import { createApp } from '../src/app.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const TOKEN = 'e'.repeat(64);
const API = 'http://127.0.0.1:4311';
const UI = 'http://127.0.0.1:4310';

interface Env {
  dir: string;
  out: string;
  app: ReturnType<typeof createApp>;
}
const envs: Env[] = [];

async function setup(persona: string): Promise<Env> {
  const dir = await mkdtemp(path.join(os.tmpdir(), `cv-api3-${persona}-`));
  const out = path.join(dir, '..', `${path.basename(dir)}-out`);
  await installFixture(path.join(ROOT, 'fixtures', 'personas', persona), dir);
  const env = {
    dir,
    out,
    app: createApp({ store: DataStore.open(dir), token: TOKEN, apiPort: 4311, uiOrigins: [UI], outDir: out }),
  };
  envs.push(env);
  return env;
}

let courte: Env;
let debordante: Env;
beforeAll(async () => {
  courte = await setup('courte');
  debordante = await setup('debordante');
});
afterAll(async () => {
  for (const e of envs) {
    await rm(e.dir, { recursive: true, force: true });
    await rm(e.out, { recursive: true, force: true });
  }
});

const get = (env: Env, url: string) => env.app.request(`${API}${url}`, { headers: { 'x-cv-token': TOKEN } });
const send = (env: Env, method: string, url: string, body: unknown = {}, headers: Record<string, string> = {}) =>
  env.app.request(`${API}${url}`, {
    method,
    headers: { 'content-type': 'application/json', origin: UI, 'x-cv-token': TOKEN, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

interface RenderBody {
  pdfBase64: string;
  sha256: string;
  report: AtsReport;
}
interface ExportBody {
  fileName: string;
  savedTo: string | null;
  sha256: string;
  previewSha256: string;
  report: AtsReport;
  fileBase64: string | null;
}
interface ErrorBody {
  code: string;
  hint: string;
  details: { report: AtsReport };
}

/** What the interface does: compile the preview, hash the buffer shown, export. */
async function preview(env: Env, presetId = 'preset-defaut'): Promise<RenderBody> {
  const res = await send(env, 'POST', '/api/render', { presetId });
  expect(res.status).toBe(200);
  const body = (await res.json()) as RenderBody;
  expect(sha256(Buffer.from(body.pdfBase64, 'base64'))).toBe(body.sha256);
  return body;
}

const status = (r: AtsReport, id: string) => r.criteria.find((c) => c.id === id)?.status;

async function savePreset(env: Env, change: (p: PresetFile) => void): Promise<PresetFile> {
  const { presets } = (await (await get(env, '/api/presets')).json()) as { presets: PresetFile[] };
  const preset = structuredClone(presets.find((p) => p.id === 'preset-defaut')!);
  change(preset);
  const res = await send(env, 'PUT', '/api/presets/preset-defaut', { preset, expectedRevision: preset.revision });
  expect(res.status).toBe(200);
  return ((await res.json()) as { preset: PresetFile }).preset;
}

describe('export PDF et DOCX (F-EXP-01 à 04, T-ATS-13)', () => {
  it("exporte le tampon de l'aperçu : même SHA-256, nom normalisé, copie horodatée avec sa trace", async () => {
    const shown = await preview(courte);
    const res = await send(courte, 'POST', '/api/export', {
      presetId: 'preset-defaut',
      format: 'pdf',
      previewSha256: shown.sha256,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as ExportBody;
    expect(body.fileName).toBe('CV_Camille_Martin_Ingenieure-logiciel-DM_FR.pdf');
    expect(body.sha256).toBe(shown.sha256);
    expect(body.fileBase64).toBeNull();
    expect(status(body.report, 'T-ATS-13')).toBe('green');
    expect(body.report.criteria.filter((c) => c.status === 'red')).toEqual([]);
    expect(body.savedTo).toMatch(
      /^[^/]+-out\/exports\/preset-defaut\/\d{8}-\d{6}_ats-classique\/CV_Camille_Martin_Ingenieure-logiciel-DM_FR\.pdf$/,
    );
    const file = path.join(path.dirname(courte.out), ...body.savedTo!.split('/'));
    expect(sha256(await readFile(file))).toBe(shown.sha256);
    const trace = JSON.parse(await readFile(path.join(path.dirname(file), 'export.json'), 'utf8')) as Record<
      string,
      unknown
    >;
    expect(trace).toMatchObject({ format: 'pdf', lang: 'fr', layout: 'ats-classique', sha256: shown.sha256 });
  });

  it("n'écrase jamais un export précédent", async () => {
    const shown = await preview(courte);
    const input = { presetId: 'preset-defaut', format: 'pdf', previewSha256: shown.sha256 };
    const a = (await (await send(courte, 'POST', '/api/export', input)).json()) as ExportBody;
    const b = (await (await send(courte, 'POST', '/api/export', input)).json()) as ExportBody;
    expect(a.savedTo).not.toBe(b.savedTo);
    expect(existsSync(path.join(path.dirname(courte.out), ...a.savedTo!.split('/')))).toBe(true);
  });

  it("refuse l'export si l'aperçu affiché n'est pas celui du preset enregistré (T-ATS-13 rouge)", async () => {
    const res = await send(courte, 'POST', '/api/export', {
      presetId: 'preset-defaut',
      format: 'pdf',
      previewSha256: '0'.repeat(64),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as ErrorBody;
    expect(body.code).toBe('PREVIEW_MISMATCH');
    expect(status(body.details.report, 'T-ATS-13')).toBe('red');
    expect(body.hint).toMatch(/aperçu/);
  });

  it('exporte le DOCX de la même projection, avec T-DOCX-01 à 03 et le préfixe Resume_ en en-US', async () => {
    let shown = await preview(courte);
    let res = await send(courte, 'POST', '/api/export', {
      presetId: 'preset-defaut',
      format: 'docx',
      previewSha256: shown.sha256,
    });
    expect(res.status).toBe(200);
    let body = (await res.json()) as ExportBody;
    expect(body.fileName).toBe('CV_Camille_Martin_Ingenieure-logiciel-DM_FR.docx');
    expect(Buffer.from(body.fileBase64!, 'base64').subarray(0, 2).toString()).toBe('PK');
    // T-DOCX-03: orange without LibreOffice; with it, green (courte holds on 1 page in LibreOffice).
    expect(body.report.criteria.filter((c) => c.id.startsWith('T-DOCX')).map((c) => [c.id, c.status])).toEqual([
      ['T-DOCX-01', 'green'],
      ['T-DOCX-02', 'green'],
      ['T-DOCX-03', findSoffice() ? 'green' : 'orange'],
    ]);
    expect(body.report.criteria.find((c) => c.id === 'T-ATS-13')).toMatchObject({ status: 'green' });

    await savePreset(courte, (p) => {
      p.lang = 'en';
      p.enVariant = 'en-US';
    });
    shown = await preview(courte);
    res = await send(courte, 'POST', '/api/export', {
      presetId: 'preset-defaut',
      format: 'docx',
      previewSha256: shown.sha256,
    });
    body = (await res.json()) as ExportBody;
    expect(body.fileName).toBe('Resume_Camille_Martin_Ingenieure-logiciel-DM_EN.docx');
    await savePreset(courte, (p) => {
      p.lang = 'fr';
    });
  });

  it('refuse l\u2019export de « débordante » avec le motif et l\u2019action proposée (F-EXP-03)', async () => {
    const shown = await preview(debordante);
    const res = await send(debordante, 'POST', '/api/export', {
      presetId: 'preset-defaut',
      format: 'pdf',
      previewSha256: shown.sha256,
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as ErrorBody;
    expect(body.code).toBe('EXPORT_BLOCKED');
    expect(status(body.details.report, 'T-ATS-01')).toBe('red');
    const reasons = exportBlockers(body.details.report, 'normale');
    expect(reasons[0]).toMatchObject({ code: 'T-ATS-01', fix: { kind: 'density' } });
    expect(reasons[0]!.message).toMatch(
      /dépasse d'environ \d+ lignes? .*décochez une puce ou passez en densité compacte/,
    );
    expect(existsSync(path.join(debordante.out, 'exports'))).toBe(false);
  });
});

describe('photo (§5.2)', () => {
  const image = async (w: number, h: number) =>
    (
      await sharp({ create: { width: w, height: h, channels: 3, background: '#4b6c8c' } })
        .png()
        .toBuffer()
    ).toString('base64');
  const revision = async (env: Env) =>
    ((await (await get(env, '/api/library')).json()) as { identity: { revision: number } }).identity.revision;

  it('importe une photo recadrée en 3:4 (JPEG, 300 Ko au plus, sans métadonnées) et la rend en PDF et en DOCX', async () => {
    const res = await send(courte, 'POST', '/api/profile/photo', {
      image: `data:image/png;base64,${await image(900, 1200)}`,
      expectedRevision: await revision(courte),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      identity: { photo: { file: string } };
      writes: Array<{ file: string }>;
      photo: { width: number; height: number };
    };
    expect(body.identity.photo).toEqual({ file: 'assets/photo.jpg' });
    expect(body.writes.map((w) => w.file)).toEqual(['profile.json']);
    expect(body.photo).toMatchObject({ width: 600, height: 800 });
    const stored = new Uint8Array(await readFile(path.join(courte.dir, 'assets', 'photo.jpg')));
    expect(await inspectPhoto(stored)).toMatchObject({ format: 'jpeg', width: 600, height: 800, exif: false });

    const served = await get(courte, '/api/profile/photo');
    expect(served.headers.get('content-type')).toBe('image/jpeg');
    expect(sha256(new Uint8Array(await served.arrayBuffer()))).toBe(sha256(stored));

    await savePreset(courte, (p) => {
      p.options.photo = true;
    });
    const shown = await preview(courte);
    expect(status(shown.report, 'T-ATS-16')).toBe('orange');
    expect(shown.report.criteria.filter((c) => c.status === 'red')).toEqual([]);
    expect(Buffer.from(shown.pdfBase64, 'base64').includes(Buffer.from(stored.subarray(100, 400)))).toBe(true);
    for (const format of ['pdf', 'docx'] as const) {
      const exp = await send(courte, 'POST', '/api/export', {
        presetId: 'preset-defaut',
        format,
        previewSha256: shown.sha256,
      });
      expect(exp.status, format).toBe(200);
      const r = ((await exp.json()) as ExportBody).report;
      expect(status(r, 'T-ATS-16')).toBe('orange');
      expect(r.criteria.filter((c) => c.status === 'red')).toEqual([]);
    }
    await savePreset(courte, (p) => {
      p.options.photo = false;
    });
  });

  it("garde la photo quand l'identité est enregistrée par le formulaire", async () => {
    const lib = (await (await get(courte, '/api/library')).json()) as {
      identity: { revision: number; value: Record<string, unknown> };
    };
    const res = await send(courte, 'PUT', '/api/profile', {
      identity: { ...lib.identity.value, photo: null, phone: '06 39 98 12 34' },
      expectedRevision: lib.identity.revision,
      base: lib.identity.value,
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { identity: { photo: unknown } }).identity.photo).toEqual({
      file: 'assets/photo.jpg',
    });
  });

  it('refuse une image illisible, trop petite, une révision périmée et un corps de plus d\u20191 Mo', async () => {
    const rev = await revision(courte);
    const bad = await send(courte, 'POST', '/api/profile/photo', {
      image: 'cGFzIHVuZSBpbWFnZQ==',
      expectedRevision: rev,
    });
    expect(bad.status).toBe(422);
    expect(((await bad.json()) as { code: string }).code).toBe('INVALID_PHOTO');
    const tiny = await send(courte, 'POST', '/api/profile/photo', {
      image: await image(90, 120),
      expectedRevision: rev,
    });
    expect(tiny.status).toBe(422);
    const stale = await send(courte, 'POST', '/api/profile/photo', {
      image: await image(300, 400),
      expectedRevision: 1,
    });
    expect(stale.status).toBe(409);
    const huge = await send(courte, 'POST', '/api/profile/photo', {
      image: 'A'.repeat(1_100_000),
      expectedRevision: rev,
    });
    expect(huge.status).toBe(413);
  });

  it('applique NF-01 aux routes de la photo et de l\u2019export', async () => {
    const body = { image: await image(300, 400), expectedRevision: await revision(courte) };
    expect((await send(courte, 'POST', '/api/profile/photo', body, { 'x-cv-token': 'x' })).status).toBe(403);
    expect((await send(courte, 'POST', '/api/profile/photo', body, { origin: 'http://evil.example' })).status).toBe(
      403,
    );
    expect((await send(courte, 'POST', '/api/profile/photo', body, { 'content-type': 'text/plain' })).status).toBe(415);
    expect((await courte.app.request(`${API}/api/profile/photo`)).status).toBe(403);
    expect(
      (
        await send(
          courte,
          'POST',
          '/api/export',
          { presetId: 'preset-defaut', format: 'pdf', previewSha256: 'x' },
          {
            host: 'evil.example',
          },
        )
      ).status,
    ).toBe(403);
  });

  it('retire la photo après confirmation et supprime son fichier', async () => {
    const res = await send(courte, 'DELETE', '/api/profile/photo', {
      confirm: true,
      expectedRevision: await revision(courte),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { identity: { photo: unknown } }).identity.photo).toBeNull();
    expect(existsSync(path.join(courte.dir, 'assets', 'photo.jpg'))).toBe(false);
    expect((await get(courte, '/api/profile/photo')).status).toBe(404);
    expect(await readdir(path.join(courte.dir, 'assets'))).toEqual([]);
  });
});
