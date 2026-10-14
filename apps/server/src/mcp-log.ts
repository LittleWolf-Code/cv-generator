// Reading of the journal of the MCP requests (ADR 0024) for the « Journal MCP » screen: one month at a
// time, the most recent requests first. The MCP server writes it (apps/mcp/src/request-log.ts); the API
// only reads it. Invalid lines are counted, never shown.
import { open, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { MCP_LOG_DIR, MCP_LOG_FILE_RE, mcpLogEntry, type McpLogEntry } from '@cv/core';

/** Requests returned at most (the most recent of the month). */
export const MCP_LOG_MAX_ENTRIES = 5000;
/** Bytes read at most: the end of a larger file. */
const MAX_BYTES = 20 * 1024 * 1024;

export interface McpLogView {
  /** false without out/ (the journal cannot be read). */
  available: boolean;
  /** Months with a journal, the most recent first (AAAA-MM). */
  months: string[];
  month: string | null;
  entries: McpLogEntry[];
  invalidLines: number;
  truncated: boolean;
}

async function readTail(file: string): Promise<{ text: string; cut: boolean }> {
  const size = (await stat(file)).size;
  const start = Math.max(0, size - MAX_BYTES);
  const handle = await open(file, 'r');
  try {
    const buffer = Buffer.alloc(size - start);
    await handle.read(buffer, 0, buffer.length, start);
    const text = buffer.toString('utf8');
    // A cut file starts in the middle of a line: drop it.
    return start > 0 ? { text: text.slice(text.indexOf('\n') + 1), cut: true } : { text, cut: false };
  } finally {
    await handle.close();
  }
}

export async function readMcpLog(outDir: string | null, month: string | null): Promise<McpLogView> {
  const empty = { entries: [], invalidLines: 0, truncated: false };
  if (!outDir) return { available: false, months: [], month: null, ...empty };
  const dir = path.join(outDir, MCP_LOG_DIR);
  const names = await readdir(dir).catch(() => [] as string[]);
  const months = names
    .map((n) => MCP_LOG_FILE_RE.exec(n)?.[1])
    .filter((m): m is string => m !== undefined)
    .sort()
    .reverse();
  const chosen = month ?? months[0] ?? null;
  if (chosen === null || !months.includes(chosen)) return { available: true, months, month: chosen, ...empty };

  const { text, cut } = await readTail(path.join(dir, `mcp-${chosen}.jsonl`));
  const entries: McpLogEntry[] = [];
  let invalidLines = 0;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      invalidLines++;
      continue;
    }
    const parsed = mcpLogEntry.safeParse(raw);
    if (parsed.success) entries.push(parsed.data);
    else invalidLines++;
  }
  // Lines are appended when the response leaves: sorted again on the time of the request, then on its
  // order in the session (same millisecond).
  entries.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : b.seq - a.seq));
  return {
    available: true,
    months,
    month: chosen,
    entries: entries.slice(0, MCP_LOG_MAX_ENTRIES),
    invalidLines,
    truncated: cut || entries.length > MCP_LOG_MAX_ENTRIES,
  };
}
