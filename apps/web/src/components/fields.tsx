// Form widgets of the library editor. Optional fields turn an empty input into null (§9.3: a missing
// value is null, never an empty string); the server sanitizes and validates, and its issues are shown
// next to the field they designate (F-LIB-05).
import { useEffect, useId, useState, type ReactNode } from 'react';
import type { AnyItem, Bilingual, Issue, Library } from '../api';
import { sub, type FieldSpec } from '../forms';

export interface FieldContext {
  library: Library;
  /** Categories still proposed, choices of a skill's category in "modifier puis accepter" (ADR 0023). */
  pendingCategories?: Array<{ id: string; label: string }> | undefined;
}

const input =
  'w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-[#1F4E79] focus:outline-2 focus:outline-[#1F4E79]';
const small = 'rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100 disabled:opacity-40';

const PART: Record<string, string> = {
  fr: 'FR',
  en: 'EN',
  text: 'texte',
  label: 'libellé',
  id: 'identifiant',
  city: 'ville',
  country: 'pays',
  url: 'URL',
  display: 'URL affichée',
  name: 'nom',
  score: 'score',
  year: 'année',
  tags: 'tags',
  skills: 'compétences',
  kind: 'type',
};

/** `bullets.1.variants.0.text.en` → `puce 2 › variante 1 › texte › EN`. */
export function humanPath(path: string): string {
  if (!path) return '';
  const parts = path.split('.');
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!;
    const next = parts[i + 1];
    if ((p === 'bullets' || p === 'variants' || p === 'links') && next !== undefined && /^\d+$/.test(next)) {
      out.push(`${p === 'bullets' ? 'puce' : p === 'links' ? 'lien' : 'variante'} ${Number(next) + 1}`);
      i++;
    } else if (/^\d+$/.test(p)) out.push(`n° ${Number(p) + 1}`);
    else out.push(PART[p] ?? p);
  }
  return out.join(' › ');
}

export function Messages({ issues = [], warnings = [] }: { issues?: Issue[]; warnings?: Issue[] }) {
  if (!issues.length && !warnings.length) return null;
  return (
    <ul className="mt-1 space-y-0.5 text-xs">
      {issues.map((i, n) => (
        <li key={`e${n}`} className="text-red-700" role="alert">
          {i.path ? `${humanPath(i.path)} : ` : ''}
          {i.message}
        </li>
      ))}
      {warnings.map((w, n) => (
        <li key={`w${n}`} className="text-amber-700">
          ⚠ {w.path ? `${humanPath(w.path)} : ` : ''}
          {w.message}
        </li>
      ))}
    </ul>
  );
}

function Field({
  label,
  hint,
  htmlFor,
  children,
  issues,
  warnings,
}: {
  label: string;
  hint?: string | undefined;
  htmlFor?: string;
  children: ReactNode;
  issues?: Issue[];
  warnings?: Issue[];
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-800">
        {label}
        {hint && <span className="ml-2 text-xs font-normal text-slate-500">{hint}</span>}
      </label>
      {children}
      <Messages {...(issues ? { issues } : {})} {...(warnings ? { warnings } : {})} />
    </div>
  );
}

const orNull = (s: string) => (s === '' ? null : s);

function TextInput({
  value,
  onChange,
  id,
  multiline,
  placeholder,
  label,
}: {
  value: string | null;
  onChange: (v: string) => void;
  id?: string;
  multiline?: boolean;
  placeholder?: string;
  label?: string;
}) {
  const common = {
    id,
    value: value ?? '',
    placeholder,
    'aria-label': label,
    className: input,
  };
  return multiline ? (
    <textarea {...common} rows={2} onChange={(e) => onChange(e.target.value)} />
  ) : (
    <input type="text" {...common} onChange={(e) => onChange(e.target.value)} />
  );
}

