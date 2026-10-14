// MCP tools through an in-memory client (§12.4), on a temporary copy of the fictitious fixtures.
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { unzipSync } from 'fflate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { placeholderPhoto } from '@cv/render';
import { createApplication, DataStore, installFixture } from '@cv/store';
import { createCvServer } from '../src/server.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SECRETS = ['camille.martin@example.com', '06 39 98 12 34', '0639981234', '+33 6 39 98 12 34'];

let tmp: string;

async function connect(fixture: string) {
  const dataDir = path.join(tmp, fixture, 'data');
  const outDir = path.join(tmp, fixture, 'out');
  await installFixture(path.join(ROOT, 'fixtures', 'personas', fixture), dataDir);
  const server = createCvServer({ dataDir, outDir });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: 'cv-test', version: '0.0.0' });
  await client.connect(clientSide);
  return { client, server, dataDir, outDir };
}

/** Hash of every file of the data directory, except the lock. */
async function hashTree(dir: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const walk = async (d: string) => {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.name === '.lock') continue;
      if (e.isDirectory()) await walk(p);
      else
        out[path.relative(dir, p)] = createHash('sha256')
          .update(await readFile(p))
          .digest('hex');
    }
  };
  await walk(dir);
  return out;
}

const noSecrets = (value: unknown) => {
  const s = JSON.stringify(value);
  for (const secret of SECRETS) expect(s).not.toContain(secret);
};

beforeAll(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'cv-mcp-'));
});
afterAll(() => rm(tmp, { recursive: true, force: true }));

