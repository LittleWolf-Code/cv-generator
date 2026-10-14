// ATS battery (§12.2): `npm run test:ats`. Renders the fictitious fixtures in each layout (ats-classique: every
// criterion; visuel since lot 8: the integrity criteria, F-MOD-03), CV and letter, in FR, en-GB and en-US, with
// each theme font (Carlito, Source Sans 3, IBM Plex Sans since lot 8), runs every §12.3 criterion with two
// extractors (pdf.js and Poppler pdftotext -raw) and checks the expected outcome of each fixture: courte and
// pieges readable (all green in ats-classique, integrity green and no red in visuel), debordante refused for
// its overflow; "courte" with and without the photo. en-US: US Letter page (612 × 792 pt, also in the DOCX)
// and Resume_ file names. Writes the PDF, DOCX and full reports to out/test-ats/<timestamp>/ (ignored by git).
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import {
  HUMAN_READING_NOTICE,
  sanitize,
  THEME_FONT_IDS,
  type AtsCriterion,
  type AtsReport,
  type EnVariant,
  type Lang,
  type ThemeFont,
} from '@cv/core';
import { locatePoppler, renderCv, renderLetter, resolveTarget, runAtsCheck, runLetterAtsCheck } from '@cv/render';
import { createApplication, DataStore, installFixture, readPhoto, setActiveLetter } from '@cv/store';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = path.join(ROOT, 'fixtures', 'personas');
if (existsSync(path.join(ROOT, '.env'))) process.loadEnvFile(path.join(ROOT, '.env'));
const single = process.env.ATS_SINGLE_EXTRACTOR === '1';

type Expectation = 'readable' | 'refused-overflow';
type Layout = 'ats-classique' | 'visuel';
/** Language of the document: FR, or EN in one of its variants (§5.4). */
type Variant = 'fr' | EnVariant;
const VARIANTS: Variant[] = ['fr', 'en-GB', 'en-US'];
const LAYOUTS: Layout[] = ['ats-classique', 'visuel'];
const DEFAULT_FONT: ThemeFont = 'carlito';
const OTHER_FONTS = THEME_FONT_IDS.filter((f) => f !== DEFAULT_FONT);

/** Integrity criteria (F-MOD-03): blocking in every layout. T-ATS-13 does not apply here (NF-08). */
const INTEGRITY = new Set([
  'T-ATS-01',
  'T-ATS-02',
  'T-ATS-04',
  'T-ATS-09',
  'T-ATS-10',
  'T-ATS-11',
  'T-ATS-12',
  'T-ATS-17',
]);

interface CvCase {
  fixture: string;
  expect: Expectation;
  variant: Variant;
  layout: Layout;
  font: ThemeFont;
  /** The photo option checked (§5.2): T-ATS-16 orange is then expected in ats-classique. */
  photo?: boolean;
  /** DOCX as well (T-DOCX-01 to 03): every default-font case, one case per other font and layout. */
  docx: boolean;
}

const fixtureCases = (layout: Layout, font: ThemeFont, docx: (fixture: string, v: Variant) => boolean): CvCase[] => [
  ...['courte', 'pieges'].flatMap((fixture) =>
    VARIANTS.map((variant) => ({
      fixture,
      expect: 'readable' as const,
      variant,
      layout,
      font,
      docx: docx(fixture, variant),
    })),
  ),
  ...(font === DEFAULT_FONT ? VARIANTS : (['fr'] as Variant[])).map((variant) => ({
    fixture: 'debordante',
    expect: 'refused-overflow' as const,
    variant,
    layout,
    font,
    docx: docx('debordante', variant),
  })),
];

const CASES: CvCase[] = [
  ...LAYOUTS.flatMap((layout) => [
    ...fixtureCases(layout, DEFAULT_FONT, () => true),
    {
      fixture: 'courte',
      expect: 'readable' as const,
      photo: true,
      variant: 'fr' as const,
      layout,
      font: DEFAULT_FONT,
      docx: true,
    },
  ]),
  ...OTHER_FONTS.flatMap((font) =>
    LAYOUTS.flatMap((layout) => fixtureCases(layout, font, (fixture, v) => fixture === 'courte' && v === 'fr')),
  ),
];

