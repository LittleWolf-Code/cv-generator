// Editing of one library element (F-LIB-05): live validation by the server (sanitization, schema,
// ATS-22 warnings), save with revision check, duplicate, archive, then explicit deletion.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, api, type AnyItem, type CollectionName, type Issue, type Library } from '../api';
import { FORMS } from '../forms';
import { buttonClass, FieldView, Messages } from './fields';

export type EditorMode =
  | { kind: 'edit'; id: string }
  | { kind: 'create'; defaults: Record<string, unknown> }
  /**
   * "Modifier puis accepter" of a new-item proposal: the form submits to `onSubmit`. `pendingCategories`:
   * categories still proposed, which a skill may target (ADR 0023).
   */
  | {
      kind: 'proposal';
      initial: AnyItem;
      onSubmit: (item: AnyItem) => Promise<void>;
      onCancel: () => void;
      pendingCategories?: Array<{ id: string; label: string }>;
    };

interface Props {
  collection: CollectionName;
  mode: EditorMode;
  library: Library;
  revision: number;
  /** After a write: the element to show (created or duplicated), or null after a deletion. */
  onWritten: (selected: { collection: CollectionName; id: string } | null) => void;
  /** Bullet to bring into view. */
  focusBullet?: string | null;
}

export function ItemEditor({ collection, mode, library, revision, onWritten, focusBullet }: Props) {
  const form = FORMS[collection];
  const stored = useMemo(() => {
    if (mode.kind !== 'edit') return null;
    return ((library[collection] as unknown as AnyItem[]).find((i) => i.id === mode.id) ?? null) as AnyItem | null;
  }, [library, collection, mode]);
  const initial = (): AnyItem =>
    mode.kind === 'edit'
      ? structuredClone(stored ?? {})
      : mode.kind === 'proposal'
        ? structuredClone(mode.initial)
        : form.empty(mode.defaults);

  const [draft, setDraft] = useState<AnyItem>(initial);
  const [loaded, setLoaded] = useState<{ item: AnyItem | null; revision: number }>({ item: stored, revision });
  const [dirty, setDirty] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [warnings, setWarnings] = useState<Issue[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [conflict, setConflict] = useState<{ item: AnyItem; revision: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const checkSeq = useRef(0);

  const modeKey = mode.kind === 'edit' ? `edit:${mode.id}` : mode.kind;
  // Another element, or a fresh form: start over.
  useEffect(() => {
    setDraft(initial());
    setLoaded({ item: stored, revision });
    setDirty(false);
    setIssues([]);
    setWarnings([]);
    setNotice(null);
    setConflict(null);
    setConfirmDelete(false);
  }, [collection, modeKey]);

  // The element changed elsewhere (live update): reload it when the form has no pending edit.
  useEffect(() => {
    if (mode.kind !== 'edit' || dirty || !stored) return;
    setDraft(structuredClone(stored));
    setLoaded({ item: stored, revision });
  }, [stored, revision]);

  // Live validation by the server, 400 ms after the last keystroke (and on opening an element, for
  // its ATS-22 warnings; an empty creation form is only checked once the user types).
  useEffect(() => {
    if (!dirty && mode.kind === 'create') return;
    const seq = ++checkSeq.current;
    const timer = setTimeout(() => {
      api
        .check(collection, draft, mode.kind === 'edit' ? mode.id : null, {
          withPendingCategories: mode.kind === 'proposal',
        })
        .then((r) => {
          if (seq !== checkSeq.current) return;
          setIssues(r.issues);
          setWarnings(r.warnings);
        })
        .catch(() => undefined);
    }, 400);
    return () => clearTimeout(timer);
  }, [draft, dirty, collection, mode]);

  useEffect(() => {
    if (focusBullet) document.getElementById(`bullet-${focusBullet}`)?.scrollIntoView({ block: 'center' });
  }, [focusBullet, modeKey]);

  if (mode.kind === 'edit' && !stored) {
    return <p className="text-sm text-slate-500">Cet élément n'existe plus (supprimé ailleurs).</p>;
  }

  const change = (key: string, value: unknown) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
    setNotice(null);
  };

  const fail = (err: unknown) => {
    if (err instanceof ApiError) {
      if (err.status === 409 && err.code === 'STALE_REVISION' && err.details.current) {
        setConflict({ item: err.details.current as AnyItem, revision: Number(err.details.currentRevision) });
      }
      if (err.issues.length) setIssues(err.issues);
      setNotice({ tone: 'error', text: err.message + (err.hint ? ` (${err.hint})` : '') });
    } else setNotice({ tone: 'error', text: (err as Error).message });
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      if (mode.kind === 'proposal') {
        await mode.onSubmit(draft);
        return;
      }
      if (mode.kind === 'create') {
        const r = await api.create(collection, draft);
        setDirty(false);
        onWritten({ collection, id: r.item.id as string });
        return;
      }
      const r = await api.update(collection, mode.id, draft, loaded.revision, loaded.item);
      setDraft(r.item);
      setLoaded({ item: r.item, revision: r.revision });
      setDirty(false);
      setIssues([]);
      setWarnings(r.warnings);
      setNotice({ tone: 'ok', text: 'Enregistré.' });
      onWritten({ collection, id: mode.id });
    });

  const reloadCurrent = () => {
    if (!conflict) return;
    setDraft(structuredClone(conflict.item));
    setLoaded(conflict);
    setConflict(null);
    setDirty(false);
    setIssues([]);
    setNotice({ tone: 'ok', text: 'Version actuelle chargée : refaites votre modification.' });
  };

  const archived = draft.archived === true;
  const title =
    mode.kind === 'create'
      ? `Nouvel élément : ${form.noun}`
      : mode.kind === 'proposal'
        ? `Proposition : ${form.noun} (modifier puis accepter)`
        : `Modifier ${form.noun}`;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {mode.kind === 'edit' && <code className="text-xs text-slate-500">{mode.id}</code>}
        {archived && <span className="rounded bg-slate-200 px-2 text-xs">archivé</span>}
        {dirty && <span className="text-xs text-amber-700">modifications non enregistrées</span>}
      </div>

      {conflict && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm" role="alert">
          <p className="font-medium">Cet élément a été modifié ailleurs depuis son ouverture.</p>
          <p className="text-slate-700">
            Vos modifications ne sont pas enregistrées. Chargez la version actuelle pour les refaire.
          </p>
          <button type="button" className={`${buttonClass.secondary} mt-2`} onClick={reloadCurrent}>
            Charger la version actuelle
          </button>
        </div>
      )}

      <Messages issues={issues.filter((i) => i.path === '')} warnings={warnings.filter((w) => w.path === '')} />

      {form.fields.map((spec) => (
        <FieldView
          key={spec.key}
          spec={spec}
          item={draft}
          onChange={change}
          issues={issues}
          warnings={warnings}
          ctx={{ library, pendingCategories: mode.kind === 'proposal' ? mode.pendingCategories : undefined }}
        />
      ))}

      {notice && (
        <p className={`text-sm ${notice.tone === 'ok' ? 'text-green-800' : 'text-red-800'}`} role="status">
          {notice.text}
        </p>
      )}

      <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-slate-200 bg-white py-3">
        <button type="submit" className={buttonClass.primary} disabled={busy || (mode.kind === 'edit' && !dirty)}>
          {mode.kind === 'proposal' ? 'Accepter cette version' : mode.kind === 'create' ? 'Créer' : 'Enregistrer'}
        </button>
        {mode.kind === 'proposal' && (
          <button type="button" className={buttonClass.secondary} onClick={mode.onCancel}>
            Annuler
          </button>
        )}
        {mode.kind === 'edit' && (
          <>
            <button
              type="button"
              className={buttonClass.secondary}
              disabled={!dirty || busy}
              onClick={() => {
                setDraft(structuredClone(loaded.item ?? {}));
                setDirty(false);
                setIssues([]);
                setWarnings([]);
              }}
            >
              Annuler les modifications
            </button>
            {collection !== 'categories' && (
              <button
                type="button"
                className={buttonClass.secondary}
                disabled={busy || dirty}
                onClick={() =>
                  run(async () => {
                    const r = await api.duplicate(collection, mode.id);
                    onWritten({ collection, id: r.item.id as string });
                  })
                }
              >
                Dupliquer
              </button>
            )}
            {collection !== 'categories' && (
              <button
                type="button"
                className={buttonClass.secondary}
                disabled={busy || dirty}
                onClick={() =>
                  run(async () => {
                    const r = await api.archive(collection, mode.id, !archived);
                    setDraft(r.item);
                    setLoaded({ item: r.item, revision: r.revision });
                    setNotice({
                      tone: 'ok',
                      text: archived
                        ? 'Élément désarchivé.'
                        : 'Élément archivé : il ne sera plus rendu. Vous pouvez maintenant le supprimer définitivement.',
                    });
                    onWritten({ collection, id: mode.id });
                  })
                }
              >
                {archived ? 'Désarchiver' : 'Archiver'}
              </button>
            )}
            {(archived || collection === 'categories') &&
              (confirmDelete ? (
                <span className="flex items-center gap-2 text-sm">
                  Suppression définitive : confirmer ?
                  <button
                    type="button"
                    className={buttonClass.danger}
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await api.remove(collection, mode.id);
                        onWritten(null);
                      })
                    }
                  >
                    Oui, supprimer
                  </button>
                  <button type="button" className={buttonClass.secondary} onClick={() => setConfirmDelete(false)}>
                    Non
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className={buttonClass.danger}
                  disabled={busy || dirty}
                  onClick={() => setConfirmDelete(true)}
                >
                  Supprimer définitivement
                </button>
              ))}
          </>
        )}
      </div>
    </form>
  );
}
