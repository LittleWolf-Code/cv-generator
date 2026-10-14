// Lot 7 in packages/core (§12.1 « Lettre » and « Nommage », F-LET-01 to 06, ADR 0016): formulas paired in
// FR, en-GB and en-US, generated subject, date of the 1st of the month, roles, naming, projection and the
// guardrails of the letter (warnings).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  checkFormulaPair,
  checkLetter,
  checkLetterRoles,
  formatLetterDate,
  letterDocumentTitle,
  letterFileName,
  letterFormulas,
  letterSubject,
  projectLetter,
  unknownSourceIds,
  type LetterVersionFile,
  type Snapshot,
} from '@cv/core';
import { FIXTURES, loadPersona } from './helpers.js';

const OFFER = readFileSync(path.join(FIXTURES, 'offres', 'offre-logiciel-dm.md'), 'utf8');
const letterFixture = (name: string) =>
  JSON.parse(readFileSync(path.join(FIXTURES, 'letters', name), 'utf8')) as LetterVersionFile;

describe('formules appariées (F-LET-05)', () => {
  const r = (civility: 'madame' | 'monsieur' | null, name: string | null) => ({
    civility,
    name,
    function: null,
    company: null,
    city: null,
  });

  it('FR : la formule finale reprend exactement l\u2019appel, jamais suivi du nom', () => {
    expect(letterFormulas(null, 'fr', 'en-GB')).toEqual({
      salutation: 'Madame, Monsieur,',
      closing: "Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.",
    });
    expect(letterFormulas(r('madame', 'Durand'), 'fr', 'en-GB')).toEqual({
      salutation: 'Madame,',
      closing: "Je vous prie d'agréer, Madame, l'expression de mes salutations distinguées.",
    });
    expect(letterFormulas(r(null, 'Claire Durand'), 'fr', 'en-GB').salutation).toBe('Madame, Monsieur,');
  });

  it('en-GB : Hiring Manager, Madam ou Sir → faithfully ; un nom → sincerely', () => {
    expect(letterFormulas(null, 'en', 'en-GB')).toEqual({
      salutation: 'Dear Hiring Manager,',
      closing: 'Yours faithfully,',
    });
    expect(letterFormulas(r('madame', 'Martin'), 'en', 'en-GB')).toEqual({
      salutation: 'Dear Ms Martin,',
      closing: 'Yours sincerely,',
    });
    expect(letterFormulas(r('monsieur', null), 'en', 'en-GB')).toEqual({
      salutation: 'Dear Sir,',
      closing: 'Yours faithfully,',
    });
    expect(letterFormulas(r(null, 'Claire Durand'), 'en', 'en-GB')).toEqual({
      salutation: 'Dear Claire Durand,',
      closing: 'Yours sincerely,',
    });
  });

  it('en-US : Ms. avec un point, toujours « Sincerely, »', () => {
    expect(letterFormulas(r('madame', 'Martin'), 'en', 'en-US')).toEqual({
      salutation: 'Dear Ms. Martin,',
      closing: 'Sincerely,',
    });
    expect(letterFormulas(r('madame', null), 'en', 'en-US')).toEqual({
      salutation: 'Dear Hiring Manager,',
      closing: 'Sincerely,',
    });
    expect(letterFormulas(null, 'en', 'en-US')).toEqual({ salutation: 'Dear Hiring Manager,', closing: 'Sincerely,' });
  });

  it('le contrôle signale toute incohérence', () => {
    for (const lang of ['fr', 'en'] as const) {
      for (const variant of ['en-GB', 'en-US'] as const) {
        for (const rec of [null, r('madame', 'Martin'), r('monsieur', null), r(null, 'Claire Durand')]) {
          expect(checkFormulaPair(letterFormulas(rec, lang, variant), lang, variant)).toBeNull();
        }
      }
    }
    expect(
      checkFormulaPair(
        { salutation: 'Madame,', closing: "Je vous prie d'agréer, Monsieur, l'expression…" },
        'fr',
        'en-GB',
      ),
    ).toMatch(/sans l'appel/);
    expect(
      checkFormulaPair({ salutation: 'Dear Hiring Manager,', closing: 'Yours sincerely,' }, 'en', 'en-GB'),
    ).toMatch(/faithfully/);
    expect(checkFormulaPair({ salutation: 'Dear Ms. Martin,', closing: 'Yours sincerely,' }, 'en', 'en-US')).toMatch(
      /Sincerely/,
    );
  });
});

describe('objet généré (F-LET-02)', () => {
  it('élision de « de » devant une voyelle, minuscule initiale, H/F retiré, référence', () => {
    expect(letterSubject('Ingénieur logiciel dispositifs médicaux H/F', 'ACME-1234', 'fr')).toEqual({
      label: 'Objet :',
      text: "Candidature au poste d'ingénieur logiciel dispositifs médicaux – Réf. ACME-1234",
    });
    expect(letterSubject('Responsable qualité (F/H)', null, 'fr').text).toBe(
      'Candidature au poste de responsable qualité',
    );
    expect(letterSubject('Architecte logiciel', null, 'fr').text).toBe("Candidature au poste d'architecte logiciel");
    expect(letterSubject('DSI adjoint', null, 'fr').text).toBe('Candidature au poste de DSI adjoint');
    expect(letterSubject('Software Engineer M/F', 'REF-9', 'en')).toEqual({
      label: null,
      text: 'Application for the position of Software Engineer – Ref. REF-9',
    });
  });
});

describe('date de la lettre (F-LET-01)', () => {
  const first = new Date(2026, 9, 1);
  it('le 1er du mois en FR, en-GB et en-US ; pas de lieu en anglais', () => {
    expect(formatLetterDate(first, 'fr', 'en-GB', 'Lyon')).toBe('Lyon, le 1er octobre 2026');
    expect(formatLetterDate(first, 'en', 'en-GB', 'Lyon')).toBe('1 October 2026');
    expect(formatLetterDate(first, 'en', 'en-US', 'Lyon')).toBe('October 1, 2026');
    expect(formatLetterDate(new Date(2026, 9, 2), 'fr', 'en-GB', 'Lyon')).toBe('Lyon, le 2 octobre 2026');
    expect(formatLetterDate(first, 'fr', 'en-GB', null)).toBe('Le 1er octobre 2026');
  });
});

describe('rôles des paragraphes (F-LET-03, ordre imposé)', () => {
  it('FR vous, moi (1 ou 2), nous ; EN opening, evidence, [motivation], close', () => {
    expect(checkLetterRoles('fr', ['vous', 'moi', 'nous'])).toBeNull();
    expect(checkLetterRoles('fr', ['vous', 'moi', 'moi', 'nous'])).toBeNull();
    expect(checkLetterRoles('fr', ['moi', 'vous', 'nous'])).toMatch(/dans cet ordre/);
    expect(checkLetterRoles('fr', ['vous', 'nous', 'nous'])).not.toBeNull();
    expect(checkLetterRoles('en', ['opening', 'evidence', 'motivation', 'close'])).toBeNull();
    expect(checkLetterRoles('en', ['opening', 'evidence', 'close'])).toBeNull();
    expect(checkLetterRoles('en', ['opening', 'evidence', 'evidence', 'close'])).toBeNull();
    expect(checkLetterRoles('en', ['opening', 'motivation', 'close'])).not.toBeNull();
    expect(checkLetterRoles('en', ['vous', 'moi', 'nous'])).not.toBeNull();
  });
});

describe('nommage (F-EXP-04, annexe B.4)', () => {
  it('LM_ en français, CoverLetter_ en anglais, translittération', () => {
    const base = { firstName: 'Lætitia', lastName: 'Strauß', company: 'Cœur Médical & Fils', format: 'pdf' as const };
    expect(letterFileName({ ...base, lang: 'fr' })).toBe('LM_Laetitia_Strauss_Coeur-Medical-Fils_FR.pdf');
    expect(letterFileName({ ...base, lang: 'en', format: 'docx' })).toBe(
      'CoverLetter_Laetitia_Strauss_Coeur-Medical-Fils_EN.docx',
    );
    expect(letterDocumentTitle('Camille Martin', 'ACME Medical', 'fr')).toBe(
      'Lettre de motivation – Camille Martin – ACME Medical',
    );
    expect(letterDocumentTitle('Camille Martin', 'ACME Medical', 'en')).toBe(
      'Cover letter – Camille Martin – ACME Medical',
    );
  });
});

describe('projection et garde-fous de la lettre', () => {
  let snapshot: Snapshot;
  let cleanup: () => Promise<void>;
  beforeAll(async () => {
    ({ snapshot, cleanup } = await loadPersona('courte'));
  });
  afterAll(() => cleanup());
  const preset = () => snapshot.presets.find((p) => p.isDefault)!;
  const ctx = (version: LetterVersionFile, lang: 'fr' | 'en', variant: 'en-GB' | 'en-US' = 'en-GB') => ({
    version,
    lang,
    enVariant: variant,
    application: {
      company: 'ACME Medical',
      jobTitle: 'Ingénieur logiciel dispositifs médicaux H/F',
      offerReference: 'ACME-1234',
    },
    identity: snapshot.profile.identity,
    template: preset().template,
    protectedTerms: ['IEC 62304'],
    date: new Date(2026, 9, 1),
  });

  it('FR : expéditeur, destinataire et date à droite, textes attendus champ par champ', () => {
    const p = projectLetter(ctx(letterFixture('lettre-logiciel-dm-fr.json'), 'fr'));
    expect(p.paper).toBe('a4');
    expect(p.sender.name).toBe('Camille Martin');
    expect(p.recipient).toEqual({ lines: ['Responsable du recrutement', 'ACME Medical', 'Grenoble'], right: true });
    expect(p.date).toEqual({ text: 'Lyon, le 1er octobre 2026', right: true });
    expect(p.meta.title).toBe('Lettre de motivation – Camille Martin – ACME Medical');
    expect(p.expected.map((e) => e.path)).toEqual([
      'sender.name',
      'sender.lines[0]',
      'sender.lines[1]',
      'sender.lines[2]',
      'recipient.lines[0]',
      'recipient.lines[1]',
      'recipient.lines[2]',
      'date',
      'subject',
      'salutation',
      'paragraphs[0]',
      'paragraphs[1]',
      'paragraphs[2]',
      'closing',
      'signature',
      'enclosure',
    ]);
    expect(p.enclosure).toBe('P. J. : CV');
    expect(p.blocking).toEqual([]);
  });

  it('en-US : papier Letter, destinataire à gauche avec « Ms. », sans lieu', () => {
    const p = projectLetter(ctx(letterFixture('letter-logiciel-dm-en.json'), 'en', 'en-US'));
    expect(p.paper).toBe('us-letter');
    expect(p.recipient.lines[0]).toBe('Ms. Durand');
    expect(p.recipient.right).toBe(false);
    expect(p.date).toEqual({ text: 'October 1, 2026', right: false });
    expect(p.salutation).toBe('Dear Ms. Durand,');
    expect(p.enclosure).toBe('Enclosure: CV');
  });

  it('les lettres fictives ne donnent aucun avertissement', () => {
    for (const name of ['lettre-logiciel-dm-fr.json', 'letter-logiciel-dm-en.json']) {
      const v = letterFixture(name);
      const checks = checkLetter({
        paragraphs: v.paragraphs,
        sourceIds: v.sourceIds,
        library: snapshot.library,
        selection: preset().selection,
        offerText: OFFER,
        offerTerms: [],
        now: new Date(2026, 9, 6),
      });
      expect(checks, name).toEqual([]);
    }
  });

  it('chiffre inventé, compétence de l\u2019offre, fait de l\u2019offre hors vous, élément non coché, formule écrite : avertissements', () => {
    const v = letterFixture('lettre-logiciel-dm-fr.json');
    const paragraphs = [
      { role: 'vous', text: v.paragraphs[0]!.text },
      {
        role: 'moi',
        text: "J'ai écrit 500 tests et déployé Kubernetes ; ACME Medical conçoit des moniteurs de classe IIb.",
      },
      { role: 'nous', text: "Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées." },
    ];
    const checks = checkLetter({
      paragraphs,
      sourceIds: [...v.sourceIds, 'prj-tracabilite'],
      library: snapshot.library,
      selection: preset().selection,
      offerText: OFFER,
      offerTerms: [],
      now: new Date(2026, 9, 6),
    });
    const by = (rule: string, paragraph: number | null) =>
      checks.filter((c) => c.rule === rule && c.paragraph === paragraph);
    expect(checks.every((c) => c.level === 'warning')).toBe(true);
    expect(by('letter-facts', 1).map((c) => c.found)).toEqual([['500'], ['Kubernetes']]);
    expect(by('protected-facts', 1)).toHaveLength(1);
    expect(by('formulas', 2)).toHaveLength(1);
    expect(by('unchecked-sources', null)[0]!.found).toEqual(['prj-tracabilite']);
  });

  it('identifiants inconnus (refusés à l\u2019enregistrement)', () => {
    expect(unknownSourceIds(['exp-medtech-2023', 'b-medtech-62304', 'exp-inventee'], snapshot.library)).toEqual([
      'exp-inventee',
    ]);
  });
});
