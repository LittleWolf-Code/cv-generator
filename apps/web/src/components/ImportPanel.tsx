// LinkedIn import from the interface (F-IMP-02, ADR 0015): the files of import/ are designated by name;
// the import creates proposals that arrive in this screen like Claude's, with a report: proposals
// created, duplicates, rejected, incomplete elements, unknown and ignored columns, dates to check,
// languages without a CEFR level, identity found (prefilled from the identity form, never saved here).
import { useEffect, useState } from 'react';
import { api, type ImportFileRow, type Lang, type LinkedInReport } from '../api';
import { buttonClass } from './fields';

const TYPE: Record<string, string> = {
  title: 'Titre',
  summary: 'Accroche',
  experience: 'Expérience',
  education: 'Formation',
  project: 'Projet',
  skill: 'Compétence',
  certification: 'Certification',
  language: 'Langue',
};

const IDENTITY: Record<string, string> = {
  firstName: 'prénom',
  lastName: 'nom',
  email: 'e-mail',
  phone: 'téléphone',
  location: 'ville et pays',
};

/** `null`: every expected CSV at the root of import/. */
type Choice = string | null;

function Report({ report, onShow }: { report: LinkedInReport; onShow: (ids: string[]) => void }) {
  const found = Object.entries(report.identityFound)
    .filter(([, v]) => v)
    .map(([k]) => IDENTITY[k] ?? k);
  return (
    <div className="space-y-2 rounded bg-slate-50 p-3 text-sm" role="status">
      <p className="font-medium">
        Import de {report.source} : {report.created} proposition{report.created > 1 ? 's' : ''} créée
        {report.created > 1 ? 's' : ''}, {report.duplicates.length} doublon{report.duplicates.length > 1 ? 's' : ''},{' '}
        {report.rejected.length} rejet{report.rejected.length > 1 ? 's' : ''}.
        {report.proposalIds.length > 0 && (
          <button type="button" className="ml-2 underline" onClick={() => onShow(report.proposalIds)}>
            Afficher ces propositions
          </button>
        )}
      </p>
      {report.datesToVerify > 0 && (
        <p className="text-amber-900">
          {report.datesToVerify} élément{report.datesToVerify > 1 ? 's' : ''} avec une date à vérifier : à accepter un
          par un (l'année seule est retenue, jamais un mois inventé).
        </p>
      )}
      {report.languagesWithoutLevel.length > 0 && (
        <p className="text-amber-900">
          Niveau CECRL à préciser : {report.languagesWithoutLevel.join(', ')}. Tant qu'il n'est pas renseigné (modifier
          puis accepter, ou dans la bibliothèque), l'export d'un CV qui affiche cette langue est bloqué.
        </p>
      )}
      {found.length > 0 && (
        <p>
          Identité trouvée ({found.join(', ')}) : rien n'est enregistré. Pour préremplir les champs vides, ouvrez
          Bibliothèque › Identité, bouton « Préremplir depuis l'export LinkedIn ».
        </p>
      )}
      {report.duplicates.length > 0 && (
        <details>
          <summary className="cursor-pointer">Doublons ({report.duplicates.length})</summary>
          <ul className="ml-5 list-disc">
            {report.duplicates.map((d, i) => (
              <li key={i}>
                {TYPE[d.type] ?? d.type} « {d.label} » : doublon de{' '}
                {d.inPending ? 'la proposition en attente' : "l'élément"} <code>{d.duplicateOf}</code> ({d.hint})
                {d.proposalIds.length > 0 && ` ; ${d.proposalIds.length} proposition(s) de complément`}
              </li>
            ))}
          </ul>
        </details>
      )}
      {report.incomplete.length > 0 && (
        <details>
          <summary className="cursor-pointer">Non proposés, incomplets ({report.incomplete.length})</summary>
          <ul className="ml-5 list-disc">
            {report.incomplete.map((x, i) => (
              <li key={i}>
                {TYPE[x.type] ?? x.type} « {x.label} » ({x.file}, ligne {x.row}) : {x.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
      {report.rejected.length > 0 && (
        <details>
          <summary className="cursor-pointer">Rejetés ({report.rejected.length})</summary>
          <ul className="ml-5 list-disc">
            {report.rejected.map((x, i) => (
              <li key={i}>
                {TYPE[x.type] ?? x.type} « {x.label} » : {x.reasons.join(' ; ')}
              </li>
            ))}
          </ul>
        </details>
      )}
      <details>
        <summary className="cursor-pointer">
          Fichiers et colonnes ({report.files.length} fichier{report.files.length > 1 ? 's' : ''}
          {report.unknownColumns.length ? `, ${report.unknownColumns.length} colonne(s) inconnue(s)` : ''})
        </summary>
        <ul className="ml-5 list-disc">
          {report.files.map((f) => (
            <li key={f.file}>
              {f.file} : {f.rows} ligne{f.rows > 1 ? 's' : ''}
              {f.columns.unknown.length > 0 && <> ; inconnues (journalisées) : {f.columns.unknown.join(', ')}</>}
              {f.columns.ignored.length > 0 && <> ; ignorées (§5.2) : {f.columns.ignored.join(', ')}</>}
              {f.columns.missing.length > 0 && <> ; absentes : {f.columns.missing.join(', ')}</>}
            </li>
          ))}
        </ul>
        {report.skipped.length > 0 && (
          <p>{report.skipped.length} fichier(s) de l'archive non lus (hors CSV attendus).</p>
        )}
      </details>
    </div>
  );
}

export function ImportPanel({ version, onShow }: { version: number; onShow: (ids: string[]) => void }) {
  const [files, setFiles] = useState<ImportFileRow[] | null>(null);
  const [available, setAvailable] = useState(true);
  const [choice, setChoice] = useState<Choice | undefined>(undefined);
  const [lang, setLang] = useState<Lang>('fr');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<LinkedInReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .importFiles()
      .then((r) => {
        setFiles(r.files.filter((f) => f.kind === 'linkedin'));
        setAvailable(r.available);
      })
      .catch((e: Error) => setError(e.message));
  }, [version]);

  const zips = (files ?? []).filter((f) => f.type === 'zip');
  const csvs = (files ?? []).filter((f) => f.type === 'csv');
  const options: Array<{ value: Choice; label: string }> = [
    ...zips.map((f) => ({ value: f.name, label: f.name })),
    ...(csvs.length ? [{ value: null, label: `CSV déposés dans import/ (${csvs.length})` }] : []),
  ];
  const selected = choice === undefined ? (options[0]?.value ?? undefined) : choice;

  const run = async () => {
    if (selected === undefined) return;
    setBusy(true);
    setError(null);
    try {
      setReport(await api.importLinkedIn(selected, lang));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-2 rounded border border-slate-200 bg-white p-3" aria-labelledby="import-title">
      <h3 id="import-title" className="font-semibold">
        Importer l'export LinkedIn
      </h3>
      {!available ? (
        <p className="text-sm text-slate-600">Dossier import/ indisponible.</p>
      ) : files && options.length === 0 ? (
        <p className="text-sm text-slate-600">
          Déposez l'export LinkedIn (le ZIP, ou ses fichiers CSV) dans le dossier import/ à la racine du projet, puis
          rouvrez cet écran. Le CV actuel (PDF ou DOCX) s'importe avec Claude : prompt importer-mon-cv.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-1">
            Fichier
            <select
              className="rounded border border-slate-300 px-1 py-0.5"
              value={selected ?? ''}
              onChange={(e) => setChoice(e.target.value === '' ? null : e.target.value)}
            >
              {options.map((o) => (
                <option key={o.value ?? ''} value={o.value ?? ''}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            Langue des textes
            <select
              className="rounded border border-slate-300 px-1 py-0.5"
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
            >
              <option value="fr">français</option>
              <option value="en">anglais</option>
            </select>
          </label>
          <button
            type="button"
            className={buttonClass.primary}
            disabled={busy || selected === undefined}
            onClick={() => void run()}
          >
            {busy ? 'Import…' : 'Importer'}
          </button>
          <span className="text-xs text-slate-500">
            Rien n'entre dans la bibliothèque : chaque élément devient une proposition à accepter ou rejeter ici.
          </span>
        </div>
      )}
      {error && (
        <p className="text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
      {report && <Report report={report} onShow={onShow} />}
    </section>
  );
}
