// T-03 (§12.6) replayed end to end on the fictitious persona « courte »: the offer « logiciel DM » is
// entered through the API of the interface; an in-memory MCP client plays Claude and follows the
// procedure adapter-a-une-offre (analysis, several previews, one variant for a group (b) term, a single
// selection proposal that fits on one page, pause); the user accepts through the API; render and
// check_ats give every blocking criterion green; PDF and DOCX are exported through the API.
import { cp, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setChecked, type Selection } from '@cv/core';
import { DataStore, installFixture } from '@cv/store';
import { readFile } from 'node:fs/promises';
import { createApp } from '../../server/src/app.js';
import { adaptToOfferProcedure } from '../src/prompts.js';
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
const get = (url: string) => app.request(`${API}${url}`, { headers: { 'x-cv-token': TOKEN } });

beforeAll(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'cv-t03-'));
  dataDir = path.join(tmp, 'data');
  const importDir = path.join(tmp, 'import');
  await installFixture(path.join(ROOT, 'fixtures', 'personas', 'courte'), dataDir);
  await cp(path.join(ROOT, 'fixtures', 'offres'), path.join(importDir, 'offres'), { recursive: true });
  app = createApp({
    store: DataStore.open(dataDir),
    token: TOKEN,
    apiPort: 4311,
    uiOrigins: [UI],
    outDir: path.join(tmp, 'out'),
    importDir,
  });
  const server = createCvServer({ dataDir, outDir: path.join(tmp, 'out'), importDir, uiPort: 4310 });
  const [c, s] = InMemoryTransport.createLinkedPair();
  await server.connect(s);
  client = new Client({ name: 'cv-t03', version: '0.0.0' });
  await client.connect(c);
});
afterAll(async () => {
  await client.close();
  await rm(tmp, { recursive: true, force: true });
});

