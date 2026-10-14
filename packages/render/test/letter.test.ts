// Lot 7 in packages/render (F-LET-07, F-MOD-05, ADR 0016): the letter template passes T-ATS-17, a letter
// compiles on one page (A4 or Letter), the overflowing one is measured, its DOCX passes T-DOCX-01 and 02,
// and the criteria of the « Lettre » column only are computed.
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { projectLetter, type LetterVersionFile } from '@cv/core';
import { buildLetterDocx, compileLetter, lintTemplate, runLetterAtsCheck, templatePath } from '@cv/render';
import { DataStore, installFixture, type Snapshot } from '@cv/store';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const letter = (name: string) =>
  JSON.parse(readFileSync(path.join(ROOT, 'fixtures', 'letters', name), 'utf8')) as LetterVersionFile;
let dir: string;
let snapshot: Snapshot;

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'cv-render-letter-'));
  await installFixture(path.join(ROOT, 'fixtures', 'personas', 'courte'), dir);
  snapshot = await DataStore.open(dir).loadSnapshot();
});
afterAll(() => rm(dir, { recursive: true, force: true }));

const projection = (name: string, lang: 'fr' | 'en', enVariant: 'en-GB' | 'en-US' = 'en-GB') =>
  projectLetter({
    version: letter(name),
    lang,
    enVariant,
    application: {
      company: 'ACME Medical',
      jobTitle: 'Ingénieur logiciel dispositifs médicaux H/F',
      offerReference: 'ACME-1234',
    },
    identity: snapshot.profile.identity,
    template: snapshot.presets[0]!.template,
    protectedTerms: snapshot.library.skills.map((s) => s.short),
    date: new Date(2026, 9, 1),
  });

describe('gabarit de lettre (F-MOD-05, T-ATS-17)', () => {
  it('ne contient aucun texte écrit en dur ni appel interdit', () => {
    expect(lintTemplate(readFileSync(templatePath('lettre'), 'utf8'))).toEqual([]);
  });
});

describe('rendu de la lettre (F-LET-07)', () => {
  it('FR : 1 page A4, critères de la colonne Lettre au vert', async () => {
    const p = projection('lettre-logiciel-dm-fr.json', 'fr');
    const compiled = compileLetter(p);
    expect(compiled.pages).toBe(1);
    const report = await runLetterAtsCheck({ projection: p, compiled, format: 'pdf', poppler: false });
    expect(report.criteria.map((c) => c.id)).toEqual([
      'T-ATS-01',
      'T-ATS-02',
      'T-ATS-03',
      'T-ATS-04',
      'T-ATS-05',
      'T-ATS-09',
      'T-ATS-10',
      'T-ATS-11',
      'T-ATS-12',
      'T-ATS-13',
      'T-ATS-14',
      'T-ATS-17',
    ]);
    expect(report.criteria.filter((c) => c.status !== 'green' && c.status !== 'na')).toEqual([]);
    expect(report.blocking).toBe(false);
    const doc = await PDFDocument.load(compiled.pdf);
    expect(doc.getTitle()).toBe('Lettre de motivation – Camille Martin – ACME Medical');
    expect(doc.getAuthor()).toBe('Camille Martin');
  });

  it('en-US : papier Letter (612 × 792 pt)', async () => {
    const compiled = compileLetter(projection('letter-logiciel-dm-en.json', 'en', 'en-US'));
    const { width, height } = (await PDFDocument.load(compiled.pdf)).getPage(0).getSize();
    expect([Math.round(width), Math.round(height)]).toEqual([612, 792]);
  });

  it('une lettre trop longue est refusée, avec le dépassement chiffré', async () => {
    const p = projection('lettre-trop-longue-fr.json', 'fr');
    const compiled = compileLetter(p);
    expect(compiled.pages).toBe(2);
    expect(compiled.measure.overflowLines).toBeGreaterThan(0);
    const report = await runLetterAtsCheck({ projection: p, compiled, format: 'pdf', poppler: false });
    expect(report.criteria[0]).toMatchObject({ id: 'T-ATS-01', status: 'red' });
    expect(report.criteria[0]!.message).toMatch(/^La lettre dépasse d'environ \d+ lignes? \(2 pages\) : raccourcissez/);
    expect(report.blocking).toBe(true);
  });

  it('DOCX de la même projection : ni tableau ni cadre, texte retrouvé', async () => {
    const p = projection('lettre-logiciel-dm-fr.json', 'fr');
    const docx = await buildLetterDocx(p);
    const report = await runLetterAtsCheck({
      projection: p,
      compiled: compileLetter(p),
      format: 'docx',
      docx,
      poppler: false,
    });
    const byId = Object.fromEntries(report.criteria.map((c) => [c.id, c.status]));
    expect(byId['T-DOCX-01']).toBe('green');
    expect(byId['T-DOCX-02']).toBe('green');
  });
});
