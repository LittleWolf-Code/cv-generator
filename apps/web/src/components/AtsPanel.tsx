// ATS readability (F-ATS-01 to 04, F-ATS-06): one light per criterion of §12.3 with its message, the
// DOCX criteria once a DOCX has been exported from the preview shown, and the "what the ATS sees" view:
// raw pdf.js text, pdftotext -raw output (or an "incomplete" report), normalized version with a copy
// button, and the detected fields. The interface speaks of readability, never of "passing" an ATS. The
// visual layout carries its badge (F-MOD-03): its layout criteria are orange, its integrity ones red.
import { useState } from 'react';
import { normalizeExtracted } from '@cv/core/export';
import { lowerFirst } from '@cv/core/selection';
import type { AtsCriterion, AtsReport, DetectedFields } from '@cv/core';

const LIGHT: Record<AtsCriterion['status'], { dot: string; label: string }> = {
  green: { dot: 'bg-green-600', label: 'vert' },
  orange: { dot: 'bg-amber-500', label: 'orange' },
  red: { dot: 'bg-red-600', label: 'rouge' },
  na: { dot: 'bg-slate-300', label: 'sans objet' },
};

function Criteria({ criteria }: { criteria: AtsCriterion[] }) {
  return (
    <ul className="space-y-1 text-sm">
      {criteria.map((c) => (
        <li key={c.id} className="flex items-start gap-2">
          <span
            className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${LIGHT[c.status].dot}`}
            role="img"
            aria-label={LIGHT[c.status].label}
          />
          <span>
            <span className="font-medium">{c.label}</span>
            <span className="text-slate-500"> ({c.id})</span> : {c.message}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Reports of the last export attempts made from the preview shown (same SHA-256), if any. */
export interface ExportReports {
  pdf: AtsReport | null;
  docx: AtsReport | null;
}

export function AtsLights({ report, exports }: { report: AtsReport; exports: ExportReports }) {
  // T-ATS-13 is known once the preview shown has been exported (PDF, or DOCX from the same projection).
  const t13 = (exports.pdf ?? exports.docx)?.criteria.find((c) => c.id === 'T-ATS-13');
  const pdf = report.criteria.map((c) => (c.id === 'T-ATS-13' && t13 ? t13 : c));
  const docx = exports.docx?.criteria.filter((c) => c.id.startsWith('T-DOCX')) ?? [];
  return (
    <div className="space-y-3">
      {report.notice && (
        <p className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900">
          <span className="font-semibold">Modèle visuel : {lowerFirst(report.notice.badge)}.</span> Les critères de mise
          en page sont en orange ; les critères d'intégrité du fichier restent bloquants.
        </p>
      )}
      {!report.complete && (
        <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">
          Rapport incomplet : pdftotext (Poppler) n'a pas été exécuté, seul pdf.js a extrait le texte.
        </p>
      )}
      <Criteria criteria={pdf} />
      <div>
        <h4 className="text-sm font-semibold">DOCX</h4>
        {docx.length > 0 ? (
          <Criteria criteria={docx} />
        ) : (
          <p className="text-xs text-slate-500">
            Contrôlés à l'export DOCX (T-DOCX-01 à 03). 1 page non garantie en DOCX.
          </p>
        )}
      </div>
    </div>
  );
}

type Source = 'pdf.js' | 'pdftotext' | 'docx';
type View = 'brut' | 'normalise' | 'champs';

const ok = (v: boolean) => (v ? '✓' : '✗');
const tone = (v: boolean) => (v ? 'text-green-800' : 'text-red-800');

function Detected({ d }: { d: DetectedFields }) {
  return (
    <div className="space-y-3 text-sm">
      <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1">
        <dt className="font-medium">Nom (1re ligne)</dt>
        <dd className={tone(d.name.ok)}>
          {ok(d.name.ok)} {d.name.line ?? '(aucune ligne)'}
        </dd>
        {d.contacts ? (
          <>
            <dt className="font-medium">E-mail</dt>
            <dd className={tone(d.contacts.email)}>
              {ok(d.contacts.email)} {d.contacts.emails.join(', ') || 'non trouvé avant le premier intitulé'}
            </dd>
            <dt className="font-medium">Téléphone</dt>
            <dd className={tone(d.contacts.phone)}>
              {ok(d.contacts.phone)} {d.contacts.phones.join(', ') || 'non trouvé avant le premier intitulé'}
            </dd>
            <dt className="font-medium">Ville et pays</dt>
            <dd className={tone(d.contacts.location)}>
              {ok(d.contacts.location)} {d.contacts.location ? 'sur une même ligne' : 'non trouvés sur une même ligne'}
            </dd>
            {d.contacts.otherEmails + d.contacts.otherPhones > 0 && (
              <>
                <dt className="font-medium">Autres coordonnées</dt>
                <dd className="text-amber-800">
                  {d.contacts.otherEmails} e-mail(s), {d.contacts.otherPhones} téléphone(s) ailleurs dans le texte
                </dd>
              </>
            )}
          </>
        ) : (
          <>
            <dt className="font-medium">Coordonnées</dt>
            <dd className="text-red-800">✗ identité absente</dd>
          </>
        )}
      </dl>
      <div>
        <h4 className="font-medium">
          Intitulés reconnus <span className={tone(d.headings.ok)}>{ok(d.headings.ok)}</span>
        </h4>
        <ol className="list-decimal pl-6">
          {d.headings.expected.map((h, i) => {
            const found = d.headings.found[i];
            const same = found !== undefined && found.replace(/\s+/g, '') === h.replace(/\s+/g, '');
            return (
              <li key={h} className={tone(same)}>
                {ok(same)} {h}
                {!same && found ? ` (lu : « ${found} »)` : ''}
              </li>
            );
          })}
        </ol>
      </div>
      <div>
        <h4 className="font-medium">Une plage de dates par entrée</h4>
        <ul className="space-y-0.5">
          {d.entries.map((e) => (
            <li key={e.id} className={tone(e.ok)}>
              {ok(e.ok)} {e.title} : <span className="whitespace-nowrap">{e.dates}</span>
              {!e.ok && <span className="block pl-4 text-xs">ligne lue : {e.line ?? 'introuvable'}</span>}
            </li>
          ))}
          {d.entries.length === 0 && <li className="text-slate-500">Aucune entrée datée.</li>}
        </ul>
      </div>
    </div>
  );
}

export function AtsView({ report, docx }: { report: AtsReport; docx: AtsReport | null }) {
  const [source, setSource] = useState<Source>('pdf.js');
  const [view, setView] = useState<View>('brut');
  const [copied, setCopied] = useState<string | null>(null);
  const texts: Record<Source, string | null> = {
    'pdf.js': report.text.pdfjs,
    pdftotext: report.text.pdftotext,
    docx: docx?.text.docx ?? null,
  };
  const detected: Record<Source, DetectedFields | undefined> = {
    'pdf.js': report.detected.find((d) => d.extractor === 'pdf.js'),
    pdftotext: report.detected.find((d) => d.extractor === 'pdftotext'),
    docx: docx?.detected.find((d) => d.extractor === 'docx'),
  };
  const raw = texts[source];
  const shown = raw === null ? null : view === 'normalise' ? normalizeExtracted(raw) : raw;
  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(done);
    } catch {
      // The browser refuses the clipboard to a window without focus: say so instead of failing silently.
      setCopied(
        'Copie refusée par le navigateur (fenêtre inactive ?) : cliquez dans la page puis réessayez, ou sélectionnez le texte et faites Ctrl+C.',
      );
    }
  };
  const pill = (active: boolean) =>
    `rounded px-2 py-0.5 text-xs ${active ? 'bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-200'}`;

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-600">
        Ce que lit un logiciel de recrutement : le texte extrait du PDF, sans mise en forme. Une extraction propre et
        complète garantit la lisibilité du fichier, pas l'issue de la candidature.
      </p>
      <div className="flex flex-wrap items-center gap-1" aria-label="Extracteur">
        <span className="mr-1 text-xs font-medium">Extracteur</span>
        {(['pdf.js', 'pdftotext', 'docx'] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={pill(source === s)}
            aria-pressed={source === s}
            onClick={() => setSource(s)}
          >
            {s === 'pdf.js' ? 'pdf.js' : s === 'pdftotext' ? 'pdftotext -raw' : 'DOCX (mammoth)'}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1" aria-label="Affichage">
        <span className="mr-1 text-xs font-medium">Affichage</span>
        {(
          [
            ['brut', 'Texte brut'],
            ['normalise', 'Version normalisée'],
            ['champs', 'Champs détectés'],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            className={pill(view === v)}
            aria-pressed={view === v}
            onClick={() => setView(v)}
          >
            {label}
          </button>
        ))}
      </div>

      {raw === null && source === 'pdftotext' && (
        <p className="rounded bg-amber-50 p-2 text-sm text-amber-900">
          Rapport incomplet : pdftotext (Poppler) n'a pas été exécuté
          {report.extractors.pdftotextDetail ? ` (${report.extractors.pdftotextDetail})` : ''}. Installez Poppler et
          indiquez son dossier dans POPPLER_BIN (fichier .env, voir le README).
        </p>
      )}
      {raw === null && source === 'docx' && (
        <p className="rounded bg-slate-50 p-2 text-sm text-slate-700">
          Exportez le DOCX : son texte (mammoth) et ses champs détectés s'affichent ici.
        </p>
      )}

      {raw !== null && view === 'champs' && (detected[source] ? <Detected d={detected[source]} /> : null)}
      {raw !== null && view !== 'champs' && shown !== null && (
        <>
          <p className="text-xs text-slate-500">
            {view === 'brut'
              ? source === 'pdf.js'
                ? 'Texte extrait par pdf.js sans normalisation (disableNormalization), lignes reconstruites avec hasEOL.'
                : source === 'pdftotext'
                  ? 'Sortie de pdftotext -raw (Poppler), sans normalisation.'
                  : 'Texte brut du DOCX lu par mammoth.'
              : 'NFKC, apostrophes et tirets unifiés, caractères invisibles retirés, espaces réduites, lignes vides supprimées. Accents et casse conservés.'}
          </p>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs ring-1 ring-slate-200">
            {shown}
          </pre>
        </>
      )}
      {raw !== null && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
            onClick={() => void copy(normalizeExtracted(raw), 'Version normalisée copiée dans le presse-papiers.')}
          >
            Copier la version normalisée
          </button>
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
            onClick={() => void copy(raw, 'Texte brut copié dans le presse-papiers.')}
          >
            Copier le texte brut
          </button>
          <span
            className={`text-xs ${copied?.startsWith('Copie refusée') ? 'text-amber-800' : 'text-green-800'}`}
            aria-live="polite"
          >
            {copied ?? ''}
          </span>
        </div>
      )}
    </div>
  );
}