export function BilingualInput({
  value,
  onChange,
  nullable,
  multiline,
  issues = [],
  warnings = [],
  label,
}: {
  value: Bilingual | null;
  onChange: (v: Bilingual | null) => void;
  nullable?: boolean | undefined;
  multiline?: boolean | undefined;
  issues?: Issue[];
  warnings?: Issue[];
  label: string;
}) {
  const v = value ?? { fr: null, en: null };
  const set = (lang: 'fr' | 'en', s: string) => {
    const next = { ...v, [lang]: orNull(s) };
    onChange(nullable && next.fr === null && next.en === null ? null : next);
  };
  const other = (lang: 'fr' | 'en') => v[lang === 'fr' ? 'en' : 'fr'];
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {(['fr', 'en'] as const).map((lang) => (
        <div key={lang}>
          <div className="mb-0.5 flex items-center gap-2 text-xs text-slate-500">
            {lang.toUpperCase()}
            {v[lang] === null && other(lang) !== null && (
              <span className="rounded bg-amber-100 px-1 text-amber-800">non traduit</span>
            )}
          </div>
          <TextInput
            value={v[lang]}
            onChange={(s) => set(lang, s)}
            multiline={multiline}
            label={`${label} (${lang.toUpperCase()})`}
          />
          <Messages issues={sub(issues, lang)} warnings={sub(warnings, lang)} />
        </div>
      ))}
      <div className="sm:col-span-2">
        <Messages issues={issues.filter((i) => i.path === '')} warnings={warnings.filter((w) => w.path === '')} />
      </div>
    </div>
  );
}

/** Text area holding a list (one value per line): keeps the raw text while typing. */
function LinesInput({
  value,
  onChange,
  separator,
  label,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  separator: 'line' | 'comma';
  label: string;
}) {
  const join = (v: string[]) => v.join(separator === 'line' ? '\n' : ', ');
  const split = (s: string) =>
    s
      .split(separator === 'line' ? /\n/ : /,/)
      .map((x) => x.trim())
      .filter(Boolean);
  const [raw, setRaw] = useState(join(value));
  useEffect(() => {
    // Only an external change (another element loaded) resets the raw text.
    setRaw((current) => (join(split(current)) === join(value) ? current : join(value)));
  }, [value]);
  const change = (s: string) => {
    setRaw(s);
    onChange(split(s));
  };
  return separator === 'line' ? (
    <textarea className={input} rows={3} value={raw} aria-label={label} onChange={(e) => change(e.target.value)} />
  ) : (
    <input
      className={input}
      value={raw}
      aria-label={label}
      placeholder="dm, embarque…"
      onChange={(e) => change(e.target.value)}
    />
  );
}

