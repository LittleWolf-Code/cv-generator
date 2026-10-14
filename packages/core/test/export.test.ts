// Lot 3 in packages/core: normalized extracted text (F-ATS-01), reasons of a blocked export with their
// fix (F-EXP-03, F-UI-06), photo unchecked when switching to English (§5.4), projected photo (§5.2).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  applyLanguage,
  exportBlockers,
  fixOfPath,
  normalizeExtracted,
  project,
  select,
  type AtsCriterion,
  type AtsReport,
  type ProjectionIssue,
} from '@cv/core';
import { loadPersona } from './helpers.js';

const crit = (id: string, status: AtsCriterion['status'], message = 'm', details?: Record<string, unknown>) =>
  details ? { id, label: id, status, message, details } : { id, label: id, status, message };

function report(criteria: AtsCriterion[], blocking: ProjectionIssue[] = [], lang = 'fr') {
  return { criteria, projection: { blocking, warnings: [] }, lang } satisfies Pick<
    AtsReport,
    'criteria' | 'projection' | 'lang'
  >;
}

describe('version normalisée du texte extrait (F-ATS-01)', () => {
  it('garde les accents et la casse, unifie apostrophes et tirets, retire les invisibles et les lignes vides', () => {
    const raw = 'Ingénieure  « Qualité »\u00A0:\u202Fd\u2019équipe\n\n   \uFB01chier\u200B ISO\u201113485 \t \n';
    expect(normalizeExtracted(raw)).toBe("Ingénieure « Qualité » : d'équipe\nfichier ISO-13485");
  });
});

