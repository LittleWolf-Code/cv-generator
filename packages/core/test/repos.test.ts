// Repositories of a project (ADR 0027): a list of links shown after the organization and the main link,
// each URL in clear and clickable (ATS-10); a repository repeated, or equal to the main link, is refused.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  linkKey,
  plainText,
  project,
  projectItem,
  select,
  setChecked,
  type Library,
  type PresetFile,
  type Projection,
  type Selection,
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

const REPO = (name: string) => ({
  url: `https://github.com/camille-martin-fictif/${name}`,
  display: `github.com/camille-martin-fictif/${name}`,
});

function withProject(): Selection {
  const sel = structuredClone(preset.selection);
  setChecked(sel, { section: 'projects', itemId: 'prj-tracabilite', bulletIds: ['b-tracabilite-export'] }, true);
  return sel;
}

function render(library: Library = snapshot.library, lang: 'fr' | 'en' = 'fr'): Projection {
  return project(select(library, withProject()), {
    lang,
    enVariant: 'en-GB',
    options: preset.options,
    template: preset.template,
    identity: snapshot.profile.identity,
  });
}

const entry = (p: Projection) =>
  p.sections.find((s) => s.key === 'projects')!.entries.find((e) => e.id === 'prj-tracabilite')!;

describe('dépôts d’un projet (ADR 0027)', () => {
  it('schéma : un projet enregistré sans dépôts reste valide, avec une liste vide', () => {
    const { repos: _repos, ...old } = snapshot.library.projects.find((p) => p.id === 'prj-tracabilite')!;
    expect(projectItem.parse(old).repos).toEqual([]);
  });

  it('schéma : un dépôt en double, ou identique au lien principal, est refusé', () => {
    const base = snapshot.library.projects.find((p) => p.id === 'prj-tracabilite')!;
    const twice = projectItem.safeParse({
      ...base,
      repos: [REPO('outil'), { url: 'https://www.github.com/Camille-Martin-Fictif/outil.git', display: 'x' }],
    });
    expect(twice.success).toBe(false);
    expect(twice.error!.issues[0]).toMatchObject({ path: ['repos', 1, 'url'], message: 'dépôt en double : x' });
    const main = projectItem.safeParse({ ...base, url: REPO('outil'), repos: [REPO('outil/')] });
    expect(main.error!.issues[0]).toMatchObject({ message: 'dépôt identique au lien du projet' });
    expect(projectItem.safeParse({ ...base, repos: [{ url: 'github.com/a/b', display: 'a' }] }).success).toBe(false);
  });

  it('linkKey : schéma, www, casse, barre finale et .git ignorés', () => {
    expect(linkKey('https://www.GitHub.com/a/B.git/')).toBe('github.com/a/b');
    expect(linkKey('http://github.com/a/b')).toBe(linkKey('https://github.com/a/b/'));
    expect(linkKey('https://github.com/a/b')).not.toBe(linkKey('https://github.com/a/bc'));
  });

  it('sous-titre : organisation, lien principal, puis chaque dépôt, chacun cliquable et insécable', () => {
    for (const lang of ['fr', 'en'] as const) {
      const p = render(snapshot.library, lang);
      const subtitle = entry(p).subtitle!;
      expect(plainText(subtitle)).toBe(
        [
          'camille-martin-fictif.github.io/tracabilite',
          'github.com/camille-martin-fictif/tracabilite',
          'github.com/camille-martin-fictif/tracabilite-cli',
        ].join(', '),
      );
      expect(subtitle.filter((s) => s.url)).toEqual([
        {
          t: 'camille-martin-fictif.github.io/tracabilite',
          nb: true,
          url: 'https://camille-martin-fictif.github.io/tracabilite/',
        },
        { t: REPO('tracabilite').display, nb: true, url: REPO('tracabilite').url },
        { t: REPO('tracabilite-cli').display, nb: true, url: REPO('tracabilite-cli').url },
      ]);
      // The separators are plain text, never part of a link.
      expect(subtitle.filter((s) => !s.url).map((s) => s.t)).toEqual([', ', ', ']);
      const expected = p.expected.find((e) => e.path === 'projects.prj-tracabilite.subtitle')!.text;
      expect(expected).toBe(plainText(subtitle));
    }
  });

  it('sous-titre : l’organisation d’abord, et des dépôts sans lien principal', () => {
    const library = structuredClone(snapshot.library);
    const prj = library.projects.find((p) => p.id === 'prj-tracabilite')!;
    prj.organization = 'Club Exemple';
    prj.url = null;
    prj.repos = [REPO('tracabilite')];
    const subtitle = entry(render(library)).subtitle!;
    expect(plainText(subtitle)).toBe('Club Exemple, github.com/camille-martin-fictif/tracabilite');
    expect(subtitle.at(-1)).toEqual({ t: REPO('tracabilite').display, nb: true, url: REPO('tracabilite').url });
  });

  it('sans organisation, lien ni dépôt : pas de sous-titre', () => {
    const library = structuredClone(snapshot.library);
    const prj = library.projects.find((p) => p.id === 'prj-tracabilite')!;
    prj.url = null;
    prj.repos = [];
    expect(entry(render(library)).subtitle).toBeNull();
  });
});
