// Coverage of the offer terms (§6.8, F-OFF-01 to 04), middle panel of an open application (§10.1). The
// server recomputes it at each preview, on the text projected for the effective selection (NF-04). It
// shows the formula and a level, never an « ATS score » (F-ATS-04); the missing terms are grouped:
// (a) in the library but not checked, with « cocher l'élément »; (b) under another label or as a
// related term; (c) absent, « à n'ajouter que si c'est vrai ». ATS-19: the target job title can become
// the CV title, by an action of the user only, and stays editable. The analysis comes from Claude
// (save_offer_analysis, MCP-10) or from a JSON file imported here; its history is kept.
import { useEffect, useId, useState, type ReactNode } from 'react';
import { stripGenderMarkers } from '@cv/core/export';
import {
  COVERAGE_THRESHOLDS,
  sameTerm,
  type Coverage,
  type CoverageFix,
  type CoverageLevel,
  type CoverageTerm,
} from '@cv/core/offer';
import { setChecked, setSectionEnabled, setSummary, setTitle, setVariant } from '@cv/core/selection';
import { ApiError, api, type ApplicationDetail, type PresetFile, type RejectedTerm, type TreeGroup } from '../api';
import { useCv } from '../state/cv-store';
import { buttonClass } from './fields';
import { cvTitle } from './PresetSettings';

const pct = (r: number) => `${(Math.round(r * 1000) / 10).toLocaleString('fr-FR')} %`;
const num = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const frDateTime = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

const LEVEL_STYLE: Record<CoverageLevel, string> = {
  faible: 'bg-red-100 text-red-900',
  moyen: 'bg-amber-100 text-amber-900',
  bon: 'bg-green-100 text-green-900',
  fort: 'bg-green-700 text-white',
};
const WEIGHT_LABEL = { titre: 'titre', requis: 'requis', souhaite: 'souhaité' } as const;
const DOMAIN_LABEL = { dm: 'DM', tech: 'tech', general: 'général' } as const;
const NO_GROUPS: TreeGroup[] = [];

function Badge({ children, className = 'bg-slate-100 text-slate-700' }: { children: ReactNode; className?: string }) {
  return <span className={`rounded px-1.5 py-0.5 text-xs ${className}`}>{children}</span>;
}

/** Untrusted text of the offer (§7.5): shown as a quotation, never interpreted. */
function Untrusted({ text }: { text: string }) {
  return (
    <q className="text-xs text-slate-600" title="Phrase de l'offre : donnée non fiable">
      {text}
    </q>
  );
}

function fixLabel(fix: CoverageFix, preset: PresetFile): string {
  switch (fix.kind) {
    case 'check':
      return "Cocher l'élément";
    case 'variant':
      return 'Choisir cette variante';
    case 'title':
      return preset.selection.overrides.title ? 'Remplacer le titre saisi par ce titre' : 'Choisir ce titre';
    case 'summary':
      return 'Choisir cette accroche';
  }
}

function applyFix(p: PresetFile, fix: CoverageFix): void {
  const sel = p.selection;
  if (fix.kind === 'check') {
    setChecked(sel, fix.target, true);
    for (const key of fix.enable) setSectionEnabled(sel, key, true);
    if (fix.variant) setVariant(sel, fix.variant.ownerId, fix.variant.variantId);
  } else if (fix.kind === 'variant') setVariant(sel, fix.ownerId, fix.variantId);
  else if (fix.kind === 'title') {
    delete sel.overrides.title;
    setTitle(sel, fix.id);
    setVariant(sel, fix.id, fix.variantId);
  } else {
    setSummary(sel, fix.id);
    setVariant(sel, fix.id, fix.variantId);
  }
}

function TermHead({ t }: { t: CoverageTerm }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="font-medium">{t.term}</span>
      <Badge>
        {WEIGHT_LABEL[t.weight]} · w = {t.w}
      </Badge>
      <Badge>{DOMAIN_LABEL[t.domain]}</Badge>
    </span>
  );
}

function Notes({ t }: { t: CoverageTerm }) {
  if (t.notes.length === 0) return null;
  return (
    <ul className="mt-0.5 text-xs text-slate-500">
      {t.notes.map((n) => (
        <li key={n}>Non compté : {n}.</li>
      ))}
    </ul>
  );
}

