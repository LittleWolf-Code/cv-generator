// « Journal MCP » screen (ADR 0024): every request received by the MCP server, with its date and time,
// the address of the SSH client, the session (one per connection), the tool and its arguments, the
// outcome and the check of the response for the contact details of the identity. Grouped by session,
// address, tool or day, to check that nothing left that should not have.
import { useEffect, useMemo, useState } from 'react';
import { api, type McpLogEntry, type McpLogResponse } from '../api';
import { buttonClass } from '../components/fields';

type GroupBy = 'session' | 'ip' | 'tool' | 'day' | 'none';

const GROUPS: Array<{ value: GroupBy; label: string }> = [
  { value: 'session', label: 'Session' },
  { value: 'ip', label: 'Adresse IP' },
  { value: 'tool', label: 'Outil' },
  { value: 'day', label: 'Jour' },
  { value: 'none', label: 'Aucun' },
];

/** Requests of the MCP protocol itself (handshake, lists), as opposed to tool and prompt calls. */
const isProtocol = (e: McpLogEntry) => e.method !== 'tools/call' && e.method !== 'prompts/get';

const dateTime = (at: string) => new Date(at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });
const day = (at: string) => new Date(at).toLocaleDateString('fr-FR', { dateStyle: 'full' });
const time = (at: string) => new Date(at).toLocaleTimeString('fr-FR');
/** Day in the time zone of the browser, like the times shown. */
const localDay = (at: string) => new Date(at).toLocaleDateString('fr-FR');

function address(e: McpLogEntry): string {
  if (e.ip) return e.ip;
  return e.via === 'local' ? 'poste local (stdio)' : 'adresse inconnue (SSH)';
}

