// F-IMP-02 in packages/core (ADR 0015): CSV reading, columns matched by name (case, BOM), unknown
// columns logged, ignored fields never read, dates, languages, bullets, and the candidates built from
// the fictitious export of fixtures/imports/linkedin/.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  cleanImportedText,
  languageByName,
  LINKEDIN_FILE_NAMES,
  linkedInCandidates,
  linkedInDateFormat,
  linkedInFileOf,
  parseCsv,
  parseLinkedInDate,
  parseLinkedInLocation,
  proficiencyToCefr,
  readLinkedInTable,
  splitBullets,
  suggestSkillCategory,
} from '@cv/core';
import { FIXTURES } from './helpers.js';

const CATEGORIES = ['langages', 'outils', 'methodes', 'reglementaire'];
const fixtureTables = () =>
  LINKEDIN_FILE_NAMES.map((f) =>
    readLinkedInTable(f, readFileSync(path.join(FIXTURES, 'imports', 'linkedin', f), 'utf8')),
  );

describe('CSV (RFC 4180)', () => {
  it('lit les guillemets, les guillemets doublés, les retours à la ligne dans un champ, le BOM et CRLF', () => {
    const csv = '\uFEFFa,b,c\r\n"1, un","dit ""oui""","ligne 1\r\nligne 2"\r\n\r\n2,,\n';
    expect(parseCsv(csv)).toEqual([
      ['a', 'b', 'c'],
      ['1, un', 'dit "oui"', 'ligne 1\r\nligne 2'],
      ['2', '', ''],
    ]);
  });
});

describe('colonnes associées par nom (F-IMP-02)', () => {
  it('ignore la casse et le BOM, journalise les colonnes inconnues, ne lit jamais les champs ignorés', () => {
    const csv =
      '\uFEFFfirst NAME,Birth Date,Headline,Address,Zip Code,Maiden Name,Twitter Handles,Geo Location\n' +
      'Alex,1 Jan 1990,Ingénieur,12 rue Fictive,69000,Nom Fictif,@alex,"Lyon, France"\n';
    const t = readLinkedInTable('Profile.csv', csv);
    expect(t.columns.known).toEqual(['First Name', 'Headline', 'Geo Location']);
    expect(t.columns.ignored.sort()).toEqual(['Address', 'Birth Date', 'Maiden Name', 'Zip Code']);
    expect(t.columns.unknown).toEqual(['Twitter Handles']);
    expect(t.columns.missing).toEqual(['Last Name', 'Summary']);
    // The values of ignored and unknown columns are dropped at read.
    const values = JSON.stringify(t.rows);
    for (const secret of ['1 Jan 1990', '12 rue Fictive', '69000', 'Nom Fictif', '@alex']) {
      expect(values).not.toContain(secret);
    }
    expect(t.rows[0]).toEqual({ 'First Name': 'Alex', Headline: 'Ingénieur', 'Geo Location': 'Lyon, France' });
  });

  it("trouve l'en-tête après une note de début de fichier", () => {
    const t = readLinkedInTable('Skills.csv', 'Notes:\n"Export fictif"\n\nName\nPython\n');
    expect(t.rows).toEqual([{ Name: 'Python' }]);
  });

  it('reconnaît les fichiers attendus sans tenir compte de la casse', () => {
    expect(linkedInFileOf('positions.CSV')).toBe('Positions.csv');
    expect(linkedInFileOf('Connections.csv')).toBeNull();
  });
});

describe('valeurs', () => {
  it('dates : « Jan 2020 » → 2020-01, « 2015 » → 2015, vide → vide, le reste à vérifier', () => {
    expect(parseLinkedInDate('Jan 2020')).toEqual({ kind: 'ok', value: '2020-01' });
    expect(parseLinkedInDate('dec 2019')).toEqual({ kind: 'ok', value: '2019-12' });
    expect(parseLinkedInDate('2015')).toEqual({ kind: 'ok', value: '2015' });
    expect(parseLinkedInDate('  ')).toEqual({ kind: 'empty' });
    expect(parseLinkedInDate('Printemps 2018')).toEqual({ kind: 'check', raw: 'Printemps 2018', year: '2018' });
    expect(parseLinkedInDate('janv. 2020')).toEqual({ kind: 'check', raw: 'janv. 2020', year: '2020' });
    expect(parseLinkedInDate('bientôt')).toEqual({ kind: 'check', raw: 'bientôt', year: null });
    expect(['Jan 2020', '2015', '', 'Printemps 2018'].map(linkedInDateFormat)).toEqual([
      'MMM AAAA',
      'AAAA',
      'vide',
      'autre',
    ]);
  });

  it('langues : seul « Native or bilingual » donne native ; noms FR et EN → code ISO', () => {
    expect(proficiencyToCefr('Native or bilingual proficiency')).toBe('native');
    expect(proficiencyToCefr('Bilingue ou langue maternelle')).toBe('native');
    expect(proficiencyToCefr('Full professional proficiency')).toBeNull();
    expect(proficiencyToCefr('')).toBeNull();
    expect(languageByName('Anglais')).toEqual({ code: 'en', names: { fr: 'Anglais', en: 'English' } });
    expect(languageByName('english (UK)')?.code).toBe('en');
    expect(languageByName('Klingon')).toBeNull();
  });

  it('lieu : ville et pays reconnus, sinon rien', () => {
    expect(parseLinkedInLocation('Lyon, Auvergne-Rhône-Alpes, France')).toEqual({
      city: 'Lyon',
      country: { fr: 'France', en: 'France' },
    });
    expect(parseLinkedInLocation('Munich, Bavaria, Germany')?.country).toEqual({ fr: 'Allemagne', en: 'Germany' });
    expect(parseLinkedInLocation('Villeurbanne et périphérie')).toBeNull();
    expect(parseLinkedInLocation('Somewhere, Atlantis')).toBeNull();
  });

  it('puces : lignes et marqueurs, puis fins de phrase au-delà de 200 caractères ; une phrase trop longue reste entière', () => {
    expect(splitBullets('• Un\n- Deux\n* Trois\n1. Quatre\n– Cinq\n\nSix')).toEqual([
      'Un',
      'Deux',
      'Trois',
      'Quatre',
      'Cinq',
      'Six',
    ]);
    const a = `Phrase A ${'a'.repeat(120)}.`;
    const b = `Phrase B ${'b'.repeat(120)}.`;
    expect(splitBullets(`${a} ${b}`)).toEqual([a, b]);
    const long = `Une seule phrase ${'x'.repeat(220)}`;
    expect(splitBullets(long)).toEqual([long]);
    expect(splitBullets('-5 % de défauts')).toEqual(['-5 % de défauts']);
  });

  it('retire les emoji et la zone privée, en les signalant', () => {
    expect(cleanImportedText('Suivi \u{1F680} de course\uFE0F\tok')).toEqual({
      text: 'Suivi  de course ok',
      removed: ['U+1F680'],
    });
  });

  it('catégorie suggérée : réglementaire pour l\u2019annexe A, langages, méthodes ou outils d\u2019après le vocabulaire', () => {
    expect(suggestSkillCategory('IEC 62304', CATEGORIES)).toBe('reglementaire');
    expect(suggestSkillCategory('Rust', CATEGORIES)).toBe('langages');
    expect(suggestSkillCategory('Scrum', CATEGORIES)).toBe('methodes');
    expect(suggestSkillCategory('Docker', CATEGORIES)).toBe('outils');
    expect(suggestSkillCategory('Gestion des risques', CATEGORIES)).toBe('outils');
    expect(suggestSkillCategory('Docker', [])).toBeNull();
  });
});

