// « Candidatures » screen (F-UI-04, F-CAN-01; the letter of each application has its own page, LetterPage): list, creation, opening. The offer is
// pasted or chosen in import/offres/ (file names only, §7.6); it is untrusted data (§7.5): its
// invisible characters are removed when it is stored, and the sentences that look like instructions
// for an AI are flagged here as soon as it is pasted. The file label is proposed from the job title,
// without gender marker, and stays editable (F-EXP-04, annex B.4). The id is assigned by the server.
import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { proposeFileLabel, stripGenderMarkers } from '@cv/core/export';
import { cleanUntrusted, flagInstructions, type InstructionFlag } from '@cv/core/offer';
import { ApiError, api, type Issue } from '../api';
import { buttonClass } from '../components/fields';
import { useCv } from '../state/cv-store';

const input =
  'w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-[#1F4E79] focus:outline-2 focus:outline-[#1F4E79]';
const panel = 'rounded bg-white p-4 shadow-sm';

const frDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

/** Sentences of the offer to check (§7.5): an instruction for an AI is never executed, only shown. */
export function FlagList({ flags }: { flags: InstructionFlag[] }) {
  if (flags.length === 0) return null;
  return (
    <div role="status" className="rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-950">
      <p className="font-semibold">
        {flags.length} phrase{flags.length > 1 ? 's' : ''} à vérifier dans l'offre
      </p>
      <p className="text-xs">
        L'offre est une donnée non fiable : elle est enregistrée telle quelle, et Claude ne suit aucune consigne qu'elle
        contient.
      </p>
      <ul className="mt-1 space-y-1">
        {flags.map((f) => (
          <li key={`${f.start}-${f.end}`}>
            <span
              className={`mr-2 rounded px-1.5 text-xs ${f.level === 'consigne' ? 'bg-red-700 text-white' : 'bg-amber-200 text-amber-950'}`}
            >
              {f.level === 'consigne' ? 'ressemble à une consigne pour une IA' : 'mentionne une IA'}
            </span>
            <span className="text-xs text-slate-600">ligne {f.line} : </span>« {f.sentence} »
            <span className="block text-xs text-slate-600">{f.reasons.join(' ; ')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({
  label,
  hint,
  issues,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  issues: Issue[];
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      {issues.map((i, k) => (
        <p key={k} role="alert" className="text-xs text-red-700">
          {i.message}
        </p>
      ))}
    </div>
  );
}

type OfferSource = 'paste' | 'file';

function CreateForm({ onCreated }: { onCreated: (id: string) => Promise<void> }) {
  const presets = useCv((s) => s.presets);
  const live = presets.filter((p) => !p.archived);
  const fallback = live.find((p) => p.isDefault) ?? live[0] ?? null;
  const ids = useId();
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [reference, setReference] = useState('');
  const [url, setUrl] = useState('');
  const [language, setLanguage] = useState<'fr' | 'en-GB' | 'en-US'>('fr');
  const [label, setLabel] = useState('');
  const [labelTouched, setLabelTouched] = useState(false);
  const [presetId, setPresetId] = useState(fallback?.id ?? '');
  const [source, setSource] = useState<OfferSource>('paste');
  const [offerText, setOfferText] = useState('');
  const [offerFile, setOfferFile] = useState('');
  const [files, setFiles] = useState<Array<{ name: string; size: number }>>([]);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!presetId && fallback) setPresetId(fallback.id);
  }, [presetId, fallback]);

  const loadFiles = useCallback(() => {
    setFilesError(null);
    api
      .offers()
      .then((r) => setFiles(r.files))
      .catch((e: Error) => setFilesError(e.message));
  }, []);
  useEffect(loadFiles, [loadFiles]);

  // F-EXP-04: proposed from the job title, without gender marker, until the user edits it.
  const proposed = proposeFileLabel(jobTitle);
  const shownLabel = labelTouched ? label : proposed;
  const pasted = source === 'paste' ? cleanUntrusted(offerText) : null;
  const flags = pasted ? flagInstructions(pasted.text) : [];
  const issuesOf = (...paths: string[]) => issues.filter((i) => paths.includes(i.path));

  const submit = async () => {
    setBusy(true);
    setError(null);
    setIssues([]);
    try {
      const r = await api.createApplication({
        company,
        jobTitle,
        offerReference: reference.trim() || null,
        url: url.trim() || null,
        lang: language === 'fr' ? 'fr' : 'en',
        enVariant: language === 'en-US' ? 'en-US' : 'en-GB',
        fileLabel: shownLabel.trim() || null,
        basePresetId: presetId,
        offerText: source === 'paste' ? offerText : null,
        offerFile: source === 'file' ? offerFile || null : null,
      });
      await onCreated(r.application.id);
    } catch (e) {
      if (e instanceof ApiError && e.issues.length) setIssues(e.issues);
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className={`${panel} space-y-3`}
      aria-labelledby={`${ids}-title`}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h2 id={`${ids}-title`} className="text-base font-semibold">
        Nouvelle candidature
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Entreprise" htmlFor={`${ids}-company`} issues={issuesOf('company')}>
          <input
            id={`${ids}-company`}
            className={input}
            value={company}
            required
            onChange={(e) => setCompany(e.target.value)}
          />
        </Field>
        <Field
          label="Intitulé du poste"
          htmlFor={`${ids}-job`}
          issues={issuesOf('jobTitle')}
          hint="Tel qu'il figure dans l'offre (les marqueurs H/F sont retirés du nom des fichiers et du titre proposé)."
        >
          <input
            id={`${ids}-job`}
            className={input}
            value={jobTitle}
            required
            onChange={(e) => setJobTitle(e.target.value)}
          />
        </Field>
        <Field label="Référence de l'offre (facultative)" htmlFor={`${ids}-ref`} issues={issuesOf('offerReference')}>
          <input id={`${ids}-ref`} className={input} value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field label="URL de l'offre (facultative)" htmlFor={`${ids}-url`} issues={issuesOf('url')}>
          <input
            id={`${ids}-url`}
            className={input}
            value={url}
            inputMode="url"
            placeholder="https://…"
            onChange={(e) => setUrl(e.target.value)}
          />
        </Field>
        <Field label="Langue du CV" htmlFor={`${ids}-lang`} issues={issuesOf('lang', 'enVariant')}>
          <select
            id={`${ids}-lang`}
            className={input}
            value={language}
            onChange={(e) =>
              setLanguage(e.target.value === 'en-US' ? 'en-US' : e.target.value === 'en-GB' ? 'en-GB' : 'fr')
            }
          >
            <option value="fr">FR</option>
            <option value="en-GB">EN-GB (A4)</option>
            <option value="en-US">EN-US (Letter)</option>
          </select>
        </Field>
        <Field
          label="Preset de départ"
          htmlFor={`${ids}-preset`}
          issues={issuesOf('basePresetId')}
          hint="Sa sélection est copiée ; la candidature diverge ensuite sans modifier le preset."
        >
          <select id={`${ids}-preset`} className={input} value={presetId} onChange={(e) => setPresetId(e.target.value)}>
            {live.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.isDefault ? ' (par défaut)' : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Libellé des fichiers"
          htmlFor={`${ids}-label`}
          issues={issuesOf('fileLabel')}
          hint={
            labelTouched ? (
              <button
                type="button"
                className="underline"
                onClick={() => {
                  setLabelTouched(false);
                  setLabel('');
                }}
              >
                Reprendre la proposition tirée de l'intitulé
              </button>
            ) : (
              "Proposé à partir de l'intitulé du poste, sans marqueur de genre ; modifiable."
            )
          }
        >
          <input
            id={`${ids}-label`}
            className={input}
            value={shownLabel}
            onChange={(e) => {
              setLabelTouched(true);
              setLabel(e.target.value);
            }}
            onBlur={() => {
              if (labelTouched) setLabel(proposeFileLabel(label));
            }}
          />
        </Field>
        {jobTitle && stripGenderMarkers(jobTitle) !== jobTitle.trim() && (
          <p className="self-end text-xs text-slate-600">
            Intitulé sans marqueur de genre : « {stripGenderMarkers(jobTitle)} »
          </p>
        )}
      </div>

      <fieldset className="space-y-2 rounded border border-slate-200 p-3">
        <legend className="px-1 text-sm font-semibold">Texte de l'offre</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name={`${ids}-source`}
              checked={source === 'paste'}
              onChange={() => setSource('paste')}
            />
            Coller le texte
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name={`${ids}-source`} checked={source === 'file'} onChange={() => setSource('file')} />
            Choisir un fichier de import/offres/
          </label>
        </div>
        {source === 'paste' ? (
          <>
            <textarea
              aria-label="Texte de l'offre"
              className={`${input} h-48 font-mono`}
              value={offerText}
              onChange={(e) => setOfferText(e.target.value)}
            />
            {pasted && pasted.removed > 0 && (
              <p className="text-xs text-slate-600">
                {pasted.removed} caractère{pasted.removed > 1 ? 's' : ''} invisible{pasted.removed > 1 ? 's' : ''} ou de
                contrôle {pasted.removed > 1 ? 'seront retirés' : 'sera retiré'} à l'enregistrement.
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Fichier de l'offre"
              className="min-w-64 rounded border border-slate-300 px-2 py-1 text-sm"
              value={offerFile}
              onChange={(e) => setOfferFile(e.target.value)}
            >
              <option value="">— choisir —</option>
              {files.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.name} ({Math.max(1, Math.round(f.size / 1024))} Ko)
                </option>
              ))}
            </select>
            <button type="button" className={buttonClass.small} onClick={loadFiles}>
              Actualiser la liste
            </button>
            <span className="text-xs text-slate-500">
              {filesError ??
                (files.length === 0 ? 'Aucune offre (.md ou .txt) dans import/offres/.' : 'Fichiers .md ou .txt.')}
            </span>
          </div>
        )}
        {issuesOf('offer', 'offerFile', 'offerText').map((i, k) => (
          <p key={k} role="alert" className="text-xs text-red-700">
            {i.message}
          </p>
        ))}
        <FlagList flags={flags} />
      </fieldset>

      {error && (
        <p role="alert" className="rounded bg-red-50 px-3 py-1.5 text-sm text-red-800">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <button type="submit" className={buttonClass.primary} disabled={busy || !company.trim() || !jobTitle.trim()}>
          {busy ? 'Création…' : 'Créer et ouvrir'}
        </button>
      </div>
    </form>
  );
}

export function ApplicationsPage({ navigate }: { navigate: (path: string) => void }) {
  const applications = useCv((s) => s.applications);
  const presets = useCv((s) => s.presets);
  const openId = useCv((s) => (s.mode === 'application' ? (s.application?.application.id ?? null) : null));
  const [invalid, setInvalid] = useState<Array<{ id: string; message: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api
      .applications()
      .then((r) => setInvalid(r.invalid))
      .catch(() => setInvalid([]));
  }, [applications]);

  const open = async (id: string) => {
    setError(null);
    try {
      if (!(await useCv.getState().openApplication(id)))
        throw new Error("enregistrez ou résolvez d'abord les modifications en cours");
      navigate('/');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 p-4">
      <div className={`${panel} space-y-3`}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">Candidatures</h2>
          <button type="button" className={`ml-auto ${buttonClass.primary}`} onClick={() => setCreating((v) => !v)}>
            {creating ? 'Fermer le formulaire' : 'Nouvelle candidature'}
          </button>
        </div>
        <p className="text-sm text-slate-600">
          Une candidature part d'un preset : sa sélection est copiée, puis s'adapte à l'offre sans modifier le preset.
          Ouverte, elle s'édite comme un preset (arbre, réglages, aperçu, feux, export) et affiche la couverture des
          termes de l'offre.
        </p>
        {error && (
          <p role="alert" className="rounded bg-red-50 px-3 py-1.5 text-sm text-red-800">
            {error}
          </p>
        )}
        {applications.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune candidature pour l'instant.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-1 pr-3 font-medium">Créée le</th>
                  <th className="py-1 pr-3 font-medium">Entreprise</th>
                  <th className="py-1 pr-3 font-medium">Poste</th>
                  <th className="py-1 pr-3 font-medium">Langue</th>
                  <th className="py-1 pr-3 font-medium">Preset de départ</th>
                  <th className="py-1 pr-3 font-medium">Analyse</th>
                  <th className="py-1 pr-3 font-medium">Exports</th>
                  <th className="py-1 font-medium">
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {applications.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100 align-top">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{frDate(a.createdAt)}</td>
                    <td className="py-1.5 pr-3">{a.company}</td>
                    <td className="py-1.5 pr-3">
                      {a.jobTitle}
                      {a.offerReference && (
                        <span className="block text-xs text-slate-500">Réf. {a.offerReference}</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3">{a.lang === 'fr' ? 'FR' : a.enVariant.toUpperCase()}</td>
                    <td className="py-1.5 pr-3">
                      {presets.find((p) => p.id === a.basePresetId)?.name ?? (
                        <span className="text-slate-500">{a.basePresetId} (introuvable)</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3">
                      {a.analysis ? (
                        <>
                          {a.analysis.terms} termes
                          <span className="block text-xs text-slate-500">
                            {frDate(a.analysis.createdAt)}
                            {a.analysis.history > 0 ? ` · ${a.analysis.history} antérieure(s)` : ''}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-500">aucune</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3">{a.exports}</td>
                    <td className="py-1.5 text-right">
                      <button
                        type="button"
                        className={a.id === openId ? buttonClass.secondary : buttonClass.primary}
                        onClick={() => void open(a.id)}
                      >
                        {a.id === openId ? 'Ouverte : afficher' : 'Ouvrir'}
                      </button>
                      <button
                        type="button"
                        className={`${buttonClass.secondary} ml-1`}
                        onClick={() => navigate(`/candidatures/${a.id}/lettre`)}
                      >
                        ✉ Lettre
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {invalid.length > 0 && (
          <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-900">
            Dossiers de candidature illisibles :
            <ul className="list-disc pl-5">
              {invalid.map((i) => (
                <li key={i.id}>
                  {i.id} : {i.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {creating && (
        <CreateForm
          onCreated={async (id) => {
            const store = useCv.getState();
            await store.reloadApplications();
            setCreating(false);
            await open(id);
          }}
        />
      )}
    </main>
  );
}
