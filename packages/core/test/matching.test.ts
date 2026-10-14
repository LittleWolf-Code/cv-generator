import { describe, expect, it } from 'vitest';
import { canon, containsTerm, normalizeForMatch, tokenizeForMatch } from '@cv/core';

const cp = (n: number) => String.fromCodePoint(n);

describe('canon (annexe B.2)', () => {
  it('ignore les blancs et la casse, unifie apostrophes et traits d\u2019union', () => {
    expect(canon(`Centres d${cp(0x2019)}intérêt`)).toBe(canon("CENTRES D'INTÉRÊT"));
    expect(canon(`temps${cp(0x2011)}réel`)).toBe('temps-réel');
    expect(canon('Expérience\n professionnelle')).toBe('expérienceprofessionnelle');
  });
});

describe('normalizeForMatch (annexe B.3)', () => {
  it('supprime les élisions et unifie les apostrophes', () => {
    expect(normalizeForMatch(`l${cp(0x2019)}intégration d'équipe`)).toBe('integration equipe');
    expect(normalizeForMatch(`jusqu${cp(0x02bc)}au déploiement`)).toBe('au deploiement');
    expect(normalizeForMatch(`qu${cp(0x60)}il`)).toBe('il');
  });

  it('translittère œ, æ et ß et retire les accents', () => {
    expect(normalizeForMatch('Mise en Œuvre, cæcum, Straße')).toBe('mise en oeuvre caecum strasse');
  });

  it('traite espace, - et / comme un même séparateur', () => {
    expect(normalizeForMatch('front-end')).toBe(normalizeForMatch('front end'));
    expect(normalizeForMatch('front/end')).toBe(normalizeForMatch('front end'));
  });

  it.each(['C++', 'C#', '.NET', 'CI/CD', '510(k)', 'V&V'])('conserve le terme protégé %s tel quel', (term) => {
    const tokens = tokenizeForMatch(`Expérience en ${term} confirmée`);
    expect(tokens.some((t) => t.kind === 'protected' && t.raw === term)).toBe(true);
    expect(containsTerm(`Expérience en ${term} confirmée`, term)).toBe(true);
  });

  it('ne confond pas C avec C++ ou C#', () => {
    expect(containsTerm('Développement en C++ et C#', 'C')).toBe(false);
    expect(containsTerm('Développement en C et C++', 'C')).toBe(true);
  });

  it('compare par suite de mots, jamais par sous-chaîne', () => {
    expect(containsTerm('Conception d\u2019algorithmes', 'Go')).toBe(false);
    expect(containsTerm('Microservices en Go', 'Go')).toBe(true);
  });

  it('« IEC 62304 (classe C) » ne déclenche pas la compétence C', () => {
    expect(containsTerm('Conformité IEC 62304 (classe C) du logiciel', 'C')).toBe(false);
    expect(containsTerm('Dispositif de Class IIa', 'IIa', { ambiguous: true })).toBe(false);
  });

  it('les sigles ambigus se comparent en casse exacte', () => {
    expect(containsTerm('Expérience go-to-market', 'Go')).toBe(false);
    expect(containsTerm('Le dm a été livré', 'DM')).toBe(false);
  });

  it('une offre de cybersécurité qui demande « MDR » n\u2019est pas couverte par « MDR (UE) 2017/745 »', () => {
    const cv = 'Documentation technique MDR (UE) 2017/745';
    expect(containsTerm(cv, 'MDR', { dmContext: false })).toBe(false);
    expect(containsTerm(cv, 'MDR', { dmContext: true })).toBe(true);
  });

  it('normes : NF EN ISO 13485:2016 = ISO 13485', () => {
    expect(containsTerm('Certification NF EN ISO 13485:2016', 'ISO 13485')).toBe(true);
    const [std] = tokenizeForMatch('NF EN ISO 13485:2016');
    expect(std).toMatchObject({ kind: 'standard', norm: 'std:13485', edition: '2016' });
  });

  it('normes : CEI 62304 = IEC62304, EN 62304 = IEC 62304', () => {
    expect(containsTerm('Maîtrise de la CEI 62304', 'IEC62304')).toBe(true);
    expect(containsTerm('Application de EN 62304:2006/A1:2015', 'IEC 62304')).toBe(true);
    expect(containsTerm('ISO/IEC 27001', 'ISO 27001')).toBe(true);
  });

  it('normes : IEC 60601-1 ≠ IEC 60601-1-2 (frontière de partie)', () => {
    expect(containsTerm('Essais CEM selon IEC 60601-1-2', 'IEC 60601-1')).toBe(false);
    expect(containsTerm('Sécurité selon IEC 60601-1', 'IEC 60601-1-2')).toBe(false);
    expect(containsTerm('Sécurité selon CEI 60601-1', 'IEC 60601-1')).toBe(true);
  });

  it('21 CFR 820 = 21 CFR Part 820', () => {
    expect(containsTerm('Conformité 21 CFR Part 820 (QMSR)', '21 CFR 820')).toBe(true);
  });
});
