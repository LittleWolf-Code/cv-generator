// T-04 (§12.6) replayed end to end on the fictitious persona « courte » (ADR 0016): the offer « logiciel DM »
// is entered through the API of the interface; an in-memory MCP client plays Claude and follows
// rediger-lettre: v1, with an invented figure slipped in on purpose, raises the warning; a modification in
// the interface creates v2; a new request to Claude creates v3 without touching v2; the user chooses the
// active version and exports a one-page PDF (and the DOCX); a final version is never modified again.
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { PDFDocument } from 'pdf-lib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataStore, installFixture } from '@cv/store';
import { createApp } from '../../server/src/app.js';
import { writeLetterProcedure } from '../src/prompts.js';
import { createCvServer } from '../src/server.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const TOKEN = 't'.repeat(64);
const API = 'http://127.0.0.1:4311';
const UI = 'http://127.0.0.1:4310';

let tmp: string;
let dataDir: string;
let app: ReturnType<typeof createApp>;
let client: Client;

type Res = {
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  content: Array<{ type: string; text?: string }>;
};
const call = async (name: string, args: Record<string, unknown> = {}) => {
  const r = (await client.callTool({ name, arguments: args })) as Res;
  expect(r.isError, `${name} : ${r.content.map((c) => c.text ?? '').join('\n')}`).toBeFalsy();
  return r.structuredContent as Record<string, unknown>;
};
const send = (method: string, url: string, body: unknown = {}) =>
  app.request(`${API}${url}`, {
    method,
    headers: { 'content-type': 'application/json', origin: UI, 'x-cv-token': TOKEN },
    body: JSON.stringify(body),
  });
const json = async <T>(res: Response | Promise<Response>) => (await (await res).json()) as T;
const sha = (b: Uint8Array | string) => createHash('sha256').update(b).digest('hex');

beforeAll(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'cv-t04-'));
  dataDir = path.join(tmp, 'data');
  await installFixture(path.join(ROOT, 'fixtures', 'personas', 'courte'), dataDir);
  app = createApp({
    store: DataStore.open(dataDir),
    token: TOKEN,
    apiPort: 4311,
    uiOrigins: [UI],
    outDir: path.join(tmp, 'out'),
  });
  const server = createCvServer({ dataDir, outDir: path.join(tmp, 'out'), importDir: null, uiPort: 4310 });
  const [c, s] = InMemoryTransport.createLinkedPair();
  await server.connect(s);
  client = new Client({ name: 'cv-t04', version: '0.0.0' });
  await client.connect(c);
});
afterAll(async () => {
  await client.close();
  await rm(tmp, { recursive: true, force: true });
});

