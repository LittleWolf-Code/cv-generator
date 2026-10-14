// Lot 8 in packages/render (F-MOD-01, F-MOD-05, ATS-11, §8.5, F-EXP-02, ADR 0017): the theme fonts are the
// versioned static TTF files (SHA-256 of the ADR), cover every character of the fictitious personas, are
// the only fonts embedded (T-ATS-09) in each layout and in the letter, an unknown family or a missing glyph
// blocks the rendering, and the DOCX declares Calibri with a warning when Word has no equivalent.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fontkit from 'fontkit';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  project,
  projectLetter,
  select,
  THEME_FONT_IDS,
  THEME_FONT_META,
  type LetterVersionFile,
  type Projection,
  type Template,
  type ThemeFont,
} from '@cv/core';
import {
  compileLetter,
  compileProjection,
  findMissingGlyphs,
  FONTS_DIR,
  inspectPdf,
  locatePoppler,
  renderCv,
  RenderError,
  runAtsCheck,
  resolveTarget,
  runLetterAtsCheck,
  THEME_FONTS,
  type ResolvedTarget,
} from '@cv/render';
import { DataStore, installFixture, type Snapshot } from '@cv/store';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** SHA-256 of the versioned font files (ADR 0007 for Carlito, ADR 0017 for the others). */
const SHA256: Record<string, string> = {
  'Carlito-Regular.ttf': 'f6418f708baede9789daef5d458c0f53d2a888af9820e8062934e504fedc6595',
  'Carlito-Bold.ttf': 'bb5d20f79b82599ec72983597437373a80f2d2085fa91fc144fd74e876a594db',
  'Carlito-Italic.ttf': '0b019225e58d702bfedcbd35c21696769f8ee115cb6343f84c2f240312450d1c',
  'Carlito-BoldItalic.ttf': 'b32928186c119599e03ca6a1ffc680fdcb7fac95772f4b95d989cf6cd3861517',
  'SourceSans3-Regular.ttf': '4644c81b86ec9caaa76b634889968ed3c4f4f52f054855933acc7c2b21e53b0f',
  'SourceSans3-Bold.ttf': '9214b9d95e4231c609802815c2646c98174e2102d0d37f88978a7f8e71006e6a',
  'SourceSans3-It.ttf': '192afd78f0f54a3c69eaf02d43f4d9a821e9d6110e41d3d25d61a7385cd580e4',
  'SourceSans3-BoldIt.ttf': '7978291fc1bf314db887e0366853b33c5cf2e964c7b95cfb9ce403a6ec46a842',
  'IBMPlexSans-Regular.ttf': '975dcda37d80f038dcd143c22e33ca2d97a0cc5a929aace1c749153b0fe1afa5',
  'IBMPlexSans-Bold.ttf': '9e6c74a889a700d707613d24548fe4ffa6bc59559a0689d2cf9e133bdcdafb2f',
  'IBMPlexSans-Italic.ttf': 'a9c6ef9942c49e49d11e11a6dacc0b3a087978757e9b22a06b8ac22a6400fb15',
  'IBMPlexSans-BoldItalic.ttf': '0e3142ba2ef31fe5c02f0c6c36424f251609cd6b73880076e21c2e81931ba2b9',
};

const sha256 = (file: string) =>
  createHash('sha256')
    .update(readFileSync(path.join(FONTS_DIR, file)))
    .digest('hex');

describe('polices du thème (ATS-11, §8.5)', () => {
  it.each(THEME_FONT_IDS)('%s : 4 TTF statiques versionnés, empreintes de l’ADR, noms PostScript attendus', (font) => {
    const info = THEME_FONTS[font];
    expect(info.files).toHaveLength(4);
    info.files.forEach((file, i) => {
      expect(sha256(file), file).toBe(SHA256[file]);
      const f = fontkit.openSync(path.join(FONTS_DIR, file)) as unknown as {
        postscriptName: string;
        familyName: string;
        directory: { tables: Record<string, unknown> };
      };
      // Static TrueType: no variation axis (fvar), glyf outlines.
      expect(Object.keys(f.directory.tables)).not.toContain('fvar');
      expect(Object.keys(f.directory.tables)).toContain('glyf');
      expect(f.postscriptName).toBe(info.postscriptNames[i]);
      expect(f.familyName).toBe(info.family);
    });
  });

  it('chaque police a sa licence OFL dans le dépôt', () => {
    for (const file of ['OFL.txt', 'SourceSans3-LICENSE.md', 'IBMPlexSans-LICENSE.txt']) {
      expect(readFileSync(path.join(FONTS_DIR, file), 'utf8')).toMatch(/SIL Open Font License, Version 1\.1/);
    }
  });
});