/**
 * Letter (lot 7, ADR 0016; themes since lot 8): the fictitious letters of fixtures/letters/ on an application
 * of each persona, in FR, en-GB and en-US, with the theme of the application (font and accent, F-MOD-05) and
 * its layout (the letter template is the same whatever the layout of the CV); « debordante » carries the
 * letter that is too long (export refused).
 */
interface LetterCase {
  fixture: string;
  expect: Expectation;
  variant: Variant;
  file: string;
  layout: Layout;
  font: ThemeFont;
  accent: string;
  docx: boolean;
}
const letterFile = (v: Variant) => (v === 'fr' ? 'lettre-logiciel-dm-fr.json' : 'letter-logiciel-dm-en.json');
const ACCENT: Record<ThemeFont, string> = {
  carlito: '#1F4E79',
  'source-sans-3': '#7B2C3F',
  'ibm-plex-sans': '#0B5563',
};
const LETTER_CASES: LetterCase[] = [
  ...THEME_FONT_IDS.flatMap((font) => [
    ...VARIANTS.flatMap((variant) =>
      ['courte', 'pieges'].map((fixture) => ({
        fixture,
        expect: 'readable' as const,
        variant,
        file: letterFile(variant),
        layout: 'ats-classique' as const,
        font,
        accent: ACCENT[font],
        docx: font === DEFAULT_FONT || (fixture === 'courte' && variant === 'fr'),
      })),
    ),
    {
      fixture: 'debordante',
      expect: 'refused-overflow' as const,
      variant: 'fr' as const,
      file: 'lettre-trop-longue-fr.json',
      layout: 'ats-classique' as const,
      font,
      accent: ACCENT[font],
      docx: font === DEFAULT_FONT,
    },
  ]),
  // The letter of an application in the visual layout: same template, same criteria.
  ...VARIANTS.map((variant) => ({
    fixture: 'courte',
    expect: 'readable' as const,
    variant,
    file: letterFile(variant),
    layout: 'visuel' as const,
    font: DEFAULT_FONT,
    accent: ACCENT[DEFAULT_FONT],
    docx: variant === 'fr',
  })),
];

/** en-US: Letter paper in the PDF (612 × 792 pt) and the DOCX (12240 × 15840 twips), Resume_ name (§5.4). */
async function paperChecks(
  variant: Variant,
  pdf: Uint8Array,
  docx: Uint8Array | null,
  fileName: string | null,
  kind: 'cv' | 'letter' = 'cv',
): Promise<string[]> {
  const failures: string[] = [];
  const letter = variant === 'en-US';
  const { width, height } = (await PDFDocument.load(pdf)).getPage(0).getSize();
  const [w, h] = letter ? [612, 792] : [595.28, 841.89];
  if (Math.abs(width - w) > 1 || Math.abs(height - h) > 1) {
    failures.push(`page ${width.toFixed(1)} × ${height.toFixed(1)} pt, attendu ${letter ? 'US Letter' : 'A4'}`);
  }
  if (docx) {
    const xml = new TextDecoder().decode(
      unzipSync(docx, { filter: (f) => f.name === 'word/document.xml' })['word/document.xml']!,
    );
    const size = /<w:pgSz [^>]*w:w="(\d+)"[^>]*w:h="(\d+)"/.exec(xml);
    const twips = letter ? ['12240', '15840'] : ['11906', '16838'];
    if (!size || size[1] !== twips[0] || size[2] !== twips[1]) {
      failures.push(`DOCX : page ${size?.[1]} × ${size?.[2]} twips, attendu ${twips.join(' × ')}`);
    }
  }
  const prefix = kind === 'letter' ? (variant === 'fr' ? 'LM_' : 'CoverLetter_') : letter ? 'Resume_' : 'CV_';
  if (!fileName?.startsWith(prefix)) failures.push(`nom de fichier ${fileName}, attendu ${prefix}…`);
  return failures;
}