describe('T-03 : candidature de bout en bout via Claude (MCP)', () => {
  it('offre saisie dans l’interface, procédure adapter-a-une-offre, validation, rendu et exports', async () => {
    // The offer is entered in the interface (API), not pasted in the chat.
    const created = await send('POST', '/api/applications', {
      company: 'ACME Medical',
      jobTitle: 'Ingénieur logiciel dispositifs médicaux H/F',
      offerReference: 'ACME-1234',
      lang: 'fr',
      basePresetId: 'preset-defaut',
      offerFile: 'offre-logiciel-dm.md',
    });
    expect(created.status).toBe(201);
    const applicationId = ((await created.json()) as { application: { id: string } }).application.id;
    const procedure = adaptToOfferProcedure(applicationId);
    expect(procedure).toContain(`get_application({ applicationId: "${applicationId}" })`);

    // 1-2. Guidelines, application (untrusted offer).
    await call('get_guidelines', { topic: 'all' });
    const g = await call('get_application', { applicationId });
    const selection = (g.selection as { selection: Selection }).selection;
    const baseRevision = (g.selection as { revision: number }).revision;
    expect(g.offer).toMatch(/^<untrusted source="offer" nonce="[0-9a-f]{16}">/);

    // 3. Terms extracted by « Claude » (the fixture analysis), saved; coverage computed by the code.
    const terms = (
      JSON.parse(await readFile(path.join(ROOT, 'fixtures', 'analyses', 'analyse-logiciel-dm.json'), 'utf8')) as {
        current: { terms: unknown[] };
      }
    ).current.terms;
    const saved = await call('save_offer_analysis', { applicationId, terms });
    expect(saved.coverage).toMatchObject({ level: 'moyen' });

    // 4. Library index with the offer terms.
    const index = await call('get_library', { view: 'index', applicationId });
    const rows = index.items as Array<{ id: string; offerTerms?: string[] }>;
    expect(rows.find((r) => r.id === 'b-medtech-62304')!.offerTerms).toEqual(expect.arrayContaining(['IEC 62304']));

    // 5. Previews, iterated: the group (a) element is checked; still one page.
    const p1 = await call('preview_selection', { target: { applicationId }, selection });
    expect(p1).toMatchObject({ pages: 1 });
    const candidate = structuredClone(selection);
    setChecked(candidate, { section: 'projects', itemId: 'prj-tracabilite', bulletId: 'b-tracabilite-export' }, true);
    const p2 = await call('preview_selection', { target: { applicationId }, selection: candidate });
    expect(p2).toMatchObject({ pages: 1, atsReport: { blocking: false }, coverage: { level: 'bon' } });

    // 6. A variant for a group (b) term, only because the bullet already says it, then a preview with it.
    const v = await call('propose_variant', {
      items: [
        {
          target: { kind: 'bullet', id: 'b-medtech-62304' },
          text: {
            fr: "Mise en conformité IEC 62304 (classe B) du logiciel d'une pompe à perfusion : plan de développement, traçabilité des exigences, 240 tests unitaires automatisés",
          },
          label: 'acme-tracabilite',
          rationale: "La puce dit déjà « traçabilité exigences-tests » : reprend le terme exact de l'offre.",
        },
      ],
    });
    const variantId = (v.results as Array<{ proposalId: string }>)[0]!.proposalId;
    candidate.variantChoice['b-medtech-62304'] = `prop:${variantId}`;
    const p3 = await call('preview_selection', { target: { applicationId }, selection: candidate });
    const trace = (p3.coverage as { terms: Array<{ term: string; q: number }> }).terms.find(
      (t) => t.term === 'traçabilité des exigences',
    )!;
    expect(trace.q).toBe(1);
    expect(p3).toMatchObject({ pages: 1, atsReport: { blocking: false } });

    // 7. One selection proposal, depending on the variant.
    const proposal = await call('propose_selection', {
      target: { applicationId },
      selection: candidate,
      rationale: { 'prj-tracabilite': 'Contient « matrice de traçabilité ».' },
      baseRevision,
    });
    const proposalId = proposal.proposalId as string;
    expect(proposal.reviewUrl).toBe(`http://127.0.0.1:4310/a-valider?ids=${proposalId}`);

    // 8. PAUSE: the user opens « À valider » and accepts (with the variant it depends on).
    const queue = (await (await get(`/api/proposals?ids=${proposalId},${variantId}`)).json()) as {
      proposals: Array<{ id: string; type: string; checks: Array<{ rule: string; ok: boolean; level: string }> }>;
    };
    expect(queue.proposals.map((p) => p.type).sort()).toEqual(['selection', 'variant']);
    // The variant shows a warning to check (offer term reused), never a rejection.
    expect(queue.proposals.find((p) => p.type === 'variant')!.checks.some((c) => !c.ok && c.level === 'warning')).toBe(
      true,
    );
    expect((await send('POST', `/api/proposals/${proposalId}/accept`, { withDependencies: true })).status).toBe(200);

    // 9. Claude checks what was accepted, renders the validated content and checks it.
    const listed = await call('list', { kind: 'proposals', ids: [proposalId, variantId] });
    expect((listed.items as Array<{ status: string }>).map((i) => i.status).sort()).toEqual(['accepted', 'accepted']);
    const rendered = await call('render', { target: { applicationId }, saveToApplication: true });
    expect((rendered.atsReport as { blocking: boolean }).blocking).toBe(false);
    const checked = await call('check_ats', { renderId: rendered.renderId });
    expect(
      (checked.atsReport as { criteria: Array<{ status: string }> }).criteria.filter((c) => c.status === 'red'),
    ).toEqual([]);

    // Export from the interface: the preview shown is the saved selection (T-ATS-13).
    const preview = (await (await send('POST', '/api/render', { applicationId })).json()) as {
      sha256: string;
      coverage: { level: string };
    };
    expect(preview.coverage.level).toBe('bon');
    for (const format of ['pdf', 'docx']) {
      const res = await send('POST', '/api/export', { applicationId, format, previewSha256: preview.sha256 });
      expect(res.status, format).toBe(200);
    }
    const { application, selection: savedSelection } = await DataStore.open(dataDir).loadApplication(applicationId);
    expect(application.exports.map((e) => e.format)).toEqual(['pdf', 'pdf', 'docx']);
    expect(savedSelection.selection.variantChoice['b-medtech-62304']).toBe('acme-tracabilite');
    expect(savedSelection.selection.sections.find((s) => s.key === 'projects')!.enabled).toBe(true);
  });
});
