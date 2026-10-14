// Lot 8 in packages/render (F-MOD-03, §12.3 « Visuel », ADR 0017 and 0019): the visual template passes
// T-ATS-17 with the integrity profile only (the ATS templates keep every rule), renders on one page with its
// photo, writes its text in the visual order (band, sidebar, main column), refuses the overflow, and its
// report follows the « Visuel » column with the badge.
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { strFromU8, unzipSync } from 'fflate';
import { getDocumentProxy } from 'unpdf';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  HUMAN_READING_NOTICE,
  VISUAL_DOCX_NOTICE,
  type AtsCriterion,
  type Layout,
  type Options,
  type ThemeFont,
  setChecked,
  THEME_FONT_META,
} from '@cv/core';
import {
  compileProjection,
  lintLayout,
  lintProfileOf,
  lintTemplate,
  renderCv,
  RenderError,
  resolveTarget,
  templatePath,
  toVisualColumn,
  type ResolvedTarget,
} from '@cv/render';
import { DataStore, installFixture, readPhoto, type Snapshot } from '@cv/store';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const source = (layout: string) => readFileSync(templatePath(layout), 'utf8');
const rules = (src: string) => lintTemplate(src, 'visuel').map((v) => v.rule);

describe('T-ATS-17 : profils du linter (ADR 0017)', () => {
  it('le gabarit visuel passe le profil visuel, mais pas le profil ATS', () => {
    expect(lintLayout('visuel')).toEqual([]);
    const asAts = lintTemplate(source('visuel'), 'ats');
    expect(asAts.map((v) => v.rule)).toContain('forbidden-call');
    expect(asAts.some((v) => /grid\s*\(/.test(v.excerpt))).toBe(true);
    // The round photo (box, clip, radius, height) is allowed by the visual profile only.
    expect(asAts.map((v) => v.rule)).toContain('photo-content');
  });

  it('le profil dépend du nom du gabarit : ats-classique et la lettre gardent toutes les règles', () => {
    expect(lintProfileOf('ats-classique')).toBe('ats');
    expect(lintProfileOf('lettre')).toBe('ats');
    expect(lintProfileOf('ats-moderne')).toBe('ats');
    expect(lintProfileOf('visuel')).toBe('visuel');
    expect(lintLayout('ats-classique')).toEqual([]);
    expect(lintLayout('lettre')).toEqual([]);
    // The same source as the visual template, under an ATS name, is refused.
    expect(lintTemplate(source('visuel'), lintProfileOf('ats-classique')).length).toBeGreaterThan(0);
    expect(lintTemplate('#grid(columns: 2, data.a, data.b)', 'ats').map((v) => v.rule)).toEqual(['forbidden-call']);
  });

  it('le profil visuel permet grid et garde les règles d’intégrité et les garde-fous', () => {
    expect(rules('#grid(columns: (1fr, 6cm), data.a, data.b)')).toEqual([]);
    expect(rules('#table(columns: 2, data.a)')).toContain('forbidden-call');
    expect(rules('#hide(data.a)')).toContain('forbidden-call');
    expect(rules('#eval(data.a)')).toContain('forbidden-call');
    expect(rules('#text(fill: white, data.a)')).toContain('white-text');
    expect(rules('#set text(size: 8.5pt)')).toContain('small-text');
    expect(rules('Compétences')).toContain('literal-text');
    expect(rules('#heading("Compétences")')).toContain('literal-text');
    expect(rules('#place(top + right, data.a)')).toContain('place-outside-photo');
    expect(rules('#let photo(src, p) = box(clip: true, radius: 4pt, image(src, width: p.width * 1cm))')).toEqual([]);
    const round =
      '#let photo(src, p) = box(clip: true, radius: 50%, image(src, width: p.width * 1cm, height: p.width * 1cm))';
    expect(rules(round)).toEqual([]);
    expect(lintTemplate(round, 'ats').map((v) => v.rule)).toContain('photo-content');
    expect(rules('#let photo(src, p) = box(clip: true, image(src), p.name)')).toContain('photo-content');
    expect(rules('#let photo(src, p) = box(clip: true, [Photo])')).toContain('photo-content');
  });

  it('aucune image hors de photo() (ATS-08) ; le visuel permet l’icône d’un lien, seule dans link-icon() (ADR 0025)', () => {
    const icon = '#let link-icon(i) = box(baseline: 0.15em, image(data.icons.at(i.kind), height: 0.95em, alt: i.alt))';
    expect(rules(icon)).toEqual([]);
    // The ATS profile allows no icon at all, even in a function of that name.
    expect(lintTemplate(icon, 'ats').map((v) => v.rule)).toContain('image-outside-photo');
    expect(lintTemplate('#box(image(data.src))', 'ats').map((v) => v.rule)).toEqual(['image-outside-photo']);
    expect(rules('#box(image(data.icons.at(c.kind)))')).toContain('image-outside-photo');
    expect(rules('#let other(i) = image(data.icons.at(i.kind))')).toContain('image-outside-photo');
    // link-icon() holds the image only: no text, no other field, no string; the name of the link is the
    // alternative text of the image, never visible.
    expect(rules('#let link-icon(i) = box(image(data.icons.at(i.kind)), i.alt)')).toContain('icon-content');
    expect(rules('#let link-icon(i) = box(image(data.icons.at(i.kind)), i.kind)')).toContain('icon-content');
    expect(rules('#let link-icon(i) = box(image(data.icons.at(i.kind)), i.name)')).toContain('icon-content');
    expect(rules('#let link-icon(i) = box(image(data.icons.at(i.kind)), text(i.alt))')).toContain('icon-content');
    expect(rules('#let link-icon(i) = [#image(data.icons.at(i.kind)) LinkedIn]')).toContain('icon-content');
    expect(rules('#let link-icon(i) = image(data.icons.at(i.kind), alt: "logo")')).toContain('literal-text');
    expect(lintLayout('ats-classique')).toEqual([]);
  });
});

describe('colonne Visuel du §12.3', () => {
  const red = (id: string): AtsCriterion => ({ id, label: id, status: 'red', message: 'échec' });

  it('T-ATS-05 à 08 passent à l’orange, l’intégrité reste rouge, T-ATS-15 et 16 sont sans objet', () => {
    for (const id of ['T-ATS-05', 'T-ATS-06', 'T-ATS-07', 'T-ATS-08'])
      expect(toVisualColumn(red(id)).status).toBe('orange');
    for (const id of [
      'T-ATS-01',
      'T-ATS-02',
      'T-ATS-03',
      'T-ATS-04',
      'T-ATS-09',
      'T-ATS-10',
      'T-ATS-11',
      'T-ATS-12',
      'T-ATS-13',
      'T-ATS-17',
    ])
      expect(toVisualColumn(red(id)).status).toBe('red');
    expect(toVisualColumn({ ...red('T-ATS-15'), status: 'orange' }).status).toBe('na');
    expect(toVisualColumn({ ...red('T-ATS-16'), status: 'orange' }).status).toBe('na');
  });
});

describe('rendu du modèle visuel', () => {
  const dirs: string[] = [];
  const setups = new Map<string, { snapshot: Snapshot; resolved: ResolvedTarget; photo: Uint8Array | null }>();
  beforeAll(async () => {
    for (const persona of ['courte', 'debordante', 'pieges']) {
      const dir = await mkdtemp(path.join(os.tmpdir(), `cv-render-visual-${persona}-`));
      dirs.push(dir);
      await installFixture(path.join(ROOT, 'fixtures', 'personas', persona), dir);
      const store = DataStore.open(dir);
      const snapshot = await store.loadSnapshot();
      const preset = snapshot.presets.find((p) => p.isDefault)!;
      setups.set(persona, {
        snapshot,
        resolved: await resolveTarget(store, snapshot, { presetId: preset.id }),
        photo: await readPhoto(store, snapshot.profile.identity),
      });
    }
  });
  afterAll(async () => {
    for (const d of dirs) await rm(d, { recursive: true, force: true });
  });

  const visual = (
    persona: string,
    options: Partial<Options> = {},
    format: 'pdf' | 'docx' = 'pdf',
    layout?: Layout,
    font?: ThemeFont,
  ) => {
    const s = setups.get(persona)!;
    const target = layout
      ? {
          ...s.resolved,
          template: { ...s.resolved.template, theme: { ...s.resolved.template.theme, ...(font ? { font } : {}) } },
          options: { ...s.resolved.options, ...options },
        }
      : {
          ...s.resolved,
          template: {
            ...s.resolved.template,
            layout: 'visuel' as const,
            theme: { ...s.resolved.template.theme, ...(font ? { font } : {}) },
          },
          options: { ...s.resolved.options, regulatoryPlacement: 'own-section' as const, ...options },
        };
    return renderCv(s.snapshot, target, { format, ...(layout ? { layout } : {}) }, { photo: s.photo });
  };
  const status = (criteria: AtsCriterion[]) => Object.fromEntries(criteria.map((c) => [c.id, c.status]));

  /** Text of page 1 (pdf.js) as lines: baseline from the top, left and right edges, size, text. */
  const pageLines = async (pdf: Uint8Array) => {
    const doc = await getDocumentProxy(pdf.slice());
    try {
      const page = await doc.getPage(1);
      const H = page.view[3]!;
      const tc = await page.getTextContent();
      const items = (tc.items as Array<{ str: string; transform: number[]; width: number }>)
        .filter((i) => i.str.trim())
        .map((i) => ({
          str: i.str,
          x: i.transform[4]!,
          right: i.transform[4]! + i.width,
          y: H - i.transform[5]!,
          size: Math.hypot(i.transform[2]!, i.transform[3]!),
        }));
      const tree = await page.getStructTree();
      return { items, tree };
    } finally {
      await (doc as unknown as { loadingTask: { destroy(): Promise<void> } }).loadingTask.destroy();
    }
  };

  it('courte avec photo : 1 page, photo intégrée, intégrité au vert, mise en page en orange au plus, badge', async () => {
    const out = await visual('courte', { photo: true });
    expect(out.projection.layout).toBe('visuel');
    expect(out.compiled.pages).toBe(1);
    expect(out.photo).not.toBeNull();
    // Typst copies the JPEG as is: the photo bytes are in the PDF.
    expect(Buffer.from(out.compiled.pdf).indexOf(Buffer.from(out.photo!))).toBeGreaterThan(0);
    const s = status(out.report.criteria);
    for (const id of [
      'T-ATS-01',
      'T-ATS-02',
      'T-ATS-03',
      'T-ATS-04',
      'T-ATS-09',
      'T-ATS-10',
      'T-ATS-11',
      'T-ATS-12',
      'T-ATS-17',
    ])
      expect(s[id], id).toBe('green');
    expect(s['T-ATS-13']).toBe('na');
    expect(s['T-ATS-15']).toBe('na');
    expect(s['T-ATS-16']).toBe('na');
    // The sidebar sections come before the main column in the text: the order of the headings differs.
    expect(s['T-ATS-06']).toBe('orange');
    expect(out.report.criteria.every((c) => c.status !== 'red')).toBe(true);
    expect(out.report.blocking).toBe(false);
    expect(out.report.notice).toEqual({ badge: HUMAN_READING_NOTICE, docx: null });
    expect(out.report.criteria.find((c) => c.id === 'T-ATS-17')!.label).toBe('Gabarit conforme (intégrité)');
    // Text order (ADR 0019): the band (name, title), the sidebar (contacts first: T-ATS-08 green, then its
    // sections), then the main column, as the page reads from left to right.
    const lines = out.report.text.pdfjs.split('\n').filter((l) => l.trim());
    expect(lines[0]).toBe('Camille Martin');
    expect(lines[1]).toBe('Ingénieure logiciel dispositifs médicaux');
    expect(s['T-ATS-08']).toBe('green');
    const at = (h: string) => lines.findIndex((l) => l.trim() === h);
    const contact = lines.findIndex((l) => l.includes('camille.martin@example.com'));
    expect(contact).toBeGreaterThan(1);
    expect(contact).toBeLessThan(at('Compétences'));
    expect(at('Compétences')).toBeLessThan(at('Normes et réglementation'));
    expect(at('Normes et réglementation')).toBeLessThan(at('Langues'));
    expect(at("Centres d'intérêt")).toBeLessThan(at('Expérience professionnelle'));
    expect(at('Expérience professionnelle')).toBeLessThan(at('Formation'));
  });

  it('icône – lien (ADR 0025) : l’icône avant l’URL, son nom dans les balises du PDF, l’URL seule dans le texte', async () => {
    const out = await visual('courte');
    expect(out.projection.header.contacts.find((c) => c.kind === 'link')!.icon).toEqual({
      kind: 'linkedin',
      alt: 'LinkedIn',
    });
    expect(out.report.criteria.every((c) => c.status !== 'red')).toBe(true);
    const { items, tree } = await pageLines(out.compiled.pdf);
    const url = items.find((i) => i.str.trim() === 'linkedin.com/in/camille-martin-fictif')!;
    const email = items.find((i) => i.str.trim() === 'camille.martin@example.com')!;
    // The icon takes the left edge of the column, the URL starts after it, on the same line.
    expect(url.x).toBeGreaterThan(email.x + 8);
    const alts: string[] = [];
    const walk = (n: unknown) => {
      const node = n as { alt?: string; children?: unknown[] };
      if (node?.alt) alts.push(node.alt);
      for (const c of node?.children ?? []) walk(c);
    };
    walk(tree);
    expect(alts).toContain('LinkedIn');
    // No icon in the ATS layout (ATS-08), nor in the DOCX (T-DOCX-01: the photo is the only drawing).
    const ats = await visual('courte', {}, 'pdf', 'ats-classique');
    expect(ats.projection.header.contacts.every((c) => c.icon === null)).toBe(true);
    const docx = await visual('courte', {}, 'docx');
    expect(strFromU8(unzipSync(docx.docx!)['word/document.xml']!)).not.toContain('<w:drawing');
  });

  it.each(['visuel', 'ats-classique'] as const)(
    '%s : les dépôts d’un projet (ADR 0027) en clair, chacun cliquable, sans ligne qui commence par une virgule',
    async (layout) => {
      const s = setups.get('courte')!;
      const selection = structuredClone(s.resolved.selection);
      setChecked(selection, { section: 'projects', itemId: 'prj-tracabilite', bulletIds: [] }, true);
      const target = {
        ...s.resolved,
        selection,
        template: { ...s.resolved.template, layout },
        options: {
          ...s.resolved.options,
          ...(layout === 'visuel' ? { regulatoryPlacement: 'own-section' as const } : {}),
        },
      };
      const out = await renderCv(s.snapshot, target, { format: 'pdf', layout }, { photo: null });
      expect(out.compiled.pages).toBe(1);
      const s2 = status(out.report.criteria);
      expect(Object.values(s2)).not.toContain('red');
      const urls = [
        'camille-martin-fictif.github.io/tracabilite',
        'github.com/camille-martin-fictif/tracabilite',
        'github.com/camille-martin-fictif/tracabilite-cli',
      ];
      // Each URL whole, on one line (non-breaking block), in the extracted text.
      const lines = out.report.text.pdfjs.split('\n').map((l) => l.trim());
      for (const u of urls)
        expect(
          lines.some((l) => l.split(/,\s*|\s+/).includes(u)),
          u,
        ).toBe(true);
      const { items } = await pageLines(out.compiled.pdf);
      // pdf.js cuts the text after each block: a comma always follows a fragment of its own line.
      const commas = items.filter((i) => /^,/.test(i.str.trim()));
      expect(commas.length).toBeGreaterThan(1);
      for (const c of commas) {
        expect(
          items.some((i) => i !== c && Math.abs(i.y - c.y) < 1 && Math.abs(i.right - c.x) < 1.5),
          `${c.str} (${c.x}, ${c.y})`,
        ).toBe(true);
      }
      // One link annotation per URL, to its own target.
      const doc = await getDocumentProxy(out.compiled.pdf.slice());
      try {
        const annots = (await (await doc.getPage(1)).getAnnotations()) as Array<{ subtype: string; url?: string }>;
        const targets = annots.filter((a) => a.subtype === 'Link').map((a) => a.url);
        expect(targets).toEqual(
          expect.arrayContaining([
            'https://camille-martin-fictif.github.io/tracabilite/',
            'https://github.com/camille-martin-fictif/tracabilite',
            'https://github.com/camille-martin-fictif/tracabilite-cli',
          ]),
        );
      } finally {
        await (doc as unknown as { loadingTask: { destroy(): Promise<void> } }).loadingTask.destroy();
      }
    },
  );

  it('une coordonnée plus large que la colonne est réduite pour tenir sur une ligne (IBM Plex Sans)', async () => {
    const out = await visual('courte', {}, 'pdf', undefined, 'ibm-plex-sans');
    const lines = out.report.text.pdfjs.split('\n').map((l) => l.trim());
    expect(lines).toContain('linkedin.com/in/camille-martin-fictif');
    const s = status(out.report.criteria);
    expect(s['T-ATS-03']).toBe('green');
    // Never below 9 pt (§8.5).
    expect(s['T-ATS-10']).toBe('green');
  });

  describe('propriétés de design (batterie T-DES, ADR 0020)', () => {
    const cap = THEME_FONT_META.carlito.capHeight;

    it.each(['visuel', 'ats-classique'] as const)(
      '%s : les dates gardent le même bord droit, même seules sur la ligne suivant l’intitulé',
      async (layout) => {
        const out =
          layout === 'visuel'
            ? await visual('pieges', {}, 'pdf', undefined, 'ibm-plex-sans')
            : await visual('pieges', {}, 'pdf', 'ats-classique', 'ibm-plex-sans');
        const { items } = await pageLines(out.compiled.pdf);
        const rights = out.projection.datedEntries.map(
          (e) => items.find((i) => i.str.length > 4 && e.dates.startsWith(i.str.trim()))!.right,
        );
        expect(rights.length).toBeGreaterThan(1);
        expect(Math.max(...rights) - Math.min(...rights)).toBeLessThan(0.5);
        // No line starts with a separator (dash, « | » between the contacts of ats-classique).
        const left = Math.min(...items.map((i) => i.x));
        expect(items.filter((i) => i.x < left + 1 && /^[|–-]/.test(i.str.trim()))).toEqual([]);
      },
    );

    it('échelle verticale : entrées détachées, intertitres rattachés à ce qui suit', async () => {
      const out = await visual('courte', { photo: true });
      const { items } = await pageLines(out.compiled.pdf);
      const body = out.projection.theme.bodySize;
      const at = (start: string) => items.find((i) => i.str.startsWith(start))!;
      const capTop = (i: { y: number; size: number }) => i.y - cap * i.size;
      // Blank between two lines of a bullet, between two entries, above and below a heading.
      const first = at('Mise en conformité');
      const second = items.find((i) => i.y > first.y + 1 && Math.abs(i.x - first.x) < 0.5)!;
      const line = capTop(second) - first.y;
      const lastOfFirst = items.filter((i) => i.y < at('Développeuse logiciel').y - 1 && i.x > first.x - 20);
      const entry = capTop(at('Développeuse logiciel')) - Math.max(...lastOfFirst.map((i) => i.y));
      expect(entry).toBeGreaterThanOrEqual(1.5 * line - 0.05);
      const heading = at('Formation');
      const before = items.filter((i) => i.y < heading.y - 1 && i.x >= heading.x - 1);
      const after = items.filter((i) => i.y > heading.y + 1 && i.x >= heading.x - 1);
      const above = capTop(heading) - Math.max(...before.map((i) => i.y));
      const below = Math.min(...after.map((i) => capTop(i))) - heading.y;
      expect(above / below).toBeGreaterThanOrEqual(1.8);
      // Line pitch of 1.25 times the body size.
      expect((second.y - first.y) / body).toBeCloseTo(1.25, 2);
    });

    it('alignements : puces sur le bord du texte, nom sur le texte principal, intertitres sur leur colonne', async () => {
      const out = await visual('courte', { photo: true });
      const { items } = await pageLines(out.compiled.pdf);
      const at = (start: string) => items.find((i) => i.str.startsWith(start))!;
      const mainEdge = at('Ingénieure logiciel embarqué').x;
      const sideEdge = at('camille.martin@example.com').x;
      for (const b of items.filter((i) => i.str === '•'))
        expect(Math.min(Math.abs(b.x - mainEdge), Math.abs(b.x - sideEdge))).toBeLessThan(0.5);
      expect(at('Camille Martin').x).toBeCloseTo(mainEdge, 0);
      expect(at('Formation').x).toBeCloseTo(mainEdge, 0);
      expect(at('Compétences').x).toBeCloseTo(sideEdge, 0);
    });

    it('aucune ligne creuse : « systématique » ne finit pas seule une puce', async () => {
      const out = await visual('courte', { photo: true });
      const { items } = await pageLines(out.compiled.pdf);
      const word = items.find((i) => i.str.includes('systématique'))!;
      const sameLine = items.filter((i) => Math.abs(i.y - word.y) < 0.5 && i.x < word.x + 200 && i.x > word.x - 300);
      expect(
        sameLine
          .map((i) => i.str)
          .join(' ')
          .trim()
          .split(/\s+/).length,
      ).toBeGreaterThan(1);
    });

    it('la photo porte son texte de remplacement dans les balises du PDF', async () => {
      const out = await visual('courte', { photo: true });
      const { tree } = await pageLines(out.compiled.pdf);
      const alts: string[] = [];
      const walk = (n: unknown) => {
        const node = n as { alt?: string; children?: unknown[] };
        if (node?.alt) alts.push(node.alt);
        for (const c of node?.children ?? []) walk(c);
      };
      walk(tree);
      expect(alts).toContain('Photo de Camille Martin');
    });
  });

  it('sans photo : 1 page, aucune image', async () => {
    const out = await visual('courte', { photo: false });
    expect(out.compiled.pages).toBe(1);
    expect(out.photo).toBeNull();
    expect(strFromU8(out.compiled.pdf, true)).not.toMatch(/\/Subtype\s*\/Image/);
  });

  it('debordante : export refusé, dépassement chiffré, autres critères d’intégrité verts sur le PDF de mesure', async () => {
    const out = await visual('debordante');
    expect(out.compiled.pages).toBeGreaterThan(1);
    const s = status(out.report.criteria);
    expect(s['T-ATS-01']).toBe('red');
    expect(out.report.blocking).toBe(true);
    expect(out.report.overflowLines).toBeGreaterThan(0);
    for (const id of ['T-ATS-02', 'T-ATS-03', 'T-ATS-04', 'T-ATS-09', 'T-ATS-10', 'T-ATS-11', 'T-ATS-12', 'T-ATS-17'])
      expect(s[id], id).toBe('green');
  });

  it('DOCX du visuel : une colonne (T-DOCX-01 vert), avec sa remarque', async () => {
    const out = await visual('courte', {}, 'docx');
    const doc = strFromU8(unzipSync(out.docx!)['word/document.xml']!);
    expect(doc).not.toContain('<w:tbl');
    const s = status(out.report.criteria);
    expect(s['T-DOCX-01']).toBe('green');
    expect(s['T-DOCX-02']).not.toBe('red');
    expect(out.report.notice).toEqual({ badge: HUMAN_READING_NOTICE, docx: VISUAL_DOCX_NOTICE });
  });

  it('un modèle forcé par la requête prend les réglages du visuel (normes en section dédiée)', async () => {
    const out = await visual('courte', {}, 'pdf', 'visuel');
    expect(out.projection.layout).toBe('visuel');
    expect(out.projection.regulatoryPlacement).toBe('own-section');
    expect(out.projection.sections.find((x) => x.key === 'regulatory')?.side).toBe(true);
    // The preset itself is untouched.
    expect(setups.get('courte')!.resolved.options.regulatoryPlacement).toBe('skills-subgroup');
  });

  it('ats-moderne reste refusé (V2)', async () => {
    const out = visual('courte', {}, 'pdf', 'ats-moderne');
    await expect(out).rejects.toThrowError(RenderError);
    await expect(out).rejects.toMatchObject({ code: 'UNSUPPORTED_LAYOUT' });
    const p = (await visual('courte')).projection;
    expect(() => compileProjection({ ...p, layout: 'ats-moderne' })).toThrowError(/prévue en V2/);
  });
});
