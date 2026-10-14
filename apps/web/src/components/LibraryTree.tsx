// Library panel with the selection of the preset being edited (§6.2): native three-state checkboxes
// (indeterminate, aria-checked="mixed", "3/5 puces" counters), choice of the title, the summary and
// each variant, ↑/↓ buttons usable with the keyboard (focus kept, new position announced), sections
// enabled and ordered. Unchecking never deletes anything (F-SEL-02). A click on a label opens the
// element in the editor; each group keeps its "Ajouter" button (lot 1).
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  applyOrder,
  entryTally,
  isOrderable,
  moveInOrder,
  moveSection,
  sectionTally,
  setChecked,
  setSectionEnabled,
  setSummary,
  setTitle,
  setVariant,
  type CheckState,
  type CheckTarget,
} from '@cv/core/selection';
import type { CollectionName, Lang, PresetFile, SectionKey, TreeGroup, TreeNode } from '../api';

export type Selected =
  | { kind: 'identity' }
  | { kind: 'item'; collection: CollectionName; id: string; bullet?: string | null }
  | { kind: 'create'; collection: CollectionName; defaults: Record<string, unknown> }
  | null;

export interface Filters {
  query: string;
  untranslated: boolean;
  archived: boolean;
}

type Edit = (recipe: (preset: PresetFile) => void) => void;

/** Same folding as the server's search text: lowercase, accents removed. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr');
}

function TriCheckbox({
  state,
  label,
  onToggle,
  disabled,
  title,
}: {
  state: CheckState;
  label: string;
  onToggle: () => void;
  disabled?: boolean;
  title?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  // A click clears `indeterminate` natively: it is set again after every render.
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'mixed';
  });
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={state === 'checked'}
      aria-checked={state === 'mixed' ? 'mixed' : undefined}
      aria-label={label}
      title={title}
      disabled={disabled}
      onChange={onToggle}
      className="mt-1 shrink-0"
    />
  );
}

function Badges({ node }: { node: TreeNode }) {
  return (
    <>
      {node.archived && <span className="ml-2 rounded bg-slate-200 px-1 text-xs text-slate-700">archivé</span>}
      {node.locked && (
        <span
          className="ml-2 rounded bg-slate-100 px-1 text-xs text-slate-600"
          title="Jamais décoché par une pré-sélection automatique (F-SEL-10)"
        >
          verrouillé
        </span>
      )}
      {node.untranslated.length > 0 && (
        <span className="ml-2 rounded bg-amber-100 px-1 text-xs text-amber-800">
          non traduit ({node.untranslated.map((l) => l.toUpperCase()).join(', ')})
        </span>
      )}
      {node.warnings > 0 && (
        <span className="ml-2 rounded bg-amber-50 px-1 text-xs text-amber-800" title="Avertissement ATS-22">
          ⚠ {node.warnings}
        </span>
      )}
      {node.cefrMissing && (
        <span
          className="ml-2 rounded bg-amber-200 px-1 text-xs text-amber-900"
          title="Tant qu'il n'est pas renseigné, l'export d'un CV qui affiche cette langue est bloqué"
        >
          niveau CECRL à préciser
        </span>
      )}
    </>
  );
}

const moveClass =
  'rounded border border-slate-300 px-1 text-xs leading-4 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent';

/** ↑/↓ pair; `focusKey` lets the tree give the focus back to the same button after the move. */
function MoveButtons({
  label,
  focusKey,
  canUp,
  canDown,
  blocked,
  onMove,
}: {
  label: string;
  focusKey: string;
  canUp: boolean;
  canDown: boolean;
  blocked: string | null;
  onMove: (step: -1 | 1) => void;
}) {
  return (
    <span className="ml-1 inline-flex shrink-0 gap-0.5" title={blocked ?? undefined}>
      <button
        type="button"
        className={moveClass}
        data-focus={`up:${focusKey}`}
        aria-label={`Monter « ${label} »`}
        disabled={!!blocked || !canUp}
        onClick={() => onMove(-1)}
      >
        ↑
      </button>
      <button
        type="button"
        className={moveClass}
        data-focus={`down:${focusKey}`}
        aria-label={`Descendre « ${label} »`}
        disabled={!!blocked || !canDown}
        onClick={() => onMove(1)}
      >
        ↓
      </button>
    </span>
  );
}

