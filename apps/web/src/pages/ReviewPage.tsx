// "À valider" screen (F-UI-03, F-PRO-05): pending proposals (or the history), `?ids=` filter from the
// MCP `reviewUrl`, files that could not be read, batch acceptance without sensitive facts nor dates to
// check, and the LinkedIn import (ADR 0015).
import { useEffect, useState } from 'react';
import { api, type Library, type ProposalsResponse } from '../api';
import { buttonClass } from '../components/fields';
import { ImportPanel } from '../components/ImportPanel';
import { ProposalCard } from '../components/ProposalCard';

export function ReviewPage({
  ids,
  library,
  version,
  onChanged,
  navigate,
}: {
  ids: string[];
  library: Library | null;
  version: number;
  onChanged: () => void;
  navigate: (path: string) => void;
}) {
  const [all, setAll] = useState(false);
  const [data, setData] = useState<ProposalsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batch, setBatch] = useState<{ busy: boolean; message: string | null; confirm: boolean }>({
    busy: false,
    message: null,
    confirm: false,
  });
  const idsKey = ids.join(',');

  useEffect(() => {
    let cancelled = false;
    api
      .proposals({ ids, all })
      .then((r) => {
        if (!cancelled) {
          setData(r);
          setError(null);
        }
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [idsKey, all, version]);

  // A proposal whose open dependency is not shown here (a skill and its pending category, ADR 0023) is
  // left out: the server would skip it anyway.
  const shown = new Set((data?.proposals ?? []).map((p) => p.id));
  const eligible = (data?.proposals ?? []).filter(
    (p) =>
      p.status === 'pending' &&
      !p.batchExcluded &&
      p.applicable.ok &&
      p.dependsOn.every((d) => (d.status !== 'pending' && d.status !== 'stale') || shown.has(d.id)),
  );
  const excluded = (data?.proposals ?? []).filter(
    (p) => (p.status === 'pending' || p.status === 'stale') && !eligible.includes(p),
  );

  const runBatch = async () => {
    setBatch({ busy: true, message: null, confirm: false });
    try {
      const r = await api.acceptBatch(eligible.map((p) => p.id));
      const skipped = r.skipped.length
        ? ` ; ${r.skipped.length} laissée(s) de côté : ${r.skipped.map((s) => s.reason).join(' ; ')}`
        : '';
      setBatch({ busy: false, message: `${r.accepted.length} proposition(s) acceptée(s)${skipped}.`, confirm: false });
      onChanged();
    } catch (e) {
      setBatch({ busy: false, message: (e as Error).message, confirm: false });
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">À valider</h2>
        {data && (
          <span className="text-sm text-slate-600">
            {data.counts.pending} en attente{data.counts.stale ? `, dont ${data.counts.stale} en conflit` : ''}
          </span>
        )}
        {ids.length === 0 && (
          <label className="ml-auto flex items-center gap-1 text-sm">
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
            Afficher l'historique (acceptées, rejetées)
          </label>
        )}
      </div>

      <p className="text-sm text-slate-600">
        Claude propose, vous disposez : rien n'entre dans la bibliothèque sans votre acceptation. Une reformulation
        acceptée devient une nouvelle variante ; le texte d'origine n'est jamais écrasé.
      </p>

      {ids.length > 0 && (
        <p className="rounded bg-blue-50 p-2 text-sm">
          Filtre : {ids.length} proposition(s) demandée(s).{' '}
          <button type="button" className="underline" onClick={() => navigate('/a-valider')}>
            Tout afficher
          </button>
          {data && data.missing.length > 0 && (
            <span className="text-red-800"> Introuvable(s) : {data.missing.join(', ')}.</span>
          )}
        </p>
      )}

      {ids.length === 0 && (
        <ImportPanel version={version} onShow={(shown) => navigate(`/a-valider?ids=${shown.join(',')}`)} />
      )}

      {error && <p className="text-sm text-red-800">Erreur : {error}</p>}

      {data && data.invalid.length > 0 && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm" role="alert">
          <p className="font-medium">Fichiers de proposition illisibles (ignorés) :</p>
          <ul className="ml-4 list-disc">
            {data.invalid.map((f) => (
              <li key={f.file}>
                <code>{f.file}</code> : {f.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {eligible.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-white p-3 text-sm">
          {batch.confirm ? (
            <>
              Accepter {eligible.length} propositions d'un coup ?
              <button
                type="button"
                className={buttonClass.primary}
                disabled={batch.busy}
                onClick={() => void runBatch()}
              >
                Oui, accepter
              </button>
              <button
                type="button"
                className={buttonClass.secondary}
                onClick={() => setBatch({ ...batch, confirm: false })}
              >
                Non
              </button>
            </>
          ) : (
            <button
              type="button"
              className={buttonClass.secondary}
              onClick={() => setBatch({ ...batch, confirm: true })}
            >
              Accepter en lot ({eligible.length})
            </button>
          )}
          {excluded.length > 0 && (
            <span className="text-slate-600">
              {excluded.length} exclue(s) du lot : faits sensibles, dates à vérifier, conflits, propositions
              inapplicables ou dépendant d'une proposition absente de cette vue, à traiter une par une.
            </span>
          )}
        </div>
      )}
      {batch.message && (
        <p className="text-sm text-slate-700" role="status">
          {batch.message}
        </p>
      )}

      {data && data.proposals.length === 0 && (
        <p className="rounded bg-white p-6 text-center text-sm text-slate-500">
          Aucune proposition {all ? '' : 'en attente'}. Les propositions de Claude apparaissent ici en direct.
        </p>
      )}

      {library &&
        data?.proposals.map((p) => (
          <ProposalCard
            key={`${p.id}:${p.status}`}
            view={p}
            library={library}
            pendingCategories={data.pendingCategories}
            onChanged={onChanged}
          />
        ))}
    </main>
  );
}
