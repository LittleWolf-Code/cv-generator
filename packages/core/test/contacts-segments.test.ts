import { describe, expect, it } from 'vitest';
import { findEmails, findPhones, maskContacts, plainText, segmentText } from '@cv/core';

describe('détection des coordonnées (annexe B.5)', () => {
  it('l\u2019expression e-mail refuse « medium.com/@nom » et « @scope/paquet »', () => {
    expect(findEmails('Articles sur medium.com/@nom et paquet @scope/paquet')).toEqual([]);
    expect(findEmails('Contact : camille.martin@example.com.')).toEqual(['camille.martin@example.com']);
  });

  it('libphonenumber ne prend ni une norme ni une plage d\u2019années pour un téléphone', () => {
    expect(findPhones('Essais IEC 60601-1-2, projet 2019 - 2021, ISO 13485:2016, 240 tests')).toEqual([]);
    expect(findPhones('Tél. : 06 39 98 12 34')).toHaveLength(1);
  });

  it('masque e-mail et téléphone dans un texte renvoyé à Claude', () => {
    const t = maskContacts('E-mail : camille.martin@example.com | Tél. : 06 39 98 12 34 | autre@example.org', {
      email: 'camille.martin@example.com',
      phone: '06 39 98 12 34',
    });
    expect(t).toBe('E-mail : {{email}} | Tél. : {{phone}} | {{email}}');
  });
});

describe('segments insécables (§8.5)', () => {
  it('met en bloc les normes, les termes protégés et les mots composés', () => {
    const segs = segmentText('Conformité IEC 62304 (classe B), chaîne CI/CD et traçabilité exigences-tests', [
      'IEC 62304',
    ]);
    const nb = segs.filter((s) => s.nb).map((s) => s.t);
    expect(nb).toEqual(['IEC 62304', 'CI/CD', 'exigences-tests']);
    expect(plainText(segs)).toBe('Conformité IEC 62304 (classe B), chaîne CI/CD et traçabilité exigences-tests');
  });

  it('garde « 45 % », « 1 200 » et « 2019 - 2021 » insécables', () => {
    const nb = segmentText('Couverture de 45 % sur 1 200 patients entre 2019 - 2021')
      .filter((s) => s.nb)
      .map((s) => s.t);
    expect(nb).toEqual(['45 %', '1 200', '2019 - 2021']);
  });

  it('garde un tiret séparateur avec le mot qui le précède : aucune ligne ne commence par un tiret (ADR 0020)', () => {
    const segs = segmentText('Auditrice interne ISO 13485 – Organisme de Formation Fictif');
    expect(segs.filter((s) => s.nb).map((s) => s.t)).toEqual(['ISO 13485 –']);
    expect(plainText(segs)).toBe('Auditrice interne ISO 13485 – Organisme de Formation Fictif');
    expect(
      segmentText('Professional Scrum Master I - Scrum.org')
        .filter((s) => s.nb)
        .map((s) => s.t),
    ).toEqual(['I -']);
  });
});