const POPPLER_HELP = `pdftotext (Poppler) est introuvable. Installation sous Windows, sans droits administrateur :
  1. Télécharger https://github.com/oschwartz10612/poppler-windows/releases/download/v26.09.0-0/Release-26.09.0-0.zip
  2. Extraire l'archive, par exemple dans C:\\Outils\\poppler-26.09.0
  3. Dans le fichier .env du projet : POPPLER_BIN=C:\\Outils\\poppler-26.09.0\\Library\\bin
En attendant (PowerShell) : $env:ATS_SINGLE_EXTRACTOR=1; npm run test:ats   (rapport marqué « incomplet »)`;

const icon: Record<AtsCriterion['status'], string> = { green: 'VERT  ', orange: 'ORANGE', red: 'ROUGE ', na: 's.o.  ' };

/**
 * Expected outcome of a CV, in the column of its layout (§12.3):
 * - ats-classique, readable: every criterion green (T-ATS-16 orange with the photo);
 * - visuel, readable: integrity criteria green, T-ATS-15 and 16 not applicable, no red, the badge;
 * - refused-overflow: T-ATS-01 red, overflow counted, export refused, the other integrity criteria (and in
 *   ats-classique every other criterion) green on the measure PDF.
 */
function evaluate(report: AtsReport, c: CvCase): string[] {
  const failures: string[] = [];
  const visual = c.layout === 'visuel';
  const considered = report.criteria.filter((x) => x.status !== 'na' && x.id.startsWith('T-ATS'));
  if (visual) {
    if (report.notice?.badge !== HUMAN_READING_NOTICE) failures.push('badge « lecture humaine » absent du rapport');
    for (const id of ['T-ATS-15', 'T-ATS-16']) {
      const x = report.criteria.find((y) => y.id === id)!;
      if (x.status !== 'na') failures.push(`${id} attendu sans objet en visuel, obtenu ${x.status}`);
    }
  } else if (report.notice) {
    failures.push('badge du modèle visuel présent en ats-classique');
  }
  if (c.expect === 'readable') {
    for (const x of considered) {
      const wanted = visual
        ? INTEGRITY.has(x.id)
          ? 'green'
          : null
        : x.id === 'T-ATS-16' && c.photo
          ? 'orange'
          : 'green';
      if (wanted && x.status !== wanted) failures.push(`${x.id} attendu ${wanted}, obtenu ${x.status} : ${x.message}`);
      if (!wanted && x.status === 'red')
        failures.push(`${x.id} rouge (attendu orange au plus en visuel) : ${x.message}`);
    }
    if (report.blocking) failures.push("export bloqué alors qu'il est attendu possible");
    if (report.projection.blocking.length)
      failures.push(`blocages de projection : ${report.projection.blocking.map((b) => b.message).join(' ; ')}`);
  } else {
    const pages = report.criteria.find((x) => x.id === 'T-ATS-01')!;
    if (pages.status !== 'red') failures.push('T-ATS-01 attendu rouge (dépassement)');
    if (!(report.overflowLines > 0)) failures.push('dépassement non chiffré');
    if (!report.blocking) failures.push('export attendu refusé');
    for (const x of considered.filter((y) => y.id !== 'T-ATS-01')) {
      const strict = !visual || INTEGRITY.has(x.id);
      if (strict && x.status !== 'green')
        failures.push(`${x.id} attendu vert sur le PDF de mesure, obtenu ${x.status} : ${x.message}`);
      if (!strict && x.status === 'red') failures.push(`${x.id} rouge sur le PDF de mesure : ${x.message}`);
    }
  }
  return failures;
}

