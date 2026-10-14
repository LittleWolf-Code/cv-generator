// The built server in a subprocess (§7.6, §12.4): started from an arbitrary cwd, every stdout line
// is a valid JSON-RPC message, logs go to stderr, every request lands in the journal (ADR 0024).
// Requires `npm run build:mcp` (run by pretest).
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { installFixture } from '@cv/store';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ENTRY = path.join(ROOT, 'apps', 'mcp', 'dist', 'index.js');
let tmp: string;

beforeAll(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'cv-stdio-'));
  await installFixture(path.join(ROOT, 'fixtures', 'personas', 'courte'), path.join(tmp, 'data'));
});
afterAll(() => rm(tmp, { recursive: true, force: true }));

function cleanEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  const env = { ...process.env, ...extra };
  delete env.CV_ROOT;
  delete env.CLAUDE_PROJECT_DIR;
  return env;
}

interface Run {
  stdout: string;
  stderr: string;
  code: number | null;
}

/** Sends JSON-RPC lines, waits for `expectedResponses` responses (or exit), then closes stdin. */
function runServer(env: NodeJS.ProcessEnv, messages: object[], expectedResponses: number): Promise<Run> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [ENTRY], { cwd: os.tmpdir(), env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill(), 20_000);
    child.stdout.on('data', (d: Buffer) => {
      stdout += d.toString('utf8');
      const responses = stdout.split('\n').filter((l) => l.includes('"id"')).length;
      if (responses >= expectedResponses) child.stdin.end();
    });
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString('utf8')));
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
    for (const m of messages) child.stdin.write(`${JSON.stringify(m)}\n`);
    if (expectedResponses === 0) child.stdin.end();
  });
}

describe('serveur MCP en sous-processus (stdio)', () => {
  it('le build existe (npm run build:mcp)', () => {
    expect(existsSync(ENTRY)).toBe(true);
  });

  it('démarre depuis un cwd quelconque et n\u2019écrit que du JSON-RPC sur stdout', async () => {
    const run = await runServer(
      cleanEnv({
        CV_DATA_DIR: path.join(tmp, 'data'),
        // Never the journal of the project's out/.
        CV_OUT_DIR: path.join(tmp, 'out'),
        CV_SSH_CONNECTION: '203.0.113.7 51234 198.51.100.2 22',
      }),
      [
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '0' } },
        },
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
        { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_overview', arguments: {} } },
      ],
      3,
    );
    const lines = run.stdout.split('\n').filter((l) => l.trim());
    expect(lines.length).toBeGreaterThanOrEqual(3);
    for (const line of lines) {
      const msg = JSON.parse(line) as { jsonrpc?: string };
      expect(msg.jsonrpc).toBe('2.0');
    }
    const byId = new Map(
      lines.map((l) => JSON.parse(l) as { id?: number; result?: Record<string, unknown> }).map((m) => [m.id, m]),
    );
    expect((byId.get(1)!.result as { protocolVersion: string }).protocolVersion).toBe('2025-11-25');
    expect((byId.get(2)!.result as { tools: unknown[] }).tools).toHaveLength(22);
    expect(run.stdout).not.toContain('camille.martin@example.com');
    // The root is deduced from the module location, never from the cwd.
    expect(run.stderr).toContain(`racine du projet : ${ROOT}`);
    expect(run.stderr).toContain('source : module');

    // Journal: one line per request, the address passed on by the SSH command.
    const logDir = path.join(tmp, 'out', 'logs');
    const [file] = await readdir(logDir);
    const journal = (await readFile(path.join(logDir, file!), 'utf8'))
      .split('\n')
      .filter(Boolean)
      .map(
        (l) => JSON.parse(l) as { method: string; name: string | null; ip: string; client: string; leaks: string[] },
      );
    expect(journal.map((e) => e.name ?? e.method)).toEqual(['initialize', 'tools/list', 'get_overview']);
    expect(journal.every((e) => e.ip === '203.0.113.7' && e.client === 'test 0' && e.leaks.length === 0)).toBe(true);
    expect(run.stderr).toContain('client 203.0.113.7');
  });

  it('refuse de démarrer sans dossier de données et indique npm run data:init', async () => {
    const run = await runServer(cleanEnv({ CV_DATA_DIR: path.join(tmp, 'absent') }), [], 0);
    expect(run.code).toBe(1);
    expect(run.stdout).toBe('');
    expect(run.stderr).toContain('npm run data:init');
  });
});
