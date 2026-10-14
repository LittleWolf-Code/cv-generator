// Journal of the MCP requests (ADR 0024): one JSON line per request received by the MCP server, in
// out/logs/mcp-AAAA-MM.jsonl. Written by apps/mcp (transport wrapper), read by the API for the
// « Journal MCP » screen; never exposed by the MCP itself.
import { z } from 'zod';

/** Folder of the journal, under out/ (CV_OUT_DIR on the server). */
export const MCP_LOG_DIR = 'logs';
/** One file per month (UTC), named after the date of the requests it holds. */
export const MCP_LOG_FILE_RE = /^mcp-(\d{4}-\d{2})\.jsonl$/;
export const MCP_LOG_MONTH_RE = /^\d{4}-\d{2}$/;

export function mcpLogFileName(at: Date): string {
  return `mcp-${at.toISOString().slice(0, 7)}.jsonl`;
}

export const mcpLogEntry = z.object({
  v: z.literal(1),
  /** Receipt of the request (ISO 8601, UTC). */
  at: z.string(),
  /** Random identifier of the connection: one MCP process, so one SSH connection on the server. */
  session: z.string(),
  /** Order of the request in its session (1, 2…): several requests can arrive in the same millisecond. */
  seq: z.number().int().positive(),
  /** Address of the SSH client; null for a local server (stdio) or an SSH command without the address. */
  ip: z.string().nullable(),
  via: z.enum(['ssh', 'local']),
  /** Name and version of the MCP client (`initialize`), once known. */
  client: z.string().nullable(),
  /** JSON-RPC method (`tools/call`, `tools/list`, `initialize`…). */
  method: z.string(),
  /** Tool or prompt called. */
  name: z.string().nullable(),
  /** Arguments summarized: long texts replaced by their length, contact details masked. */
  args: z.unknown().nullable(),
  /** `tool-error`: business refusal of the tool (`code`); `error`: JSON-RPC error; `no-response`: connection closed first. */
  outcome: z.enum(['ok', 'tool-error', 'error', 'no-response']),
  code: z.string().nullable(),
  ms: z.number().nonnegative(),
  /** Size of the response sent (UTF-8 bytes). */
  bytes: z.number().int().nonnegative(),
  /** Contact details of the identity found in the response: must stay empty (§7.5). */
  leaks: z.array(z.enum(['email', 'phone'])),
});
export type McpLogEntry = z.infer<typeof mcpLogEntry>;