function SkillsPicker({
  value,
  onChange,
  library,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  library: Library;
}) {
  const byId = new Map(library.skills.map((s) => [s.id, s]));
  const free = library.skills.filter((s) => !value.includes(s.id) && !s.archived);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {value.map((id) => (
        <span key={id} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs">
          {byId.get(id)?.short ?? `${id} (inconnue)`}
          <button
            type="button"
            className="text-slate-500 hover:text-red-700"
            aria-label={`Retirer ${byId.get(id)?.short ?? id}`}
            onClick={() => onChange(value.filter((x) => x !== id))}
          >
            ×
          </button>
        </span>
      ))}
      {free.length > 0 && (
        <select
          className="rounded border border-slate-300 px-1 py-0.5 text-xs"
          value=""
          aria-label="Ajouter une compétence liée"
          onChange={(e) => e.target.value && onChange([...value, e.target.value])}
        >
          <option value="">+ compétence…</option>
          {free.map((s) => (
            <option key={s.id} value={s.id}>
              {s.short}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function VariantsEditor({
  value,
  onChange,
  issues,
  label,
}: {
  value: AnyItem[];
  onChange: (v: AnyItem[]) => void;
  issues: Issue[];
  label: string;
}) {
  const set = (i: number, patch: AnyItem) => onChange(value.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  const add = () => {
    const ids = value.map((v) => v.id as string);
    let n = value.length + 1;
    while (ids.includes(`variante-${n}`)) n++;
    onChange([
      ...value,
      { id: value.length ? `variante-${n}` : 'principale', label: null, text: { fr: null, en: null } },
    ]);
  };
  return (
    <div className="space-y-2">
      {value.map((v, i) => (
        <div key={i} className="rounded border border-slate-200 p-2">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500">Variante</span>
            <input
              className="w-32 rounded border border-slate-300 px-1 py-0.5 text-xs"
              value={(v.id as string) ?? ''}
              aria-label={`${label} : identifiant de la variante ${i + 1}`}
              onChange={(e) => set(i, { id: e.target.value })}
            />
            <input
              className="w-40 rounded border border-slate-300 px-1 py-0.5 text-xs"
              value={(v.label as string | null) ?? ''}
              placeholder="libellé (facultatif)"
              aria-label={`${label} : libellé de la variante ${i + 1}`}
              onChange={(e) => set(i, { label: orNull(e.target.value) })}
            />
            <button
              type="button"
              className={`${small} ml-auto`}
              disabled={value.length <= 1}
              onClick={() => {
                if (window.confirm('Supprimer cette variante ? Son texte sera perdu.')) {
                  onChange(value.filter((_, j) => j !== i));
                }
              }}
            >
              Supprimer la variante
            </button>
          </div>
          <BilingualInput
            value={v.text as Bilingual}
            onChange={(t) => set(i, { text: t ?? { fr: null, en: null } })}
            multiline
            label={`${label} ${i + 1}`}
            issues={sub(issues, `${i}.text`)}
          />
          <Messages issues={issues.filter((x) => x.path.startsWith(`${i}.`) && !x.path.startsWith(`${i}.text`))} />
        </div>
      ))}
      <button type="button" className={small} onClick={add}>
        + Ajouter une variante
      </button>
      <Messages issues={issues.filter((x) => !/^\d+\./.test(x.path))} />
    </div>
  );
}

function BulletsEditor({
  value,
  onChange,
  issues,
  library,
}: {
  value: AnyItem[];
  onChange: (v: AnyItem[]) => void;
  issues: Issue[];
  library: Library;
}) {
  const set = (i: number, patch: AnyItem) => onChange(value.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d]!, next[i]!];
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {value.map((b, i) => (
        <div
          key={(b.id as string) || `new-${i}`}
          id={b.id ? `bullet-${b.id as string}` : undefined}
          className="rounded border border-slate-300 bg-slate-50 p-2"
        >
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            Puce {i + 1}
            {!b.id && <span className="text-xs font-normal text-slate-500">(nouvelle)</span>}
            <span className="ml-auto flex gap-1">
              <button
                type="button"
                className={small}
                disabled={i === 0}
                onClick={() => move(i, -1)}
                aria-label={`Monter la puce ${i + 1}`}
              >
                ↑
              </button>
              <button
                type="button"
                className={small}
                disabled={i === value.length - 1}
                onClick={() => move(i, 1)}
                aria-label={`Descendre la puce ${i + 1}`}
              >
                ↓
              </button>
              <button
                type="button"
                className={small}
                onClick={() => {
                  if (window.confirm('Supprimer cette puce et toutes ses variantes ?')) {
                    onChange(value.filter((_, j) => j !== i));
                  }
                }}
              >
                Supprimer
              </button>
            </span>
          </div>
          <VariantsEditor
            value={(b.variants as AnyItem[]) ?? []}
            onChange={(variants) => set(i, { variants })}
            issues={sub(issues, `${i}.variants`)}
            label={`Puce ${i + 1}, variante`}
          />
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              <div className="text-xs text-slate-500">Tags</div>
              <LinesInput
                value={(b.tags as string[]) ?? []}
                onChange={(tags) => set(i, { tags })}
                separator="comma"
                label={`Tags de la puce ${i + 1}`}
              />
              <Messages issues={sub(issues, `${i}.tags`)} />
            </div>
            <div>
              <div className="text-xs text-slate-500">Compétences liées</div>
              <SkillsPicker
                value={(b.skills as string[]) ?? []}
                onChange={(skills) => set(i, { skills })}
                library={library}
              />
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        className={small}
        onClick={() =>
          onChange([
            ...value,
            {
              id: '',
              tags: [],
              skills: [],
              variants: [{ id: 'principale', label: null, text: { fr: null, en: null } }],
            },
          ])
        }
      >
        + Ajouter une puce
      </button>
      <Messages issues={issues.filter((x) => !/^\d+\./.test(x.path))} />
    </div>
  );
}

function GroupInputs({
  fields,
  value,
  onChange,
  issues,
}: {
  fields: Array<{ key: string; label: string; placeholder?: string }>;
  value: AnyItem | null;
  onChange: (v: AnyItem | null) => void;
  issues: Issue[];
}) {
  const v = value ?? {};
  const set = (key: string, s: string) => {
    const next: AnyItem = { ...Object.fromEntries(fields.map((f) => [f.key, v[f.key] ?? null])), [key]: orNull(s) };
    onChange(fields.every((f) => next[f.key] === null) ? null : next);
  };
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {fields.map((f) => (
        <div key={f.key}>
          <TextInput
            value={(v[f.key] as string | null) ?? null}
            onChange={(s) => set(f.key, s)}
            label={f.label}
            placeholder={f.placeholder ?? f.label}
          />
          <Messages issues={sub(issues, f.key)} />
        </div>
      ))}
    </div>
  );
}

/** `https://www.github.com/a/b/` → `github.com/a/b`: the displayed form suggested for a typed URL. */
const displayOf = (url: string) =>
  url
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');

/** Ordered list of links (repositories of a project, ADR 0027): URL and displayed URL per row. */
function LinksEditor({
  value,
  onChange,
  issues,
  label,
  noun,
}: {
  value: AnyItem[];
  onChange: (v: AnyItem[]) => void;
  issues: Issue[];
  label: string;
  noun: string;
}) {
  const set = (i: number, patch: AnyItem) => onChange(value.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const setUrl = (i: number, url: string) => {
    const l = value[i]!;
    const display = (l.display as string | null) ?? '';
    // The displayed URL follows the typed one until the user writes their own.
    const follows = display === '' || display === displayOf((l.url as string | null) ?? '');
    set(i, follows ? { url, display: displayOf(url) } : { url });
  };
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d]!, next[i]!];
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {value.map((l, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <input
              className={input}
              value={(l.url as string | null) ?? ''}
              placeholder="https://github.com/…"
              aria-label={`${label} : URL du ${noun} ${i + 1}`}
              onChange={(e) => setUrl(i, e.target.value)}
            />
            <Messages issues={sub(issues, `${i}.url`)} />
          </div>
          <div>
            <input
              className={input}
              value={(l.display as string | null) ?? ''}
              placeholder="github.com/…"
              aria-label={`${label} : URL affichée du ${noun} ${i + 1}`}
              onChange={(e) => set(i, { display: e.target.value })}
            />
            <Messages issues={sub(issues, `${i}.display`)} />
          </div>
          <span className="flex gap-1">
            <button
              type="button"
              className={small}
              disabled={i === 0}
              onClick={() => move(i, -1)}
              aria-label={`Monter le ${noun} ${i + 1}`}
            >
              ↑
            </button>
            <button
              type="button"
              className={small}
              disabled={i === value.length - 1}
              onClick={() => move(i, 1)}
              aria-label={`Descendre le ${noun} ${i + 1}`}
            >
              ↓
            </button>
            <button type="button" className={small} onClick={() => onChange(value.filter((_, j) => j !== i))}>
              Retirer
            </button>
          </span>
        </div>
      ))}
      <button type="button" className={small} onClick={() => onChange([...value, { url: '', display: '' }])}>
        + Ajouter un {noun}
      </button>
      <Messages issues={issues.filter((x) => !/^\d+\./.test(x.path))} />
    </div>
  );
}

export function LocationInput({
  value,
  onChange,
  issues,
}: {
  value: AnyItem | null;
  onChange: (v: AnyItem | null) => void;
  issues: Issue[];
}) {
  const city = (value?.city as string | undefined) ?? '';
  const country = (value?.country as Bilingual | undefined) ?? { fr: null, en: null };
  const emit = (c: string, k: Bilingual) =>
    onChange(c === '' && k.fr === null && k.en === null ? null : { city: c, country: k });
  return (
    <div className="space-y-1">
      <input
        className={input}
        value={city}
        placeholder="Ville"
        aria-label="Ville"
        onChange={(e) => emit(e.target.value, country)}
      />
      <Messages issues={sub(issues, 'city')} />
      <BilingualInput
        value={country}
        onChange={(k) => emit(city, k ?? { fr: null, en: null })}
        label="Pays"
        issues={sub(issues, 'country')}
      />
    </div>
  );
}

/** One field of an element, by descriptor. */
export function FieldView({
  spec,
  item,
  onChange,
  issues,
  warnings,
  ctx,
}: {
  spec: FieldSpec;
  item: AnyItem;
  onChange: (key: string, value: unknown) => void;
  issues: Issue[];
  warnings: Issue[];
  ctx: FieldContext;
}) {
  const id = useId();
  const value = item[spec.key];
  const own = sub(issues, spec.key);
  const ownWarn = sub(warnings, spec.key);
  const set = (v: unknown) => onChange(spec.key, v);
  switch (spec.kind) {
    case 'text':
      return (
        <Field label={spec.label} hint={spec.hint} htmlFor={id} issues={own} warnings={ownWarn}>
          <TextInput
            id={id}
            value={(value as string | null) ?? null}
            onChange={(s) => set(spec.required ? s : orNull(s))}
          />
        </Field>
      );
    case 'bilingual':
      return (
        <Field label={spec.label} hint={spec.hint}>
          <BilingualInput
            value={(value as Bilingual | null) ?? null}
            onChange={set}
            nullable={spec.nullable}
            multiline={spec.multiline}
            label={spec.label}
            issues={own}
            warnings={ownWarn}
          />
        </Field>
      );
    case 'date': {
      const ongoing = spec.ongoing !== undefined && value === null;
      return (
        <Field label={spec.label} hint="AAAA-MM, ou AAAA si le mois est inconnu" htmlFor={id} issues={own}>
          <div className="flex items-center gap-3">
            <input
              id={id}
              className={`${input} max-w-36`}
              value={(value as string | null) ?? ''}
              placeholder="2023-02"
              disabled={ongoing}
              onChange={(e) => set(spec.required ? e.target.value : orNull(e.target.value))}
            />
            {spec.ongoing && (
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={ongoing} onChange={(e) => set(e.target.checked ? null : '')} />
                {spec.ongoing}
              </label>
            )}
          </div>
        </Field>
      );
    }
    case 'select':
      return (
        <Field label={spec.label} htmlFor={id} issues={own}>
          <select
            id={id}
            className={`${input} max-w-60`}
            value={(value as string | null) ?? ''}
            onChange={(e) => set(orNull(e.target.value))}
          >
            {spec.nullLabel && <option value="">{spec.nullLabel}</option>}
            {spec.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      );
    case 'category':
      return (
        <Field label={spec.label} htmlFor={id} issues={own}>
          <select
            id={id}
            className={`${input} max-w-60`}
            value={(value as string) ?? ''}
            onChange={(e) => set(e.target.value)}
          >
            <option value="">choisir…</option>
            {ctx.library.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label.fr ?? c.label.en ?? c.id}
              </option>
            ))}
            {ctx.pendingCategories?.length ? (
              <optgroup label="En attente de validation">
                {ctx.pendingCategories
                  .filter((c) => !ctx.library.categories.some((v) => v.id === c.id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} (en attente)
                    </option>
                  ))}
              </optgroup>
            ) : null}
          </select>
          {typeof value === 'string' &&
            !ctx.library.categories.some((c) => c.id === value) &&
            ctx.pendingCategories?.some((c) => c.id === value) && (
              <p className="text-xs text-slate-600">
                Catégorie en attente : l'acceptation l'acceptera d'abord (F-PRO-03).
              </p>
            )}
        </Field>
      );
    case 'checkbox':
      return (
        <div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={value === true} onChange={(e) => set(e.target.checked)} />
            {spec.label}
            {spec.hint && <span className="text-xs text-slate-500">{spec.hint}</span>}
          </label>
          <Messages issues={own} />
        </div>
      );
    case 'list':
      return (
        <Field label={spec.label} hint={spec.hint} issues={own}>
          <LinesInput value={(value as string[]) ?? []} onChange={set} separator="line" label={spec.label} />
        </Field>
      );
    case 'tags':
      return (
        <Field label={spec.label} hint="séparés par des virgules ; minuscules, chiffres et tirets" issues={own}>
          <LinesInput value={(value as string[]) ?? []} onChange={set} separator="comma" label={spec.label} />
        </Field>
      );
    case 'skills':
      return (
        <Field label={spec.label} issues={own}>
          <SkillsPicker value={(value as string[]) ?? []} onChange={set} library={ctx.library} />
        </Field>
      );
    case 'location':
      return (
        <Field label={spec.label} hint="ville et pays seulement">
          <LocationInput value={(value as AnyItem | null) ?? null} onChange={set} issues={own} />
        </Field>
      );
    case 'link':
      return (
        <Field label={spec.label} hint="URL affichée en clair (ATS-10)">
          <GroupInputs
            fields={[
              { key: 'url', label: 'URL', placeholder: 'https://…' },
              { key: 'display', label: 'URL affichée', placeholder: 'github.com/…' },
            ]}
            value={(value as AnyItem | null) ?? null}
            onChange={set}
            issues={own}
          />
        </Field>
      );
    case 'links':
      return (
        <Field label={spec.label} hint={spec.hint}>
          <LinksEditor
            value={(value as AnyItem[]) ?? []}
            onChange={set}
            issues={own}
            label={spec.label}
            noun={spec.noun}
          />
        </Field>
      );
    case 'languageCertification':
      return (
        <Field label={spec.label} hint="« TOEIC », « 945 », « 2025 »">
          <GroupInputs
            fields={[
              { key: 'name', label: 'Nom' },
              { key: 'score', label: 'Score' },
              { key: 'year', label: 'Année' },
            ]}
            value={(value as AnyItem | null) ?? null}
            onChange={set}
            issues={own}
          />
        </Field>
      );
    case 'variants':
      return (
        <Field label={spec.label}>
          <VariantsEditor value={(value as AnyItem[]) ?? []} onChange={set} issues={own} label="Variante" />
        </Field>
      );
    case 'bullets':
      return (
        <Field label={spec.label}>
          <BulletsEditor value={(value as AnyItem[]) ?? []} onChange={set} issues={own} library={ctx.library} />
        </Field>
      );
  }
}

export const buttonClass = {
  primary: 'rounded bg-[#1F4E79] px-3 py-1 text-sm text-white hover:bg-[#173d5f] disabled:opacity-50',
  secondary: 'rounded border border-slate-300 bg-white px-3 py-1 text-sm hover:bg-slate-100 disabled:opacity-50',
  danger: 'rounded border border-red-300 bg-white px-3 py-1 text-sm text-red-800 hover:bg-red-50 disabled:opacity-50',
  small,
};
