// Tool results (§7.2): `structuredContent` plus a text summary; business errors are tool errors
// (`isError: true`) of shape {code, message, details, hint}. Every payload is passed through
// maskContacts: no e-mail or phone number ever leaves the server (§7.5).
import { maskContacts, type Identity } from '@cv/core';

export interface ToolErrorBody {
  code: string;
  message: string;
  details: Record<string, unknown>;
  hint: string;
}

type TextBlock = { type: 'text'; text: string };
type ImageBlock = { type: 'image'; data: string; mimeType: string };

export interface ToolResult {
  [key: string]: unknown;
  content: Array<TextBlock | ImageBlock>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export type Masker = (value: unknown) => unknown;

/** Deep-masks contact details in any JSON value. */
export function makeMasker(identity: Pick<Identity, 'email' | 'phone'> | null): Masker {
  const ids = { email: identity?.email ?? null, phone: identity?.phone ?? null };
  return (value) => JSON.parse(maskContacts(JSON.stringify(value), ids));
}

export function ok<T extends Record<string, unknown>>(
  mask: Masker,
  structured: T,
  summary: string,
  images: ImageBlock[] = [],
): ToolResult {
  const safe = mask(structured) as T;
  return { content: [{ type: 'text', text: mask(summary) as string }, ...images], structuredContent: safe };
}

export function toolError(mask: Masker, body: ToolErrorBody): ToolResult {
  const safe = mask(body) as ToolErrorBody;
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: `${safe.code} : ${safe.message}\nAction suggérée : ${safe.hint}\n${JSON.stringify(safe.details)}`,
      },
    ],
    structuredContent: safe as unknown as Record<string, unknown>,
  };
}
