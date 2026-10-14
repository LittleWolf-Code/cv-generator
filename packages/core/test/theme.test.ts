// Lot 8 in packages/core (F-MOD-01 to 03, NF-10, §5.3, ADR 0017): theme schema (fonts, accent contrast
// with its ratio), swatches, sidebar tint, switching layouts, sections of the visual sidebar.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ACCENT_SWATCHES,
  accentProblem,
  applyLayout,
  contrastBetween,
  contrastOnWhite,
  formatRatio,
  isAtsLayout,
  lowerFirst,
  MUTED_TEXT,
  presetFile,
  project,
  projectionTheme,
  select,
  sidebarTint,
  THEME_FONT_IDS,
  THEME_FONT_META,
  type PresetFile,
  type Projection,
} from '@cv/core';
import type { Snapshot } from '@cv/store';
import { loadPersona } from './helpers.js';

let snapshot: Snapshot;
let preset: PresetFile;
let cleanup: () => Promise<void>;
beforeAll(async () => {
  const p = await loadPersona('courte');
  snapshot = p.snapshot;
  cleanup = p.cleanup;
  preset = snapshot.presets[0]!;
});
afterAll(() => cleanup());

const withTheme = (theme: Record<string, unknown>) => ({
  ...preset,
  template: { ...preset.template, theme: { ...preset.template.theme, ...theme } },
});

describe('thème du schéma (F-MOD-01, NF-10)', () => {
  it('refuse un accent sous 4,5:1 sur blanc, avec le ratio obtenu', () => {
    const r = presetFile.safeParse(withTheme({ accent: '#AAAAAA' }));
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]!.message).toBe(
      'contraste de 2,3:1 sur blanc, insuffisant (minimum 4,5:1) : choisissez une couleur plus foncée',
    );
    expect(r.error!.issues[0]!.path).toEqual(['template', 'theme', 'accent']);
    // 4.48:1 is refused (the ratio is rounded down, never shown as 4,5:1); 4.54:1 is accepted.
    expect(contrastOnWhite('#777777')).toBeLessThan(4.5);
    expect(accentProblem('#777777')).toMatch(/^contraste de 4,4:1/);
    expect(contrastOnWhite('#767676')).toBeGreaterThanOrEqual(4.5);
    expect(presetFile.safeParse(withTheme({ accent: '#767676' })).success).toBe(true);
    expect(accentProblem('#12345')).toBe('couleur #RRGGBB attendue');
  });

  it('refuse une police hors du thème, accepte les trois polices fournies', () => {
    expect(presetFile.safeParse(withTheme({ font: 'arial' })).success).toBe(false);
    expect(presetFile.safeParse(withTheme({ font: 'Carlito' })).success).toBe(false);
    expect(THEME_FONT_IDS).toEqual(['carlito', 'source-sans-3', 'ibm-plex-sans']);
    for (const font of THEME_FONT_IDS) expect(presetFile.safeParse(withTheme({ font })).success).toBe(true);
    expect(THEME_FONT_META.carlito.metricEquivalent).toBe('Calibri');
    expect(THEME_FONT_META['source-sans-3'].metricEquivalent).toBeNull();
    expect(THEME_FONT_META['ibm-plex-sans'].family).toBe('IBM Plex Sans');
  });

  it('propose des pastilles toutes au-dessus de 7:1, et une teinte de colonne lisible', () => {
    for (const s of ACCENT_SWATCHES) {
      expect(contrastOnWhite(s.hex), s.name).toBeGreaterThanOrEqual(7);
      const tint = sidebarTint(s.hex)!;
      expect(tint, s.name).toMatch(/^#[0-9A-F]{6}$/);
      expect(contrastBetween(s.hex, tint)).toBeGreaterThanOrEqual(4.5);
      expect(contrastBetween(MUTED_TEXT, tint)).toBeGreaterThanOrEqual(4.5);
    }
    // An accent at the limit loses its tint rather than its contrast (ATS-14).
    expect(sidebarTint('#767676')).toBeNull();
    expect(contrastOnWhite(MUTED_TEXT)).toBeGreaterThanOrEqual(4.5);
    expect(formatRatio(4.4999)).toBe('4,4:1');
  });

  it('projette la police, l’accent, la teinte et la couleur secondaire du thème', () => {
    const t = projectionTheme({
      layout: 'visuel',
      theme: { font: 'source-sans-3', accent: '#7B2C3F', density: 'compacte' },
    });
    expect(t).toMatchObject({
      family: 'Source Sans 3',
      accent: '#7B2C3F',
      muted: MUTED_TEXT,
      bodySize: 10,
      margin: 1.5,
    });
    expect(t.tint).toBe(sidebarTint('#7B2C3F'));
  });

  it('règle l’interligne par police pour un pas de 1,25 (normale) ou 1,20 (compacte) fois le corps (ADR 0020)', () => {
    for (const font of THEME_FONT_IDS)
      for (const [density, pitch] of [
        ['normale', 1.25],
        ['compacte', 1.2],
      ] as const) {
        const t = projectionTheme({ layout: 'ats-classique', theme: { font, accent: '#1F4E79', density } });
        expect(t.leading + THEME_FONT_META[font].capHeight, `${font} ${density}`).toBeCloseTo(pitch, 3);
        // Vertical scale: entries at least 1.5 times the blank between two lines, sections above that.
        expect(t.entryGap, `${font} ${density}`).toBeGreaterThanOrEqual(1.5 * t.leading * t.bodySize - 0.05);
        expect(t.sectionGap).toBeGreaterThan(t.entryGap * 1.5);
        expect(t.linebreaks).toBe('optimized');
      }
  });
});