describe("candidats tirés de l'export fictif", () => {
  const { candidates, incomplete, identity } = linkedInCandidates(fixtureTables(), 'fr', CATEGORIES);
  const byLabel = (label: string) => candidates.find((c) => c.label === label);

  it('texte dans la langue choisie, l\u2019autre à traduire (null)', () => {
    const exp = byLabel('Stagiaire ingénieure biomédicale – Hôpital Fictif de Villeurbanne')!;
    expect(exp.data.position).toEqual({ fr: 'Stagiaire ingénieure biomédicale', en: null });
    const en = linkedInCandidates(fixtureTables(), 'en', CATEGORIES).candidates.find((c) => c.type === 'title')!;
    expect((en.data.variants as Array<{ text: unknown }>)[0]!.text).toEqual({
      fr: null,
      en: 'Ingénieure logiciel embarqué – dispositifs médicaux',
    });
  });

  it('date illisible : année retenue, valeur brute dans un contrôle « date à vérifier », jamais de mois inventé', () => {
    const exp = byLabel('Stagiaire ingénieure biomédicale – Hôpital Fictif de Villeurbanne')!;
    expect(exp.data.start).toBe('2018');
    expect(exp.data.end).toBe('2018-08');
    expect(exp.checks.map((c) => c.rule)).toEqual(['date-to-verify', 'location-to-verify']);
    expect(exp.checks[0]!.message).toContain('Printemps 2018');
    // Long description split at sentence ends.
    expect((exp.data.bullets as unknown[]).length).toBe(2);
  });

  it('fin vide → en cours ; fin illisible sans année → élément non proposé', () => {
    expect(byLabel('Ingénieure logiciel embarqué – MedTech Exemple SAS')!.data.end).toBeNull();
    const t = readLinkedInTable(
      'Positions.csv',
      'Company Name,Title,Started On,Finished On\nSociété Fictive,Testeuse,Jan 2020,bientôt\n',
    );
    const x = linkedInCandidates([t], 'fr', CATEGORIES);
    expect(x.candidates).toEqual([]);
    expect(x.incomplete[0]!.reason).toContain('jamais lue comme « en cours »');
  });

  it('langues : native, ou niveau CECRL à préciser ; langue inconnue non proposée', () => {
    expect(byLabel('Français')!.data.cefr).toBe('native');
    const de = byLabel('Allemand')!;
    expect(de.data).toMatchObject({ code: 'de', language: { fr: 'Allemand', en: 'German' }, cefr: null });
    expect(de.checks[0]).toMatchObject({ rule: 'cefr-to-specify' });
    expect(incomplete.map((i) => i.label)).toContain('Klingon');
  });

  it('incomplets : sans date de début, sans diplôme, sans organisme', () => {
    expect(incomplete.map((i) => `${i.type}:${i.reason}`)).toEqual([
      'experience:date de début absente',
      'education:diplôme absent',
      'language:langue non reconnue (code ISO inconnu)',
      'certification:organisme absent (Authority)',
    ]);
  });

  it("identité trouvée (préremplissage seulement) ; l'e-mail principal est retenu", () => {
    expect(identity).toEqual({
      firstName: 'Camille',
      lastName: 'Martin',
      email: 'camille.martin@example.com',
      phone: '06 39 98 12 34',
      location: { city: 'Lyon', country: { fr: 'France', en: 'France' } },
    });
  });

  it('emoji retiré et signalé ; lien http(s) gardé avec son affichage', () => {
    const p = byLabel("Application de suivi d'entraînement")!;
    expect(p.checks.map((c) => c.rule)).toEqual(['removed-characters']);
    expect(p.data.url).toEqual({
      url: 'https://github.com/camille-martin-fictif/suivi-course',
      display: 'github.com/camille-martin-fictif/suivi-course',
    });
  });
});
