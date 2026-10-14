// Export of the preset shown (F-EXP-01 to 04, §10.1): "Exporter PDF" and "Exporter DOCX" buttons, the
// permanent DOCX warning (F-EXP-02), the reasons of a blocked export, each with a link to its fix
// (F-EXP-03, F-UI-06), the result of the last export (file name, copy kept, T-ATS-13), and the badge and
// DOCX remark of the visual layout (F-MOD-03, ADR 0017).
import {
  exportBlockers,
  exportWarnings,
  type BlockerField,
  type BlockerFix,
  type ExportBlocker,
} from '@cv/core/export';
import { lowerFirst, THEME_FONT_META, VISUAL_DOCX_NOTICE } from '@cv/core/selection';
import type { Lang, RenderResponse, TreeGroup, TreeNode } from '../api';
import { useCv } from '../state/cv-store';
import { buttonClass } from './fields';

export type FixHandler = (fix: BlockerFix) => void;

const NO_GROUPS: TreeGroup[] = [];

function findNode(groups: readonly TreeGroup[], id: string): TreeNode | null {
  const walk = (nodes: readonly TreeNode[]): TreeNode | null => {
    for (const n of nodes) {
      if (n.id === id) return n;
      const child = walk(n.children);
      if (child) return child;
    }
    return null;
  };
  for (const g of groups) {
    const found = walk(g.items);
    if (found) return found;
  }
  return null;
}

/** Text of the button that applies a fix. */
function fixLabel(fix: BlockerFix, groups: readonly TreeGroup[], lang: Lang): string {
  switch (fix.kind) {
    case 'identity':
      return "Ouvrir l'identité";
    case 'density':
      return 'Passer en densité compacte';
    case 'ats-view':
      return 'Voir la vue ATS';
    case 'open': {
      const node = findNode(groups, fix.itemId);
      const text = node ? node.label[lang] || node.label.fr : fix.itemId;
      const short = text.length > 40 ? `${text.slice(0, 39)}…` : text;
      return fix.bulletId ? `Ouvrir « ${short} » (puce)` : `Ouvrir « ${short} »`;
    }
  }
}

/** Element of a field, as shown in the tree (« Ingénieure logiciel – MedTech »), or its identifier. */
function elementOf(fix: BlockerFix | null, groups: readonly TreeGroup[], lang: Lang): string {
  if (!fix) return '';
  if (fix.kind === 'identity') return 'Identité';
  if (fix.kind !== 'open') return '';
  const short = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
  const node = findNode(groups, fix.itemId);
  const text = short(node ? node.label[lang] || node.label.fr : fix.itemId, 50);
  if (!fix.bulletId) return text;
  // Bullets of one entry are told apart by the start of their text.
  const bullet = findNode(groups, fix.bulletId);
  return bullet ? `${text} › « ${short(bullet.label.fr || bullet.label.en, 40)} »` : text;
}

/** Every field of a reason, each with its link (§5.4: all the untranslated fields, ADR 0015). */
function FieldList({ fields, onFix, tone }: { fields: BlockerField[]; onFix: FixHandler; tone: 'red' | 'amber' }) {
  const groups = useCv((s) => s.library?.groups ?? NO_GROUPS);
  const lang = useCv((s) => s.draft?.lang ?? 'fr');
  const border =
    tone === 'red'
      ? 'border-red-300 text-red-900 hover:bg-red-100'
      : 'border-amber-300 text-amber-900 hover:bg-amber-100';
  return (
    <ul className="mt-1 space-y-0.5 pl-4 text-xs">
      {fields.map((f, i) => (
        <li key={i}>
          {f.fix ? (
            <button
              type="button"
              className={`rounded border bg-white px-1.5 py-0.5 text-left ${border}`}
              onClick={() => onFix(f.fix!)}
            >
              {elementOf(f.fix, groups, lang)} › {f.field}
            </button>
          ) : (
            <span>{f.field}</span>
          )}
          {f.detail && <span className="ml-1">{f.detail}</span>}
        </li>
      ))}
    </ul>
  );
}

function Blockers({ blockers, onFix }: { blockers: ExportBlocker[]; onFix: FixHandler }) {
  const groups = useCv((s) => s.library?.groups ?? NO_GROUPS);
  const lang = useCv((s) => s.draft?.lang ?? 'fr');
  return (
    <ul className="list-disc space-y-1 pl-5">
      {blockers.map((b) => (
        <li key={`${b.code}|${b.message}`}>
          {b.message}
          {b.fields && b.fields.length > 0 ? (
            <FieldList fields={b.fields} onFix={onFix} tone="red" />
          ) : (
            b.fix && (
              <button
                type="button"
                className="ml-2 rounded border border-red-300 bg-white px-2 py-0.5 text-xs text-red-900 hover:bg-red-100"
                onClick={() => onFix(b.fix!)}
              >
                {fixLabel(b.fix, groups, lang)}
              </button>
            )
          )}
        </li>
      ))}
    </ul>
  );
}