describe('passage d’un modèle à l’autre (§5.3, ADR 0017)', () => {
  const draft = () => structuredClone(preset);

  it('le visuel met les normes en section dédiée et suggère la photo sans la cocher', () => {
    const p = draft();
    expect(p.options.regulatoryPlacement).toBe('skills-subgroup');
    const change = applyLayout(p, 'visuel', true);
    expect(p.template.layout).toBe('visuel');
    expect(p.options.regulatoryPlacement).toBe('own-section');
    expect(p.options.photo).toBe(false);
    expect(change).toEqual({ regulatoryPlacement: 'own-section', suggestPhoto: true });
    // Without a photo in the identity, nothing to suggest.
    const q = draft();
    expect(applyLayout(q, 'visuel', false).suggestPhoto).toBe(false);
  });

  it('le retour en ATS rétablit la ligne dans Compétences ; rien ne change sans changement de modèle', () => {
    const p = draft();
    applyLayout(p, 'visuel');
    expect(applyLayout(p, 'visuel')).toEqual({ regulatoryPlacement: null, suggestPhoto: false });
    expect(applyLayout(p, 'ats-classique')).toEqual({ regulatoryPlacement: 'skills-subgroup', suggestPhoto: false });
    expect(p.options.regulatoryPlacement).toBe('skills-subgroup');
    // A choice already in place is kept and not announced.
    const q = draft();
    q.options.regulatoryPlacement = 'own-section';
    expect(applyLayout(q, 'visuel').regulatoryPlacement).toBeNull();
    expect(isAtsLayout('ats-classique') && isAtsLayout('ats-moderne') && !isAtsLayout('visuel')).toBe(true);
    expect(lowerFirst('Destiné aux portails ATS')).toBe('destiné aux portails ATS');
  });
});

describe('colonnes du modèle visuel (projection)', () => {
  const projectWith = (layout: 'ats-classique' | 'visuel'): Projection =>
    project(select(snapshot.library, preset.selection), {
      lang: 'fr',
      enVariant: 'en-GB',
      options: { ...preset.options, regulatoryPlacement: 'own-section' },
      template: { ...preset.template, layout },
      identity: snapshot.profile.identity,
    });

  it('range Compétences, Normes, Langues, Certifications et Centres d’intérêt à gauche, sans changer l’ordre', () => {
    const visual = projectWith('visuel');
    const side = visual.sections.filter((s) => s.side).map((s) => s.key);
    const main = visual.sections.filter((s) => !s.side).map((s) => s.key);
    expect(main).toEqual(['experience', 'education']);
    expect(side).toEqual(['skills', 'regulatory', 'languages', 'interests']);
    // T-ATS-06 compares with the order of the selection, which the visual layout keeps.
    expect(visual.headings).toEqual(projectWith('ats-classique').headings);
    expect(projectWith('ats-classique').sections.every((s) => !s.side)).toBe(true);
  });
});
