// Top bar of the selection screen (§10.1): the preset and its actions (F-PRE-02: create, duplicate,
// rename, archive, default), the application selector (an open application is edited like a preset),
// language and enVariant, density (F-SEL-08), layout (F-MOD-02/03: the visual layout gets its badge and
// its defaults, ADR 0017), photo (§5.2: unchecked when switching to English, can be checked again), the
// fill gauge with the overflow in lines, and the export buttons with the reasons of a blocked export
// (F-SEL-07, F-EXP-01 to 03, F-UI-06).
import { useEffect, useId, useRef, useState } from 'react';
import {
  applyLanguage,
  applyLayout,
  AVAILABLE_LAYOUTS,
  HUMAN_READING_NOTICE,
  LAYOUT_LABELS,
  type AvailableLayout,
  type LanguageChoice,
} from '@cv/core/selection';
import { ApiError, type RenderResponse } from '../api';
import { useCv } from '../state/cv-store';
import { ExportPanel, type FixHandler } from './ExportPanel';
import { buttonClass } from './fields';

type DialogKind = 'create' | 'duplicate' | 'rename';

const DIALOG_TITLE: Record<DialogKind, string> = {
  create: 'Nouveau preset',
  duplicate: 'Dupliquer le preset',
  rename: 'Renommer le preset',
};

function errorText(e: unknown): string {
  if (e instanceof ApiError && e.issues.length) return e.issues.map((i) => i.message).join(' ; ');
  return (e as Error).message;
}

/** Native modal dialog asking for a preset name. */
function NameDialog({
  kind,
  initial,
  onSubmit,
  onClose,
}: {
  kind: DialogKind;
  initial: string;
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto w-96 rounded-lg p-4 shadow-xl backdrop:bg-slate-900/30"
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          onSubmit(name.trim())
            .then(() => ref.current?.close())
            .catch((err: unknown) => setError(errorText(err)))
            .finally(() => setBusy(false));
        }}
      >
        <h2 id={titleId} className="text-base font-semibold">
          {DIALOG_TITLE[kind]}
        </h2>
        {kind === 'create' && <p className="text-sm text-slate-600">Le nouveau preset part d'une sélection vide.</p>}
        {kind === 'duplicate' && (
          <p className="text-sm text-slate-600">
            La copie reprend la sélection, l'ordre, les variantes, la langue et les options.
          </p>
        )}
        <label className="block text-sm">
          Nom
          <input
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
            value={name}
            required
            autoFocus
            onChange={(e) => setName(e.target.value)}
            aria-invalid={error ? true : undefined}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className={buttonClass.secondary} onClick={() => ref.current?.close()}>
            Annuler
          </button>
          <button type="submit" className={buttonClass.primary} disabled={busy || !name.trim()}>
            Valider
          </button>
        </div>
      </form>
    </dialog>
  );
}

/** Fill gauge (F-SEL-07): the 100 % mark stays visible, an overflow shows beyond it in red. */
export function Gauge({ render }: { render: RenderResponse }) {
  const pct = Math.round(render.fillRatio * 100);
  const max = 150;
  const over = render.overflowLines > 0;
  const lines = `${render.overflowLines} ligne${render.overflowLines > 1 ? 's' : ''}`;
  return (
    <div className="flex items-center gap-2 text-sm">
      <div
        role="meter"
        aria-label="Remplissage de la page"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(pct, max)}
        aria-valuetext={over ? `${pct} %, dépasse d'environ ${lines}` : `${pct} % de la page`}
        className="relative h-2.5 w-40 overflow-hidden rounded bg-slate-200"
      >
        <div
          className={`h-full ${over ? 'bg-red-600' : pct >= 95 ? 'bg-amber-500' : 'bg-green-600'}`}
          style={{ width: `${(Math.min(pct, max) / max) * 100}%` }}
        />
        <div className="absolute inset-y-0 w-0.5 bg-slate-700" style={{ left: `${(100 / max) * 100}%` }} />
      </div>
      <span className={over ? 'font-semibold text-red-700' : ''}>{pct} %</span>
      {over && <span className="text-red-700">dépasse d'environ {lines}</span>}
    </div>
  );
}

const SAVE_LABEL = {
  enregistré: 'Enregistré',
  'en attente': 'Modifications en attente…',
  enregistrement: 'Enregistrement…',
  erreur: 'Enregistrement impossible',
  conflit: 'Conflit',
} as const;