function VariantSelect({
  node,
  chosen,
  label,
  lang,
  edit,
}: {
  node: TreeNode;
  chosen: string;
  label: string;
  lang: Lang;
  edit: Edit;
}) {
  if (node.variants.length < 2) return null;
  return (
    <select
      className="ml-2 max-w-40 rounded border border-slate-300 px-1 text-xs"
      aria-label={`Variante de « ${label} »`}
      value={chosen}
      onChange={(e) => {
        const value = e.target.value;
        edit((p) => setVariant(p.selection, node.id, value));
      }}
    >
      {node.variants.map((v) => (
        <option key={v.id} value={v.id} title={v.text[lang]}>
          {v.label ?? v.id}
        </option>
      ))}
    </select>
  );
}

function visible(node: TreeNode, f: Filters, words: string[]): { show: boolean; children: TreeNode[] } {
  if (node.archived && !f.archived) return { show: false, children: [] };
  const matches = (n: TreeNode) => words.every((w) => n.search.includes(w));
  const childMatches = node.children.filter((c) => matches(c) && (!f.untranslated || c.untranslated.length > 0));
  const self = matches(node) && (!f.untranslated || node.untranslated.length > 0);
  if (self)
    return {
      show: true,
      children: words.length || f.untranslated ? (childMatches.length ? childMatches : node.children) : node.children,
    };
  return { show: childMatches.length > 0, children: childMatches };
}

/** Experience, education and projects: entries with bullets. */
const ENTRY_SECTIONS = new Set<string>(['experience', 'education', 'projects']);