/** T-DOCX-01 and 02 green (T-DOCX-02 orange at most in visuel), T-DOCX-03 orange or green (§12.2). */
function evaluateDocx(criteria: AtsCriterion[], layout: Layout): string[] {
  const failures: string[] = [];
  for (const c of criteria) {
    if (c.id === 'T-DOCX-03') continue;
    const ok = c.status === 'green' || (layout === 'visuel' && c.id === 'T-DOCX-02' && c.status === 'orange');
    if (!ok) failures.push(`${c.id} attendu vert, obtenu ${c.status} : ${c.message}`);
  }
  return failures;
}

function printCase(
  title: string,
  details: string,
  criteria: AtsCriterion[],
  failures: string[],
  verbose: boolean,
): void {
  console.log(`\n== ${title} → ${failures.length ? 'ÉCHEC' : "CONFORME À L'ATTENDU"}`);
  console.log(`   ${details}`);
  for (const c of criteria) {
    if (verbose || c.status === 'orange' || c.status === 'red')
      console.log(`   ${icon[c.status]} ${c.id.padEnd(9)} ${c.label} : ${c.message}`);
  }
  for (const f of failures) console.log(`   !! ${f}`);
}

const expectLabel = (c: { expect: Expectation; layout: Layout; photo?: boolean }) =>
  c.expect === 'refused-overflow'
    ? 'export refusé pour dépassement'
    : c.layout === 'visuel'
      ? 'intégrité au vert, aucun rouge, badge'
      : c.photo
        ? 'tout au vert, sauf T-ATS-16 orange (photo)'
        : 'tout au vert';

