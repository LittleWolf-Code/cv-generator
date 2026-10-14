// Identity and contact details (F-LIB-01, §5.2): name, one e-mail, one phone, city and country, links
// shown in clear, optional driving licence and work authorization, photo (its own route, §5.2). No
// birth date, no address.
import { useEffect, useState } from 'react';
import { ApiError, api, type AnyItem, type Bilingual, type Identity, type Issue } from '../api';
import { sub } from '../forms';
import { BilingualInput, buttonClass, LocationInput, Messages } from './fields';
import { PhotoEditor } from './PhotoEditor';

const input = 'w-full rounded border border-slate-300 px-2 py-1 text-sm';

const EMPTY: AnyItem = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  location: null,
  links: [],
  photo: null,
  drivingLicense: null,
  workAuthorization: null,
};

const LINK_KINDS = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'github', label: 'GitHub' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'other', label: 'Autre' },
];

/** Display of a link on the CV (ADR 0025); the URL is always shown in clear (ATS-10). */
const LINK_STYLES = [
  { value: 'url', label: 'Lien seul' },
  { value: 'name', label: 'Nom – lien' },
  { value: 'icon', label: 'Icône – lien' },
];

/** Name of a link without a name of its own, in French (`linkNames` of the projection labels). */
const DEFAULT_LINK_NAMES: Record<string, string> = {
  linkedin: 'LinkedIn',
  github: 'GitHub',
  portfolio: 'Portfolio',
  other: 'Site web',
};

/** Name shown before the URL (French CV): the name of the link, or the name of its kind. */
function linkName(l: AnyItem): string {
  return (l.name as Bilingual | null)?.fr ?? DEFAULT_LINK_NAMES[(l.kind as string) ?? 'other'] ?? '';
}

