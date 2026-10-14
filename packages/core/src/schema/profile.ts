// data/profile.json: identity and contact details (§5.2). No birth date, age, family status,
// nationality or identity number exists in the model, by design.
import { z } from 'zod';
import { bilingual, httpUrl, id, location, revision, schemaVersion, text } from './common.js';

export const linkKind = z.enum(['linkedin', 'github', 'portfolio', 'other']);
export type LinkKind = z.infer<typeof linkKind>;

/**
 * How a link is shown on the CV (ADR 0025): its URL alone, its name then its URL (« LinkedIn :
 * linkedin.com/in/… »), or an icon then its URL. The URL is always shown in clear (ATS-10); the icon is
 * drawn by the visual layout only (ATS-08): elsewhere the URL stands alone.
 */
export const linkStyle = z.enum(['url', 'name', 'icon']);
export type LinkStyle = z.infer<typeof linkStyle>;

export const identityLink = z.strictObject({
  id,
  kind: linkKind,
  url: httpUrl,
  /** Readable URL shown on the CV (`linkedin.com/in/…`), ATS-10. */
  display: text,
  style: linkStyle.default('url'),
  /** Name of the link (`name` style, alternative text of the icon); null: the name of its kind. */
  name: bilingual.nullable().default(null),
});
export type IdentityLink = z.infer<typeof identityLink>;

export const identity = z.strictObject({
  firstName: text,
  lastName: text,
  /** Never returned by an MCP tool (§7.5). */
  email: z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'adresse e-mail invalide'),
  /** Never returned by an MCP tool (§7.5). */
  phone: text,
  /** City and country only, never the full address (§5.2). */
  location,
  links: z.array(identityLink).default([]),
  /** Relative to the data directory (`assets/photo.jpg`). Never returned by an MCP tool. */
  photo: z
    .strictObject({ file: z.string().regex(/^assets\/[\w.-]+\.jpe?g$/) })
    .nullable()
    .default(null),
  drivingLicense: bilingual.nullable().default(null),
  workAuthorization: bilingual.nullable().default(null),
});
export type Identity = z.infer<typeof identity>;

export const profileFile = z.strictObject({
  schemaVersion,
  revision,
  /** null until the user fills it in (fresh `data:init`). */
  identity: identity.nullable(),
});
export type ProfileFile = z.infer<typeof profileFile>;