export function PresetBar({ onFix }: { onFix: FixHandler }) {
  const presets = useCv((s) => s.presets);
  const identity = useCv((s) => s.library?.identity.value ?? null);
  const [langNotice, setLangNotice] = useState<string | null>(null);
  const preset = useCv((s) => s.draft);
  const save = useCv((s) => s.save);
  const render = useCv((s) => s.preview.response);
  const mode = useCv((s) => s.mode);
  const activeId = useCv((s) => s.activeId);
  const applications = useCv((s) => s.applications);
  const application = useCv((s) => s.application);
  const {
    edit,
    activate,
    openApplication,
    createPreset,
    renamePreset,
    archivePreset,
    setDefaultPreset,
    resolveConflict,
  } = useCv.getState();
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!preset) return null;
  const live = presets.filter((p) => !p.archived);
  const archived = presets.filter((p) => p.archived);
  const run = (action: () => Promise<unknown>) => {
    setActionError(null);
    action().catch((e: unknown) => setActionError(errorText(e)));
  };

  return (
    <div className="space-y-2 border-b border-slate-200 bg-white px-4 py-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <span className="font-medium">Preset</span>
          <select
            className="max-w-64 rounded border border-slate-300 px-2 py-1"
            value={mode === 'preset' ? preset.id : ''}
            onChange={(e) => {
              const id = e.target.value;
              run(async () => {
                if (!(await activate(id)))
                  throw new Error("enregistrez ou résolvez d'abord les modifications en cours");
              });
            }}
          >
            {mode === 'application' && (
              <option value="" disabled>
                — (candidature ouverte)
              </option>
            )}
            {live.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.isDefault ? ' (par défaut)' : ''}
              </option>
            ))}
            {archived.length > 0 && (
              <optgroup label="Archivés">
                {archived.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="font-medium">Candidature</span>
          <select
            className="max-w-72 rounded border border-slate-300 px-2 py-1"
            value={mode === 'application' ? (application?.application.id ?? '') : ''}
            onChange={(e) => {
              const id = e.target.value;
              run(async () => {
                const done = id ? await openApplication(id) : activeId ? await activate(activeId) : true;
                if (!done) throw new Error("enregistrez ou résolvez d'abord les modifications en cours");
              });
            }}
          >
            <option value="">Aucune (éditer le preset)</option>
            {applications.map((a) => (
              <option key={a.id} value={a.id}>
                {a.company} – {a.jobTitle}
              </option>
            ))}
          </select>
        </label>
        {mode === 'application' && application && (
          <>
            <span className="text-xs text-slate-600">
              Preset de départ : {application.basePreset?.name ?? application.application.basePresetId} (non modifié)
            </span>
            <button
              type="button"
              className={buttonClass.small}
              onClick={() => {
                // Same navigation as the screen tabs (the shell listens to popstate).
                window.history.pushState(null, '', `/candidatures/${application.application.id}/lettre`);
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
            >
              ✉ Lettre
            </button>
          </>
        )}
        <span className={`flex flex-wrap gap-1 ${mode === 'application' ? 'hidden' : ''}`}>
          <button type="button" className={buttonClass.small} onClick={() => setDialog('create')}>
            Nouveau
          </button>
          <button type="button" className={buttonClass.small} onClick={() => setDialog('duplicate')}>
            Dupliquer
          </button>
          <button type="button" className={buttonClass.small} onClick={() => setDialog('rename')}>
            Renommer
          </button>
          <button
            type="button"
            className={buttonClass.small}
            disabled={preset.isDefault && !preset.archived}
            title={preset.isDefault ? "Le preset par défaut ne s'archive pas" : undefined}
            onClick={() => run(() => archivePreset(preset.id, !preset.archived))}
          >
            {preset.archived ? 'Restaurer' : 'Archiver'}
          </button>
          <button
            type="button"
            className={buttonClass.small}
            disabled={preset.isDefault || preset.archived}
            onClick={() => run(() => setDefaultPreset(preset.id))}
          >
            {preset.isDefault ? '★ Par défaut' : 'Définir par défaut'}
          </button>
        </span>

        <label className="flex items-center gap-2">
          <span className="font-medium">Langue</span>
          <select
            className="rounded border border-slate-300 px-2 py-1"
            value={preset.lang === 'fr' ? 'fr' : preset.enVariant}
            onChange={(e) => {
              const v: LanguageChoice = e.target.value === 'fr' ? 'fr' : e.target.value === 'en-US' ? 'en-US' : 'en-GB';
              let unchecked = false;
              edit((p) => {
                unchecked = applyLanguage(p, v);
              });
              setLangNotice(
                unchecked
                  ? "Photo décochée pour l'anglais (peu d'usage hors de France) : vous pouvez la recocher."
                  : null,
              );
            }}
          >
            <option value="fr">FR</option>
            <option value="en-GB">EN-GB (A4)</option>
            <option value="en-US">EN-US (Letter)</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="font-medium">Densité</span>
          <select
            className="rounded border border-slate-300 px-2 py-1"
            value={preset.template.theme.density}
            onChange={(e) => {
              const v = e.target.value === 'compacte' ? 'compacte' : 'normale';
              edit((p) => {
                p.template.theme.density = v;
              });
            }}
          >
            <option value="normale">Normale</option>
            <option value="compacte">Compacte</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="font-medium">Modèle</span>
          <select
            className="rounded border border-slate-300 px-2 py-1"
            value={preset.template.layout}
            onChange={(e) => {
              const layout = (AVAILABLE_LAYOUTS as readonly string[]).includes(e.target.value)
                ? (e.target.value as AvailableLayout)
                : 'ats-classique';
              let change: ReturnType<typeof applyLayout> = { regulatoryPlacement: null, suggestPhoto: false };
              edit((p) => {
                change = applyLayout(p, layout, !!identity?.photo);
              });
              const notes = [
                change.regulatoryPlacement === 'own-section'
                  ? '« Normes et réglementation » passe en section dédiée (défaut du modèle visuel).'
                  : change.regulatoryPlacement === 'skills-subgroup'
                    ? '« Normes et réglementation » revient en ligne dans Compétences (défaut des modèles ATS).'
                    : null,
                change.suggestPhoto
                  ? 'Le modèle visuel intègre la photo : cochez « Photo » si vous le souhaitez.'
                  : null,
              ].filter((x): x is string => !!x);
              setLangNotice(notes.length ? notes.join(' ') : null);
            }}
          >
            {AVAILABLE_LAYOUTS.map((l) => (
              <option key={l} value={l}>
                {LAYOUT_LABELS[l]}
              </option>
            ))}
          </select>
          {preset.template.layout === 'visuel' && (
            <span
              className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900"
              title={HUMAN_READING_NOTICE}
            >
              Lecture humaine
            </span>
          )}
        </label>
        <label
          className={`flex items-center gap-1 ${identity?.photo ? '' : 'text-slate-400'}`}
          title={
            identity?.photo
              ? 'Ignorée par les ATS, déconseillée hors de France : feu orange T-ATS-16'
              : "Importez d'abord une photo dans l'identité"
          }
        >
          <input
            type="checkbox"
            checked={preset.options.photo && !!identity?.photo}
            disabled={!identity?.photo}
            onChange={(e) => {
              const on = e.target.checked;
              setLangNotice(null);
              edit((p) => {
                p.options.photo = on;
              });
            }}
          />
          Photo
        </label>

        <span className="ml-auto flex items-center gap-4">
          {render && <Gauge render={render} />}
          <span
            className={`text-xs ${save.status === 'erreur' || save.status === 'conflit' ? 'text-red-700' : 'text-slate-500'}`}
            aria-live="polite"
          >
            {SAVE_LABEL[save.status]}
          </span>
        </span>
      </div>

      {preset.archived && (
        <p className="rounded bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
          Preset archivé : il reste modifiable, mais n'apparaît plus dans la liste principale.
        </p>
      )}
      {save.status === 'conflit' && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded bg-amber-50 px-3 py-1.5 text-sm text-amber-900"
        >
          <span className="flex-1">{save.message} Que faire de vos modifications non enregistrées ?</span>
          <button type="button" className={buttonClass.secondary} onClick={() => resolveConflict('reload')}>
            Recharger la version enregistrée
          </button>
          <button type="button" className={buttonClass.secondary} onClick={() => resolveConflict('keep')}>
            Garder mes modifications
          </button>
        </div>
      )}
      {save.status === 'erreur' && save.message && (
        <p role="alert" className="rounded bg-red-50 px-3 py-1.5 text-sm text-red-800">
          Enregistrement impossible : {save.message}
        </p>
      )}
      {actionError && (
        <p role="alert" className="rounded bg-red-50 px-3 py-1.5 text-sm text-red-800">
          {actionError}
        </p>
      )}
      {langNotice && (
        <p role="status" className="flex items-center gap-2 rounded bg-amber-50 px-3 py-1.5 text-sm text-amber-900">
          <span className="flex-1">{langNotice}</span>
          <button type="button" className={buttonClass.small} onClick={() => setLangNotice(null)}>
            Fermer
          </button>
        </p>
      )}
      {render && <ExportPanel render={render} onFix={onFix} />}

      {dialog && (
        <NameDialog
          kind={dialog}
          initial={dialog === 'rename' ? preset.name : dialog === 'duplicate' ? `${preset.name} (copie)` : ''}
          onClose={() => setDialog(null)}
          onSubmit={async (name) => {
            if (dialog === 'rename') await renamePreset(name);
            else await createPreset(name, dialog === 'duplicate' ? preset.id : null);
          }}
        />
      )}
    </div>
  );
}
