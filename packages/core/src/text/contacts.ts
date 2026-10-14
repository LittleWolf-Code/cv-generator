// Contact detection (spec annex B.5). Never rely on a naive phone regex: "IEC 60601-1-2" or
// "2019 - 2021" must not be taken for phone numbers.
import { findPhoneNumbersInText } from 'libphonenumber-js';

/** B.5 e-mail pattern: rejects "medium.com/@nom" and "@scope/paquet". */
export const EMAIL_RE = /(?<![\p{L}\p{N}._%+/@-])[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu;

export function findEmails(text: string): string[] {
  return [...text.matchAll(EMAIL_RE)].map((m) => m[0]);
}

export interface FoundPhone {
  /** E.164 form. */
  number: string;
  /** National significant digits, for digit-wise comparison. */
  digits: string;
  start: number;
  end: number;
}

export function findPhones(text: string): FoundPhone[] {
  return findPhoneNumbersInText(text, 'FR').map((m) => ({
    number: m.number.number,
    digits: m.number.nationalNumber,
    start: m.startsAt,
    end: m.endsAt,
  }));
}

export function digitsOf(s: string): string {
  return s.replace(/\D+/g, '');
}

/** Same phone number, compared on digits (a leading national 0 or +33 prefix is ignored). */
export function samePhone(a: string, b: string): boolean {
  const strip = (d: string) => d.replace(/^(?:0033|33)(?=\d{9}$)/, '').replace(/^0(?=\d{9}$)/, '');
  return strip(digitsOf(a)) === strip(digitsOf(b));
}

export type ContactKind = 'email' | 'phone';

/**
 * Contact details of the identity found in a text sent out (journal of the MCP requests, ADR 0024): the
 * e-mail (case-insensitive) and the phone number in any written form (compared on digits). Returns the
 * kinds found, never the values.
 */
export function findContactLeaks(
  text: string,
  identity: { email?: string | null; phone?: string | null },
): ContactKind[] {
  const found: ContactKind[] = [];
  if (identity.email && text.toLowerCase().includes(identity.email.toLowerCase())) found.push('email');
  const phone = identity.phone;
  // A value too short to be a number would match anywhere.
  if (
    phone &&
    digitsOf(phone).length >= 6 &&
    (text.includes(phone) || findPhones(text).some((p) => samePhone(p.number, phone)))
  ) {
    found.push('phone');
  }
  return found;
}

/**
 * Masks e-mails and phone numbers in a text returned to Claude (§7.5): the identity values (even if
 * libphonenumber does not recognize them) and any other address or valid number found.
 */
export function maskContacts(text: string, identity: { email?: string | null; phone?: string | null }): string {
  let out = text;
  if (identity.email) out = out.split(identity.email).join('{{email}}');
  if (identity.phone) out = out.split(identity.phone).join('{{phone}}');
  out = out.replace(EMAIL_RE, '{{email}}');
  for (const p of findPhones(out).reverse()) out = out.slice(0, p.start) + '{{phone}}' + out.slice(p.end);
  return out;
}
