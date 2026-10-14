// Application shell: four screens (Bibliothèque with the selection, Candidatures, À valider, Journal MCP),
// the pending-proposals badge, the backup and reset buttons, and the live stream that reloads data when another
// process (Claude via MCP, another tab, a file dropped by hand) changes data/ (§8.4, F-PRO-05). The
// library, the presets and the open application live in the Zustand store (ADR 0011, ADR 0013).
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, isOnline, isOwnWrite, signOut } from './api';
import { buttonClass } from './components/fields';
import { ResetDialog } from './components/ResetDialog';
import { subscribeEvents, type LiveStatus } from './events';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { JournalPage } from './pages/JournalPage';
import { LetterPage } from './pages/LetterPage';
import { LibraryPage } from './pages/LibraryPage';
import { ReviewPage } from './pages/ReviewPage';
import { useCv } from './state/cv-store';

interface Route {
  page: 'bibliotheque' | 'candidatures' | 'a-valider' | 'lettre' | 'journal';
  ids: string[];
  /** Letter of an application (/candidatures/<id>/lettre?lang=fr|en, ADR 0016). */
  letter: { applicationId: string; lang: 'fr' | 'en' | null } | null;
}

function parseRoute(): Route {
  const path = window.location.pathname.replace(/\/+$/, '');
  const letterMatch = /^\/candidatures\/([a-z0-9]+(?:-[a-z0-9]+)*)\/lettre$/.exec(path);
  const langParam = new URLSearchParams(window.location.search).get('lang');
  const letter = letterMatch
    ? {
        applicationId: letterMatch[1]!,
        lang: langParam === 'fr' || langParam === 'en' ? (langParam as 'fr' | 'en') : null,
      }
    : null;
  const page = letter
    ? 'lettre'
    : path === '/a-valider'
      ? 'a-valider'
      : path === '/candidatures'
        ? 'candidatures'
        : path === '/journal'
          ? 'journal'
          : 'bibliotheque';
  const ids = (new URLSearchParams(window.location.search).get('ids') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^[0-9A-HJKMNP-TV-Z]{26}$/.test(s));
  return { page, ids, letter };
}

/**
 * Files whose change concerns the interface (the lock and temporary files are never reported). Every
 * file of an application counts, except the exported files themselves: their trace is application.json.
 */
const RELEVANT = /^(?:profile\.json|library\/|presets\/|proposals\/|applications\/[^/]+\/(?!exports\/))/;

export function App() {
  const [route, setRoute] = useState<Route>(parseRoute);
  const library = useCv((s) => s.library);
  const libraryError = useCv((s) => s.libraryError);
  const [pending, setPending] = useState<{ pending: number; stale: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<LiveStatus>('connexion');
  const [version, setVersion] = useState(0);
  const [backupState, setBackupState] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = useCallback((path: string) => {
    window.history.pushState(null, '', path);
    setRoute(parseRoute());
  }, []);

  useEffect(() => {
    const onPop = () => setRoute(parseRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  /** Reload everything shown (library, proposals): after our writes, or on a change from elsewhere. */
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    const store = useCv.getState();
    Promise.all([store.reloadLibrary(), store.reloadPresets(), api.proposals(), store.reloadApplications()])
      .then(async ([, , props]) => {
        await useCv.getState().reloadApplication();
        if (cancelled) return;
        setPending(props.counts);
        setError(null);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [version]);

  useEffect(
    () =>
      subscribeEvents(
        (change) => {
          if (!RELEVANT.test(change.file) || isOwnWrite(change.file, change.revision)) return;
          if (refreshTimer.current) clearTimeout(refreshTimer.current);
          refreshTimer.current = setTimeout(refresh, 150);
        },
        (status) => {
          setLive(status);
          // Back online after an interruption: changes may have been missed.
          if (status === 'en direct') refresh();
        },
      ),
    [refresh],
  );

  const backup = async () => {
    setBackupState('Préparation…');
    try {
      await api.backup();
      setBackupState(null);
    } catch (e) {
      setBackupState((e as Error).message);
    }
  };

  /** The letter of an application belongs to the « Candidatures » screen. */
  const current = (page: Route['page']) => route.page === page || (page === 'candidatures' && route.page === 'lettre');
  const tab = (page: Route['page'], label: string, badge?: number) => (
    <button
      type="button"
      onClick={() => navigate(page === 'bibliotheque' ? '/' : `/${page}`)}
      aria-current={current(page) ? 'page' : undefined}
      className={`rounded px-3 py-1 text-sm ${current(page) ? 'bg-[#1F4E79] text-white' : 'bg-slate-100 hover:bg-slate-200'}`}
    >
      {label}
      {badge !== undefined && badge > 0 && (
        <span
          className={`ml-2 rounded-full px-2 text-xs ${current(page) ? 'bg-white text-[#1F4E79]' : 'bg-[#1F4E79] text-white'}`}
          aria-label={`${badge} proposition(s) en attente`}
        >
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold">Générateur de CV</h1>
        <nav className="flex gap-2" aria-label="Écrans">
          {tab('bibliotheque', 'Bibliothèque')}
          {tab('candidatures', 'Candidatures')}
          {tab('a-valider', 'À valider', pending?.pending)}
          {tab('journal', 'Journal MCP')}
        </nav>
        <span className="ml-auto flex items-center gap-3">
          <span
            className={`text-xs ${live === 'en direct' ? 'text-green-700' : live === 'connexion' ? 'text-slate-500' : 'text-red-700'}`}
            title="Mise à jour automatique quand data/ change"
          >
            ● {live}
          </span>
          <button type="button" className={buttonClass.secondary} onClick={() => void backup()}>
            Sauvegarde ZIP
          </button>
          <button type="button" className={buttonClass.danger} onClick={() => setResetting(true)}>
            Réinitialiser…
          </button>
          {isOnline() && (
            <button type="button" className={buttonClass.secondary} onClick={() => void signOut()}>
              Se déconnecter
            </button>
          )}
        </span>
      </header>
      {resetting && <ResetDialog onClose={() => setResetting(false)} />}
      {backupState && <p className="bg-slate-50 px-4 py-1 text-sm text-slate-700">{backupState}</p>}
      {(error ?? libraryError) && (
        <p className="bg-red-50 px-4 py-2 text-sm text-red-800">Erreur : {error ?? libraryError}</p>
      )}

      {route.page === 'bibliotheque' ? (
        <LibraryPage onChanged={refresh} />
      ) : route.page === 'candidatures' ? (
        <ApplicationsPage navigate={navigate} />
      ) : route.page === 'journal' ? (
        <JournalPage />
      ) : route.page === 'lettre' && route.letter ? (
        <LetterPage
          key={route.letter.applicationId}
          applicationId={route.letter.applicationId}
          initialLang={route.letter.lang}
          version={version}
          onChanged={refresh}
          navigate={navigate}
        />
      ) : (
        <ReviewPage
          ids={route.ids}
          library={library?.library ?? null}
          version={version}
          onChanged={refresh}
          navigate={navigate}
        />
      )}

      <footer className="flex flex-wrap gap-4 border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-600">
        <button type="button" className="hover:underline" onClick={() => navigate('/a-valider')}>
          À valider ({pending?.pending ?? '…'}){pending?.stale ? `, dont ${pending.stale} en conflit` : ''}
        </button>
        {library && (
          <span>
            Non traduits : FR {library.untranslated.fr} · EN {library.untranslated.en}
          </span>
        )}
      </footer>
    </div>
  );
}