async function main(): Promise<number> {
  const poppler = await locatePoppler();
  const extractorLine =
    poppler.status === 'ok'
      ? `Extracteurs : pdf.js + pdftotext (Poppler ${poppler.version ?? '?'} : ${poppler.pdftotext})`
      : `Extracteurs : pdf.js seul — pdftotext ${poppler.status === 'not-poppler' ? `ignoré (${poppler.detail})` : 'absent'}`;
  console.log(extractorLine);
  if (poppler.status !== 'ok' && !single) {
    console.error(`\n${POPPLER_HELP}`);
    return 1;
  }

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
  const outDir = path.join(ROOT, 'out', 'test-ats', stamp);
  await mkdir(outDir, { recursive: true });
  let failed = 0;
  const tally = new Map<string, { ok: number; total: number }>();
  const count = (key: string, ok: boolean) => {
    const t = tally.get(key) ?? { ok: 0, total: 0 };
    t.total++;
    if (ok) t.ok++;
    tally.set(key, t);
  };

  // §12.2 pieges: an emoji (and other refused characters) must be refused at validation.
  const refused = JSON.parse(await readFile(path.join(FIXTURES, 'pieges', 'refused-inputs.json'), 'utf8')) as {
    cases: Array<{ field: string; value: string; expected: string }>;
  };
  for (const c of refused.cases) {
    const r = sanitize(c.value);
    const ok = !r.ok && r.reason === c.expected;
    console.log(`pieges / saisie refusée (${c.expected}) : ${ok ? 'OK' : 'ÉCHEC'}`);
    if (!ok) failed++;
  }

  for (const c of CASES) {
    const lang: Lang = c.variant === 'fr' ? 'fr' : 'en';
    const name = `cv-${c.layout}-${c.font}-${c.fixture}-${c.variant}${c.photo ? '-photo' : ''}`;
    const dataDir = await mkdtemp(path.join(os.tmpdir(), `cv-ats-${c.fixture}-`));
    try {
      await installFixture(path.join(FIXTURES, c.fixture), dataDir);
      const store = DataStore.open(dataDir);
      const snapshot = await store.loadSnapshot();
      const preset = snapshot.presets.find((p) => p.isDefault) ?? snapshot.presets[0]!;
      const resolved = await resolveTarget(store, snapshot, { presetId: preset.id });
      const target = {
        ...resolved,
        enVariant: c.variant === 'fr' ? resolved.enVariant : c.variant,
        template: { layout: c.layout, theme: { ...resolved.template.theme, font: c.font } },
        // §5.3: own-section is the default of the visual layout (ADR 0017).
        options: {
          ...resolved.options,
          photo: c.photo ?? false,
          ...(c.layout === 'visuel' ? { regulatoryPlacement: 'own-section' as const } : {}),
        },
      };
      const out = await renderCv(
        snapshot,
        target,
        { format: c.docx ? 'docx' : 'pdf', lang },
        { photo: await readPhoto(store, snapshot.profile.identity) },
      );
      if (c.photo && !out.projection.photo) throw new Error(`${c.fixture} : la fixture n'a pas de photo`);
      // Re-run the PDF part with pdffonts as an extra font check (T-ATS-09, tests).
      const pdfReport = await runAtsCheck({
        projection: out.projection,
        compiled: out.compiled,
        format: 'pdf',
        withPdffonts: true,
      });
      const docxCriteria = out.report.criteria.filter((x) => x.id.startsWith('T-DOCX'));

      const base = path.join(outDir, name);
      await writeFile(`${base}.pdf`, out.compiled.pdf);
      if (out.compiled.pages > 1) await writeFile(`${base}.mesure.pdf`, out.compiled.measurePdf);
      if (out.docx) await writeFile(`${base}.docx`, out.docx);
      await writeFile(`${base}.rapport.json`, JSON.stringify({ pdf: pdfReport, docx: docxCriteria }, null, 2));

      const failures = [
        ...evaluate(pdfReport, c),
        ...(await paperChecks(c.variant, out.compiled.pdf, out.docx, out.fileName)),
        ...evaluateDocx(docxCriteria, c.layout),
      ];
      if (c.docx && c.layout === 'visuel' && !out.report.notice?.docx) failures.push('remarque du DOCX visuel absente');
      printCase(
        `${name} (attendu : ${expectLabel(c)}${c.variant === 'en-US' ? ', US Letter et Resume_' : ''})`,
        `${out.fileName ?? ''}${c.docx ? ' (+ DOCX)' : ''} ; pages ${out.compiled.pages}, remplissage ${Math.round(out.compiled.measure.fillRatio * 100)} %, dépassement ${out.compiled.measure.overflowLines} ligne(s), compilation ${out.compiled.ms.toFixed(0)} ms${pdfReport.complete ? '' : ' — rapport INCOMPLET (un seul extracteur)'}`,
        [...pdfReport.criteria, ...docxCriteria],
        failures,
        c.font === DEFAULT_FONT,
      );
      count(`CV ${c.layout} ${c.font}`, failures.length === 0);
      if (failures.length) failed++;
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  }

  for (const c of LETTER_CASES) {
    const lang: Lang = c.variant === 'fr' ? 'fr' : 'en';
    const name = `lettre-${c.layout}-${c.font}-${c.fixture}-${c.variant}`;
    const dataDir = await mkdtemp(path.join(os.tmpdir(), `cv-ats-lettre-${c.fixture}-`));
    try {
      await installFixture(path.join(FIXTURES, c.fixture), dataDir);
      const store = DataStore.open(dataDir);
      const created = await createApplication(
        store,
        {
          company: 'ACME Medical',
          jobTitle: 'Ingénieur logiciel dispositifs médicaux H/F',
          offerReference: 'ACME-1234',
          lang,
          ...(lang === 'en' ? { enVariant: c.variant as EnVariant } : {}),
          basePresetId: 'preset-defaut',
          offerText: await readFile(path.join(ROOT, 'fixtures', 'offres', 'offre-logiciel-dm.md'), 'utf8'),
        },
        { importDir: null },
      );
      const id = created.application.id;
      // The fixture is written as a version file (validated by the schema), then made active.
      const letter = JSON.parse(await readFile(path.join(ROOT, 'fixtures', 'letters', c.file), 'utf8'));
      await store.create(`applications/${id}/letters/${lang}/v1.json`, letter);
      await setActiveLetter(store, id, lang, 1);
      const loaded = await store.loadApplication(id);
      // Theme of the application (F-MOD-05): the letter takes its font and accent.
      const selection = {
        ...loaded.selection,
        template: { layout: c.layout, theme: { font: c.font, accent: c.accent, density: 'normale' as const } },
      };
      const out = await renderLetter(
        await store.loadSnapshot(),
        { application: loaded.application, selection, version: letter, lang },
        { format: c.docx ? 'docx' : 'pdf' },
      );
      const pdfReport = await runLetterAtsCheck({
        projection: out.projection,
        compiled: out.compiled,
        format: 'pdf',
        withPdffonts: true,
      });
      const docxCriteria = out.report.criteria.filter((x) => x.id.startsWith('T-DOCX'));
      const base = path.join(outDir, name);
      await writeFile(`${base}.pdf`, out.compiled.pdf);
      if (out.docx) await writeFile(`${base}.docx`, out.docx);
      await writeFile(`${base}.rapport.json`, JSON.stringify({ pdf: pdfReport, docx: docxCriteria }, null, 2));
      const failures: string[] = [];
      const pages = pdfReport.criteria.find((x) => x.id === 'T-ATS-01')!;
      const others = pdfReport.criteria.filter((x) => x.id !== 'T-ATS-01' && x.status !== 'na');
      if (out.projection.theme.font !== c.font || out.projection.theme.accent !== c.accent)
        failures.push('la lettre ne reprend pas la police et l’accent du thème de la candidature');
      if (pdfReport.notice) failures.push('badge du modèle visuel sur la lettre (gabarit unique)');
      if (c.expect === 'readable') {
        for (const x of pdfReport.criteria)
          if (x.status !== 'green' && x.status !== 'na')
            failures.push(`${x.id} attendu vert, obtenu ${x.status} : ${x.message}`);
        if (pdfReport.blocking) failures.push("export bloqué alors qu'il est attendu possible");
        failures.push(...(await paperChecks(c.variant, out.compiled.pdf, out.docx, out.fileName, 'letter')));
      } else {
        if (pages.status !== 'red') failures.push('T-ATS-01 attendu rouge (dépassement)');
        if (!(pdfReport.overflowLines > 0)) failures.push('dépassement non chiffré');
        for (const x of others)
          if (x.status !== 'green')
            failures.push(`${x.id} attendu vert sur le PDF de mesure, obtenu ${x.status} : ${x.message}`);
      }
      failures.push(...evaluateDocx(docxCriteria, 'ats-classique'));
      printCase(
        `${name} (attendu : ${c.expect === 'readable' ? 'tout au vert' : 'export refusé pour dépassement'}${c.variant === 'en-US' ? ', US Letter' : ''})`,
        `${out.fileName ?? ''}${c.docx ? ' (+ DOCX)' : ''} ; pages ${out.compiled.pages}, remplissage ${Math.round(out.compiled.measure.fillRatio * 100)} %, dépassement ${out.compiled.measure.overflowLines} ligne(s)${pdfReport.complete ? '' : ' — rapport INCOMPLET (un seul extracteur)'}`,
        [...pdfReport.criteria, ...docxCriteria],
        failures,
        c.font === DEFAULT_FONT && c.layout === 'ats-classique',
      );
      count(`Lettre ${c.layout} ${c.font}`, failures.length === 0);
      if (failures.length) failed++;
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  }

  console.log('\nRécapitulatif (cas conformes à l’attendu / cas joués) :');
  for (const [key, t] of tally) console.log(`   ${key.padEnd(36)} ${t.ok}/${t.total}`);
  console.log(`\nRapports, PDF et DOCX : ${outDir}`);
  console.log(
    failed === 0
      ? `test:ats : OK${single && poppler.status !== 'ok' ? ' (INCOMPLET : pdf.js seul, ATS_SINGLE_EXTRACTOR=1)' : ''}`
      : `test:ats : ${failed} échec(s)`,
  );
  return failed === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
