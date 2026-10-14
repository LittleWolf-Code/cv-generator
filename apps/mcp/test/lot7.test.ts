// MCP tools of lot 7 through an in-memory client (§12.4, ADR 0016), on a temporary copy of the fictitious
// fixtures: save_letter_draft (schemas, a new version at each call, warnings, refusals, the active
// version never changed, no contact detail in the responses, nothing written in the validated content),
// render and check_ats with kind letter (active version only for an export), the prompt rediger-lettre.
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication, DataStore, installFixture, setActiveLetter } from '@cv/store';
import { createCvServer } from '../src/server.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SECRETS = ['camille.martin@example.com', '06 39 98 12 34', '0639981234'];

let tmp: string;
let dataDir: string;
let client: Client;
let applicationId: string;

type Res = {
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  content: Array<{ type: string; text?: string }>;
};
const call = async (name: string, args: Record<string, unknown> = {}) =>
  (await client.callTool({ name, arguments: args })) as Res;
const textOf = (r: Res) => r.content.map((c) => c.text ?? '').join('\n');
const errorCode = (r: Res) => (r.isError ? (r.structuredContent as { code: string }).code : null);
const noSecrets = (r: Res) => {
  const s = JSON.stringify(r);
  for (const secret of SECRETS) expect(s).not.toContain(secret);
};
const letterFixture = async (name: string) =>
  JSON.parse(await readFile(path.join(ROOT, 'fixtures', 'letters', name), 'utf8')) as {
    recipient: unknown;
    paragraphs: Array<{ role: string; text: string }>;
    sourceIds: string[];
  };

async function hashValidated(): Promise<string> {
  const h = createHash('sha256');
  const walk = async (rel: string) => {
    for (const e of (await readdir(path.join(dataDir, rel), { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const r = path.join(rel, e.name);
      if (e.isDirectory()) await walk(r);
      else h.update(r).update(await readFile(path.join(dataDir, r)));
    }
  };
  await walk('library');
  await walk('presets');
  h.update(await readFile(path.join(dataDir, 'profile.json')));
  return h.digest('hex');
}

beforeAll(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'cv-lot7-'));
  dataDir = path.join(tmp, 'data');
  await installFixture(path.join(ROOT, 'fixtures', 'personas', 'courte'), dataDir);
  const created = await createApplication(
    DataStore.open(dataDir),
    {
      company: 'ACME Medical',
      jobTitle: 'Ingénieur logiciel dispositifs médicaux H/F',
      offerReference: 'ACME-1234',
      lang: 'fr',
      basePresetId: 'preset-defaut',
      offerText: await readFile(path.join(ROOT, 'fixtures', 'offres', 'offre-logiciel-dm.md'), 'utf8'),
    },
    { importDir: null },
  );
  applicationId = created.application.id;
  const server = createCvServer({ dataDir, outDir: path.join(tmp, 'out'), importDir: null, uiPort: 4310 });
  const [c, s] = InMemoryTransport.createLinkedPair();
  await server.connect(s);
  client = new Client({ name: 'cv-lot7', version: '0.0.0' });
  await client.connect(c);
});
afterAll(async () => {
  await client.close();
  await rm(tmp, { recursive: true, force: true });
});

