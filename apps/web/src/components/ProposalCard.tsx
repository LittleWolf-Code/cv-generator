// One proposal of the "À valider" screen (F-PRO-02 to 06): author, provenance, rationale, diff,
// automatic checks, dependencies, three-way conflict when stale, and the actions accept / edit then
// accept / reject. A selection is accepted element by element.
import { useState } from 'react';
import {
  ApiError,
  api,
  type AnyItem,
  type Bilingual,
  type DiffSegment,
  type Library,
  type Line,
  type PendingCategory,
  type ProposalView,
} from '../api';
import { buttonClass, BilingualInput } from './fields';
import { ItemEditor } from './ItemEditor';

const TYPE_LABEL: Record<ProposalView['type'], string> = {
  item: 'Nouvel élément',
  variant: 'Nouvelle variante',
  translation: 'Traduction',
  edit: 'Modification',
  alias: 'Alias',
  selection: 'Sélection',
};

export const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pending: { label: 'en attente', className: 'bg-blue-100 text-blue-900' },
  stale: { label: 'conflit', className: 'bg-amber-200 text-amber-900' },
  accepted: { label: 'acceptée', className: 'bg-green-100 text-green-900' },
  edited: { label: 'modifiée puis acceptée', className: 'bg-green-100 text-green-900' },
  rejected: { label: 'rejetée', className: 'bg-slate-200 text-slate-700' },
  superseded: { label: 'remplacée', className: 'bg-slate-200 text-slate-700' },
  introuvable: { label: 'introuvable', className: 'bg-red-100 text-red-800' },
};

/** Local date and time of an ISO timestamp (resolutions are stored in UTC, fixtures in local time). */
export function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

/** What an acceptance produced, from the resolution's final value. */
function outcome(view: ProposalView): string | null {
  const fv = view.resolution?.finalValue as Record<string, unknown> | undefined;
  if (!fv) return null;
  if (typeof fv.variantId === 'string') return `variante « ${fv.variantId} »`;
  if (Array.isArray(fv.addedBullets) && typeof fv.itemId === 'string') {
    return `${fv.addedBullets.length} puce(s) ajoutée(s) à l'élément ${fv.itemId}`;
  }
  if (typeof fv.itemId === 'string') return `élément ${fv.itemId}`;
  if (Array.isArray(fv.applied)) return `${fv.applied.length} élément(s) de sélection appliqué(s)`;
  return null;
}

const ORIGIN: Record<string, string> = { claude: 'Claude', 'import-linkedin': 'import LinkedIn' };
const SOURCE: Record<string, string> = {
  dictee: 'dictée',
  'import-cv': 'import du CV',
  'import-linkedin': 'export LinkedIn',
  offre: "offre d'emploi",
  bibliotheque: 'bibliothèque',
};

/** Import remarks shown in full (not only as a badge): the user reads them before accepting (ADR 0015). */
const REMARKS = new Set([
  'date-to-verify',
  'cefr-to-specify',
  'category-to-verify',
  'location-to-verify',
  'removed-characters',
  'max-length',
]);

export function DiffText({ segments }: { segments: DiffSegment[] }) {
  return (
    <span className="whitespace-pre-wrap">
      {segments.map((s, i) =>
        s.op === 'eq' ? (
          <span key={i}>{s.text}</span>
        ) : s.op === 'del' ? (
          <del key={i} className="mx-px rounded-sm bg-red-100 px-0.5 text-red-900" aria-label={`supprimé : ${s.text}`}>
            {s.text}
          </del>
        ) : (
          <ins
            key={i}
            className="mx-px rounded-sm bg-green-100 px-0.5 text-green-900 no-underline"
            aria-label={`ajouté : ${s.text}`}
          >
            {s.text}
          </ins>
        ),
      )}
    </span>
  );
}

