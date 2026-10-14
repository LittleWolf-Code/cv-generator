// Lot 3 in packages/render: photo import pipeline (§5.2), rendering with the photo in the PDF and the
// DOCX, T-ATS-16 orange and nothing else degraded, T-ATS-17 rule on photo(), T-ATS-13 at export, and
// the fields detected in the extraction (F-ATS-02).
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { strFromU8, unzipSync } from 'fflate';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AtsCriterion } from '@cv/core';
import {
  checkPreviewIsExport,
  compileProjection,
  findSoffice,
  inspectPhoto,
  lintTemplate,
  PhotoError,
  placeholderPhoto,
  processPhoto,
  renderCv,
  resolveTarget,
  RenderError,
  withPreviewCheck,
  type RenderOutput,
  type ResolvedTarget,
} from '@cv/render';
import { DataStore, installFixture, readPhoto, type Snapshot } from '@cv/store';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
let dir: string;
let snapshot: Snapshot;
let target: ResolvedTarget;
let photo: Uint8Array;

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'cv-photo-'));
  await installFixture(path.join(ROOT, 'fixtures', 'personas', 'courte'), dir);
  const store = DataStore.open(dir);
  snapshot = await store.loadSnapshot();
  target = await resolveTarget(store, snapshot, { presetId: 'preset-defaut' });
  photo = (await readPhoto(store, snapshot.profile.identity))!;
});
afterAll(() => rm(dir, { recursive: true, force: true }));

const withPhoto = (on: boolean): ResolvedTarget => ({ ...target, options: { ...target.options, photo: on } });
const statuses = (out: RenderOutput) => Object.fromEntries(out.report.criteria.map((c) => [c.id, c.status]));
const contains = (hay: Uint8Array, needle: Uint8Array) =>
  Buffer.from(hay).includes(Buffer.from(needle.subarray(100, 400)));

describe('import de la photo (§5.2)', () => {
  it('recadre en 3:4, ramène à 600 × 800 au plus, en JPEG qualité 85 de 300 Ko au plus', async () => {
    const landscape = await sharp({ create: { width: 1600, height: 900, channels: 3, background: '#5a7d9a' } })
      .png()
      .toBuffer();
    const r = await processPhoto(new Uint8Array(landscape));
    expect([r.width, r.height, r.quality]).toEqual([600, 800, 85]);
    const info = await inspectPhoto(r.jpeg);
    expect(info).toMatchObject({ format: 'jpeg', width: 600, height: 800 });
    expect(info.bytes).toBeLessThanOrEqual(300 * 1024);
  });

  it("applique l'orientation EXIF, puis supprime EXIF, GPS et profil ICC", async () => {
    const tagged = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#336699' } })
      .withMetadata({
        orientation: 6,
        exif: { IFD0: { Artist: 'Fictif' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '45/1 45/1 0/1' } },
      })
      .jpeg()
      .toBuffer();
    expect((await inspectPhoto(new Uint8Array(tagged))).exif).toBe(true);
    const r = await processPhoto(new Uint8Array(tagged));
    // 800 × 600 shown rotated (orientation 6): portrait 600 × 800, already 3:4.
    expect([r.width, r.height]).toEqual([600, 800]);
    expect(await inspectPhoto(r.jpeg)).toMatchObject({ exif: false, icc: false, xmp: false });
  });

  it('ne grossit pas une petite image et refuse une image trop petite ou illisible', async () => {
    const small = await sharp({ create: { width: 300, height: 400, channels: 3, background: '#888888' } })
      .jpeg()
      .toBuffer();
    expect(await processPhoto(new Uint8Array(small))).toMatchObject({ width: 300, height: 400 });
    const tiny = await sharp({ create: { width: 90, height: 120, channels: 3, background: '#888888' } })
      .png()
      .toBuffer();
    await expect(processPhoto(new Uint8Array(tiny))).rejects.toBeInstanceOf(PhotoError);
    await expect(processPhoto(new TextEncoder().encode('pas une image'))).rejects.toBeInstanceOf(PhotoError);
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"/>');
    await expect(processPhoto(svg)).rejects.toThrow(/format non pris en charge/);
  });

  it('baisse la qualité par paliers pour tenir sous le plafond, sinon refuse', async () => {
    const noise = await sharp(randomBytes(600 * 800 * 3), { raw: { width: 600, height: 800, channels: 3 } })
      .png()
      .toBuffer();
    const first = await processPhoto(new Uint8Array(noise), Number.MAX_SAFE_INTEGER);
    expect(first.quality).toBe(85);
    const ceiling = first.jpeg.byteLength - 1;
    const r = await processPhoto(new Uint8Array(noise), ceiling);
    expect(r.quality).toBeLessThan(85);
    expect(r.jpeg.byteLength).toBeLessThanOrEqual(ceiling);
    await expect(processPhoto(new Uint8Array(noise), 10 * 1024)).rejects.toThrow(/trop lourde/);
  });

  it('la photo fictive de la fixture « courte » est conforme (aucune personne : un motif généré)', async () => {
    const info = await inspectPhoto(photo);
    expect(info).toMatchObject({ format: 'jpeg', width: 600, height: 800, exif: false });
    expect(info.bytes).toBeLessThanOrEqual(300 * 1024);
  });
});

