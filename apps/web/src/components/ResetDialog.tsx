// Reset of the data (F-LIB-09c, ADR 0021): a native modal dialog that says what is erased and what is
// kept, offers to download a backup ZIP first (checked by default) and asks for the word RÉINITIALISER.
// The server keeps its own ZIP copy in out/backups/ before erasing. Once done, the page is reloaded: the
// state of the interface (preset being edited, open application) belongs to the erased data.
import { useEffect, useId, useRef, useState } from 'react';
import { api, ApiError } from '../api';
import { buttonClass } from './fields';

const WORD = 'RÉINITIALISER';

/** The word typed, accents and case ignored. */
function confirmed(typed: string): boolean {
  const plain = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().trim();
  return plain(typed) === plain(WORD);
}

function errorText(e: unknown): string {
  if (e instanceof ApiError && e.hint) return `${e.message} (${e.hint})`;
  return (e as Error).message;
}

export function ResetDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [typed, setTyped] = useState('');
  const [download, setDownload] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backup, setBackup] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const reset = async () => {
    setBusy(true);
    setError(null);
    try {
      if (download) await api.backup();
      setBackup((await api.resetData()).backup);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => busy && e.preventDefault()}
      onClose={() => (backup ? window.location.assign('/') : onClose())}
      className="m-auto w-[32rem] max-w-[calc(100vw-2rem)] rounded-lg p-4 shadow-xl backdrop:bg-slate-900/30"
    >
      {backup ? (
        <div className="space-y-3">
          <h2 id={titleId} className="text-base font-semibold">
            Données réinitialisées
          </h2>
          <p className="text-sm">
            Le site repart d'un dossier vide. Copie de sécurité gardée sur le serveur : <code>{backup}</code>
          </p>
          <div className="flex justify-end">
            <button type="button" className={buttonClass.primary} autoFocus onClick={() => ref.current?.close()}>
              Recharger la page
            </button>
          </div>
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (confirmed(typed) && !busy) void reset();
          }}
        >
          <h2 id={titleId} className="text-base font-semibold">
            Réinitialiser mes données
          </h2>
          <p className="text-sm">
            Tout le contenu de <code>data/</code> sera effacé : bibliothèque, identité et photo, presets, candidatures
            (offres, analyses, lettres, exports) et propositions. Le site repartira d'un dossier vide, comme après
            l'installation.
          </p>
          <p className="text-sm text-slate-600">
            Avant d'effacer, le serveur garde une copie ZIP dans <code>out/backups/</code>. Les fichiers à importer (
            <code>import/</code>) et les clés de connexion ne sont pas touchés.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={download} onChange={(e) => setDownload(e.target.checked)} />
            Télécharger aussi une sauvegarde ZIP avant de réinitialiser
          </label>
          <label className="block text-sm">
            Pour confirmer, tapez <strong>{WORD}</strong>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              value={typed}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setTyped(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={buttonClass.secondary}
              disabled={busy}
              onClick={() => ref.current?.close()}
            >
              Annuler
            </button>
            <button type="submit" className={buttonClass.danger} disabled={busy || !confirmed(typed)}>
              {busy ? 'Réinitialisation…' : 'Réinitialiser'}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
