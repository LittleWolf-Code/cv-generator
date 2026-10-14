// Marking of untrusted text (§7.5): every text of external origin (offer, source sentence of an
// analysis, imported text) is returned to Claude between <untrusted source="…" nonce="…"> and
// </untrusted>, with a random nonce per response, so that it cannot close the tag itself: any
// occurrence of the tag inside the content is neutralized.
import { randomBytes } from 'node:crypto';

export type UntrustedSource = 'offer' | 'import' | 'linkedin';

export function newNonce(): string {
  return randomBytes(8).toString('hex');
}

/** `<untrusted` and `</untrusted` inside the content can no longer be read as the tag. */
export function neutralizeUntrusted(text: string): string {
  return text.replace(/<(\s*\/?\s*untrusted)/gi, '&lt;$1');
}

export function markUntrusted(text: string, source: UntrustedSource, nonce: string): string {
  return `<untrusted source="${source}" nonce="${nonce}">${neutralizeUntrusted(text)}</untrusted>`;
}