export function IdentityEditor({
  identity,
  revision,
  onWritten,
}: {
  identity: Identity | null;
  revision: number;
  onWritten: () => void;
}) {
  const [draft, setDraft] = useState<AnyItem>(() => structuredClone((identity as AnyItem | null) ?? EMPTY));
  const [loaded, setLoaded] = useState({ value: identity as unknown, revision });
  const [dirty, setDirty] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  /** Source of the « préremplir » button: a ZIP name, null for the CSV of import/, undefined when none. */
  const [linkedin, setLinkedin] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    api
      .importFiles()
      .then((r) => {
        const files = r.files.filter((x) => x.kind === 'linkedin');
        const zip = files.find((x) => x.type === 'zip');
        setLinkedin(zip ? zip.name : files.length ? null : undefined);
      })
      .catch(() => setLinkedin(undefined));
  }, []);

  /** Fills the empty fields only, from the identity found in the LinkedIn export; nothing is saved. */
  const prefill = async () => {
    try {
      const { identity: found } = await api.linkedInIdentity(linkedin ?? null);
      const filled: string[] = [];
      const next = { ...draft };
      const take = (key: 'firstName' | 'lastName' | 'email' | 'phone', label: string) => {
        if (!(next[key] as string | undefined)?.trim() && found[key]) {
          next[key] = found[key];
          filled.push(label);
        }
      };
      take('firstName', 'prénom');
      take('lastName', 'nom');
      take('email', 'e-mail');
      take('phone', 'téléphone');
      if (!next.location && found.location) {
        next.location = found.location;
        filled.push('ville et pays');
      }
      if (filled.length) {
        setDraft(next);
        setDirty(true);
      }
      setNotice({
        tone: 'ok',
        text: filled.length
          ? `Prérempli depuis l'export LinkedIn : ${filled.join(', ')}. Vérifiez, puis enregistrez.`
          : "Aucun champ vide à préremplir depuis l'export LinkedIn.",
      });
    } catch (err) {
      setNotice({ tone: 'error', text: (err as Error).message });
    }
  };

  useEffect(() => {
    if (dirty) return;
    setDraft(structuredClone((identity as AnyItem | null) ?? EMPTY));
    setLoaded({ value: identity, revision });
  }, [identity, revision, dirty]);

  const set = (key: string, value: unknown) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
    setNotice(null);
  };
  const links = (draft.links as AnyItem[]) ?? [];
  const setLink = (i: number, patch: AnyItem) =>
    set(
      'links',
      links.map((l, j) => (j === i ? { ...l, ...patch } : l)),
    );

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.saveIdentity(draft, loaded.revision, loaded.value);
      setDraft(r.identity as unknown as AnyItem);
      setLoaded({ value: r.identity, revision: r.revision });
      setDirty(false);
      setIssues([]);
      setNotice({ tone: 'ok', text: 'Enregistré.' });
      onWritten();
    } catch (err) {
      if (err instanceof ApiError) {
        setIssues(err.issues);
        setNotice({ tone: 'error', text: err.message + (err.hint ? ` (${err.hint})` : '') });
      } else setNotice({ tone: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const text = (key: string, label: string, hint?: string) => (
    <div className="space-y-1">
      <label className="block text-sm font-medium" htmlFor={`id-${key}`}>
        {label}
        {hint && <span className="ml-2 text-xs font-normal text-slate-500">{hint}</span>}
      </label>
      <input
        id={`id-${key}`}
        className={input}
        value={(draft[key] as string) ?? ''}
        onChange={(e) => set(key, e.target.value)}
      />
      <Messages issues={sub(issues, key)} />
    </div>
  );

  return (
    <div className="space-y-4">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <h2 className="text-base font-semibold">Identité et coordonnées</h2>
        <p className="text-xs text-slate-500">
          Affichées en haut du CV, dans le corps (ATS-03). Jamais renvoyées par le serveur MCP. Ni date de naissance, ni
          adresse complète (§5.2).
        </p>
        <Messages issues={issues.filter((i) => i.path === '')} />
        {linkedin !== undefined && (
          <p className="text-sm">
            <button type="button" className={buttonClass.small} onClick={() => void prefill()}>
              Préremplir depuis l'export LinkedIn
            </button>
            <span className="ml-2 text-xs text-slate-500">
              champs vides seulement ({linkedin ?? 'CSV de import/'}) ; rien n'est enregistré sans votre clic
            </span>
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {text('firstName', 'Prénom')}
          {text('lastName', 'Nom')}
          {text('email', 'E-mail', 'un seul')}
          {text('phone', 'Téléphone', 'un seul')}
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium">Ville et pays</div>
          <LocationInput
            value={(draft.location as AnyItem | null) ?? null}
            onChange={(v) => set('location', v)}
            issues={sub(issues, 'location')}
          />
          <Messages issues={issues.filter((i) => i.path === 'location')} />
        </div>
        <div className="space-y-2">
          <div className="text-sm font-medium">
            Liens <span className="text-xs font-normal text-slate-500">URL affichée en clair (ATS-10)</span>
          </div>
          {links.map((l, i) => (
            <div
              key={(l.id as string) || `new-${i}`}
              className="grid gap-2 border-b border-slate-100 pb-2 sm:grid-cols-[8rem_1fr_1fr_auto]"
            >
              <select
                className={input}
                value={(l.kind as string) ?? 'other'}
                aria-label={`Type du lien ${i + 1}`}
                onChange={(e) => setLink(i, { kind: e.target.value })}
              >
                {LINK_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
              <input
                className={input}
                value={(l.url as string) ?? ''}
                placeholder="https://www.linkedin.com/in/…"
                aria-label={`URL du lien ${i + 1}`}
                onChange={(e) => setLink(i, { url: e.target.value })}
              />
              <input
                className={input}
                value={(l.display as string) ?? ''}
                placeholder="linkedin.com/in/…"
                aria-label={`URL affichée du lien ${i + 1}`}
                onChange={(e) => setLink(i, { display: e.target.value })}
              />
              <button
                type="button"
                className={buttonClass.small}
                onClick={() =>
                  set(
                    'links',
                    links.filter((_, j) => j !== i),
                  )
                }
              >
                Retirer
              </button>
              <div className="flex flex-wrap items-center gap-2 text-sm sm:col-span-4">
                <label htmlFor={`link-style-${i}`} className="text-slate-600">
                  Affichage
                </label>
                <select
                  id={`link-style-${i}`}
                  className="rounded border border-slate-300 px-2 py-1 text-sm"
                  value={(l.style as string) ?? 'url'}
                  onChange={(e) => setLink(i, { style: e.target.value })}
                >
                  {LINK_STYLES.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-slate-500">
                  {l.style === 'icon'
                    ? "icône dessinée dans le modèle visuel seulement ; le modèle ATS et le DOCX montrent l'URL seule (ATS-08)"
                    : l.style === 'name'
                      ? `« ${linkName(l)} : ${(l.display as string) || '…'} »`
                      : `« ${(l.display as string) || '…'} »`}
                </span>
              </div>
              {(l.style === 'name' || l.style === 'icon') && (
                <div className="space-y-1 sm:col-span-4">
                  <div className="text-xs text-slate-600">
                    Nom du lien
                    <span className="ml-2 text-slate-500">
                      {l.style === 'icon' ? "texte de remplacement de l'icône, jamais visible ; " : ''}
                      vide : « {DEFAULT_LINK_NAMES[(l.kind as string) ?? 'other']} »
                    </span>
                  </div>
                  <BilingualInput
                    value={(l.name as Bilingual | null) ?? null}
                    onChange={(v) => setLink(i, { name: v })}
                    nullable
                    label={`Nom du lien ${i + 1}`}
                    issues={sub(issues, `links.${i}.name`)}
                  />
                </div>
              )}
              <div className="sm:col-span-4">
                <Messages issues={sub(issues, `links.${i}`).filter((x) => !x.path.startsWith('name'))} />
              </div>
            </div>
          ))}
          <button
            type="button"
            className={buttonClass.small}
            onClick={() =>
              set('links', [...links, { id: '', kind: 'linkedin', url: '', display: '', style: 'url', name: null }])
            }
          >
            + Ajouter un lien
          </button>
        </div>
        {(['drivingLicense', 'workAuthorization'] as const).map((key) => (
          <div key={key} className="space-y-1">
            <div className="text-sm font-medium">
              {key === 'drivingLicense' ? 'Permis de conduire' : 'Autorisation de travail'}
              <span className="ml-2 text-xs font-normal text-slate-500">
                facultatif, affiché seulement si l'option est cochée
                {key === 'drivingLicense' &&
                  " ; EN (en-GB) : « Full driving licence (category B) » ; un CV en-US affiche « Driver's license »"}
              </span>
            </div>
            <BilingualInput
              value={(draft[key] as Bilingual | null) ?? null}
              onChange={(v) => set(key, v)}
              nullable
              label={key === 'drivingLicense' ? 'Permis' : 'Autorisation de travail'}
              issues={sub(issues, key)}
            />
          </div>
        ))}
        {notice && (
          <p className={`text-sm ${notice.tone === 'ok' ? 'text-green-800' : 'text-red-800'}`} role="status">
            {notice.text}
          </p>
        )}
        <div className="flex gap-2 border-t border-slate-200 pt-3">
          <button type="submit" className={buttonClass.primary} disabled={busy || !dirty}>
            Enregistrer
          </button>
          <button
            type="button"
            className={buttonClass.secondary}
            disabled={busy || !dirty}
            onClick={() => {
              setDirty(false);
              setIssues([]);
            }}
          >
            Annuler les modifications
          </button>
        </div>
      </form>
      <PhotoEditor identity={identity} revision={revision} onWritten={onWritten} />
    </div>
  );
}
