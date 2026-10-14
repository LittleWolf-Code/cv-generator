import { describe, expect, it } from 'vitest';
import { checkSanitized, sanitize, sanitizeDeep } from '@cv/core';

const ok = (input: string, multiline = false) => {
  const r = sanitize(input, { multiline });
  if (!r.ok) throw new Error(`refusé : ${r.reason}`);
  return r.value;
};
const cp = (n: number) => String.fromCodePoint(n);

describe('sanitize (annexe B.1)', () => {
  it('normalise en NFC', () => {
    expect(ok('e' + cp(0x301) + 'te')).toBe(cp(0xe9) + 'te');
  });

  it.each([
    [0x00ad, 'trait d\u2019union conditionnel'],
    [0x200b, 'espace sans chasse'],
    [0x200c, 'antiliant sans chasse'],
    [0x200d, 'liant sans chasse'],
    [0x200e, 'marque gauche-droite'],
    [0x200f, 'marque droite-gauche'],
    [0x2060, 'gluon de mots'],
    [0xfeff, 'BOM'],
    [0xe0001, 'étiquette de langue'],
    [0xe0041, 'étiquette A'],
    [0xe007f, 'fin d\u2019étiquette'],
  ])('supprime U+%s (%s)', (code) => {
    expect(ok(`dispo${cp(code)}sitif`)).toBe('dispositif');
  });

  it.each([0x2010, 0x2011])('remplace U+%s par un trait d\u2019union', (code) => {
    expect(ok(`temps${cp(code)}réel`)).toBe('temps-réel');
  });

  it.each([0x00a0, 0x2007, 0x2009, 0x202f, 0x2028, 0x2029])('remplace U+%s par une espace', (code) => {
    expect(ok(`45${cp(code)}%`)).toBe('45 %');
  });

  it.each([0x2019, 0x2018, 0x02bc])('remplace U+%s par une apostrophe droite', (code) => {
    expect(ok(`l${cp(code)}équipe`)).toBe("l'équipe");
  });

  it('réduit les espaces multiples et retire les espaces de bord', () => {
    expect(ok('  Ingénieure   logiciel  ')).toBe('Ingénieure logiciel');
  });

  it.each([
    ['emoji', 'Livraison ' + cp(0x1f680), 'emoji'],
    ['symbole emoji U+2600–27BF', 'Soleil ' + cp(0x2600), 'emoji'],
    ['zone privée', 'Logo ' + cp(0xe000), 'private-use'],
    ['caractère de contrôle', 'Cloche ' + cp(0x07), 'control'],
    ['tabulation', 'A' + cp(0x09) + 'B', 'control'],
    ['contrôle C1', 'A' + cp(0x85) + 'B', 'control'],
  ])('refuse %s avec le motif attendu', (_label, input, reason) => {
    const r = sanitize(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe(reason);
  });

  it('accepte \\n uniquement dans un champ multiligne, et normalise CRLF', () => {
    expect(sanitize('a\nb').ok).toBe(false);
    expect(ok('a\r\nb  c', true)).toBe('a\nb c');
  });

  it('checkSanitized signale un texte non assaini', () => {
    expect(checkSanitized("l'équipe")).toBeNull();
    expect(checkSanitized('45' + cp(0xa0) + '%')).toMatch(/non assaini/);
    expect(checkSanitized('ok ' + cp(0x1f600))).toMatch(/emoji/);
  });

  it('sanitizeDeep désigne le champ refusé et laisse les identifiants et URL intacts', () => {
    const { value, issues } = sanitizeDeep({ id: 'exp-1', url: 'https://x.test/a b', text: { fr: 'A' + cp(0x1f680) } });
    expect(value.id).toBe('exp-1');
    expect(value.url).toBe('https://x.test/a b');
    expect(issues).toHaveLength(1);
    expect(issues[0]!.path).toBe('$.text.fr');
    expect(issues[0]!.message).toMatch(/\$\.text\.fr : emoji interdit \(U\+1F680\)/);
  });
});
