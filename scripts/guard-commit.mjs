#!/usr/bin/env node
// NF-03 guard: refuses a commit whose staged files touch real personal data.
// Installed as the pre-commit hook through `git config core.hooksPath .githooks`
// (done by the root `prepare` script). Plain JS so it runs without any build.
import { execFileSync } from 'node:child_process';

const FORBIDDEN = [
  { re: /^data\//i, why: 'data/ contient les données réelles' },
  { re: /^import\//i, why: "import/ contient le CV, l'export LinkedIn et les offres" },
  { re: /^out\//i, why: 'out/ contient des rendus de données réelles' },
  { re: /^auth\//i, why: "auth/ contient les clés de sécurité enregistrées de l'instance en ligne" },
  { re: /(^|\/)\.env$/i, why: '.env peut contenir des chemins ou réglages personnels' },
  { re: /(^|\/)\.env\.(?!example$)[^/]+$/i, why: 'fichier .env.* personnel' },
  { re: /^docs\/prive\//i, why: 'docs/prive/ décrit le serveur et les accès de l’auteur' },
  { re: /^scripts\/vps\//i, why: 'scripts/vps/ est l’outillage privé du serveur de l’auteur' },
  { re: /^scripts\/deploy-vps\.ts$/i, why: 'outillage de déploiement privé' },
  { re: /^\.mcp\.json$/i, why: '.mcp.json contient l’hôte SSH du poste (modèle : .mcp.json.example)' },
];

function stagedFiles() {
  const out = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], {
    encoding: 'utf8',
  });
  return out.split('\0').filter(Boolean);
}

const offending = [];
for (const file of stagedFiles()) {
  const normalized = file.replace(/\\/g, '/');
  const rule = FORBIDDEN.find((r) => r.re.test(normalized));
  if (rule) offending.push(`  - ${normalized} (${rule.why})`);
}

if (offending.length > 0) {
  console.error('guard-commit : commit refusé, ces fichiers ne doivent jamais être versionnés :');
  console.error(offending.join('\n'));
  console.error("Retirez-les de l'index : git restore --staged <fichier>");
  process.exit(1);
}