function Column({ title, lines, empty }: { title: string; lines: Line[] | null; empty: string }) {
  return (
    <div className="min-w-0 rounded border border-slate-200 bg-white p-2">
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</h4>
      {lines ? (
        <dl className="space-y-1 text-sm">
          {lines.map((l, i) => (
            <div key={i}>
              <dt className="text-xs text-slate-500">{l.label}</dt>
              <dd className="whitespace-pre-wrap">{l.segments ? <DiffText segments={l.segments} /> : l.text}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm italic text-slate-500">{empty}</p>
      )}
    </div>
  );
}

/** Same JSON value in the edit box as in the stored value (text fields stay plain text). */
function asEditText(v: unknown): string {
  return typeof v === 'string' ? v : JSON.stringify(v, null, 2);
}

function EditForm({
  view,
  library,
  pendingCategories,
  onSubmit,
  onCancel,
}: {
  view: ProposalView;
  library: Library;
  pendingCategories: PendingCategory[];
  onSubmit: (edited: unknown) => Promise<void>;
  onCancel: () => void;
}) {
  const initial = view.editable as AnyItem;
  const [value, setValue] = useState<AnyItem>(() => structuredClone(initial));
  const [raw, setRaw] = useState(() => asEditText(initial.newValue));
  const [error, setError] = useState<string | null>(null);

  if (view.type === 'item') {
    return (
      <div className="rounded border border-slate-300 bg-white p-3">
        <ItemEditor
          collection={view.collection!}
          library={library}
          revision={0}
          mode={{
            kind: 'proposal',
            initial: initial.item as AnyItem,
            onSubmit: (item) => onSubmit({ item }),
            onCancel,
            pendingCategories,
          }}
          onWritten={() => undefined}
        />
      </div>
    );
  }

  const submit = async () => {
    setError(null);
    let edited: unknown = value;
    if (view.type === 'edit') {
      const original = initial.newValue;
      if (typeof original === 'string' || original === null) edited = { newValue: raw === '' ? null : raw };
      else {
        try {
          edited = { newValue: JSON.parse(raw) as unknown };
        } catch {
          setError('valeur JSON invalide');
          return;
        }
      }
    }
    await onSubmit(edited);
  };

  const conflictValues =
    view.type === 'edit' && view.conflict && typeof initial.newValue === 'string'
      ? [
          { label: 'Reprendre la valeur actuelle', line: view.conflict.current },
          { label: 'Reprendre la valeur de base', line: view.conflict.base },
        ]
      : [];

  return (
    <div className="space-y-2 rounded border border-slate-300 bg-white p-3">
      {view.type === 'variant' && (
        <>
          <label className="block text-sm">
            Libellé de la variante
            <input
              className="ml-2 rounded border border-slate-300 px-2 py-0.5 text-sm"
              value={(value.label as string | null) ?? ''}
              onChange={(e) => setValue({ ...value, label: e.target.value === '' ? null : e.target.value })}
            />
          </label>
          <BilingualInput
            value={value.text as Bilingual}
            onChange={(t) => setValue({ ...value, text: t ?? { fr: null, en: null } })}
            multiline
            label="Texte de la variante"
          />
        </>
      )}
      {view.type === 'translation' && (
        <textarea
          className="w-full rounded border border-slate-300 p-2 text-sm"
          rows={3}
          aria-label="Traduction"
          value={(value.text as string) ?? ''}
          onChange={(e) => setValue({ ...value, text: e.target.value })}
        />
      )}
      {view.type === 'alias' && (
        <div className="flex flex-wrap gap-2 text-sm">
          <input
            className="rounded border border-slate-300 px-2 py-0.5"
            aria-label="Alias"
            value={(value.alias as string) ?? ''}
            onChange={(e) => setValue({ ...value, alias: e.target.value })}
          />
          <select
            className="rounded border border-slate-300 px-1"
            aria-label="Type"
            value={value.kind as string}
            onChange={(e) => setValue({ ...value, kind: e.target.value })}
          >
            <option value="alias">alias (équivalent strict)</option>
            <option value="related">terme voisin</option>
          </select>
        </div>
      )}
      {view.type === 'edit' && (
        <>
          <textarea
            className="w-full rounded border border-slate-300 p-2 font-mono text-sm"
            rows={typeof initial.newValue === 'string' ? 2 : 5}
            aria-label="Nouvelle valeur"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
          {conflictValues.map(
            (c) =>
              c.line?.[0] && (
                <button
                  key={c.label}
                  type="button"
                  className={buttonClass.small}
                  onClick={() => setRaw(c.line![0]!.text)}
                  title={c.line[0].text}
                >
                  {c.label}
                </button>
              ),
          )}
        </>
      )}
      {error && <p className="text-sm text-red-800">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className={buttonClass.primary} onClick={() => void submit()}>
          Accepter cette version
        </button>
        <button type="button" className={buttonClass.secondary} onClick={onCancel}>
          Annuler
        </button>
      </div>
    </div>
  );
}

export function ProposalCard({
  view,
  library,
  pendingCategories = [],
  onChanged,
}: {
  view: ProposalView;
  library: Library;
  /** Categories still proposed, which a skill may target in "modifier puis accepter" (ADR 0023). */
  pendingCategories?: PendingCategory[];
  onChanged: () => void;
}) {
  const open = view.status === 'pending' || view.status === 'stale';
  const [editing, setEditing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elements, setElements] = useState<Set<string>>(
    () => new Set((view.selection ?? []).filter((r) => r.applicable).map((r) => r.key)),
  );
  const pendingDeps = view.dependsOn.filter((d) => d.status === 'pending' || d.status === 'stale');
  // "Modifier puis accepter" may move a skill to a pending category that was not its dependency
  // (ADR 0023): the store computes the dependency on the final value, so it must be allowed to accept it.
  const targetsPendingCategory = (edited: unknown): boolean => {
    const e = edited as { item?: { category?: unknown }; newValue?: unknown } | undefined;
    const target = view.type === 'item' ? e?.item?.category : view.type === 'edit' ? e?.newValue : undefined;
    return (
      typeof target === 'string' &&
      !library.categories.some((c) => c.id === target) &&
      pendingCategories.some((c) => c.id === target)
    );
  };
  const status = STATUS_LABEL[view.status]!;

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setEditing(false);
      setRejecting(false);
      onChanged();
    } catch (err) {
      const e = err as ApiError;
      const details =
        e instanceof ApiError && e.issues.length
          ? ` : ${e.issues.map((i) => `${i.path} ${i.message}`.trim()).join(' ; ')}`
          : '';
      setError(e.message + details);
    } finally {
      setBusy(false);
    }
  };

  const accept = (edited?: unknown) =>
    act(() =>
      api.accept(view.id, {
        ...(edited !== undefined ? { edited } : {}),
        // The pending variants of a selection, the pending category of a skill (ADR 0023): accepted first.
        // The store computes the dependency on the final value, so a skill moved to a validated category
        // by "modifier puis accepter" does not accept it.
        ...(view.selection ? { elements: [...elements] } : {}),
        withDependencies: pendingDeps.length > 0 || targetsPendingCategory(edited),
      }),
    );

  return (
    <article
      className={`rounded border bg-white p-4 shadow-sm ${view.status === 'stale' ? 'border-amber-400' : 'border-slate-200'}`}
      aria-labelledby={`p-${view.id}`}
    >
      <header className="flex flex-wrap items-center gap-2">
        <h3 id={`p-${view.id}`} className="font-semibold">
          {view.duplicateOf
            ? "Complément d'un élément"
            : view.type === 'item' && view.collection === 'categories'
              ? 'Nouvelle catégorie'
              : TYPE_LABEL[view.type]}
        </h3>
        <span className={`rounded px-2 text-xs ${status.className}`}>{status.label}</span>
        {view.sensitive && (
          <span
            className="rounded bg-red-100 px-2 text-xs text-red-900"
            title="Exclue des acceptations en lot (F-PRO-06)"
          >
            fait sensible
          </span>
        )}
        {view.checks.some((c) => !c.ok && c.rule === 'date-to-verify') && (
          <span className="rounded bg-amber-200 px-2 text-xs text-amber-900" title="Exclue des acceptations en lot">
            date à vérifier
          </span>
        )}
        {view.checks.some((c) => !c.ok && c.rule === 'cefr-to-specify') && (
          <span
            className="rounded bg-amber-200 px-2 text-xs text-amber-900"
            title="Tant qu'il n'est pas renseigné, l'export d'un CV qui affiche cette langue est bloqué"
          >
            niveau CECRL à préciser
          </span>
        )}
        <span className="ml-auto text-xs text-slate-500">
          {ORIGIN[view.origin] ?? view.origin} · {SOURCE[view.source] ?? view.source} · {when(view.createdAt)} ·{' '}
          <code>{view.id}</code>
        </span>
      </header>
      <p className="mt-1 text-sm text-slate-700">{view.target}</p>

      {view.rationale && <p className="mt-2 text-sm">Justification : {view.rationale}</p>}
      {view.sourceFile && <p className="text-xs text-slate-500">Fichier source : {view.sourceFile}</p>}
      {view.userStatement && (
        <p className="text-xs text-slate-500">Déclaration de l'utilisateur : « {view.userStatement} »</p>
      )}
      {view.duplicateOf && (
        <p className="mt-1 text-sm text-slate-700">
          Doublon de l'élément <code>{view.duplicateOf}</code> déjà validé : l'acceptation n'ajoute que les puces
          nouvelles ; organisation, intitulé et dates restent inchangés.
        </p>
      )}
      {view.supersedes && <p className="text-xs text-slate-500">Remplace la proposition {view.supersedes}.</p>}

      {view.checks.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2 text-xs" aria-label="Contrôles automatiques">
          {view.checks.map((c, i) => (
            <li
              key={i}
              className={`rounded px-2 py-0.5 ${c.ok ? 'bg-green-50 text-green-900' : c.level === 'warning' ? 'bg-amber-50 text-amber-900' : 'bg-red-50 text-red-900'}`}
              title={c.message}
            >
              {c.ok ? '✓' : c.level === 'warning' ? '⚠' : '✗'} {c.rule}
              {c.value !== undefined ? ` (${c.value})` : ''}
              {c.found?.length ? ` : ${c.found.join(', ')}` : ''}
            </li>
          ))}
        </ul>
      )}

      {view.checks.some((c) => !c.ok && c.level === 'warning' && REMARKS.has(c.rule) && c.message) && (
        <ul className="mt-2 list-disc pl-5 text-sm text-amber-900" aria-label="Remarques à vérifier">
          {view.checks
            .filter((c) => !c.ok && c.level === 'warning' && REMARKS.has(c.rule) && c.message)
            .map((c, i) => (
              <li key={i}>{c.message}</li>
            ))}
        </ul>
      )}

      {view.dependsOn.length > 0 && (
        <div className="mt-2 text-sm">
          Dépend de :
          <ul className="ml-4 list-disc">
            {view.dependsOn.map((d) => (
              <li key={d.id}>
                {d.label}{' '}
                <span className={`rounded px-1 text-xs ${STATUS_LABEL[d.status]?.className ?? ''}`}>
                  {STATUS_LABEL[d.status]?.label ?? d.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {view.diff.length > 0 && !view.conflict && (
        <div className="mt-3 space-y-2 rounded bg-slate-50 p-3 text-sm">
          {view.diff.map((d, i) => (
            <div key={i}>
              <div className="text-xs text-slate-500">{d.label}</div>
              <DiffText segments={d.segments} />
            </div>
          ))}
        </div>
      )}

      {view.conflict && (
        <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3">
          <p className="mb-2 text-sm font-medium text-amber-900">
            {view.staleReason === 'missing'
              ? "Conflit : l'élément visé n'existe plus."
              : "Conflit : l'élément a changé depuis le calcul de la proposition."}{' '}
            Comparez avant de décider.
          </p>
          <div className="grid gap-2 md:grid-cols-3">
            <Column
              title="Base (au moment de la proposition)"
              lines={view.conflict.base}
              empty="non enregistrée dans la proposition"
            />
            <Column title="Actuelle" lines={view.conflict.current} empty="élément supprimé" />
            <Column title="Proposée" lines={view.conflict.proposed} empty="—" />
          </div>
        </div>
      )}

      {view.selection && (
        <fieldset className="mt-3 rounded border border-slate-200 p-2" disabled={!open}>
          <legend className="px-1 text-sm">Éléments de la sélection (acceptés un par un)</legend>
          <ul className="space-y-1 text-sm">
            {view.selection.map((r) => (
              <li key={r.key} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={elements.has(r.key)}
                  disabled={!r.applicable}
                  aria-label={`${r.op} ${r.label}`}
                  onChange={(e) => {
                    const next = new Set(elements);
                    if (e.target.checked) next.add(r.key);
                    else next.delete(r.key);
                    setElements(next);
                  }}
                />
                <div>
                  <span className={r.op === 'remove' ? 'text-red-800' : 'text-green-800'}>
                    {r.op === 'add' ? '+ cocher' : r.op === 'remove' ? '− décocher' : '↺ variante'}
                  </span>{' '}
                  {r.label}
                  {r.detail && <span className="text-xs text-slate-500"> ({r.detail})</span>}
                  {r.rationale && <div className="text-xs text-slate-600">{r.rationale}</div>}
                  {r.reason && (
                    <div className={`text-xs ${r.applicable ? 'text-slate-500' : 'text-red-800'}`}>{r.reason}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      {open && !view.applicable.ok && (
        <p className="mt-2 text-sm text-red-800">Ne peut pas être acceptée telle quelle : {view.applicable.reason}</p>
      )}
      {open && view.applicable.ok && view.applicable.reason && (
        <p className="mt-2 text-sm text-slate-600">{view.applicable.reason}</p>
      )}
      {open && pendingDeps.length > 0 && (
        <p className="mt-2 text-sm text-slate-700">
          L'acceptation acceptera d'abord{' '}
          {pendingDeps.length === 1 ? 'la proposition' : `les ${pendingDeps.length} propositions`} dont elle dépend
          (F-PRO-03).
        </p>
      )}

      {view.resolution && (
        <p className="mt-2 text-sm text-slate-600">
          {STATUS_LABEL[view.resolution.action]?.label ?? view.resolution.action} le {when(view.resolution.at)}
          {outcome(view) ? ` · ${outcome(view)}` : ''}
          {view.resolution.reason ? ` · motif : ${view.resolution.reason}` : ''}
        </p>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      {open && editing && (
        <div className="mt-3">
          <EditForm
            view={view}
            library={library}
            pendingCategories={pendingCategories}
            onSubmit={(edited) => accept(edited)}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}

      {open && rejecting && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            className="min-w-64 flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
            placeholder="Motif du rejet (facultatif)"
            aria-label="Motif du rejet"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            type="button"
            className={buttonClass.danger}
            disabled={busy}
            onClick={() => void act(() => api.reject(view.id, reason.trim() || null))}
          >
            Confirmer le rejet
          </button>
          <button type="button" className={buttonClass.secondary} onClick={() => setRejecting(false)}>
            Annuler
          </button>
        </div>
      )}

      {open && !editing && !rejecting && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonClass.primary}
            disabled={busy || !view.applicable.ok || (view.selection !== null && elements.size === 0)}
            onClick={() => void accept()}
          >
            {view.selection
              ? `Accepter ${elements.size} élément${elements.size > 1 ? 's' : ''}`
              : view.status === 'stale'
                ? 'Accepter sur la version actuelle'
                : 'Accepter'}
          </button>
          {view.type !== 'selection' && (
            <button type="button" className={buttonClass.secondary} disabled={busy} onClick={() => setEditing(true)}>
              Modifier puis accepter
            </button>
          )}
          <button type="button" className={buttonClass.danger} disabled={busy} onClick={() => setRejecting(true)}>
            Rejeter
          </button>
        </div>
      )}
    </article>
  );
}
