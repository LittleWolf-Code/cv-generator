import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  assertSafeFileName,
  DataStore,
  initDataDir,
  RENAME_DELAYS_MS,
  renameWithRetry,
  resolveInside,
  StoreError,
} from '@cv/store';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'cv-store-'));
  await initDataDir(dir);
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe('data:init', () => {
  it('crée un dossier de données vide et valide, sans écraser l\u2019existant', async () => {
    const snap = await DataStore.open(dir).loadSnapshot();
    expect(snap.profile.identity).toBeNull();
    expect(snap.library.experiences).toEqual([]);
    expect(snap.library.categories.map((c) => c.id)).toContain('reglementaire');
    expect(snap.presets.map((p) => p.id)).toEqual(['preset-defaut']);
    expect(await initDataDir(dir)).toEqual([]);
  });

  it('refuse de démarrer sans dossier de données', () => {
    expect(() => DataStore.open(path.join(dir, 'absent'))).toThrowError(/npm run data:init|introuvable/);
  });
});

describe('écriture atomique et révisions (§8.4)', () => {
  it('réessaie le rename sur EPERM/EBUSY puis abandonne après 5 attentes', async () => {
    let calls = 0;
    const flaky = async () => {
      calls++;
      if (calls < 3) throw Object.assign(new Error('busy'), { code: calls === 1 ? 'EPERM' : 'EBUSY' });
    };
    await renameWithRetry('a', 'b', flaky);
    expect(calls).toBe(3);

    let always = 0;
    const locked = async () => {
      always++;
      throw Object.assign(new Error('locked'), { code: 'EACCES' });
    };
    await expect(renameWithRetry('a', 'b', locked)).rejects.toThrow('locked');
    expect(always).toBe(RENAME_DELAYS_MS.length + 1);
  });

  it('n\u2019attend pas sur une erreur non transitoire', async () => {
    let calls = 0;
    await expect(
      renameWithRetry('a', 'b', async () => {
        calls++;
        throw Object.assign(new Error('nope'), { code: 'ENOENT' });
      }),
    ).rejects.toThrow('nope');
    expect(calls).toBe(1);
  });

  it('incrémente la révision et refuse une révision périmée (STALE_REVISION)', async () => {
    const store = DataStore.open(dir);
    const preset = (await store.listPresets())[0]!;
    const saved = await store.write(
      'presets/preset-defaut.json',
      { ...preset, name: 'Renommé' },
      { expectedRevision: preset.revision },
    );
    expect(saved.revision).toBe(preset.revision + 1);
    await expect(
      store.write('presets/preset-defaut.json', preset, { expectedRevision: preset.revision }),
    ).rejects.toMatchObject({
      code: 'STALE_REVISION',
    });
  });

  it('écrit en UTF-8 sans BOM et tolère un BOM en lecture', async () => {
    const file = path.join(dir, 'profile.json');
    const raw = await readFile(file);
    expect(raw[0]).not.toBe(0xef);
    await writeFile(file, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), raw]));
    expect((await DataStore.open(dir).loadProfile()).identity).toBeNull();
  });

  it('valide avant d\u2019écrire', async () => {
    const store = DataStore.open(dir);
    const preset = (await store.listPresets())[0]!;
    await expect(store.write('presets/preset-defaut.json', { ...preset, name: '' })).rejects.toMatchObject({
      code: 'INVALID_DATA',
    });
  });
});

describe('identifiants (F-LIB-02)', () => {
  it('attribue slug + suffixe et ne réutilise jamais un identifiant', async () => {
    const store = DataStore.open(dir);
    const a = await store.allocateId('experience', 'MedTech Exemple 2023');
    const b = await store.allocateId('experience', 'MedTech Exemple 2023');
    expect(a).toBe('exp-medtech-exemple-2023');
    expect(b).toBe('exp-medtech-exemple-2023-2');
    const ids = await store.readIds();
    expect(Object.keys(ids.ids)).toEqual(expect.arrayContaining([a, b]));
  });

  it('sérialise les attributions concurrentes grâce au verrou', async () => {
    const store = DataStore.open(dir);
    const got = await Promise.all(Array.from({ length: 5 }, () => store.allocateId('skill', 'Python')));
    expect(new Set(got).size).toBe(5);
  });
});

describe('périmètre de fichiers (§7.6)', () => {
  it.each(['../secret.pdf', 'C:\\Windows\\win.ini', 'a/b.pdf', 'CON.txt', 'cv.exe', 'x:y.pdf'])('refuse %s', (name) => {
    expect(() => assertSafeFileName(name)).toThrowError(StoreError);
  });

  it('accepte un nom simple', () => {
    expect(assertSafeFileName('CV actuel (2026).pdf')).toBe('CV actuel (2026).pdf');
  });

  it('refuse un chemin qui sort de la racine, UNC ou périphérique', () => {
    expect(() => resolveInside(dir, '..\\..\\Windows')).toThrowError(StoreError);
    expect(() => resolveInside(dir, '\\\\serveur\\partage')).toThrowError(StoreError);
    expect(resolveInside(dir, 'library').toLowerCase()).toContain('library');
  });
});