describe('serveur MCP « cv » (client en mémoire)', () => {
  it('négocie le protocole, publie les instructions, les 22 outils et les 3 prompts (lots 0, 5, 6, 7 et ADR 0022)', async () => {
    const { client } = await connect('courte');
    expect(client.getNegotiatedProtocolVersion()).toBe('2025-11-25');
    const instructions = client.getInstructions() ?? '';
    expect(instructions.length).toBeLessThanOrEqual(2048);
    expect(instructions).toMatch(/Aucune invention/);
    // ADR 0023 (category proposal): propose_item announces the category and the returned itemId.
    expect(instructions).toMatch(/propose_item \(dont une catégorie ; itemId renvoyé\)/);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'check_ats',
      'create_application',
      'create_preset',
      'get_application',
      'get_guidelines',
      'get_import_file_text',
      'get_items',
      'get_library',
      'get_overview',
      'get_preset',
      'import_linkedin',
      'list',
      'preview_selection',
      'propose_alias',
      'propose_edit',
      'propose_item',
      'propose_selection',
      'propose_translation',
      'propose_variant',
      'render',
      'save_letter_draft',
      'save_offer_analysis',
    ]);
    for (const t of tools) {
      expect(t.outputSchema, t.name).toBeDefined();
      expect(t.annotations?.openWorldHint, t.name).toBe(false);
      expect(t.annotations?.destructiveHint, t.name).toBe(false);
    }
    const readOnly = tools
      .filter((t) => t.annotations?.readOnlyHint)
      .map((t) => t.name)
      .sort();
    expect(readOnly).toEqual([
      'get_application',
      'get_guidelines',
      'get_import_file_text',
      'get_items',
      'get_library',
      'get_overview',
      'get_preset',
      'list',
      'preview_selection',
    ]);
    // §7.2: propose_*, render and check_ats are not idempotent; every proposal description starts with the rules.
    for (const t of tools.filter((x) => /^(propose_|render|check_ats|create_|save_|import_)/.test(x.name))) {
      expect(t.annotations?.idempotentHint, t.name).toBe(false);
    }
    for (const t of tools.filter((x) => x.name.startsWith('propose_')))
      expect(t.description, t.name).toMatch(/^RÈGLES : aucune invention/);
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name)).toEqual(['adapter-a-une-offre', 'importer-mon-cv', 'rediger-lettre']);
    expect(prompts[2]!.arguments).toEqual([expect.objectContaining({ name: 'applicationId', required: true })]);
    expect(prompts[0]!.arguments).toEqual([expect.objectContaining({ name: 'applicationId', required: false })]);
    expect(prompts[1]!.arguments).toEqual([expect.objectContaining({ name: 'fileName', required: false })]);
    await client.close();
  });

  it('get_overview, get_library (index), render puis check_ats : résultats conformes, sans e-mail ni téléphone, sans écriture dans data/', async () => {
    const { client, dataDir, outDir } = await connect('courte');
    const before = await hashTree(dataDir);

    const overview = await client.callTool({ name: 'get_overview', arguments: {} });
    expect(overview.isError).toBeFalsy();
    const o = overview.structuredContent as {
      counts: Record<string, number>;
      presets: Array<{ id: string }>;
      identityPresent: boolean;
    };
    expect(o.counts.experiences).toBe(3);
    expect(o.presets.map((p) => p.id)).toEqual(['preset-defaut']);
    expect(o.identityPresent).toBe(true);
    noSecrets(overview);

    const library = await client.callTool({ name: 'get_library', arguments: { lang: 'fr' } });
    const l = library.structuredContent as {
      view: string;
      items: Array<{ id: string; type: string; lineCost: number }>;
      nextCursor: string | null;
    };
    expect(l.view).toBe('index');
    expect(l.items.find((i) => i.id === 'b-medtech-62304')).toMatchObject({ type: 'bullet', lineCost: 2 });
    expect(l.nextCursor).toBeNull();
    noSecrets(library);

    const render = await client.callTool({
      name: 'render',
      arguments: { target: { presetId: 'preset-defaut' }, format: 'pdf', lang: 'fr' },
    });
    expect(render.isError).toBeFalsy();
    const r = render.structuredContent as {
      renderId: string;
      absolutePath: string;
      fileUri: string;
      pages: number;
      atsReport: { blocking: boolean; criteria: Array<{ id: string; status: string }> };
    };
    expect(r.pages).toBe(1);
    expect(r.atsReport.blocking).toBe(false);
    expect(r.atsReport.criteria.filter((c) => c.status === 'red')).toEqual([]);
    expect(path.basename(r.absolutePath)).toBe('CV_Camille_Martin_Ingenieure-logiciel-DM_FR.pdf');
    expect(r.absolutePath.startsWith(outDir)).toBe(true);
    expect(existsSync(r.absolutePath)).toBe(true);
    expect(r.fileUri.startsWith('file:///')).toBe(true);
    noSecrets(render);

    const check = await client.callTool({ name: 'check_ats', arguments: { renderId: r.renderId } });
    expect(check.isError).toBeFalsy();
    const c = check.structuredContent as { text: string; atsReport: { blocking: boolean } };
    expect(c.atsReport.blocking).toBe(false);
    expect(c.text.split('\n')[0]).toBe('Camille Martin');
    expect(c.text).toContain('{{email}}');
    expect(c.text).toContain('{{phone}}');
    noSecrets(check);

    expect(await hashTree(dataDir)).toEqual(before);
    await client.close();
  });

  it('render refuse la fixture débordante (PAGE_OVERFLOW) avec le rapport et une action suggérée', async () => {
    const { client, outDir } = await connect('debordante');
    const res = await client.callTool({ name: 'render', arguments: { target: { presetId: 'preset-defaut' } } });
    expect(res.isError).toBe(true);
    const e = res.structuredContent as {
      code: string;
      hint: string;
      details: { atsReport: { overflowLines: number } };
    };
    expect(e.code).toBe('PAGE_OVERFLOW');
    expect(e.details.atsReport.overflowLines).toBeGreaterThan(0);
    expect(e.hint).toMatch(/décochez/);
    expect(existsSync(outDir)).toBe(false);
    noSecrets(res);
    await client.close();
  });

  it('refuse les identifiants inconnus et les renderId forgés', async () => {
    const { client } = await connect('pieges');
    const missing = await client.callTool({ name: 'render', arguments: { target: { presetId: 'inexistant' } } });
    expect(missing.isError).toBe(true);
    expect((missing.structuredContent as { code: string }).code).toBe('NOT_FOUND');
    const forged = await client.callTool({ name: 'check_ats', arguments: { renderId: '..\\..\\data' } });
    expect(forged.isError).toBe(true);
    const traversal = await client.callTool({ name: 'render', arguments: { target: { applicationId: '../../etc' } } });
    expect(traversal.isError).toBe(true);
    await client.close();
  });

  it('ne transmet jamais la photo : image neutre dans le PDF, le DOCX et l\u2019aperçu, rien dans les réponses', async () => {
    const { client, dataDir } = await connect('courte');
    // The MCP server renders validated content only: the photo is checked in the saved preset.
    const presetFile = path.join(dataDir, 'presets', 'preset-defaut.json');
    const preset = JSON.parse(await readFile(presetFile, 'utf8')) as { options: { photo: boolean } };
    preset.options.photo = true;
    await writeFile(presetFile, JSON.stringify(preset));
    const photo = await readFile(path.join(dataDir, 'assets', 'photo.jpg'));
    const needle = photo.subarray(100, 400);
    const grey = Buffer.from(await placeholderPhoto());

    const pdf = await client.callTool({
      name: 'render',
      arguments: { target: { presetId: 'preset-defaut' }, format: 'pdf', includePreviewImage: true },
    });
    expect(pdf.isError).toBeFalsy();
    const r = pdf.structuredContent as {
      absolutePath: string;
      atsReport: { criteria: Array<{ id: string; status: string }> };
    };
    expect(r.atsReport.criteria.find((c) => c.id === 'T-ATS-16')?.status).toBe('orange');
    const bytes = await readFile(r.absolutePath);
    expect(bytes.includes(needle)).toBe(false);
    expect(bytes.includes(grey.subarray(100, 400))).toBe(true);

    const docx = await client.callTool({
      name: 'render',
      arguments: { target: { presetId: 'preset-defaut' }, format: 'docx' },
    });
    const media = Object.entries(
      unzipSync(await readFile((docx.structuredContent as { absolutePath: string }).absolutePath)),
    )
      .filter(([name]) => name.startsWith('word/media/') && !name.endsWith('/'))
      .map(([, data]) => Buffer.from(data));
    expect(media).toHaveLength(1);
    expect(media[0]!.equals(grey)).toBe(true);

    const library = await client.callTool({ name: 'get_library', arguments: { view: 'full' } });
    const overview = await client.callTool({ name: 'get_overview', arguments: {} });
    for (const res of [pdf, docx, library, overview]) {
      const text = JSON.stringify(res);
      expect(text).not.toContain('photo.jpg');
      expect(text).not.toContain(photo.toString('base64').slice(400, 480));
    }
    await client.close();
  });

  it('render avec includePreviewImage renvoie une image PNG', async () => {
    const { client } = await connect('pieges');
    const res = await client.callTool({
      name: 'render',
      arguments: { target: { presetId: 'preset-defaut' }, includePreviewImage: true },
    });
    expect(res.isError).toBeFalsy();
    const image = (res.content as Array<{ type: string; mimeType?: string }>).find((b) => b.type === 'image');
    expect(image?.mimeType).toBe('image/png');
    await client.close();
  });
});

