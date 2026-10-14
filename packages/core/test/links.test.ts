// Display of the links (ADR 0025): URL alone, name then URL, or icon then URL. The URL is always in
// clear (ATS-10); the icon is drawn by the visual layout only (ATS-08), the URL stands alone elsewhere.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  identityLink,
  project,
  select,
  type Identity,
  type IdentityLink,
  type Layout,
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

const LINK: IdentityLink = {
  id: 'lk-portfolio',
  kind: 'portfolio',
  url: 'https://camille-martin.example.com',
  display: 'camille-martin.example.com',
  style: 'url',
  name: null,
};

function render(link: Partial<IdentityLink>, lang: 'fr' | 'en' = 'fr', layout: Layout = 'visuel'): Projection {
  const identity: Identity = { ...snapshot.profile.identity!, links: [{ ...LINK, ...link }] };
  return project(select(snapshot.library, preset.selection), {
    lang,
    enVariant: 'en-GB',
    options: { ...preset.options, links: [LINK.id] },
    template: { ...preset.template, layout },
    identity,
  });
}

const contact = (p: Projection) => p.header.contacts.find((c) => c.kind === 'link')!;
const expectedText = (p: Projection) =>
  p.expected.find((e) => e.path === `header.contacts[${p.header.contacts.findIndex((c) => c.kind === 'link')}]`)!.text;

describe('affichage des liens (ADR 0025)', () => {
  it('schéma : sans style ni nom, un lien enregistré avant reste valide et garde son URL seule', () => {
    const { style: _style, name: _name, ...old } = LINK;
    expect(identityLink.parse(old)).toMatchObject({ style: 'url', name: null });
    expect(identityLink.safeParse({ ...LINK, style: 'logo' }).success).toBe(false);
  });

  it('lien seul : l’URL, sans libellé ni icône', () => {
    const c = contact(render({}));
    expect(c).toMatchObject({ label: null, text: LINK.display, url: LINK.url, icon: null });
  });

  it('nom – lien : le nom de son type, avec la ponctuation de la langue, dans le texte attendu', () => {
    const fr = render({ style: 'name' });
    expect(contact(fr).label).toBe('Portfolio :');
    expect(expectedText(fr)).toBe('Portfolio : camille-martin.example.com');
    expect(contact(render({ style: 'name' }, 'en')).label).toBe('Portfolio:');
    expect(contact(render({ style: 'name', kind: 'other' }, 'en')).label).toBe('Website:');
    // The ATS layout shows the name as well: a text label (ATS-08).
    expect(contact(render({ style: 'name' }, 'fr', 'ats-classique')).label).toBe('Portfolio :');
  });

  it('nom – lien : un nom à soi, traduit ; sans traduction, l’export EN est bloqué sur ce champ', () => {
    const name = { fr: 'Mes réalisations', en: 'My work' };
    expect(contact(render({ style: 'name', name })).label).toBe('Mes réalisations :');
    expect(contact(render({ style: 'name', name }, 'en')).label).toBe('My work:');
    const blocked = render({ style: 'name', name: { fr: 'Mes réalisations', en: null } }, 'en');
    expect(blocked.blocking).toContainEqual(
      expect.objectContaining({
        code: 'UNTRANSLATED',
        target: expect.objectContaining({ collection: 'profile', field: 'links.0.name' }),
      }),
    );
    // A name that is not shown is never resolved: no block for the URL alone.
    expect(render({ name: { fr: 'Mes réalisations', en: null } }, 'en').blocking).toEqual([]);
  });

  it('icône – lien : l’icône de son type dans le visuel, son nom en texte de remplacement, l’URL seule en texte', () => {
    const p = render({ style: 'icon' });
    expect(contact(p)).toMatchObject({
      label: null,
      text: LINK.display,
      icon: { kind: 'portfolio', alt: 'Portfolio' },
    });
    expect(expectedText(p)).toBe(LINK.display);
    expect(contact(render({ style: 'icon', name: { fr: 'Site perso', en: 'Personal site' } }, 'en')).icon).toEqual({
      kind: 'portfolio',
      alt: 'Personal site',
    });
  });

  it('icône – lien : dans le modèle ATS, aucune icône (ATS-08), l’URL seule', () => {
    expect(contact(render({ style: 'icon' }, 'fr', 'ats-classique'))).toMatchObject({ label: null, icon: null });
  });

  it('les autres coordonnées n’ont jamais d’icône', () => {
    const p = render({ style: 'icon' });
    expect(p.header.contacts.filter((c) => c.kind !== 'link').every((c) => c.icon === null)).toBe(true);
  });
});
