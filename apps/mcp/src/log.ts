// stdout is reserved for the MCP protocol (§7.6): every log goes to stderr.

export function log(message: string): void {
  process.stderr.write(`[cv-mcp] ${message}\n`);
}