function GroupA({ terms, preset }: { terms: CoverageTerm[]; preset: PresetFile }) {
  const edit = useCv((s) => s.edit);
  return (
    <ul className="space-y-2">
      {terms.map((t) => (
        <li key={t.term} className="rounded border border-slate-200 p-2 text-sm">
          <TermHead t={t} />
          <ul className="mt-1 space-y-1">
            {t.suggestions.map((s, i) =>
              s.kind === 'unchecked' ? (
                <li key={i} className="flex flex-wrap items-start gap-2">
                  <span className="min-w-0 flex-1 text-xs">
                    {s.where} : « {s.excerpt} »
                    {s.q < 1 && <span className="text-slate-500"> (sous la forme « {s.form} », q = 0,9)</span>}
                  </span>
                  <button type="button" className={buttonClass.small} onClick={() => edit((p) => applyFix(p, s.fix))}>
                    {fixLabel(s.fix, preset)}
                  </button>
                </li>
              ) : null,
            )}
          </ul>
          <Notes t={t} />
        </li>
      ))}
    </ul>
  );
}

function GroupB({ terms }: { terms: CoverageTerm[] }) {
  return (
    <ul className="space-y-2">
      {terms.map((t) => (
        <li key={t.term} className="rounded border border-slate-200 p-2 text-sm">
          <TermHead t={t} />
          <ul className="mt-1 space-y-0.5 text-xs">
            {t.suggestions.map((s, i) =>
              s.kind === 'related' ? (
                <li key={i}>
                  Terme voisin de la compétence « {s.skill} » (related « {s.related} ») : il ne compte jamais. Un alias
                  strict compterait, s'il est vraiment équivalent.
                </li>
              ) : s.kind === 'label' ? (
                <li key={i}>
                  Autre libellé {s.inCv ? 'dans le CV' : 'dans la bibliothèque'} ({s.where}) : « {s.excerpt} ». Reprenez
                  le terme exact seulement s'il est juste.
                </li>
              ) : null,
            )}
          </ul>
          <Notes t={t} />
        </li>
      ))}
    </ul>
  );
}

function GroupC({ terms }: { terms: CoverageTerm[] }) {
  return (
    <ul className="space-y-1.5">
      {terms.map((t) => (
        <li key={t.term} className="text-sm">
          <TermHead t={t} />
          <Notes t={t} />
        </li>
      ))}
    </ul>
  );
}

/** ATS-19: the target job title as CV title, if it is exact; never automatic, always editable. */
function TargetTitle({ jobTitle, preset }: { jobTitle: string; preset: PresetFile }) {
  const edit = useCv((s) => s.edit);
  const groups = useCv((s) => s.library?.groups ?? NO_GROUPS);
  const id = useId();
  const proposed = stripGenderMarkers(jobTitle);
  const [value, setValue] = useState(proposed);
  useEffect(() => setValue(proposed), [proposed]);
  const current = cvTitle(preset, groups);
  const override = preset.selection.overrides.title;
  const lang = preset.lang === 'fr' ? 'français' : 'anglais';

  return (
    <section aria-labelledby={id} className="space-y-2 rounded border border-slate-200 p-3">
      <h3 id={id} className="text-sm font-semibold">
        Titre du CV et intitulé du poste visé (ATS-19)
      </h3>
      <p className="text-sm">
        Intitulé de l'offre{proposed !== jobTitle.trim() ? ', sans marqueur de genre' : ''} : « {proposed} ». Titre
        actuel : {current ? `« ${current} »` : 'aucun'}
        {override ? ' (saisi pour cette candidature)' : ''}.
      </p>
      {current && sameTerm(current, proposed) ? (
        <p className="text-sm text-green-800">Le titre du CV reprend déjà l'intitulé du poste.</p>
      ) : (
        <div className="space-y-1">
          <label className="block text-xs text-slate-600" htmlFor={`${id}-title`}>
            Reprenez-le comme titre seulement s'il décrit exactement votre poste ; vous pouvez l'ajuster (forme
            féminine, par exemple) avant de l'appliquer.
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id={`${id}-title`}
              className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <button
              type="button"
              className={buttonClass.secondary}
              disabled={!value.trim()}
              onClick={() =>
                edit((p) => {
                  const prev = p.selection.overrides.title;
                  p.selection.overrides.title = {
                    fr: prev?.fr ?? null,
                    en: prev?.en ?? null,
                    [p.lang]: value.trim(),
                  };
                })
              }
            >
              Utiliser comme titre du CV
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Le titre est saisi pour le {lang} et pour cette candidature seulement ; la bibliothèque ne change pas.
          </p>
        </div>
      )}
      {override && (
        <button
          type="button"
          className={buttonClass.small}
          onClick={() =>
            edit((p) => {
              delete p.selection.overrides.title;
            })
          }
        >
          Revenir au titre de la bibliothèque
        </button>
      )}
    </section>
  );
}