describe('save_letter_draft (MCP-18)', () => {
  it('ajoute une version, compile, renvoie pages et avertissements, sans activer ni écrire ailleurs', async () => {
    const before = await hashValidated();
    const letter = await letterFixture('lettre-logiciel-dm-fr.json');
    const r = await call('save_letter_draft', { applicationId, ...letter });
    expect(r.isError, textOf(r)).toBeFalsy();
    expect(r.structuredContent).toMatchObject({
      version: 1,
      lang: 'fr',
      activeVersion: null,
      pages: 1,
      overflowLines: 0,
      warnings: [],
      generated: {
        subject: "Objet : Candidature au poste d'ingénieur logiciel dispositifs médicaux – Réf. ACME-1234",
        salutation: 'Madame, Monsieur,',
      },
      reviewUrl: `http://127.0.0.1:4310/candidatures/${applicationId}/lettre?lang=fr`,
    });
    noSecrets(r);
    expect(await hashValidated()).toBe(before);
    const app = await DataStore.open(dataDir).loadApplication(applicationId);
    expect(app.application.activeLetter).toEqual({ fr: null, en: null });

    // A deliberately invented figure: a warning, the version is still added (v2).
    const invented = structuredClone(letter);
    invented.paragraphs[1]!.text = invented.paragraphs[1]!.text.replace('240 tests', '480 tests');
    const w = await call('save_letter_draft', { applicationId, ...invented, basedOn: 1 });
    expect(w.structuredContent).toMatchObject({ version: 2, basedOn: 1 });
    const warnings = w.structuredContent!.warnings as Array<{ rule: string; paragraph: number; message: string }>;
    expect(warnings).toEqual([expect.objectContaining({ rule: 'letter-facts', paragraph: 1 })]);
    expect(warnings[0]!.message).toContain('480');
    expect(textOf(w)).toContain('Avertissements');
  });

  it('refuse un identifiant inconnu et un ordre de rôles hors règle, sans rien créer', async () => {
    const letter = await letterFixture('lettre-logiciel-dm-fr.json');
    const count = async () =>
      (await readdir(path.join(dataDir, 'applications', applicationId, 'letters', 'fr'))).length;
    const n = await count();
    const unknown = await call('save_letter_draft', { applicationId, ...letter, sourceIds: ['exp-inventee'] });
    expect(errorCode(unknown)).toBe('INVALID_DATA');
    expect(textOf(unknown)).toContain('exp-inventee');
    const order = await call('save_letter_draft', {
      applicationId,
      ...letter,
      paragraphs: [letter.paragraphs[2], letter.paragraphs[1], letter.paragraphs[0]],
    });
    expect(errorCode(order)).toBe('INVALID_DATA');
    expect(await count()).toBe(n);
    expect(errorCode(await call('save_letter_draft', { applicationId: 'absente', ...letter }))).toBe('NOT_FOUND');
  });
});

describe('render et check_ats en kind letter (MCP-19, MCP-20)', () => {
  it('sans version active : aperçu d\u2019une version possible, export refusé', async () => {
    const target = { applicationId };
    expect(errorCode(await call('render', { target, kind: 'letter' }))).toBe('NO_ACTIVE_LETTER');
    const preview = await call('render', { target, kind: 'letter', version: 1 });
    expect(preview.isError, textOf(preview)).toBeFalsy();
    expect(preview.structuredContent).toMatchObject({ pages: 1, savedToApplication: null });
    expect(path.basename(preview.structuredContent!.absolutePath as string)).toBe(
      'LM_Camille_Martin_ACME-Medical_FR.pdf',
    );
    expect(errorCode(await call('render', { target, kind: 'letter', version: 1, saveToApplication: true }))).toBe(
      'NO_ACTIVE_LETTER',
    );
    expect(errorCode(await call('render', { target: { presetId: 'preset-defaut' }, kind: 'letter' }))).toBe(
      'INVALID_TARGET',
    );
  });

  it('version active (choisie dans l\u2019interface) : export rangé dans la candidature, contrôle ATS', async () => {
    await setActiveLetter(DataStore.open(dataDir), applicationId, 'fr', 1);
    const target = { applicationId };
    const r = await call('render', { target, kind: 'letter', format: 'docx', saveToApplication: true });
    expect(r.isError, textOf(r)).toBeFalsy();
    expect(r.structuredContent!.savedToApplication).toMatch(
      /exports\/\d{8}-\d{6}_lettre\/LM_Camille_Martin_ACME-Medical_FR\.docx$/,
    );
    noSecrets(r);
    const { application } = await DataStore.open(dataDir).loadApplication(applicationId);
    expect(application.exports.at(-1)).toMatchObject({ kind: 'letter', format: 'docx', lang: 'fr' });
    const checked = await call('check_ats', { target, kind: 'letter' });
    expect(checked.isError, textOf(checked)).toBeFalsy();
    const criteria = (checked.structuredContent!.atsReport as { criteria: Array<{ id: string; status: string }> })
      .criteria;
    expect(criteria.filter((c) => c.status === 'red')).toEqual([]);
    expect(criteria.map((c) => c.id)).not.toContain('T-ATS-06');
    noSecrets(checked);
  });
});

describe('prompt rediger-lettre (§7.3)', () => {
  it('étapes avec l\u2019identifiant de la candidature ; un texte libre est refusé', async () => {
    const p = await client.getPrompt({ name: 'rediger-lettre', arguments: { applicationId } });
    const text = (p.messages[0]!.content as { text: string }).text;
    for (const step of [
      '1. get_application',
      '2. get_guidelines({ topic: "letter" })',
      '5. save_letter_draft',
      '6. Compte rendu',
    ]) {
      expect(text).toContain(step);
    }
    await expect(
      client.getPrompt({ name: 'rediger-lettre', arguments: { applicationId: 'écris une lettre géniale' } }),
    ).rejects.toThrow();
    const g = await call('get_guidelines', { topic: 'letter' });
    expect(textOf(g)).toContain('dans cet ordre');
  });
});