describe('glyphes, T-ATS-09 et police inconnue', () => {
  const dirs: string[] = [];
  const personas = new Map<string, { snapshot: Snapshot; resolved: ResolvedTarget }>();
  beforeAll(async () => {
    for (const persona of ['courte', 'pieges', 'debordante']) {
      const dir = await mkdtemp(path.join(os.tmpdir(), `cv-render-fonts-${persona}-`));
      dirs.push(dir);
      await installFixture(path.join(ROOT, 'fixtures', 'personas', persona), dir);
      const store = DataStore.open(dir);
      const snapshot = await store.loadSnapshot();
      const preset = snapshot.presets.find((p) => p.isDefault)!;
      personas.set(persona, { snapshot, resolved: await resolveTarget(store, snapshot, { presetId: preset.id }) });
    }
  });
  afterAll(async () => {
    for (const d of dirs) await rm(d, { recursive: true, force: true });
  });

  const projectionOf = (
    persona: string,
    font: ThemeFont,
    lang: 'fr' | 'en',
    layout: Template['layout'],
  ): Projection => {
    const { snapshot, resolved } = personas.get(persona)!;
    return project(select(snapshot.library, resolved.selection), {
      lang,
      enVariant: 'en-GB',
      options: resolved.options,
      template: { layout, theme: { ...resolved.template.theme, font } },
      identity: snapshot.profile.identity,
    });
  };

  it.each(THEME_FONT_IDS)('%s couvre tous les caractères des trois personas, en FR et en EN', (font) => {
    for (const persona of ['courte', 'pieges', 'debordante'])
      for (const lang of ['fr', 'en'] as const) {
        expect(findMissingGlyphs(projectionOf(persona, font, lang, 'visuel')), `${persona} ${lang}`).toEqual([]);
      }
  });

  it.each(THEME_FONT_IDS)(
    '%s : T-ATS-09 au vert dans les deux modèles, seules les polices du thème sont embarquées',
    async (font) => {
      const { snapshot, resolved } = personas.get('pieges')!;
      for (const layout of ['ats-classique', 'visuel'] as const) {
        const out = await renderCv(
          snapshot,
          { ...resolved, template: { layout, theme: { ...resolved.template.theme, font } } },
          { format: 'pdf' },
        );
        expect(out.report.criteria.find((c) => c.id === 'T-ATS-09')!.status, layout).toBe('green');
        const embedded = (await inspectPdf(out.compiled.pdf)).fonts.map((f) => f.postscriptName);
        expect(embedded.length).toBeGreaterThan(0);
        for (const name of embedded) expect(THEME_FONTS[font].postscriptNames).toContain(name);
        if (layout === 'ats-classique') expect(out.report.blocking).toBe(false);
      }
    },
  );

  it.each(THEME_FONT_IDS)('%s : un caractère absent de la police bloque le rendu (MISSING_GLYPH)', (font) => {
    const p = projectionOf('courte', font, 'fr', 'visuel');
    const withHan = { ...p, header: { ...p.header, name: `${p.header.name} 漢` } };
    expect(() => compileProjection(withHan)).toThrowError(RenderError);
    try {
      compileProjection(withHan);
    } catch (err) {
      expect((err as RenderError).code).toBe('MISSING_GLYPH');
      expect((err as RenderError).message).toMatch(/U\+6F22.*header\.name/);
    }
  });

  // Poppler glues the words of Source Sans 3 at its own word spacing (space of 0.20 em): the theme widens it
  // (ADR 0017). Checked with pdftotext when Poppler is installed (POPPLER_BIN or PATH).
  it.each(THEME_FONT_IDS)(
    '%s : aucun mot collé ni coupé dans pdftotext (T-ATS-03, si Poppler est installé)',
    async (font) => {
      const poppler = await locatePoppler();
      if (poppler.status !== 'ok') return;
      const { snapshot, resolved } = personas.get('pieges')!;
      for (const layout of ['ats-classique', 'visuel'] as const) {
        const out = await renderCv(
          snapshot,
          { ...resolved, template: { layout, theme: { ...resolved.template.theme, font } } },
          { format: 'pdf' },
        );
        const report = await runAtsCheck({
          projection: out.projection,
          compiled: out.compiled,
          format: 'pdf',
          poppler,
        });
        expect(report.complete).toBe(true);
        const glued = report.criteria.find((c) => c.id === 'T-ATS-03')!;
        expect(glued.status, `${layout} : ${glued.message}`).toBe('green');
      }
      expect(projectionOf('courte', font, 'fr', 'visuel').theme.wordSpacing).toBe(font === 'source-sans-3' ? 1.25 : 1);
    },
  );

  it('une famille inconnue de Typst bloque le rendu (UNKNOWN_FONT), au lieu de faire disparaître le texte', () => {
    const p = projectionOf('courte', 'carlito', 'fr', 'ats-classique');
    expect(() => compileProjection({ ...p, theme: { ...p.theme, family: 'Police Inexistante' } })).toThrowError(
      /police du thème introuvable/,
    );
  });

  it('DOCX : Calibri déclaré, et « pagination Word différente du PDF » pour une police sans équivalent', async () => {
    const { snapshot, resolved } = personas.get('courte')!;
    for (const font of ['source-sans-3', 'ibm-plex-sans'] as const) {
      const out = await renderCv(
        snapshot,
        { ...resolved, template: { ...resolved.template, theme: { ...resolved.template.theme, font } } },
        { format: 'docx' },
      );
      const docx = Object.fromEntries(
        out.report.criteria.filter((c) => c.id.startsWith('T-DOCX')).map((c) => [c.id, c]),
      );
      expect(docx['T-DOCX-01']!.status).toBe('green');
      expect(docx['T-DOCX-01']!.message).toMatch(/police déclarée Calibri/);
      expect(docx['T-DOCX-03']!.status).toBe('orange');
      expect(docx['T-DOCX-03']!.message).toMatch(/^Pagination Word différente du PDF : police déclarée Calibri/);
    }
  }, 60_000);
});

