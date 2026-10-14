// Options of the preset being edited (F-SEL-05), shown in the middle panel when no element is open:
// links shown in the header, driving licence and work authorization, date format, placement of the
// standards, "references" note, photo (§5.2), the label of the exported file names (F-EXP-04,
// annex B.4), a CV title typed for this selection only (`overrides.title`, §9.2) and the theme (F-MOD-01:
// font, accent color with its contrast; ADR 0017). Sections are enabled in the library tree; language,
// layout and density are in the top bar. Same panel for an open application.
import { useEffect, useState, type ReactNode } from 'react';
import { cvFileName, proposeFileLabel } from '@cv/core/export';
import {
  ACCENT_SWATCHES,
  accentProblem,
  contrastOnWhite,
  formatRatio,
  THEME_FONT_IDS,
  THEME_FONT_META,
  type ThemeFontId,
} from '@cv/core/selection';
import type { Identity, PresetFile, TreeGroup } from '../api';
import { useCv } from '../state/cv-store';
import { buttonClass } from './fields';

function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-1 rounded border border-slate-200 p-3">
      <legend className="px-1 text-sm font-semibold text-slate-800">{legend}</legend>
      {children}
    </fieldset>
  );
}

function Check({
  checked,
  disabled,
  onChange,
  children,
  hint,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  children: ReactNode;
  hint?: string | null;
}) {
  return (
    <label className={`flex items-start gap-2 text-sm ${disabled ? 'text-slate-400' : ''}`}>
      <input
        type="checkbox"
        className="mt-1"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        {children}
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

function Radio<T extends string>({
  name,
  value,
  current,
  onChange,
  children,
}: {
  name: string;
  value: T;
  current: T;
  onChange: (value: T) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="radio" className="mt-1" name={name} checked={current === value} onChange={() => onChange(value)} />
      <span>{children}</span>
    </label>
  );
}

const NO_GROUPS: TreeGroup[] = [];
/** `<Libellé>` as stored, annex B.4: gender markers removed, transliterated, [A-Za-z0-9-], 40 characters cut at a word end. */
const normalizeLabel = (raw: string) => proposeFileLabel(raw);

/** Text of the CV title chosen in the preset, in its language (override first). */
export function cvTitle(preset: PresetFile, groups: readonly TreeGroup[]): string | null {
  const override = preset.selection.overrides.title;
  if (override) return override[preset.lang] ?? override.fr ?? override.en;
  const id = preset.selection.titleId;
  if (!id) return null;
  const node = groups.find((g) => g.key === 'titles')?.items.find((n) => n.id === id);
  if (!node) return null;
  const variant = node.variants.find((v) => v.id === preset.selection.variantChoice[id]) ?? node.variants[0];
  return variant ? variant.text[preset.lang] || variant.text.fr : node.label[preset.lang];
}

/** F-EXP-04: label of the file names, edited freely then normalized when it is applied. */
function FileLabel({ preset, identity }: { preset: PresetFile; identity: Identity | null }) {
  const edit = useCv((s) => s.edit);
  const groups = useCv((s) => s.library?.groups ?? NO_GROUPS);
  const [raw, setRaw] = useState(preset.fileLabel);
  useEffect(() => setRaw(preset.fileLabel), [preset.id, preset.fileLabel]);
  const label = normalizeLabel(raw);
  const apply = (value: string) => {
    const next = normalizeLabel(value);
    if (!next || next === preset.fileLabel) return;
    edit((p) => {
      p.fileLabel = next;
    });
  };
  const title = cvTitle(preset, groups);
  const names = identity
    ? (['pdf', 'docx'] as const).map((format) =>
        cvFileName({
          firstName: identity.firstName,
          lastName: identity.lastName,
          label: label || preset.fileLabel,
          lang: preset.lang,
          enVariant: preset.enVariant,
          format,
        }),
      )
    : [];
  return (
    <div className="space-y-2">
      <label className="block text-sm" htmlFor="file-label">
        Libellé des fichiers
        <span className="ml-2 text-xs text-slate-500">
          40 caractères au plus, lettres sans accent, chiffres et tirets
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="file-label"
          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
          value={raw}
          aria-invalid={label ? undefined : true}
          aria-describedby="file-label-help"
          onChange={(e) => setRaw(e.target.value)}
          onBlur={() => {
            apply(raw);
            if (label) setRaw(label);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              apply(raw);
              if (label) setRaw(label);
            }
          }}
        />
        <button
          type="button"
          className={buttonClass.small}
          disabled={!title}
          title={
            title
              ? `À partir de « ${title} », sans marqueur de genre (H/F…)`
              : 'Choisissez un titre dans la bibliothèque'
          }
          onClick={() => {
            if (!title) return;
            const proposed = proposeFileLabel(title);
            setRaw(proposed);
            apply(proposed);
          }}
        >
          Proposer à partir du titre
        </button>
      </div>
      <p id="file-label-help" className={`text-xs ${label ? 'text-slate-500' : 'text-red-700'}`}>
        {label
          ? names.length > 0
            ? `Fichiers : ${names.join(' · ')}`
            : "Renseignez l'identité pour voir le nom des fichiers."
          : 'Libellé vide : saisissez au moins une lettre ou un chiffre.'}
      </p>
    </div>
  );
}

/**
 * Theme (F-MOD-01): font of packages/render/fonts/, accent color (swatches or any color reaching 4.5:1 on
 * white, NF-10). A color refused stays in the field with its message and is not applied.
 */
function ThemeSettings({ preset }: { preset: PresetFile }) {
  const edit = useCv((s) => s.edit);
  const accent = preset.template.theme.accent.toUpperCase();
  const [raw, setRaw] = useState(accent);
  useEffect(() => setRaw(accent), [accent]);
  const candidate = raw.trim().toUpperCase();
  const problem = accentProblem(candidate);
  const apply = (hex: string) => {
    const value = hex.toUpperCase();
    if (accentProblem(value) || value === accent) return;
    edit((p) => {
      p.template.theme.accent = value;
    });
  };
  const font = preset.template.theme.font;
  return (
    <div className="space-y-3">
      <label className="block text-sm">
        Police
        <select
          className="ml-2 rounded border border-slate-300 px-2 py-1"
          value={font}
          onChange={(e) => {
            const v = THEME_FONT_IDS.find((id) => id === e.target.value);
            if (v)
              edit((p) => {
                p.template.theme.font = v;
              });
          }}
        >
          {THEME_FONT_IDS.map((id: ThemeFontId) => (
            <option key={id} value={id}>
              {THEME_FONT_META[id].label}
            </option>
          ))}
        </select>
        {THEME_FONT_META[font].metricEquivalent === null && (
          <span className="mt-1 block text-xs text-amber-800">
            Pas d'équivalent dans Word : le DOCX déclare Calibri, sa pagination diffère du PDF (feu orange T-DOCX-03).
          </span>
        )}
      </label>
      <div className="space-y-1">
        <p className="text-sm">Couleur d'accent</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Couleurs proposées">
          {ACCENT_SWATCHES.map((sw) => (
            <button
              key={sw.hex}
              type="button"
              aria-pressed={accent === sw.hex.toUpperCase()}
              title={`${sw.name} (${sw.hex}, contraste ${formatRatio(contrastOnWhite(sw.hex))})`}
              className={`flex items-center gap-1 rounded border px-2 py-0.5 text-xs ${
                accent === sw.hex.toUpperCase() ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-300'
              }`}
              onClick={() => apply(sw.hex)}
            >
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: sw.hex }}
              />
              {sw.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            Autre couleur
            <input
              type="color"
              className="h-7 w-10 rounded border border-slate-300"
              value={/^#[0-9A-F]{6}$/.test(candidate) ? candidate.toLowerCase() : '#000000'}
              onChange={(e) => {
                setRaw(e.target.value.toUpperCase());
                apply(e.target.value);
              }}
            />
          </label>
          <input
            aria-label="Code de la couleur d'accent (#RRGGBB)"
            aria-invalid={problem ? true : undefined}
            aria-describedby="accent-help"
            className="w-24 rounded border border-slate-300 px-2 py-1 font-mono text-sm"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onBlur={() => apply(candidate)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                apply(candidate);
              }
            }}
          />
        </div>
        <p
          id="accent-help"
          role={problem ? 'alert' : undefined}
          className={`text-xs ${problem ? 'text-red-700' : 'text-slate-500'}`}
        >
          {problem
            ? `Couleur refusée : ${problem}.`
            : `Contraste sur blanc : ${formatRatio(contrastOnWhite(candidate))} (au moins 4,5:1).`}
        </p>
      </div>
      <p className="text-xs text-slate-500">
        La densité se règle dans la barre du haut. La lettre de motivation reprend la police et l'accent de la
        candidature.
      </p>
    </div>
  );
}

/** `overrides.title` (§9.2): a title typed by the user for this selection, over the title checked. */
function TitleOverride({ preset, what }: { preset: PresetFile; what: string }) {
  const edit = useCv((s) => s.edit);
  const library = useCv((s) => s.library?.library ?? null);
  const groups = useCv((s) => s.library?.groups ?? NO_GROUPS);
  const override = preset.selection.overrides.title;
  const [fr, setFr] = useState(override?.fr ?? '');
  const [en, setEn] = useState(override?.en ?? '');
  useEffect(() => {
    setFr(override?.fr ?? '');
    setEn(override?.en ?? '');
  }, [override?.fr, override?.en]);

  if (!override) {
    const current = cvTitle(preset, groups);
    return (
      <div className="space-y-1 text-sm">
        <p>Titre : {current ? `« ${current} »` : 'aucun'}, choisi dans la bibliothèque (section Titres de l'arbre).</p>
        <button
          type="button"
          className={buttonClass.small}
          onClick={() =>
            edit((p) => {
              // Starts from the title checked, in both languages.
              const t = library?.titles.find((x) => x.id === p.selection.titleId);
              const v = t?.variants.find((x) => x.id === p.selection.variantChoice[t.id]) ?? t?.variants[0];
              p.selection.overrides.title = { fr: v?.text.fr ?? null, en: v?.text.en ?? null };
            })
          }
        >
          Saisir un titre propre à {what}
        </button>
      </div>
    );
  }
  const apply = (lang: 'fr' | 'en', value: string) =>
    edit((p) => {
      const t = p.selection.overrides.title;
      if (!t) return;
      t[lang] = value.trim() || null;
      if (t.fr === null && t.en === null) delete p.selection.overrides.title;
    });
  const field = (lang: 'fr' | 'en', value: string, set: (v: string) => void) => (
    <label className="block text-sm">
      {lang.toUpperCase()}
      <input
        className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
        value={value}
        onChange={(e) => set(e.target.value)}
        onBlur={() => apply(lang, value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            apply(lang, value);
          }
        }}
      />
    </label>
  );
  return (
    <div className="space-y-2">
      <p className="text-sm text-amber-900">
        Titre saisi pour {what}, prioritaire sur le titre coché. Un titre vide dans la langue du CV bloque l'export.
      </p>
      {field('fr', fr, setFr)}
      {field('en', en, setEn)}
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
    </div>
  );
}

export function PresetSettings({ preset, identity }: { preset: PresetFile; identity: Identity | null }) {
  const edit = useCv((s) => s.edit);
  const isApplication = useCv((s) => s.mode === 'application');
  const o = preset.options;
  const visual = preset.template.layout === 'visuel';
  const links = identity?.links ?? [];
  const setOption = <K extends keyof PresetFile['options']>(key: K, value: PresetFile['options'][K]) =>
    edit((p) => {
      p.options[key] = value;
    });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">
          Réglages {isApplication ? 'de la candidature' : 'du preset'} « {preset.name} »
        </h2>
        <p className="text-sm text-slate-600">
          Cochez les sections et les éléments dans la bibliothèque ; chaque changement est enregistré et l'aperçu se met
          à jour. Décocher ne supprime jamais rien.
        </p>
      </div>

      <Fieldset legend="Thème">
        <ThemeSettings preset={preset} />
      </Fieldset>

      <Fieldset legend="En-tête">
        {links.length === 0 && (
          <p className="text-sm text-slate-500">Aucun lien dans l'identité (LinkedIn, GitHub, portfolio).</p>
        )}
        {links.map((l) => (
          <Check
            key={l.id}
            checked={o.links.includes(l.id)}
            onChange={(on) =>
              edit((p) => {
                // Identity order is kept whatever the order of the clicks.
                const wanted = new Set(p.options.links.filter((id) => id !== l.id));
                if (on) wanted.add(l.id);
                p.options.links = links.map((x) => x.id).filter((id) => wanted.has(id));
              })
            }
            hint={
              l.style === 'icon' && !visual
                ? "Affiché avec son icône dans le modèle visuel ; ici, l'URL seule (ATS-08)."
                : null
            }
          >
            Lien {l.display}
          </Check>
        ))}
        <Check
          checked={o.photo && !!identity?.photo}
          disabled={!identity?.photo}
          onChange={(v) => setOption('photo', v)}
          hint={
            !identity?.photo
              ? "Importez d'abord une photo dans l'identité."
              : visual
                ? "Intégrée à l'en-tête du modèle visuel. Décochée automatiquement en passant en anglais."
                : 'Ignorée par les ATS et déconseillée hors de France (feu orange T-ATS-16). Décochée automatiquement en passant en anglais.'
          }
        >
          Photo
        </Check>
      </Fieldset>

      <Fieldset legend="Titre du CV">
        <TitleOverride preset={preset} what={isApplication ? 'cette candidature' : 'ce preset'} />
      </Fieldset>

      <Fieldset legend="Nom des fichiers exportés">
        <FileLabel preset={preset} identity={identity} />
      </Fieldset>

      <Fieldset legend="Mentions (ligne dans Compétences)">
        <Check
          checked={o.drivingLicense}
          disabled={!identity?.drivingLicense}
          onChange={(v) => setOption('drivingLicense', v)}
          hint={identity?.drivingLicense ? null : "Renseignez le permis dans l'identité pour l'afficher."}
        >
          Permis de conduire
        </Check>
        <Check
          checked={o.workAuthorization}
          disabled={!identity?.workAuthorization}
          onChange={(v) => setOption('workAuthorization', v)}
          hint={identity?.workAuthorization ? null : "Renseignez l'autorisation de travail dans l'identité."}
        >
          Autorisation de travail
        </Check>
        <Check
          checked={o.referencesNote}
          onChange={(v) => setOption('referencesNote', v)}
          hint="Prend de la place sans rien apporter ; peu d'usage en France."
        >
          « Références disponibles sur demande » en fin de CV
        </Check>
      </Fieldset>

      <Fieldset legend="Format des dates">
        <Radio name="dateStyle" value="numerique" current={o.dateStyle} onChange={(v) => setOption('dateStyle', v)}>
          Numérique : 03/2022 – aujourd'hui <span className="text-xs text-slate-500">(recommandé pour les ATS)</span>
        </Radio>
        <Radio name="dateStyle" value="lettres" current={o.dateStyle} onChange={(v) => setOption('dateStyle', v)}>
          En lettres : mars 2022 – aujourd'hui
        </Radio>
      </Fieldset>

      <Fieldset legend="Normes et réglementation">
        <Radio
          name="regulatoryPlacement"
          value="skills-subgroup"
          current={o.regulatoryPlacement}
          onChange={(v) => setOption('regulatoryPlacement', v)}
        >
          Une ligne dans Compétences{' '}
          <span className="text-xs text-slate-500">(défaut des modèles ATS : intitulés standard)</span>
        </Radio>
        <Radio
          name="regulatoryPlacement"
          value="own-section"
          current={o.regulatoryPlacement}
          onChange={(v) => setOption('regulatoryPlacement', v)}
        >
          Une section dédiée{' '}
          <span className="text-xs text-slate-500">
            {visual
              ? '(défaut du modèle visuel, dans la colonne de gauche)'
              : '(intitulé non standard : feu orange T-ATS-15)'}
          </span>
        </Radio>
      </Fieldset>
    </div>
  );
}
