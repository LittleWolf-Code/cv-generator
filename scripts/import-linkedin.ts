// `npm run import:linkedin -- [fichier] [--dry-run] [--lang en]` (F-IMP-02, ADR 0015): the LinkedIn
// import from a terminal, with the function shared by the interface and import_linkedin (MCP-21).
// `fichier`: a ZIP or an expected CSV of import/; without it, every expected CSV at the root of import/.
// Writes only proposals, to accept or reject in « À valider ». `--dry-run` writes nothing and prints
// only the names of the files and columns and counts, never a value (to confirm the columns of a real
// export). Data directory: CV_DATA_DIR, otherwise data/.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataStore, importLinkedIn } from '@cv/store';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (existsSync(path.join(ROOT, '.env'))) process.loadEnvFile(path.join(ROOT, '.env'));

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const langIndex = args.indexOf('--lang');
  const lang = langIndex >= 0 && args[langIndex + 1] === 'en' ? 'en' : 'fr';
  const fileName = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--lang') ?? null;

  const override = process.env.CV_DATA_DIR;
  if (override && !path.isAbsolute(override)) throw new Error(`CV_DATA_DIR doit être un chemin absolu : ${override}`);
  const dataDir = override ?? path.join(ROOT, 'data');
  if (!existsSync(dataDir)) throw new Error(`dossier de données introuvable : ${dataDir} (npm run data:init)`);
  const importDir = path.join(ROOT, 'import');

  const report = await importLinkedIn(DataStore.open(dataDir), { importDir, fileName, lang, dryRun });
  const out: string[] = [
    `${dryRun ? 'Essai à blanc (rien n\u2019est écrit)' : 'Import LinkedIn'} : ${report.source}`,
    ...report.files.map((f) => {
      const parts = [`${f.columns.known.length} colonne(s) attendue(s)`];
      if (f.columns.unknown.length) parts.push(`inconnues : ${f.columns.unknown.join(', ')}`);
      if (f.columns.ignored.length) parts.push(`ignorées : ${f.columns.ignored.join(', ')}`);
      if (f.columns.missing.length) parts.push(`absentes : ${f.columns.missing.join(', ')}`);
      const dates = f.dateFormats
        ? ` ; dates : ${Object.entries(f.dateFormats)
            .map(
              ([c, n]) =>
                `${c} (${Object.entries(n)
                  .map(([k, v]) => `${v} ${k}`)
                  .join(', ')})`,
            )
            .join(' ; ')}`
        : '';
      const levels = f.levels ? ` ; niveaux : ${f.levels.native} natif(s), ${f.levels.toSpecify} à préciser` : '';
      return `  ${f.file} : ${f.rows} ligne(s), ${parts.join(' ; ')}${dates}${levels}`;
    }),
  ];
  if (report.skipped.length) out.push(`  ${report.skipped.length} fichier(s) de l'archive non lus (hors CSV attendus)`);
  if (!dryRun) {
    out.push(
      `${report.created} proposition(s) créée(s), ${report.duplicates.length} doublon(s), ${report.rejected.length} rejet(s), ${report.incomplete.length} élément(s) incomplet(s) non proposé(s)`,
    );
    if (report.datesToVerify) out.push(`${report.datesToVerify} date(s) à vérifier (acceptation une par une)`);
    if (report.languagesWithoutLevel.length)
      out.push(`${report.languagesWithoutLevel.length} langue(s) sans niveau CECRL`);
    out.push('À valider dans l\u2019interface : npm run dev, écran « À valider ».');
  }
  const found = Object.entries(report.identityFound)
    .filter(([, v]) => v)
    .map(([k]) => k);
  if (found.length) out.push(`Identité trouvée (${found.join(', ')}) : à préremplir depuis l'écran Identité.`);
  console.log(out.join('\n'));
}

main().catch((err: unknown) => {
  console.error(`import:linkedin : ${(err as Error).message}`);
  process.exit(1);
});