describe('render avec saveToApplication (F-CAN-03)', () => {
  it('ajoute un export horodaté à la candidature, par la même fonction que l’interface', async () => {
    const dataDir = path.join(tmp, 'courte-candidature', 'data');
    const outDir = path.join(tmp, 'courte-candidature', 'out');
    await installFixture(path.join(ROOT, 'fixtures', 'personas', 'courte'), dataDir);
    const store = DataStore.open(dataDir);
    const { application } = await createApplication(
      store,
      {
        company: 'ACME Medical',
        jobTitle: 'Ingénieur logiciel',
        lang: 'fr',
        basePresetId: 'preset-defaut',
        offerText: 'Offre',
      },
      { importDir: null },
    );
    const server = createCvServer({ dataDir, outDir });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await server.connect(serverSide);
    const client = new Client({ name: 'cv-test', version: '0.0.0' });
    await client.connect(clientSide);

    const saved: string[] = [];
    for (const format of ['pdf', 'pdf'] as const) {
      const res = await client.callTool({
        name: 'render',
        arguments: { target: { applicationId: application.id }, format, saveToApplication: true },
      });
      expect(res.isError).toBeFalsy();
      saved.push((res.structuredContent as { savedToApplication: string }).savedToApplication);
    }
    // Two renders in the same second never share a folder: nothing is overwritten.
    expect(new Set(saved).size).toBe(2);
    for (const rel of saved) {
      expect(rel.startsWith(`applications/${application.id}/exports/`)).toBe(true);
      expect(rel).toMatch(/\/exports\/\d{8}-\d{6}(?:-\d+)?_ats-classique\/CV_.+\.pdf$/);
      expect(existsSync(path.join(dataDir, ...rel.split('/')))).toBe(true);
    }
    const { application: after } = await store.loadApplication(application.id);
    expect(after.exports).toHaveLength(2);
    expect(after.exports[0]).toMatchObject({ kind: 'cv', format: 'pdf', lang: 'fr', atsCheck: 'ok', sent: false });

    // A preset is refused, before anything is written.
    const refused = await client.callTool({
      name: 'render',
      arguments: { target: { presetId: 'preset-defaut' }, saveToApplication: true },
    });
    expect(refused.isError).toBe(true);
    expect(JSON.stringify(refused.structuredContent ?? refused.content)).toContain('INVALID_TARGET');
    await client.close();
  });
});