export function ExportPanel({ render, onFix }: { render: RenderResponse; onFix: FixHandler }) {
  const preset = useCv((s) => s.draft);
  const exporting = useCv((s) => s.exporting);
  const { exportCv, dismissExport } = useCv.getState();
  if (!preset) return null;
  const live = exportBlockers(render.report, preset.template.theme.density);
  const remarks = exportWarnings(render.report);
  const blocked = live.length > 0;
  const visual = render.report.notice ?? null;
  const fontWithoutEquivalent = THEME_FONT_META[preset.template.theme.font].metricEquivalent === null;
  const busy = exporting.busy;

  const button = (format: 'pdf' | 'docx', text: string) => (
    <button
      type="button"
      className={buttonClass.primary}
      disabled={blocked || busy !== null}
      aria-describedby={format === 'docx' ? 'docx-warning' : undefined}
      onClick={() => void exportCv(format)}
    >
      {busy === format ? 'Export…' : text}
    </button>
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex flex-col items-start gap-0.5">{button('pdf', 'Exporter PDF')}</div>
        <div className="flex flex-col items-start gap-0.5">
          {button('docx', 'Exporter DOCX')}
          <span id="docx-warning" className="max-w-56 text-xs text-amber-800">
            1 page non garantie en DOCX
            {fontWithoutEquivalent && ' ; police déclarée Calibri : pagination Word différente du PDF'}
            {visual && ' ; une seule colonne (la mise en page visuelle est réservée au PDF)'}
          </span>
        </div>
        {blocked ? (
          <div role="status" className="min-w-0 flex-1 rounded bg-red-50 px-3 py-1.5 text-sm text-red-900">
            <span className="font-semibold">Export bloqué</span>
            <Blockers blockers={live} onFix={onFix} />
          </div>
        ) : (
          <p role="status" className="min-w-0 flex-1 rounded bg-green-50 px-3 py-1.5 text-sm text-green-900">
            Export possible : 1 page, aucun critère bloquant
            {visual ? ' (les critères de mise en page du modèle visuel sont en orange)' : ''}. Le PDF exporté est
            l'aperçu affiché ; le DOCX est produit à partir du même contenu.
          </p>
        )}
      </div>

      {visual && (
        <div role="note" className="rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-900">
          <span className="font-semibold">Modèle visuel : {lowerFirst(visual.badge)}.</span> Pour une candidature en
          ligne, exportez plutôt le modèle ATS classique. {VISUAL_DOCX_NOTICE}.
        </div>
      )}

      {remarks.map((w) => (
        <div key={w.code} role="note" className="rounded bg-amber-50 px-3 py-1.5 text-sm text-amber-900">
          {w.message}
          {w.fields && <FieldList fields={w.fields} onFix={onFix} tone="amber" />}
        </div>
      ))}

      {exporting.refused && (
        <div role="alert" className="flex items-start gap-2 rounded bg-red-50 px-3 py-1.5 text-sm text-red-900">
          <div className="min-w-0 flex-1">
            <span className="font-semibold">{exporting.refused.message}</span>
            {exporting.refused.blockers.length > 0 && <Blockers blockers={exporting.refused.blockers} onFix={onFix} />}
          </div>
          <button type="button" className={buttonClass.small} onClick={dismissExport}>
            Fermer
          </button>
        </div>
      )}
      {exporting.last && (
        <div role="status" className="flex items-start gap-2 rounded bg-green-50 px-3 py-1.5 text-sm text-green-900">
          <div className="min-w-0 flex-1">
            <span className="font-semibold">
              {exporting.last.format.toUpperCase()} exporté : {exporting.last.fileName}
            </span>
            <span className="block text-xs">
              Téléchargé par le navigateur
              {exporting.last.savedTo
                ? exporting.last.inApplication
                  ? ` ; copie rangée dans la candidature (${exporting.last.savedTo}), avec sa trace`
                  : ` ; copie conservée dans ${exporting.last.savedTo}`
                : ''}
              . SHA-256 {exporting.last.sha256.slice(0, 12)}…
              {exporting.last.format === 'pdf' ? ", identique à l'aperçu affiché (T-ATS-13)." : '.'}
            </span>
          </div>
          <button type="button" className={buttonClass.small} onClick={dismissExport}>
            Fermer
          </button>
        </div>
      )}
    </div>
  );
}