function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Ko`;
  return `${(bytes / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
}

function request(e: McpLogEntry): string {
  return e.name ? `${e.name}${e.method === 'prompts/get' ? ' (prompt)' : ''}` : e.method;
}

function args(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object' || Array.isArray(value)) return JSON.stringify(value);
  return Object.entries(value as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(' · ');
}

const LEAK_LABEL = { email: 'e-mail', phone: 'téléphone' } as const;

function Outcome({ e }: { e: McpLogEntry }) {
  switch (e.outcome) {
    case 'ok':
      return <span className="text-green-800">ok</span>;
    case 'tool-error':
      return <span className="text-amber-800">refus{e.code ? ` : ${e.code}` : ''}</span>;
    case 'error':
      return <span className="text-red-800">erreur {e.code}</span>;
    default:
      return <span className="text-slate-500">sans réponse</span>;
  }
}

function Leaks({ e }: { e: McpLogEntry }) {
  if (e.outcome === 'no-response') return <span className="text-slate-400">—</span>;
  if (e.leaks.length === 0) return <span className="text-green-800">✓ aucune</span>;
  return <strong className="text-red-800">⚠ {e.leaks.map((l) => LEAK_LABEL[l]).join(', ')}</strong>;
}

interface Group {
  key: string;
  title: string;
  entries: McpLogEntry[];
}

function keyOf(e: McpLogEntry, by: GroupBy): string {
  switch (by) {
    case 'session':
      return e.session;
    case 'ip':
      return address(e);
    case 'tool':
      return request(e);
    case 'day':
      return localDay(e.at);
    default:
      return '';
  }
}

function titleOf(first: McpLogEntry, by: GroupBy): string {
  switch (by) {
    case 'session':
      return `Session ${first.session}`;
    case 'ip':
      return address(first);
    case 'tool':
      return request(first);
    case 'day':
      return day(first.at);
    default:
      return 'Toutes les requêtes';
  }
}

/** Groups in order of their latest request; requests in chronological order inside a group. */
function groupEntries(entries: McpLogEntry[], by: GroupBy): Group[] {
  if (by === 'none') return [{ key: 'all', title: titleOf(entries[0]!, by), entries }];
  const groups = new Map<string, McpLogEntry[]>();
  for (const e of entries) {
    const key = keyOf(e, by);
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  return [...groups].map(([key, list]) => ({ key, title: titleOf(list[0]!, by), entries: [...list].reverse() }));
}

const unique = (values: string[]) => [...new Set(values)];

function GroupHeader({ group, by }: { group: Group; by: GroupBy }) {
  const list = group.entries;
  const times = list.map((e) => e.at).sort();
  const first = times[0]!;
  const last = times[times.length - 1]!;
  const leaks = list.filter((e) => e.leaks.length > 0).length;
  const refused = list.filter((e) => e.outcome !== 'ok').length;
  const ips = unique(list.map(address));
  const clients = unique(list.map((e) => e.client).filter((c): c is string => c !== null));
  const sessions = unique(list.map((e) => e.session));
  return (
    <summary className="cursor-pointer list-none px-3 py-2 hover:bg-slate-50">
      <span className="font-medium">{group.title}</span>
      <span className="ml-2 text-sm text-slate-600">
        {list.length} requête(s) · {dateTime(first)}
        {list.length > 1 ? ` → ${localDay(first) === localDay(last) ? time(last) : dateTime(last)}` : ''}
        {by !== 'ip' ? ` · ${ips.join(', ')}` : ''}
        {by !== 'session' ? ` · ${sessions.length} session(s)` : ''}
        {clients.length > 0 ? ` · ${clients.join(', ')}` : ''}
        {refused > 0 ? ` · ${refused} refus ou erreur(s)` : ''}
      </span>
      <span className={`ml-2 text-sm ${leaks ? 'font-semibold text-red-800' : 'text-green-800'}`}>
        {leaks ? `⚠ ${leaks} réponse(s) avec une coordonnée` : '✓ aucune coordonnée'}
      </span>
    </summary>
  );
}

function EntryTable({ entries, by }: { entries: McpLogEntry[]; by: GroupBy }) {
  const cell = 'border-t border-slate-100 px-2 py-1 align-top';
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-2 py-1 font-medium">Date et heure</th>
            {by !== 'session' && <th className="px-2 py-1 font-medium">Session</th>}
            {by !== 'ip' && <th className="px-2 py-1 font-medium">Adresse IP</th>}
            {by !== 'tool' && <th className="px-2 py-1 font-medium">Requête</th>}
            <th className="px-2 py-1 font-medium">Arguments</th>
            <th className="px-2 py-1 font-medium">Résultat</th>
            <th className="px-2 py-1 text-right font-medium">Durée</th>
            <th className="px-2 py-1 text-right font-medium">Réponse</th>
            <th className="px-2 py-1 font-medium">Coordonnées</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, n) => (
            <tr key={`${e.session}-${e.at}-${n}`} className={isProtocol(e) ? 'text-slate-500' : ''}>
              <td className={`${cell} whitespace-nowrap`}>{dateTime(e.at)}</td>
              {by !== 'session' && <td className={`${cell} font-mono`}>{e.session}</td>}
              {by !== 'ip' && <td className={`${cell} font-mono whitespace-nowrap`}>{address(e)}</td>}
              {by !== 'tool' && <td className={`${cell} font-mono`}>{request(e)}</td>}
              <td className={`${cell} max-w-md break-words`} title={e.args ? JSON.stringify(e.args) : undefined}>
                {args(e.args)}
              </td>
              <td className={cell}>
                <Outcome e={e} />
              </td>
              <td className={`${cell} text-right whitespace-nowrap`}>{e.ms} ms</td>
              <td className={`${cell} text-right whitespace-nowrap`}>{size(e.bytes)}</td>
              <td className={`${cell} whitespace-nowrap`}>
                <Leaks e={e} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function JournalPage() {
  const [month, setMonth] = useState<string | null>(null);
  const [by, setBy] = useState<GroupBy>('session');
  const [hideProtocol, setHideProtocol] = useState(false);
  const [data, setData] = useState<McpLogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .mcpLog(month)
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
  }, [month, version]);

  const entries = useMemo(
    () => (data?.entries ?? []).filter((e) => !hideProtocol || !isProtocol(e)),
    [data, hideProtocol],
  );
  const groups = useMemo(() => (entries.length ? groupEntries(entries, by) : []), [entries, by]);
  const all = data?.entries ?? [];
  const leaking = all.filter((e) => e.leaks.length > 0);
  const sessions = unique(all.map((e) => e.session));
  const ips = unique(all.map(address));
  const unknown = all.filter((e) => e.via === 'ssh' && !e.ip).length;

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">Journal MCP</h2>
        {data && data.months.length > 0 && (
          <label className="flex items-center gap-1 text-sm">
            Mois
            <select
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              value={data.month ?? ''}
              onChange={(e) => setMonth(e.target.value)}
            >
              {data.months.map((m) => (
                <option key={m} value={m}>
                  {new Date(`${m}-15T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex items-center gap-1 text-sm">
          Regrouper par
          <select
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            value={by}
            onChange={(e) => setBy(e.target.value as GroupBy)}
          >
            {GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={hideProtocol} onChange={(e) => setHideProtocol(e.target.checked)} />
          Masquer les requêtes de protocole
        </label>
        <button type="button" className={`${buttonClass.secondary} ml-auto`} onClick={() => setVersion((v) => v + 1)}>
          Actualiser
        </button>
      </div>

      <p className="text-sm text-slate-600">
        Chaque requête reçue par le serveur MCP, avec sa date, son heure et l'adresse du client SSH. Une session
        correspond à un démarrage du serveur, donc à une connexion SSH (un toucher de la clé de sécurité). La colonne «
        Coordonnées » indique si la réponse envoyée à Claude contenait l'e-mail ou le téléphone de votre identité : elle
        doit toujours afficher « aucune ». La photo n'est jamais transmise. Le journal reste sur le serveur (dossier{' '}
        <code>out/logs/</code>) et n'est lisible que dans cette interface.
      </p>

      {error && <p className="text-sm text-red-800">Erreur : {error}</p>}

      {data && !data.available && (
        <p className="rounded bg-white p-6 text-center text-sm text-slate-500">
          Journal indisponible : le dossier <code>out/</code> n'est pas configuré pour cette instance.
        </p>
      )}

      {data?.available && all.length > 0 && (
        <div
          className={`rounded border p-3 text-sm ${leaking.length ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'}`}
          role="status"
        >
          <p>
            {all.length} requête(s) · {sessions.length} session(s) · adresse(s) : {ips.join(', ')}
          </p>
          <p className={leaking.length ? 'font-semibold text-red-800' : 'text-green-800'}>
            {leaking.length
              ? `⚠ ${leaking.length} réponse(s) contenaient une coordonnée de votre identité : voir les lignes signalées.`
              : '✓ Aucune réponse ne contenait votre e-mail ni votre téléphone.'}
          </p>
          {unknown > 0 && (
            <p className="text-amber-800">
              {unknown} requête(s) sans adresse : la commande SSH du client ne transmet pas{' '}
              <code>CV_SSH_CONNECTION</code> (voir le README, « Journal MCP »).
            </p>
          )}
        </div>
      )}

      {data && (data.invalidLines > 0 || data.truncated) && (
        <p className="text-sm text-amber-800">
          {data.truncated ? 'Seules les requêtes les plus récentes du mois sont affichées. ' : ''}
          {data.invalidLines > 0 ? `${data.invalidLines} ligne(s) illisible(s) ignorée(s).` : ''}
        </p>
      )}

      {data?.available && all.length === 0 && (
        <p className="rounded bg-white p-6 text-center text-sm text-slate-500">
          Aucune requête MCP journalisée{data.month ? ' ce mois-ci' : ''}. Les requêtes de Claude apparaissent ici une
          fois traitées (bouton « Actualiser »).
        </p>
      )}

      {groups.map((g) => (
        <details
          key={g.key}
          open={by !== 'none' ? groups.length <= 5 : true}
          className="rounded border border-slate-200 bg-white"
        >
          <GroupHeader group={g} by={by} />
          <EntryTable entries={g.entries} by={by} />
        </details>
      ))}
    </main>
  );
}
