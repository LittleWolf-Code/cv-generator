// Photo of the identity (§5.2), stored as data/assets/photo.jpg. It arrives already processed by
// @cv/render (sharp: 3:4, at most 600 × 800, JPEG quality 85, 300 KB at most, metadata removed): the
// store checks that it is a small JPEG, writes it atomically, then points the profile to it.
// Never returned by an MCP tool (§7.5).
import { readFile, rm } from 'node:fs/promises';
import type { Identity, ProfileFile } from '@cv/core';
import { writeFileAtomic } from './atomic.js';
import { StoreError } from './errors.js';
import type { WriteRef } from './library.js';
import type { DataStore } from './store.js';

export const PHOTO_FILE = 'assets/photo.jpg';
export const PHOTO_STORED_MAX_BYTES = 300 * 1024;

export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/** JPEG bytes of the identity photo, or null (no photo, or file missing). */
export async function readPhoto(store: DataStore, identity: Identity | null): Promise<Uint8Array | null> {
  if (!identity?.photo) return null;
  try {
    return new Uint8Array(await readFile(store.abs(identity.photo.file)));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export interface PhotoWrite {
  identity: Identity;
  revision: number;
  writes: WriteRef[];
}

async function profileForPhoto(
  store: DataStore,
  expectedRevision: number,
): Promise<ProfileFile & { identity: Identity }> {
  const profile = await store.read<ProfileFile>('profile.json');
  if (!profile.identity) {
    throw new StoreError(
      'NOT_APPLICABLE',
      "aucune identité : la photo s'ajoute à l'identité",
      {},
      "renseignez et enregistrez d'abord l'identité (nom, e-mail, téléphone, ville et pays)",
    );
  }
  if (profile.revision !== expectedRevision) {
    throw new StoreError(
      'STALE_REVISION',
      "l'identité a été modifiée ailleurs depuis son ouverture",
      { file: 'profile.json', currentRevision: profile.revision, current: profile.identity },
      'rechargez la version actuelle, puis recommencez',
    );
  }
  return profile as ProfileFile & { identity: Identity };
}

/** Writes the processed photo, then the profile that points to it (a new photo replaces the previous one). */
export async function savePhoto(store: DataStore, jpeg: Uint8Array, expectedRevision: number): Promise<PhotoWrite> {
  if (!isJpeg(jpeg) || jpeg.byteLength > PHOTO_STORED_MAX_BYTES) {
    throw new StoreError('INVALID_DATA', 'photo non conforme : JPEG de 300 Ko au plus attendu');
  }
  return store.withLock(async () => {
    const profile = await profileForPhoto(store, expectedRevision);
    await writeFileAtomic(store.abs(PHOTO_FILE), jpeg);
    const identity: Identity = { ...profile.identity, photo: { file: PHOTO_FILE } };
    const saved = await store.write('profile.json', { ...profile, identity }, { locked: true });
    return { identity, revision: saved.revision, writes: [{ file: 'profile.json', revision: saved.revision }] };
  });
}

/** Removes the photo from the identity, then deletes its file (explicit action, confirmed in the interface). */
export async function removePhoto(store: DataStore, expectedRevision: number): Promise<PhotoWrite> {
  return store.withLock(async () => {
    const profile = await profileForPhoto(store, expectedRevision);
    const file = profile.identity.photo?.file ?? null;
    const identity: Identity = { ...profile.identity, photo: null };
    const saved = await store.write('profile.json', { ...profile, identity }, { locked: true });
    if (file) await rm(store.abs(file), { force: true });
    return { identity, revision: saved.revision, writes: [{ file: 'profile.json', revision: saved.revision }] };
  });
}
