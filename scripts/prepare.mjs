// Installs the versioned git hooks (guard-commit, NF-03) for this clone.
// Only touches the repository's local config, never the global one.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (existsSync('.git')) {
  try {
    execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' });
  } catch {
    console.error('prepare: git introuvable, hook guard-commit non installé.');
  }
}