describe('rendu avec photo (§5.2, §8.5)', () => {
  let without: RenderOutput;
  let withIt: RenderOutput;
  beforeAll(async () => {
    without = await renderCv(snapshot, withPhoto(false), { format: 'docx' }, { photo });
    withIt = await renderCv(snapshot, withPhoto(true), { format: 'docx' }, { photo });
  });

  it('place la photo dans le PDF : 1 page, T-ATS-16 orange, aucun autre critère dégradé', () => {
    expect(withIt.compiled.pages).toBe(1);
    expect(contains(withIt.compiled.pdf, photo)).toBe(true);
    expect(contains(without.compiled.pdf, photo)).toBe(false);
    const a = statuses(without);
    const b = statuses(withIt);
    expect(a['T-ATS-16']).toBe('green');
    expect(b['T-ATS-16']).toBe('orange');
    for (const id of Object.keys(a)) if (id !== 'T-ATS-16') expect(b[id], id).toBe(a[id]);
    expect(b['T-ATS-17']).toBe('green');
    expect(withIt.report.blocking).toBe(false);
  });

  it('garde le nom en première ligne et les coordonnées avant le premier intitulé', () => {
    const d = withIt.report.detected.find((x) => x.extractor === 'pdf.js')!;
    expect(d.name).toEqual({ line: 'Camille Martin', ok: true });
    expect(d.contacts).toMatchObject({ email: true, phone: true, location: true, otherEmails: 0, otherPhones: 0 });
    expect(d.headings.ok).toBe(true);
    expect(d.entries.every((e) => e.ok)).toBe(true);
  });

  it('met la photo en ligne dans le corps du DOCX, une seule fois, sans ancre ni en-tête', () => {
    const files = unzipSync(withIt.docx!);
    const doc = strFromU8(files['word/document.xml']!);
    expect(doc.match(/<w:drawing\b/g)).toHaveLength(1);
    expect(doc).toContain('<wp:inline');
    expect(doc).not.toContain('<wp:anchor');
    expect(Object.keys(files).some((f) => /^word\/header/.test(f))).toBe(false);
    const docx = Object.fromEntries(
      withIt.report.criteria.filter((c) => c.id.startsWith('T-DOCX')).map((c) => [c.id, c.status]),
    );
    // T-DOCX-03 is orange without LibreOffice; with it, it reports the page count LibreOffice gives.
    const pagination = withIt.report.criteria.find((c) => c.id === 'T-DOCX-03')!;
    expect(docx).toEqual({ 'T-DOCX-01': 'green', 'T-DOCX-02': 'green', 'T-DOCX-03': pagination.status });
    if (findSoffice()) expect(pagination.status).toBe((pagination.details?.pages as number) > 1 ? 'orange' : 'green');
    else expect(pagination.status).toBe('orange');
    expect(strFromU8(unzipSync(without.docx!)['word/document.xml']!)).not.toContain('<w:drawing');
  });

  it('exige les octets de la photo quand la projection en a une', () => {
    expect(() => compileProjection(withIt.projection, null)).toThrow(RenderError);
  });

  it('rend sans photo, avec un avertissement, si son fichier manque', async () => {
    const out = await renderCv(snapshot, withPhoto(true), { format: 'pdf' });
    expect(out.projection.photo).toBeNull();
    expect(out.projection.warnings.map((w) => w.code)).toContain('PHOTO_MISSING');
    expect(statuses(out)['T-ATS-16']).toBe('green');
  });

  it('remplace la photo par une image neutre pour le MCP, sans changer la mise en page', async () => {
    const grey = await placeholderPhoto();
    const mcp = await renderCv(snapshot, withPhoto(true), { format: 'pdf' }, { photo: grey });
    expect(contains(mcp.compiled.pdf, photo)).toBe(false);
    expect(mcp.compiled.measure.contentHeight).toBeCloseTo(withIt.compiled.measure.contentHeight, 3);
  });
});

describe('T-ATS-17 : photo() ne contient que l\u2019image placée', () => {
  const rules = (src: string) => lintTemplate(src).map((v) => v.rule);
  it('accepte place(top + right, image(…)) et le gabarit ats-classique', async () => {
    expect(rules('#let photo(src, p) = place(top + right, image(src, width: p.width * 1cm))')).toEqual([]);
    const template = await readFile(path.join(ROOT, 'packages', 'render', 'templates', 'ats-classique.typ'), 'utf8');
    expect(lintTemplate(template)).toEqual([]);
  });
  it('refuse du texte, une boîte ou un champ textuel dans photo()', () => {
    expect(rules('#let photo(p) = place(top + right, text(p.name))')).toContain('photo-content');
    expect(rules('#let photo(p) = place(top + right, box(image(p.src)))')).toContain('photo-content');
    expect(rules('#let photo(p) = place(top + right, [#p.src])')).toContain('photo-content');
  });
});

describe('T-ATS-13 : aperçu = export', () => {
  const h = (c: string) => c.repeat(64);
  it("est sans objet sans les deux empreintes, vert si elles sont égales, rouge sinon (et bloque l'export)", async () => {
    expect(checkPreviewIsExport().status).toBe('na');
    expect(checkPreviewIsExport(h('a'), h('a')).status).toBe('green');
    expect(checkPreviewIsExport(h('a'), h('a'), 'docx').message).toMatch(/DOCX produit/);
    const red: AtsCriterion = checkPreviewIsExport(h('a'), h('b'));
    expect(red.status).toBe('red');
    const out = await renderCv(snapshot, withPhoto(false), { format: 'pdf' });
    expect(out.report.blocking).toBe(false);
    expect(withPreviewCheck(out.report, h('a'), h('b')).blocking).toBe(true);
    expect(withPreviewCheck(out.report, h('a'), h('a')).blocking).toBe(false);
  });
});
