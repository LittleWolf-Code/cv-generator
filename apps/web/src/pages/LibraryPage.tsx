// Selection screen (§10.1, F-UI-01): preset bar on top; library with the selection on the left; detail
// in the middle (preset settings, or the editor of the element clicked); live preview of the compiled
// PDF with the ATS lights, and the "what the ATS sees" view, on the right (F-SEL-06, F-ATS-01 to 04).
// A link of a blocked export opens the element to fix (F-EXP-03, F-UI-06). With an application open
// (ADR 0013), the middle panel shows the coverage of the offer terms (or the settings), and the right
// panel gains an « Offre » tab (§10.1).
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BlockerFix } from '@cv/core/export';
import { COLLECTION_NAMES, decodeBase64, type CollectionName } from '../api';
import { AtsLights, AtsView } from '../components/AtsPanel';
import { CoveragePanel } from '../components/CoveragePanel';
import { buttonClass } from '../components/fields';
import { IdentityEditor } from '../components/IdentityEditor';
import { ItemEditor } from '../components/ItemEditor';
import { LibraryTree, type Filters, type Selected } from '../components/LibraryTree';
import { OfferPanel } from '../components/OfferPanel';
import { PdfPreview } from '../components/PdfPreview';
import { PresetBar } from '../components/PresetBar';
import { PresetSettings } from '../components/PresetSettings';
import { useCv } from '../state/cv-store';

type Tab = 'apercu' | 'ats' | 'offre';

const FILTERS_KEY = 'cv.library.filters';

function loadFilters(): Filters {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (raw) return { query: '', ...(JSON.parse(raw) as Partial<Filters>) } as Filters;
  } catch {
    // Interface state only (§8.4): ignore an unreadable value.
  }
  return { query: '', untranslated: false, archived: false };
}

const panel = 'max-h-[calc(100vh-11rem)] overflow-auto rounded bg-white p-4 shadow-sm';