export function LibraryTree({
  groups,
  preset,
  edit,
  identityLabel,
  filters,
  onFilters,
  selected,
  onSelect,
}: {
  groups: TreeGroup[];
  preset: PresetFile;
  edit: Edit;
  identityLabel: string | null;
  filters: Filters;
  onFilters: (f: Filters) => void;
  selected: Selected;
  onSelect: (s: Selected) => void;
}) {
  const sel = preset.selection;
  const lang = preset.lang;
  const included = new Set(sel.include);
  const words = fold(filters.query).split(/\s+/).filter(Boolean);
  const filtering = words.length > 0 || filters.untranslated;
  const blocked = filtering ? 'Videz le filtre pour réordonner' : null;
  const subgroup = preset.options.regulatoryPlacement === 'skills-subgroup';
  const passOver: SectionKey[] = subgroup ? ['regulatory'] : [];

  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const treeRef = useRef<HTMLDivElement>(null);

  // After a move, the focus goes back to the same button (or to the other one at an edge).
  useLayoutEffect(() => {
    if (!focusKey || !treeRef.current) return;
    const find = (k: string) => treeRef.current!.querySelector<HTMLButtonElement>(`[data-focus="${CSS.escape(k)}"]`);
    const [dir, ...rest] = focusKey.split(':');
    const other = `${dir === 'up' ? 'down' : 'up'}:${rest.join(':')}`;
    const target = find(focusKey);
    (target && !target.disabled ? target : find(other))?.focus();
    setFocusKey(null);
  }, [focusKey, preset]);

  const isSel = (collection: CollectionName, id: string) =>
    selected?.kind === 'item' && selected.collection === collection && selected.id === id;
  const linkClass = (active: boolean) =>
    `text-left hover:underline focus-visible:underline ${active ? 'font-semibold text-[#1F4E79]' : ''}`;
  const label = (n: TreeNode) => n.label[lang] || n.label[lang === 'fr' ? 'en' : 'fr'];
  const chosenVariant = (n: TreeNode) => sel.variantChoice[n.id] ?? n.variants[0]?.id ?? '';
  const variantText = (n: TreeNode) => n.variants.find((v) => v.id === chosenVariant(n))?.text[lang] ?? label(n);

  /** Moves `id` among `ids` and announces its new position. */
  const move = (
    orderKey: string,
    ids: string[],
    id: string,
    name: string,
    step: -1 | 1,
    sameGroup?: (a: string, b: string) => boolean,
  ) => {
    const domain = sameGroup ? ids.filter((x) => sameGroup(id, x)) : ids;
    const position = domain.indexOf(id) + step + 1;
    edit((p) => {
      moveInOrder(p.selection, orderKey, ids, id, step, sameGroup);
    });
    setFocusKey(`${step < 0 ? 'up' : 'down'}:${id}`);
    setAnnounce(`« ${name} » déplacé en position ${position} sur ${domain.length}.`);
  };

  const toggle = (target: CheckTarget, value: boolean) => edit((p) => setChecked(p.selection, target, value));

  // Group order: titles, summary, the other sections in the preset's order, categories.
  const rank = new Map(sel.sections.map((s, i) => [s.key, i]));
  const sectionGroups = groups.filter((g) => g.section !== null && g.section !== 'summary');
  sectionGroups.sort((a, b) => rank.get(a.section!)! - rank.get(b.section!)!);
  const ordered = [
    ...groups.filter((g) => g.key === 'titles' || g.key === 'summary'),
    ...sectionGroups,
    ...groups.filter((g) => g.key === 'categories'),
  ];
  const movableSections = sectionGroups.map((g) => g.section!).filter((k) => !passOver.includes(k));

  const itemsOf = (g: TreeGroup) => (g.fixedOrder || !g.section ? g.items : applyOrder(g.items, sel.order[g.key]));

  const row = (node: TreeNode, content: ReactNode, children?: ReactNode) => (
    <li key={node.id} className="py-0.5">
      <div className="flex items-start gap-2">{content}</div>
      {children}
    </li>
  );

  const labelButton = (node: TreeNode, text: string, bullet?: string) => (
    <button
      type="button"
      className={linkClass(!bullet && isSel(node.collection, node.id))}
      onClick={() =>
        onSelect({
          kind: 'item',
          collection: node.collection,
          id: bullet ? node.parentId! : node.id,
          ...(bullet ? { bullet } : {}),
        })
      }
    >
      {text || <em className="text-slate-400">(sans texte)</em>}
    </button>
  );

  const renderEntry = (g: TreeGroup, node: TreeNode, children: TreeNode[], ids: string[]) => {
    const section = g.section!;
    const bulletIds = node.children.map((c) => c.id);
    const tally = entryTally(sel, node.id, bulletIds);
    const name = label(node);
    const index = ids.indexOf(node.id);
    const orderedChildren = applyOrder(children, sel.order[node.id]);
    const allBullets = applyOrder(node.children, sel.order[node.id]).map((c) => c.id);
    return row(
      node,
      <>
        <TriCheckbox
          state={node.archived ? 'unchecked' : tally.state}
          label={name}
          disabled={node.archived}
          title={node.archived ? 'Élément archivé : jamais rendu' : undefined}
          onToggle={() => toggle({ section, itemId: node.id, bulletIds }, tally.state === 'unchecked')}
        />
        <div className={`min-w-0 flex-1 text-sm ${node.archived ? 'opacity-60' : ''}`}>
          {labelButton(node, name)}
          {node.detail && <span className="ml-2 text-xs text-slate-500">{node.detail}</span>}
          {bulletIds.length > 0 && (
            <span
              className="ml-2 text-xs text-slate-500"
              title={tally.state === 'unchecked' ? "Sélection des puces conservée, masquée avec l'entrée" : undefined}
            >
              {tally.checked}/{tally.total} puces{tally.state === 'unchecked' && tally.checked > 0 ? ' (masquées)' : ''}
            </span>
          )}
          <Badges node={node} />
        </div>
        {!g.fixedOrder && !node.archived && (
          <MoveButtons
            label={name}
            focusKey={node.id}
            canUp={index > 0}
            canDown={index < ids.length - 1}
            blocked={blocked}
            onMove={(step) => move(g.key, ids, node.id, name, step)}
          />
        )}
      </>,
      orderedChildren.length > 0 && (
        <ul className="ml-6 border-l border-slate-200 pl-3 text-sm">
          {orderedChildren.map((c) => {
            const text = variantText(c);
            const on = included.has(c.id);
            const visibleInCv = on && tally.state !== 'unchecked';
            const at = allBullets.indexOf(c.id);
            return (
              <li key={c.id} className="flex items-start gap-2 py-0.5">
                <TriCheckbox
                  state={on ? 'checked' : 'unchecked'}
                  label={text}
                  disabled={node.archived}
                  onToggle={() => toggle({ section, itemId: node.id, bulletId: c.id }, !on)}
                />
                <div className="min-w-0 flex-1">
                  <span className={visibleInCv ? 'text-slate-800' : 'text-slate-400'}>
                    {labelButton(c, text, c.id)}
                  </span>
                  <VariantSelect node={c} chosen={chosenVariant(c)} label={text} lang={lang} edit={edit} />
                  <Badges node={c} />
                </div>
                <MoveButtons
                  label={text}
                  focusKey={c.id}
                  canUp={at > 0}
                  canDown={at < allBullets.length - 1}
                  blocked={blocked}
                  onMove={(step) => move(node.id, allBullets, c.id, text, step)}
                />
              </li>
            );
          })}
        </ul>
      ),
    );
  };

  const renderFlat = (g: TreeGroup, node: TreeNode, ids: string[], sameGroup?: (a: string, b: string) => boolean) => {
    const section = g.section!;
    const on = included.has(node.id);
    const name = label(node);
    const domain = sameGroup ? ids.filter((x) => sameGroup(node.id, x)) : ids;
    const index = domain.indexOf(node.id);
    return row(
      node,
      <>
        <TriCheckbox
          state={on && !node.archived ? 'checked' : 'unchecked'}
          label={name}
          disabled={node.archived}
          title={node.archived ? 'Élément archivé : jamais rendu' : undefined}
          onToggle={() => toggle({ section, itemId: node.id }, !on)}
        />
        <div className={`min-w-0 flex-1 text-sm ${node.archived ? 'opacity-60' : ''}`}>
          {labelButton(node, name)}
          {node.detail && g.categories.length === 0 && (
            <span className="ml-2 text-xs text-slate-500">{node.detail}</span>
          )}
          <Badges node={node} />
        </div>
        {!node.archived && (
          <MoveButtons
            label={name}
            focusKey={node.id}
            canUp={index > 0}
            canDown={index < domain.length - 1}
            blocked={blocked}
            onMove={(step) => move(g.key, ids, node.id, name, step, sameGroup)}
          />
        )}
      </>,
    );
  };

  /** Titles and summaries: one chosen element (radio), with its variant. */
  const renderChoice = (g: TreeGroup, node: TreeNode) => {
    const isTitle = g.key === 'titles';
    const chosen = isTitle ? sel.titleId === node.id : sel.summaryId === node.id;
    const text = variantText(node);
    return row(
      node,
      <>
        <input
          type="radio"
          name={isTitle ? 'cv-title' : 'cv-summary'}
          className="mt-1 shrink-0"
          checked={chosen && !node.archived}
          disabled={node.archived}
          aria-label={text}
          onChange={() => edit((p) => (isTitle ? setTitle(p.selection, node.id) : setSummary(p.selection, node.id)))}
        />
        <div className={`min-w-0 flex-1 text-sm ${node.archived ? 'opacity-60' : ''}`}>
          {labelButton(node, text)}
          {chosen && <VariantSelect node={node} chosen={chosenVariant(node)} label={text} lang={lang} edit={edit} />}
          <Badges node={node} />
        </div>
      </>,
    );
  };

  const sectionHeader = (g: TreeGroup, live: TreeNode[]) => {
    const key = g.section;
    const ids = live.map((n) => n.id);
    const tally = key ? sectionTally(sel, key, ids) : null;
    const movable = key !== null && movableSections.includes(key);
    const at = key ? movableSections.indexOf(key) : -1;
    return (
      <h3 className="flex flex-wrap items-center gap-2 font-semibold text-slate-800">
        {key && tally && (
          <TriCheckbox
            state={tally.state}
            label={`Section ${g.label}`}
            onToggle={() => edit((p) => setSectionEnabled(p.selection, key, tally.state === 'unchecked'))}
          />
        )}
        <span className={key && tally?.state === 'unchecked' ? 'text-slate-400' : ''}>{g.label}</span>
        <span className="text-xs font-normal text-slate-500">
          {key && key !== 'summary' && tally ? `(${tally.checked}/${tally.total})` : `(${live.length})`}
        </span>
        {movable && (
          <MoveButtons
            label={`section ${g.label}`}
            focusKey={`section-${key}`}
            canUp={at > 0}
            canDown={at < movableSections.length - 1}
            blocked={null}
            onMove={(step) => {
              edit((p) => {
                moveSection(p.selection, key, step, passOver);
              });
              setFocusKey(`${step < 0 ? 'up' : 'down'}:section-${key}`);
              setAnnounce(
                `Section « ${g.label} » déplacée en position ${at + step + 1} sur ${movableSections.length}.`,
              );
            }}
          />
        )}
        <button
          type="button"
          className="ml-auto rounded border border-slate-300 px-2 py-0.5 text-xs font-normal hover:bg-slate-100"
          onClick={() => onSelect({ kind: 'create', collection: g.collection, defaults: g.defaults })}
          aria-label={`Ajouter dans ${g.label}`}
        >
          + Ajouter
        </button>
      </h3>
    );
  };

  return (
    <div className="space-y-4" ref={treeRef}>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <div className="space-y-2">
        <input
          type="search"
          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          placeholder="Filtrer la bibliothèque…"
          aria-label="Filtrer la bibliothèque"
          value={filters.query}
          onChange={(e) => onFilters({ ...filters, query: e.target.value })}
        />
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={filters.untranslated}
              onChange={(e) => onFilters({ ...filters, untranslated: e.target.checked })}
            />
            Non traduit
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={filters.archived}
              onChange={(e) => onFilters({ ...filters, archived: e.target.checked })}
            />
            Afficher les archivés
          </label>
        </div>
      </div>

      <section aria-label="Identité">
        <h3 className="font-semibold text-slate-800">Identité et coordonnées</h3>
        <button
          type="button"
          className={`ml-2 mt-1 text-sm ${linkClass(selected?.kind === 'identity')}`}
          onClick={() => onSelect({ kind: 'identity' })}
        >
          {identityLabel ?? 'À compléter'}
        </button>
      </section>

      {ordered.map((g) => {
        const live = g.items.filter((i) => !i.archived);
        const shownItems = itemsOf(g)
          .map((n) => ({ node: n, ...visible(n, filters, words) }))
          .filter((x) => x.show);
        const ids = itemsOf(g)
          .filter((n) => filters.archived || !n.archived)
          .map((n) => n.id);
        const category = new Map(g.items.map((n) => [n.id, n.category]));
        const sameCategory = (a: string, b: string) => category.get(a) === category.get(b);
        let body: ReactNode;
        if (shownItems.length === 0) {
          body = (
            <p className="ml-6 text-sm text-slate-400">{g.items.length ? 'Aucun élément filtré' : 'Aucun élément'}</p>
          );
        } else if (g.key === 'titles' || g.key === 'summary') {
          body = (
            <ul className="ml-2 mt-1">
              {shownItems.map(({ node }) => renderChoice(g, node))}
              {g.key === 'titles' && (
                <li className="flex items-center gap-2 py-0.5 text-sm text-slate-500">
                  <input
                    type="radio"
                    name="cv-title"
                    checked={sel.titleId === null}
                    onChange={() => edit((p) => setTitle(p.selection, null))}
                    aria-label="Aucun titre"
                  />
                  Aucun titre
                </li>
              )}
            </ul>
          );
        } else if (ENTRY_SECTIONS.has(g.key)) {
          body = (
            <ul className="ml-2 mt-1">{shownItems.map(({ node, children }) => renderEntry(g, node, children, ids))}</ul>
          );
        } else if (g.categories.length > 0) {
          body = g.categories.map((c) => {
            const inCategory = shownItems.filter((x) => x.node.category === c.id);
            if (inCategory.length === 0) return null;
            return (
              <div key={c.id} className="ml-2 mt-1">
                {g.categories.length > 1 && <p className="text-xs font-medium text-slate-500">{c.label}</p>}
                <ul>{inCategory.map(({ node }) => renderFlat(g, node, ids, sameCategory))}</ul>
              </div>
            );
          });
        } else if (g.key === 'categories') {
          body = (
            <ul className="ml-2 mt-1">
              {shownItems.map(({ node }) =>
                row(
                  node,
                  <div className="min-w-0 text-sm">
                    {labelButton(node, label(node))}
                    {node.detail && <span className="ml-2 text-xs text-slate-500">{node.detail}</span>}
                  </div>,
                ),
              )}
            </ul>
          );
        } else {
          body = <ul className="ml-2 mt-1">{shownItems.map(({ node }) => renderFlat(g, node, ids))}</ul>;
        }
        return (
          <section key={g.key} aria-label={g.label}>
            {sectionHeader(g, live)}
            {g.key === 'regulatory' && subgroup && (
              <p className="ml-6 text-xs text-slate-500">
                Rendue comme une ligne de Compétences (réglage « Normes et réglementation »).
              </p>
            )}
            {g.section && !isOrderable(g.section) && g.section !== 'summary' && (
              <p className="ml-6 text-xs text-slate-500">Ordre antichronologique imposé.</p>
            )}
            {body}
          </section>
        );
      })}
    </div>
  );
}
