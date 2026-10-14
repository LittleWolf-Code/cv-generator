import { describe, expect, it } from 'vitest';
import {
  cvFileName,
  cvDocumentTitle,
  fileNamePart,
  isWindowsReservedName,
  proposeFileLabel,
  stripGenderMarkers,
} from '@cv/core';

describe('nommage des fichiers (F-EXP-04, annexe B.4)', () => {
  it('translittère « Cœur Lætitia Strauß »', () => {
    expect(fileNamePart('Cœur Lætitia Strauß')).toBe('Coeur-Laetitia-Strauss');
    expect(fileNamePart('Øystein Łukasz Élodie')).toBe('Oystein-Lukasz-Elodie');
  });

  it.each([
    ['Ingénieur logiciel dispositifs médicaux H/F', 'Ingénieur logiciel dispositifs médicaux'],
    ['Développeur backend (F/H)', 'Développeur backend'],
    ['Data engineer - H/F/X', 'Data engineer'],
    ['Ingénieur qualité F/H/NB', 'Ingénieur qualité'],
    ['Software Engineer (m/w/d)', 'Software Engineer'],
    ['Technicien M/F', 'Technicien'],
  ])('retire les marqueurs de genre : %s', (input, expected) => {
    expect(stripGenderMarkers(input)).toBe(expected);
  });

  it('remplace les caractères réservés de Windows', () => {
    expect(fileNamePart('R&D: QA/RA <senior>?*|"')).toBe('R-D-QA-RA-senior');
  });

  it('refuse les noms réservés de Windows', () => {
    for (const n of ['CON', 'nul', 'COM1', 'LPT9', 'aux.txt']) expect(isWindowsReservedName(n)).toBe(true);
    expect(isWindowsReservedName('CONTRAT')).toBe(false);
  });

  it('limite le libellé à 40 caractères, coupé en fin de mot', () => {
    const label = proposeFileLabel('Ingénieur logiciel embarqué senior pour dispositifs médicaux implantables H/F');
    expect(label.length).toBeLessThanOrEqual(40);
    expect(label).toBe('Ingenieur-logiciel-embarque-senior-pour');
  });

  it('produit CV_<Prénom>_<Nom>_<Libellé>_<FR|EN> et Resume_ en en-US, 80 caractères au plus', () => {
    const base = { firstName: 'Camille', lastName: 'Martin', label: 'Ingenieur-logiciel-DM', format: 'pdf' as const };
    expect(cvFileName({ ...base, lang: 'fr', enVariant: 'en-GB' })).toBe(
      'CV_Camille_Martin_Ingenieur-logiciel-DM_FR.pdf',
    );
    expect(cvFileName({ ...base, lang: 'en', enVariant: 'en-GB' })).toBe(
      'CV_Camille_Martin_Ingenieur-logiciel-DM_EN.pdf',
    );
    expect(cvFileName({ ...base, lang: 'en', enVariant: 'en-US', format: 'pdf' })).toBe(
      'Resume_Camille_Martin_Ingenieur-logiciel-DM_EN.pdf',
    );
    const long = cvFileName({
      ...base,
      firstName: 'Marie-Christine-Alexandrine',
      lastName: 'de La Tour-Dupont-Montmorency',
      label: 'Ingenieur-logiciel-dispositifs-medicaux',
      lang: 'fr',
      enVariant: 'en-GB',
    });
    expect(long.length).toBeLessThanOrEqual(80);
    expect(long.endsWith('_FR.pdf')).toBe(true);
  });

  it('métadonnée Title du CV', () => {
    expect(cvDocumentTitle('Camille Martin', 'Ingénieure logiciel')).toBe('CV – Camille Martin – Ingénieure logiciel');
  });
});