describe('T-04 : lettre de motivation', () => {
  it('v1 de Claude (avertissement), v2 dans l\u2019interface, v3 de Claude sans toucher à la v2, export d\u2019une page', async () => {
    // The offer is entered in the interface.
    const created = await send('POST', '/api/applications', {
      company: 'ACME Medical',
      jobTitle: 'Ingénieur logiciel dispositifs médicaux H/F',
      offerReference: 'ACME-1234',
      lang: 'fr',
      basePresetId: 'preset-defaut',
      offerText: await readFile(path.join(ROOT, 'fixtures', 'offres', 'offre-logiciel-dm.md'), 'utf8'),
    });
    expect(created.status).toBe(201);
    const id = ((await created.json()) as { application: { id: string } }).application.id;
    const lettersDir = path.join(dataDir, 'applications', id, 'letters', 'fr');

    // rediger-lettre, played by « Claude ».
    expect(writeLetterProcedure(id)).toContain(`get_application({ applicationId: "${id}" })`);
    const g = await call('get_application', { applicationId: id });
    expect(g.offer).toMatch(/^<untrusted source="offer"/);
    await call('get_guidelines', { topic: 'letter' });
    await call('get_items', { ids: ['exp-medtech-2023', 'b-medtech-62304', 'b-medtech-risques'], lang: 'fr' });
    const fixture = JSON.parse(
      await readFile(path.join(ROOT, 'fixtures', 'letters', 'lettre-logiciel-dm-fr.json'), 'utf8'),
    ) as {
      recipient: unknown;
      paragraphs: Array<{ role: string; text: string }>;
      sourceIds: string[];
    };
    const v1Paragraphs = structuredClone(fixture.paragraphs);
    // An invented figure, slipped in on purpose: 35 risk controls become 60.
    v1Paragraphs[1]!.text = v1Paragraphs[1]!.text.replace('35 mesures', '60 mesures');
    const v1 = await call('save_letter_draft', {
      applicationId: id,
      recipient: fixture.recipient,
      paragraphs: v1Paragraphs,
      sourceIds: fixture.sourceIds,
    });
    expect(v1).toMatchObject({ version: 1, pages: 1, activeVersion: null });
    expect(v1.warnings).toEqual([expect.objectContaining({ rule: 'letter-facts', paragraph: 1 })]);
    expect((v1.warnings as Array<{ message: string }>)[0]!.message).toContain('60');

    // The user corrects the paragraph in the interface: v2, origin « utilisateur », based on v1.
    const v2 = await json<{ version: { version: number; origin: string; basedOn: number }; checks: unknown[] }>(
      send('POST', `/api/applications/${id}/letters/fr`, {
        recipient: fixture.recipient,
        paragraphs: fixture.paragraphs,
        sourceIds: fixture.sourceIds,
        basedOn: 1,
      }),
    );
    expect(v2.version).toMatchObject({ version: 2, origin: 'utilisateur', basedOn: 1 });
    expect(v2.checks).toEqual([]);
    const v2Bytes = await readFile(path.join(lettersDir, 'v2.json'), 'utf8');

    // A new request to Claude: v3, without touching v2.
    const v3Paragraphs = structuredClone(fixture.paragraphs);
    v3Paragraphs[2]!.text =
      "Je serais heureuse d'échanger avec vous, lors d'un entretien, sur la façon dont je peux contribuer à vos projets de dispositifs médicaux.";
    const v3 = await call('save_letter_draft', {
      applicationId: id,
      recipient: fixture.recipient,
      paragraphs: v3Paragraphs,
      sourceIds: fixture.sourceIds,
      basedOn: 2,
    });
    expect(v3).toMatchObject({ version: 3, basedOn: 2, warnings: [] });
    expect(await readFile(path.join(lettersDir, 'v2.json'), 'utf8')).toBe(v2Bytes);
    const listed = await json<{
      active: { fr: number | null };
      letters: { fr: Array<{ version: number; origin: string }> };
    }>(app.request(`${API}/api/applications/${id}/letters`, { headers: { 'x-cv-token': TOKEN } }));
    expect(listed.letters.fr.map((v) => `${v.version}:${v.origin}`)).toEqual(['1:claude', '2:utilisateur', '3:claude']);
    expect(listed.active.fr).toBeNull();

    // The user chooses v3 as the active version, previews it and exports it.
    expect((await send('POST', `/api/applications/${id}/letters/fr/active`, { version: 3 })).status).toBe(200);
    const preview = await json<{ pdfBase64: string; sha256: string; pages: number; active: boolean; fileName: string }>(
      send('POST', '/api/letters/render', { applicationId: id, lang: 'fr', version: 3 }),
    );
    expect(preview).toMatchObject({ pages: 1, active: true, fileName: 'LM_Camille_Martin_ACME-Medical_FR.pdf' });
    expect(sha(Buffer.from(preview.pdfBase64, 'base64'))).toBe(preview.sha256);
    const pdf = await send('POST', '/api/letters/export', {
      applicationId: id,
      lang: 'fr',
      format: 'pdf',
      previewSha256: preview.sha256,
    });
    expect(pdf.status).toBe(200);
    const exported = (await pdf.json()) as { fileName: string; sha256: string; savedTo: string };
    expect(exported.sha256).toBe(preview.sha256);
    const file = await readFile(path.join(dataDir, exported.savedTo));
    expect((await PDFDocument.load(file)).getPageCount()).toBe(1);
    const docx = await send('POST', '/api/letters/export', {
      applicationId: id,
      lang: 'fr',
      format: 'docx',
      previewSha256: preview.sha256,
    });
    expect(docx.status).toBe(200);
    // A preview of another version does not export (T-ATS-13: not the active version).
    const old = await json<{ sha256: string }>(
      send('POST', '/api/letters/render', { applicationId: id, lang: 'fr', version: 2 }),
    );
    expect(
      (
        await send('POST', '/api/letters/export', {
          applicationId: id,
          lang: 'fr',
          format: 'pdf',
          previewSha256: old.sha256,
        })
      ).status,
    ).toBe(409);
    const { application } = await DataStore.open(dataDir).loadApplication(id);
    expect(application.exports.map((e) => `${e.kind}:${e.format}`)).toEqual(['letter:pdf', 'letter:docx']);

    // Final status: irreversible; a modification creates v4 and leaves v3 as it is.
    expect((await send('POST', `/api/applications/${id}/letters/fr/3/final`, { confirm: true })).status).toBe(200);
    expect((await send('POST', `/api/applications/${id}/letters/fr/3/final`, { confirm: true })).status).toBe(409);
    const v3Final = await readFile(path.join(lettersDir, 'v3.json'), 'utf8');
    const v4 = await send('POST', `/api/applications/${id}/letters/fr`, {
      recipient: fixture.recipient,
      paragraphs: fixture.paragraphs,
      sourceIds: fixture.sourceIds,
      basedOn: 3,
    });
    expect(v4.status).toBe(201);
    expect(await readFile(path.join(lettersDir, 'v3.json'), 'utf8')).toBe(v3Final);
  });
});
