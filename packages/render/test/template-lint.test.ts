import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { lintTemplate, templatePath } from '@cv/render';

const rules = (src: string) => lintTemplate(src).map((v) => v.rule);

describe('analyse statique des gabarits ATS (T-ATS-17)', () => {
  it('le gabarit ats-classique est conforme', () => {
    expect(lintTemplate(readFileSync(templatePath('ats-classique'), 'utf8'))).toEqual([]);
  });

  it.each(['grid', 'table', 'hide', 'eval'])('rejette %s(', (fn) => {
    expect(rules(`#${fn}(data.x)`)).toContain('forbidden-call');
  });

  it('rejette fill: white sur du texte', () => {
    expect(rules('#text(fill: white, data.x)')).toContain('white-text');
    expect(rules('#text(fill: rgb("#ffffff"), data.x)')).toContain('white-text');
  });

  it('rejette une taille < 9 pt', () => {
    expect(rules('#set text(size: 8pt)')).toContain('small-text');
    expect(rules('#set text(size: 9pt)')).toEqual([]);
  });

  it('rejette tout texte littéral visible', () => {
    expect(rules('Compétences')).toContain('literal-text');
    expect(rules('#heading("Compétences")')).toContain('literal-text');
    expect(rules('#{ strong[Langages] }')).toContain('literal-text');
    expect(rules('#let x = data.punct.space + " "')).toEqual([]);
    expect(rules('#context [#metadata(here().position()) <cv-end>]')).toEqual([]);
  });

  it('n\u2019autorise place( que dans photo()', () => {
    expect(rules('#place(top + right, image(data.photo))')).toContain('place-outside-photo');
    expect(rules('#let photo(p) = place(top + right, image(p))\n#photo(data.photo)')).toEqual([]);
  });

  it('ignore les commentaires', () => {
    expect(rules('// grid( table( Compétences\n#let x = 1')).toEqual([]);
  });
});
