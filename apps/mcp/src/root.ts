// Project root resolution (§7.6): CV_ROOT, then CLAUDE_PROJECT_DIR, then the folder deduced from
// this module (apps/mcp/dist/index.js → ../../..). Never process.cwd().
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ResolvedRoot {
  root: string;
  source: 'CV_ROOT' | 'CLAUDE_PROJECT_DIR' | 'module';
  dataDir: string;
  outDir: string;
  importDir: string;
}

const ROOT_PACKAGE_NAME = 'cv-generator';

/** True when `dir` is this project (root package.json named cv-generator). */
export function isProjectRoot(dir: string): boolean {
  try {
    const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as { name?: string };
    return pkg.name === ROOT_PACKAGE_NAME;
  } catch {
    return false;
  }
}

export function moduleRoot(moduleUrl: string = import.meta.url): string {
  // src/root.ts and dist/root.js both sit in apps/mcp/<dir>/: three levels up is the project root.
  return path.resolve(path.dirname(fileURLToPath(moduleUrl)), '..', '..', '..');
}

export function resolveRoot(env: NodeJS.ProcessEnv = process.env, moduleUrl: string = import.meta.url): ResolvedRoot {
  let root: string;
  let source: ResolvedRoot['source'];
  if (env.CV_ROOT) {
    root = path.resolve(env.CV_ROOT);
    source = 'CV_ROOT';
  } else if (env.CLAUDE_PROJECT_DIR && isProjectRoot(env.CLAUDE_PROJECT_DIR)) {
    // Claude Code sets CLAUDE_PROJECT_DIR to the project it runs in: only trusted if it is this one.
    root = path.resolve(env.CLAUDE_PROJECT_DIR);
    source = 'CLAUDE_PROJECT_DIR';
  } else {
    root = moduleRoot(moduleUrl);
    source = 'module';
  }
  const envFile = path.join(root, '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  // CV_DATA_DIR, and CV_IMPORT_DIR and CV_OUT_DIR on the server of the online instance (ADR 0018).
  const folder = (variable: string, fallback: string) => {
    const value = env[variable] ?? process.env[variable];
    if (!value) return path.join(root, fallback);
    if (!path.isAbsolute(value)) throw new Error(`${variable} doit être un chemin absolu : ${value}`);
    return path.resolve(value);
  };
  return {
    root,
    source,
    dataDir: folder('CV_DATA_DIR', 'data'),
    outDir: folder('CV_OUT_DIR', 'out'),
    importDir: folder('CV_IMPORT_DIR', 'import'),
  };
}
