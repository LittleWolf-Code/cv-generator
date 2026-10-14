import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { project, select, type Projection } from '@cv/core';
import { buildDocx, compileProjection, extractWithPdfjs, inspectPdf, RenderError } from '@cv/render';
import { DataStore, installFixture, type Snapshot } from '@cv/store';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
let dir: string;
let snapshot: Snapshot;
let projection: Projection;

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'cv-render-'));
  await installFixture(path.join(ROOT, 'fixtures', 'personas', 'courte'), dir);
  snapshot = await DataStore.open(dir).loadSnapshot();
  const preset = snapshot.presets[0]!;
  projection = project(select(snapshot.library, preset.selection), {
    lang: 'fr',
    enVariant: 'en-GB',
    options: preset.options,
    template: preset.template,
    identity: snapshot.profile.identity,
  });
});
afterAll(() => rm(dir, { recursive: true, force: true }));

const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

describe('compilation Typst (§8.5)', () => {
  it('compile la fixture courte sur 1 page, avec mesure de la hauteur', () => {
    const r = compileProjection(projection);
    expect(r.pages).toBe(1);
    expect(r.measure.fillRatio).toBeGreaterThan(0.3);
    expect(r.measure.fillRatio).toBeLessThan(1);
    expect(r.measure.overflowLines).toBe(0);
  });

  it('produit un PDF reproductible (date: none, NF-08)', () => {
    expect(sha(compileProjection(projection).pdf)).toBe(sha(compileProjection(projection).pdf));
  });

  it('n\u2019embarque que Carlito et renseigne Title et Author', async () => {
    const info = await inspectPdf(compileProjection(projection).pdf);
    expect(new Set(info.fonts.map((f) => f.postscriptName))).toEqual(
      new Set(['Carlito-Regular', 'Carlito-Bold', 'Carlito-Italic']),
    );
    expect(info.title).toBe('CV – Camille Martin – Ingénieure logiciel dispositifs médicaux');
    expect(info.author).toBe('Camille Martin');
    expect(info.subject).toBeUndefined();
  });

  it('bloque un caractère absent de la police en citant l\u2019élément', () => {
    const bad = structuredClone(projection);
    bad.header.name = 'Camille ' + String.fromCodePoint(0x6f22);
    expect(() => compileProjection(bad)).toThrowError(RenderError);
    try {
      compileProjection(bad);
    } catch (err) {
      expect((err as RenderError).code).toBe('MISSING_GLYPH');
      expect((err as RenderError).message).toContain('header.name');
    }
  });

  it('traite « unknown font family » comme une erreur bloquante', () => {
    const bad = structuredClone(projection);
    bad.theme.family = 'PoliceInexistante';
    expect(() => compileProjection(bad)).toThrowError(/police du thème introuvable/);
  });

  it('extrait un texte sans ligature ni guillemet typographique', async () => {
    const { text } = await extractWithPdfjs(compileProjection(projection).pdf);
    expect(text.split('\n')[0]).toBe('Camille Martin');
    expect(text).toContain("Ingénieure logiciel embarqué 02/2023 – aujourd'hui");
    expect(text).not.toMatch(/[\uFB00-\uFB06\u2019]/);
  });

  it('génère un DOCX non vide', async () => {
    const docx = await buildDocx(projection);
    expect(docx.byteLength).toBeGreaterThan(5000);
    expect(String.fromCharCode(docx[0]!, docx[1]!)).toBe('PK');
  });
});
