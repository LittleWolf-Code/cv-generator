// Online instance (ADR 0018): the MCP server run on the server over SSH links to the public origin, and
// reads its folders from CV_DATA_DIR, CV_IMPORT_DIR and CV_OUT_DIR.
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DataStore } from '@cv/store';
import { interfaceOrigin, makeContext, reviewUrl } from '../src/context.js';
import { resolveRoot } from '../src/root.js';
import { letterReviewUrl } from '../src/tools-letter.js';

const store = DataStore.open(path.resolve('fixtures', 'personas', 'courte'));
const ids = ['01JZ0000000000000000000000'];

describe('MCP : instance en ligne (ADR 0018)', () => {
  it('les liens de validation pointent vers l’origine publique quand elle est déclarée', () => {
    const local = makeContext(store, { dataDir: 'd', outDir: 'o', uiPort: 4310 });
    expect(reviewUrl(local, ids)).toBe(`http://127.0.0.1:4310/a-valider?ids=${ids[0]}`);
    const online = makeContext(store, { dataDir: 'd', outDir: 'o', publicOrigin: 'https://cv.example.org' });
    expect(interfaceOrigin(online)).toBe('https://cv.example.org');
    expect(reviewUrl(online, ids)).toBe(`https://cv.example.org/a-valider?ids=${ids[0]}`);
    expect(letterReviewUrl(online, '2026-10-07-acme-dev', 'fr')).toBe(
      'https://cv.example.org/candidatures/2026-10-07-acme-dev/lettre?lang=fr',
    );
  });

  it('dossiers de données, d’import et de sortie configurables (chemins absolus seulement)', () => {
    const root = path.resolve('apps', 'mcp', 'test');
    const absolute = (p: string) => path.resolve(root, p);
    const env = {
      CV_ROOT: root,
      CV_DATA_DIR: absolute('srv-data'),
      CV_IMPORT_DIR: absolute('srv-import'),
      CV_OUT_DIR: absolute('srv-out'),
    };
    const resolved = resolveRoot(env);
    expect(resolved).toMatchObject({
      dataDir: env.CV_DATA_DIR,
      importDir: env.CV_IMPORT_DIR,
      outDir: env.CV_OUT_DIR,
    });
    expect(() => resolveRoot({ CV_ROOT: root, CV_IMPORT_DIR: 'relatif' })).toThrow(
      /CV_IMPORT_DIR doit être un chemin absolu/,
    );
    const defaults = resolveRoot({ CV_ROOT: root });
    expect(defaults.importDir).toBe(path.join(root, 'import'));
  });
});
