// data/ids.json: registry of every identifier ever assigned. An id is never reused, even after
// deletion (F-LIB-02).
import { z } from 'zod';
import { id, isoDateTime, revision, schemaVersion } from './common.js';

export const idKind = z.enum([
  'title',
  'summary',
  'experience',
  'education',
  'project',
  'skill',
  'certification',
  'language',
  'interest',
  'category',
  'bullet',
  'link',
  'preset',
  'application',
]);
export type IdKind = z.infer<typeof idKind>;

export const idsFile = z.strictObject({
  schemaVersion,
  revision,
  ids: z.record(id, z.strictObject({ kind: idKind, createdAt: isoDateTime })),
});
export type IdsFile = z.infer<typeof idsFile>;

/** Conventional prefix of generated ids, by kind. */
export const ID_PREFIX: Record<IdKind, string> = {
  title: 'ttl',
  summary: 'sum',
  experience: 'exp',
  education: 'edu',
  project: 'prj',
  skill: 'sk',
  certification: 'cert',
  language: 'lang',
  interest: 'int',
  category: 'cat',
  bullet: 'b',
  link: 'lk',
  preset: 'preset',
  application: 'app',
};