describe("motifs de blocage de l'export (F-EXP-03, F-UI-06)", () => {
  it('ne renvoie rien quand aucun critère n\u2019est rouge', () => {
    expect(exportBlockers(report([crit('T-ATS-01', 'green'), crit('T-ATS-16', 'orange')]), 'normale')).toEqual([]);
  });

  it('place le dépassement en premier, avec la densité compacte comme correctif tant qu\u2019elle n\u2019est pas active', () => {
    const r = report([crit('T-ATS-05', 'red'), crit('T-ATS-01', 'red', 'Le CV dépasse d\u2019environ 4 lignes')]);
    const normal = exportBlockers(r, 'normale');
    expect(normal[0]).toMatchObject({ code: 'T-ATS-01', fix: { kind: 'density' } });
    expect(normal[1]).toMatchObject({ code: 'T-ATS-05', fix: { kind: 'ats-view' } });
    expect(exportBlockers(r, 'compacte')[0]!.fix).toBeNull();
  });

  it('regroupe les champs non traduits et ouvre le premier élément concerné', () => {
    const untranslated = (itemId: string, bulletId?: string): ProjectionIssue => ({
      code: 'UNTRANSLATED',
      message: `non traduit (EN) : experiences/${itemId}`,
      target: { collection: 'experiences', itemId, field: 'text', ...(bulletId ? { bulletId } : {}) },
    });
    const b = exportBlockers(
      report([], [untranslated('exp-a', 'b-1'), untranslated('exp-b')], 'en (en-GB)'),
      'normale',
    );
    expect(b).toHaveLength(1);
    expect(b[0]!.message).toMatch(/^2 champs affichés non traduits en anglais : traduisez-les/);
    expect(b[0]!.fix).toEqual({ kind: 'open', collection: 'experiences', itemId: 'exp-a', bulletId: 'b-1' });
  });

  it('signale une langue sans niveau CECRL et ouvre cette langue', () => {
    const b = exportBlockers(
      report(
        [],
        [
          {
            code: 'LANGUAGE_LEVEL_MISSING',
            message: 'niveau CECRL à préciser : Allemand',
            target: { collection: 'languages', itemId: 'lang-de', field: 'cefr' },
          },
        ],
      ),
      'normale',
    );
    expect(b[0]!.message).toBe(
      'Niveau CECRL à préciser : Allemand : choisissez un niveau de A1 à C2, ou « langue maternelle »',
    );
    expect(b[0]!.fix).toEqual({ kind: 'open', collection: 'languages', itemId: 'lang-de' });
  });

  it("renvoie vers l'identité (identité absente, coordonnées rouges) et vers l'élément d'un texte manquant", () => {
    const b = exportBlockers(
      report(
        [
          crit('T-ATS-08', 'red', 'Non retrouvé(s)'),
          crit('T-ATS-02', 'red', '1 texte attendu absent', {
            missing: [{ extractor: 'pdf.js', path: 'experience.exp-a.b-2' }],
          }),
        ],
        [{ code: 'IDENTITY_MISSING', message: 'identité absente : renseignez le profil' }],
      ),
      'normale',
    );
    expect(b.map((x) => x.fix)).toEqual([
      { kind: 'identity' },
      { kind: 'identity' },
      { kind: 'open', collection: 'experiences', itemId: 'exp-a', bulletId: 'b-2' },
    ]);
    expect(b[1]!.message).toMatch(/complétez l'identité/);
  });

  it('associe un chemin de texte attendu à son élément', () => {
    expect(fixOfPath('header.contacts[1]')).toEqual({ kind: 'identity' });
    expect(fixOfPath('education.edu-a.title')).toEqual({ kind: 'open', collection: 'education', itemId: 'edu-a' });
    expect(fixOfPath('skills.lines[0].items[1]')).toBeNull();
  });
});

describe('langue du document et photo (§5.4)', () => {
  it("décoche la photo en passant du français à l'anglais, et elle reste recochable", () => {
    const p = { lang: 'fr' as 'fr' | 'en', enVariant: 'en-GB' as 'en-GB' | 'en-US', options: { photo: true } };
    expect(applyLanguage(p, 'en-US')).toBe(true);
    expect(p).toEqual({ lang: 'en', enVariant: 'en-US', options: { photo: false } });
    p.options.photo = true;
    expect(applyLanguage(p, 'en-GB')).toBe(false);
    expect(p.options.photo).toBe(true);
    expect(applyLanguage(p, 'fr')).toBe(false);
    expect(p).toMatchObject({ lang: 'fr', options: { photo: true } });
  });
});

describe('photo projetée (§5.2)', () => {
  let persona: Awaited<ReturnType<typeof loadPersona>>;
  beforeAll(async () => {
    persona = await loadPersona('courte');
  });
  afterAll(() => persona.cleanup());

  const projectWith = (photo: boolean, density: 'normale' | 'compacte', withIdentityPhoto = true) => {
    const preset = persona.snapshot.presets[0]!;
    const identity = persona.snapshot.profile.identity!;
    return project(select(persona.snapshot.library, preset.selection), {
      lang: 'fr',
      enVariant: 'en-GB',
      options: { ...preset.options, photo },
      template: { ...preset.template, theme: { ...preset.template.theme, density } },
      identity: withIdentityPhoto ? identity : { ...identity, photo: null },
    });
  };

  it("n'existe que si l'option est cochée et que l'identité a une photo, à la taille de la densité", () => {
    expect(projectWith(false, 'normale').photo).toBeNull();
    // The alternative text goes to the PDF tags only (ADR 0020).
    expect(projectWith(true, 'normale').photo).toEqual({ width: 2.4, gap: 0.5, alt: 'Photo de Camille Martin' });
    expect(projectWith(true, 'compacte').photo).toEqual({ width: 2.1, gap: 0.4, alt: 'Photo de Camille Martin' });
  });

  it("signale une photo cochée sans photo dans l'identité, sans bloquer l'export", () => {
    const p = projectWith(true, 'normale', false);
    expect(p.photo).toBeNull();
    expect(p.warnings.map((w) => w.code)).toContain('PHOTO_MISSING');
    expect(p.blocking).toEqual([]);
  });
});