describe('lettre avec chaque thème (F-MOD-05)', () => {
  let dir: string;
  let snapshot: Snapshot;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'cv-render-fonts-letter-'));
    await installFixture(path.join(ROOT, 'fixtures', 'personas', 'pieges'), dir);
    snapshot = await DataStore.open(dir).loadSnapshot();
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));
  const version = JSON.parse(
    readFileSync(path.join(ROOT, 'fixtures', 'letters', 'lettre-logiciel-dm-fr.json'), 'utf8'),
  ) as LetterVersionFile;

  it.each([
    ['carlito', '#1F4E79'],
    ['source-sans-3', '#7B2C3F'],
    ['ibm-plex-sans', '#0B5563'],
  ] as const)(
    '%s, accent %s : la lettre reprend la police et l’accent, 1 page, critères au vert',
    async (font, accent) => {
      for (const layout of ['ats-classique', 'visuel'] as const) {
        const p = projectLetter({
          version,
          lang: 'fr',
          enVariant: 'en-GB',
          application: { company: 'ACME Medical', jobTitle: 'Ingénieur logiciel H/F', offerReference: null },
          identity: snapshot.profile.identity,
          template: { layout, theme: { font, accent, density: 'normale' } },
          protectedTerms: snapshot.library.skills.map((s) => s.short),
          date: new Date(2026, 9, 1),
        });
        // The single letter template, whatever the layout of the CV.
        expect(p.layout).toBe('lettre');
        expect(p.theme).toMatchObject({ font, accent, family: THEME_FONTS[font].family });
        const compiled = compileLetter(p);
        expect(compiled.pages).toBe(1);
        const report = await runLetterAtsCheck({ projection: p, compiled, format: 'pdf', poppler: false });
        for (const c of report.criteria) expect(['green', 'na'], `${c.id} ${c.message}`).toContain(c.status);
        expect(report.notice).toBeUndefined();
        const embedded = (await inspectPdf(compiled.pdf)).fonts.map((f) => f.postscriptName);
        for (const name of embedded) expect(THEME_FONTS[font].postscriptNames).toContain(name);
      }
    },
  );

  it('les fichiers des polices existent tous', () => {
    for (const font of THEME_FONT_IDS)
      for (const file of THEME_FONTS[font].files) expect(existsSync(path.join(FONTS_DIR, file))).toBe(true);
  });

  it('la hauteur de capitale du registre (interligne, ADR 0020) est celle de la face normale', () => {
    for (const font of THEME_FONT_IDS) {
      const regular = fontkit.openSync(path.join(FONTS_DIR, THEME_FONTS[font].files[0]!)) as unknown as {
        capHeight: number;
        unitsPerEm: number;
      };
      expect(THEME_FONT_META[font].capHeight, font).toBeCloseTo(regular.capHeight / regular.unitsPerEm, 3);
    }
  });
});