export function LibraryPage({ onChanged }: { onChanged: () => void }) {
  const data = useCv((s) => s.library);
  const preset = useCv((s) => s.draft);
  const preview = useCv((s) => s.preview);
  const edit = useCv((s) => s.edit);
  const previewPainted = useCv((s) => s.previewPainted);
  const previewDisplayed = useCv((s) => s.previewDisplayed);
  const exportReports = useCv((s) => s.exporting.reports);
  const [selected, setSelected] = useState<Selected>(null);
  const [filters, setFilters] = useState<Filters>(loadFilters);
  const [tab, setTab] = useState<Tab>('apercu');
  const application = useCv((s) => (s.mode === 'application' ? s.application : null));
  const [middle, setMiddle] = useState<'couverture' | 'reglages'>('couverture');
  const shownTab: Tab = tab === 'offre' && !application ? 'apercu' : tab;

  useEffect(() => {
    try {
      localStorage.setItem(
        FILTERS_KEY,
        JSON.stringify({ untranslated: filters.untranslated, archived: filters.archived }),
      );
    } catch {
      // Private mode: filters are simply not remembered.
    }
  }, [filters.untranslated, filters.archived]);

  const render = preview.response;
  const pdf = useMemo(() => (render ? decodeBase64(render.pdfBase64) : null), [render]);

  const onFix = useCallback(
    (fix: BlockerFix) => {
      if (fix.kind === 'identity') setSelected({ kind: 'identity' });
      else if (fix.kind === 'ats-view') setTab('ats');
      else if (fix.kind === 'density')
        edit((p) => {
          p.template.theme.density = 'compacte';
        });
      else if ((COLLECTION_NAMES as readonly string[]).includes(fix.collection))
        setSelected({
          kind: 'item',
          collection: fix.collection as CollectionName,
          id: fix.itemId,
          bullet: fix.bulletId ?? null,
        });
    },
    [edit],
  );
  // Reports of the exports made from the preview whose report is shown (T-ATS-13, T-DOCX-01 to 03).
  const fromShown = (format: 'pdf' | 'docx') => {
    const r = exportReports[format];
    return r && render && r.previewSha256 === render.sha256 ? r.report : null;
  };
  const exports = { pdf: fromShown('pdf'), docx: fromShown('docx') };

  if (!data) return <p className="p-4 text-sm text-slate-500">Chargement…</p>;
  const identity = data.identity.value;

  const written = (next: { collection: CollectionName; id: string } | null) => {
    onChanged();
    setSelected(next ? { kind: 'item', ...next } : null);
  };

  return (
    <div className="flex flex-1 flex-col">
      <PresetBar onFix={onFix} />
      <main className="grid flex-1 grid-cols-1 gap-4 p-4 xl:grid-cols-[minmax(320px,0.95fr)_minmax(400px,1.2fr)_minmax(380px,1fr)]">
        <section className={panel} aria-label="Bibliothèque et sélection">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-base font-semibold">Bibliothèque</h2>
            <button
              type="button"
              className={`ml-auto ${buttonClass.small}`}
              aria-pressed={selected === null}
              onClick={() => setSelected(null)}
            >
              {application ? 'Couverture et réglages' : 'Réglages du preset'}
            </button>
          </div>
          {preset ? (
            <LibraryTree
              groups={data.groups}
              preset={preset}
              edit={edit}
              identityLabel={identity ? `${identity.firstName} ${identity.lastName}` : null}
              filters={filters}
              onFilters={setFilters}
              selected={selected}
              onSelect={setSelected}
            />
          ) : (
            <p className="text-sm text-slate-500">Chargement des presets…</p>
          )}
        </section>

        <section className={panel} aria-label="Détail et édition">
          {selected === null && application && (
            <div className="mb-3 flex gap-2" role="tablist" aria-label="Panneau central">
              {(['couverture', 'reglages'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={middle === m}
                  onClick={() => setMiddle(m)}
                  className={`rounded px-3 py-1 text-sm ${middle === m ? 'bg-[#1F4E79] text-white' : 'bg-slate-100 hover:bg-slate-200'}`}
                >
                  {m === 'couverture' ? "Couverture de l'offre" : 'Réglages de la candidature'}
                </button>
              ))}
            </div>
          )}
          {selected === null && application && middle === 'couverture' && <CoveragePanel />}
          {selected === null && (!application || middle === 'reglages') && (
            <div className="space-y-3">
              {preset && <PresetSettings preset={preset} identity={identity} />}
              {data.integrity.errors.length > 0 && (
                <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-900">
                  Incohérences : {data.integrity.errors.map((e) => `${e.path} : ${e.message}`).join(' ; ')}
                </div>
              )}
              {data.integrity.warnings.length > 0 && (
                <div className="rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
                  {data.integrity.warnings.map((e) => e.message).join(' ; ')}
                </div>
              )}
              <p className="text-xs text-slate-500">
                Un clic sur un libellé de la bibliothèque ouvre l'élément pour le modifier ; « + Ajouter » en crée un.
                Les saisies sont assainies à l'enregistrement.
              </p>
            </div>
          )}
          {selected?.kind === 'identity' && (
            <IdentityEditor identity={identity} revision={data.identity.revision} onWritten={onChanged} />
          )}
          {selected?.kind === 'item' && (
            <ItemEditor
              key={`${selected.collection}:${selected.id}`}
              collection={selected.collection}
              mode={{ kind: 'edit', id: selected.id }}
              library={data.library}
              revision={data.revisions[selected.collection]}
              focusBullet={selected.bullet ?? null}
              onWritten={written}
            />
          )}
          {selected?.kind === 'create' && (
            <ItemEditor
              key={`create:${selected.collection}:${JSON.stringify(selected.defaults)}`}
              collection={selected.collection}
              mode={{ kind: 'create', defaults: selected.defaults }}
              library={data.library}
              revision={data.revisions[selected.collection]}
              onWritten={written}
            />
          )}
        </section>

        <section className={panel} aria-label="Aperçu">
          <div className="mb-3 flex flex-wrap items-center gap-2" role="tablist">
            {(application ? (['apercu', 'ats', 'offre'] as const) : (['apercu', 'ats'] as const)).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={shownTab === t}
                onClick={() => setTab(t)}
                className={`rounded px-3 py-1 text-sm ${shownTab === t ? 'bg-[#1F4E79] text-white' : 'bg-slate-100 hover:bg-slate-200'}`}
              >
                {t === 'apercu' ? 'Aperçu' : t === 'ats' ? 'Vue ATS' : 'Offre'}
              </button>
            ))}
            <span className="ml-auto text-xs text-slate-500" aria-live="polite">
              {preview.busy
                ? 'Compilation…'
                : render
                  ? `${render.pages} page${render.pages > 1 ? 's' : ''} · compilé en ${render.compileMs} ms${
                      preview.latencyMs !== null ? ` · aperçu à jour en ${preview.latencyMs} ms` : ''
                    }`
                  : ''}
            </span>
          </div>
          {preview.error && <p className="text-sm text-red-800">Aperçu impossible : {preview.error}</p>}
          {render && (
            // The preview stays mounted on the ATS tab: the buffer shown is the one exported (ATS-15).
            <div className={shownTab === 'apercu' ? 'space-y-4' : 'hidden'}>
              {pdf && (
                <PdfPreview
                  data={pdf}
                  onLoaded={() => void previewDisplayed(render, pdf)}
                  onPainted={() => {
                    if (preview.since !== null) previewPainted(preview.since);
                  }}
                />
              )}
              <h3 className="font-semibold">Lisibilité ATS</h3>
              <AtsLights report={render.report} exports={exports} />
            </div>
          )}
          {render && shownTab === 'ats' && <AtsView report={render.report} docx={exports.docx} />}
          {application && shownTab === 'offre' && <OfferPanel detail={application} />}
        </section>
      </main>
    </div>
  );
}