function Formula({ coverage }: { coverage: Coverage }) {
  if (coverage.ratio === null || !coverage.level) return <p className="text-sm">Aucun terme dans l'analyse.</p>;
  return (
    <div className="space-y-1">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span className={`rounded px-2 py-0.5 text-sm font-semibold ${LEVEL_STYLE[coverage.level]}`}>
          Niveau de couverture : {coverage.level}
        </span>
        <span>
          Σ w·q / Σ w = {num(coverage.sumWQ)} / {coverage.sumW} = {pct(coverage.ratio)}
        </span>
      </p>
      <p className="text-xs text-slate-500">
        q = 1 pour la forme exacte, 0,9 pour un alias ou un sigle, 0 sinon (un terme voisin ne compte jamais) ; w = 3
        (titre), 2 (requis), 1 (souhaité). Niveaux : faible sous {pct(COVERAGE_THRESHOLDS.moyen)}, moyen jusqu'à{' '}
        {pct(COVERAGE_THRESHOLDS.bon)}, bon jusqu'à {pct(COVERAGE_THRESHOLDS.fort)}, fort au-delà. C'est la couverture
        des termes de l'offre par le texte du CV, pas un « score ATS ».
      </p>
    </div>
  );
}

function TermsTable({ coverage }: { coverage: Coverage }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="text-slate-500">
          <tr>
            <th className="py-1 pr-2 font-medium">Terme</th>
            <th className="py-1 pr-2 font-medium">Poids</th>
            <th className="py-1 pr-2 font-medium">Domaine</th>
            <th className="py-1 pr-2 font-medium">q</th>
            <th className="py-1 pr-2 font-medium">Trouvé dans</th>
            <th className="py-1 font-medium">Phrase de l'offre (non fiable)</th>
          </tr>
        </thead>
        <tbody>
          {coverage.terms.map((t) => (
            <tr key={t.term} className="border-t border-slate-100 align-top">
              <td className="py-1 pr-2">
                {t.term}
                {t.aliases.length > 0 && <span className="block text-slate-500">alias : {t.aliases.join(', ')}</span>}
              </td>
              <td className="py-1 pr-2">
                {WEIGHT_LABEL[t.weight]} ({t.w})
              </td>
              <td className="py-1 pr-2">{DOMAIN_LABEL[t.domain]}</td>
              <td className="py-1 pr-2">{num(t.q)}</td>
              <td className="py-1 pr-2">
                {t.match ? (
                  <>
                    {t.match.where}
                    {t.match.kind === 'alias' && <span className="block text-slate-500">sous « {t.match.form} »</span>}
                    {t.match.editionNote && <span className="block text-amber-800">{t.match.editionNote}</span>}
                  </>
                ) : (
                  <span className="text-slate-500">groupe {t.group}</span>
                )}
              </td>
              <td className="py-1">
                <Untrusted text={t.sourceSentence} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnalysisImport({ detail }: { detail: ApplicationDetail }) {
  const reloadApplication = useCv((s) => s.reloadApplication);
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string; rejected: RejectedTerm[] } | null>(null);

  const onFile = async (file: File) => {
    setBusy(true);
    setResult(null);
    try {
      let json: unknown;
      try {
        json = JSON.parse(await file.text());
      } catch {
        throw new Error(`${file.name} n'est pas un fichier JSON valide`);
      }
      const r = await api.importAnalysis(detail.application.id, json);
      const kept = r.analysis.current?.terms.length ?? 0;
      setResult({
        ok: true,
        text: `Analyse enregistrée : ${kept} terme${kept > 1 ? 's' : ''}${r.rejected.length ? `, ${r.rejected.length} rejeté(s)` : ''}.${r.analysis.history.length ? " La précédente reste dans l'historique." : ''}`,
        rejected: r.rejected,
      });
      await reloadApplication();
    } catch (e) {
      const rejected = e instanceof ApiError ? ((e.details.rejected as RejectedTerm[] | undefined) ?? []) : [];
      setResult({ ok: false, text: (e as Error).message, rejected });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm">
        <span className={`${buttonClass.secondary} inline-block cursor-pointer`}>
          {busy ? 'Import…' : 'Importer une analyse (JSON)'}
        </span>
        <input
          id={id}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void onFile(file);
          }}
        />
      </label>
      <p className="text-xs text-slate-500">
        Format de analysis.json (ou {'{ terms: [...] }'}). Chaque phrase source doit figurer dans l'offre ; sinon le
        terme est rejeté. Claude l'enregistre lui-même avec save_offer_analysis (prompt adapter-a-une-offre).
      </p>
      {result && (
        <div
          role={result.ok ? 'status' : 'alert'}
          className={`rounded px-2 py-1 text-sm ${result.ok ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'}`}
        >
          {result.text}
          {result.rejected.length > 0 && (
            <ul className="list-disc pl-5 text-xs">
              {result.rejected.map((r) => (
                <li key={r.index}>
                  {r.term ?? `terme ${r.index + 1}`} : {r.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function History({ detail }: { detail: ApplicationDetail }) {
  const [open, setOpen] = useState<number | null>(null);
  const analysis = detail.analysis;
  if (!analysis?.current) return null;
  const past = [...analysis.history].reverse();
  return (
    <div className="space-y-1 text-sm">
      <p>
        Analyse courante : {frDateTime(analysis.current.createdAt)}, origine {analysis.current.origin},{' '}
        {analysis.current.terms.length} termes.
      </p>
      {past.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs text-slate-600">Historique ({past.length})</summary>
          <ul className="mt-1 space-y-1">
            {past.map((a, i) => (
              <li key={`${a.createdAt}-${i}`} className="text-xs">
                <button type="button" className="underline" onClick={() => setOpen(open === i ? null : i)}>
                  {frDateTime(a.createdAt)} · {a.origin} · {a.terms.length} termes
                </button>
                {open === i && (
                  <ul className="mt-1 space-y-0.5 pl-3">
                    {a.terms.map((t) => (
                      <li key={t.term}>
                        {t.term} ({WEIGHT_LABEL[t.weight]}, {DOMAIN_LABEL[t.domain]}) :{' '}
                        <Untrusted text={t.sourceSentence} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function CoveragePanel() {
  const detail = useCv((s) => s.application);
  const preset = useCv((s) => s.draft);
  const coverage = useCv((s) => s.preview.response?.coverage ?? null);
  const busy = useCv((s) => s.preview.busy);
  if (!detail || !preset) return null;
  const hasAnalysis = !!detail.analysis?.current;
  const groups = coverage
    ? {
        a: coverage.terms.filter((t) => t.group === 'a'),
        b: coverage.terms.filter((t) => t.group === 'b'),
        c: coverage.terms.filter((t) => t.group === 'c'),
      }
    : null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Couverture des termes de l'offre</h2>
        <p className="text-sm text-slate-600">
          {detail.application.company} · {detail.application.jobTitle}. Recalculée à chaque coche, sur le texte du CV
          affiché.
        </p>
      </div>

      {!hasAnalysis && (
        <p className="rounded bg-slate-50 p-2 text-sm text-slate-700">
          Aucune analyse pour cette offre. Demandez à Claude d'adapter le CV à l'offre (prompt adapter-a-une-offre avec
          l'identifiant {detail.application.id}) : il extrait les termes et les enregistre ; la couverture s'affiche
          alors ici. Vous pouvez aussi importer une analyse au format JSON.
        </p>
      )}
      {hasAnalysis && !coverage && (
        <p className="text-sm text-slate-500">{busy ? 'Calcul…' : 'En attente de l’aperçu…'}</p>
      )}
      {coverage && groups && (
        <>
          <Formula coverage={coverage} />
          <TargetTitle jobTitle={detail.application.jobTitle} preset={preset} />

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">
              Termes manquants ({coverage.counts.a + coverage.counts.b + coverage.counts.c} sur {coverage.terms.length})
            </h3>
            <div className="space-y-1">
              <h4 className="text-sm font-medium">(a) Dans la bibliothèque, mais pas coché ({groups.a.length})</h4>
              {groups.a.length ? (
                <GroupA terms={groups.a} preset={preset} />
              ) : (
                <p className="text-xs text-slate-500">Aucun.</p>
              )}
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-medium">(b) Sous un autre libellé, ou terme voisin ({groups.b.length})</h4>
              {groups.b.length ? <GroupB terms={groups.b} /> : <p className="text-xs text-slate-500">Aucun.</p>}
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-medium">(c) Absents de la bibliothèque ({groups.c.length})</h4>
              {groups.c.length ? (
                <>
                  <p className="text-xs text-slate-600">
                    À n'ajouter que si c'est vrai ; sinon, à garder pour la lettre ou l'entretien.
                  </p>
                  <GroupC terms={groups.c} />
                </>
              ) : (
                <p className="text-xs text-slate-500">Aucun.</p>
              )}
            </div>
          </section>

          <section className="space-y-1">
            <h3 className="text-sm font-semibold">Tous les termes</h3>
            <TermsTable coverage={coverage} />
          </section>
        </>
      )}

      <section className="space-y-2 rounded border border-slate-200 p-3">
        <h3 className="text-sm font-semibold">Analyse de l'offre</h3>
        <History detail={detail} />
        <AnalysisImport detail={detail} />
      </section>
    </div>
  );
}
