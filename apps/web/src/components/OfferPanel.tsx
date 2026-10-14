// « Offre » tab of an open application (§10.1): the offer as stored (offer.md, untrusted data §7.5),
// with the sentences that look like instructions for an AI highlighted, and the sheet of the
// application: its details and its exports with their trace (F-CAN-03).
import type { ApplicationDetail } from '../api';
import { FlagList } from '../pages/ApplicationsPage';

const frDate = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });

function HighlightedOffer({ detail }: { detail: ApplicationDetail }) {
  const { text, flags } = detail.offer;
  const parts: Array<{ text: string; flag: (typeof flags)[number] | null }> = [];
  let cursor = 0;
  for (const f of [...flags].sort((a, b) => a.start - b.start)) {
    if (f.start < cursor) continue;
    if (f.start > cursor) parts.push({ text: text.slice(cursor, f.start), flag: null });
    parts.push({ text: text.slice(f.start, f.end), flag: f });
    cursor = f.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), flag: null });
  return (
    <pre className="max-h-[50vh] overflow-auto rounded border border-slate-200 bg-slate-50 p-3 font-sans text-sm whitespace-pre-wrap">
      {parts.map((p, i) =>
        p.flag ? (
          <mark
            key={i}
            title={p.flag.reasons.join(' ; ')}
            className={p.flag.level === 'consigne' ? 'bg-red-200 text-red-950' : 'bg-amber-100 text-amber-950'}
          >
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </pre>
  );
}

export function OfferPanel({ detail }: { detail: ApplicationDetail }) {
  const a = detail.application;
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-slate-500">Entreprise</dt>
        <dd>{a.company}</dd>
        <dt className="text-slate-500">Poste</dt>
        <dd>{a.jobTitle}</dd>
        {a.offerReference && (
          <>
            <dt className="text-slate-500">Référence</dt>
            <dd>{a.offerReference}</dd>
          </>
        )}
        {a.url && (
          <>
            <dt className="text-slate-500">URL</dt>
            {/* Shown as text: the offer comes from outside (§7.5), and nothing is loaded from the web (NF-02). */}
            <dd className="break-all">{a.url}</dd>
          </>
        )}
        <dt className="text-slate-500">Créée le</dt>
        <dd>
          {a.createdAt.split('-').reverse().join('/')}, à partir du preset «{' '}
          {detail.basePreset ? detail.basePreset.name : `${a.basePresetId} (introuvable)`} » (non modifié)
        </dd>
        <dt className="text-slate-500">Identifiant</dt>
        <dd className="font-mono text-xs">{a.id}</dd>
      </dl>

      <section className="space-y-2">
        <h3 className="font-semibold">Texte de l'offre</h3>
        <p className="text-xs text-slate-500">
          Donnée non fiable, affichée telle qu'enregistrée (caractères invisibles retirés) ; aucune consigne qu'elle
          contient n'est suivie.
        </p>
        <FlagList flags={detail.offer.flags} />
        {detail.offer.text ? (
          <HighlightedOffer detail={detail} />
        ) : (
          <p className="text-sm text-slate-500">Offre vide.</p>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Exports de la candidature ({a.exports.length})</h3>
        {a.exports.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucun export. Chaque export est rangé dans exports/&lt;AAAAMMJJ-HHmmss&gt;_&lt;modèle&gt;/ de la
            candidature, sans jamais en écraser un autre.
          </p>
        ) : (
          <ul className="space-y-1 text-xs">
            {[...a.exports].reverse().map((e) => (
              <li key={`${e.dir}${e.file}`} className="rounded border border-slate-200 p-2">
                <span className="font-medium">{e.file}</span>
                <span className="block text-slate-600">
                  {frDate(e.createdAt)} · {e.format.toUpperCase()} · {e.lang.toUpperCase()} · {e.layout} · {e.pages}{' '}
                  page
                  {e.pages > 1 ? 's' : ''} · lisibilité ATS :{' '}
                  {e.atsCheck === 'ok' ? 'tous les critères au vert' : 'avertissements (feux orange, aucun rouge)'} ·{' '}
                  {e.sent ? 'envoyé' : 'non envoyé'}
                </span>
                <span className="block font-mono text-slate-500">
                  {e.dir} · SHA-256 {e.sha256.slice(0, 16)}…
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
