// Review screen data (F-PRO-02, F-UI-03): for each proposal, its effective status (`stale` computed
// from the base hash), a readable target, the word diff against the base, the automatic checks, the
// dependencies, whether it can still be applied, and the three columns of a conflict.
import {
  applyLibraryProposal,
  batchExclusion,
  COLLECTION_LABEL,
  getPath,
  isSensitive,
  ITEM_COLLECTION,
  itemLabel,
  openCategoryProposals,
  pick,
  ProposalError,
  removalViolations,
  requiredCategory,
  selectionElements,
  truncate,
  wordDiff,
  describeTarget,
  type Bilingual,
  type Bullet,
  type CollectionName,
  type DiffSegment,
  type Library,
  type LibraryProposal,
  type ProposalFile,
  type ProposalStatus,
  type Selection,
  type SubjectContext,
  type Variant,
} from '@cv/core';
import { editableOf, hashSubject, proposalFreshness } from '@cv/store';

export interface Line {
  label: string;
  text: string;
  /** Current column of a conflict: word diff against the base line with the same label. */
  segments?: DiffSegment[];
}

export interface DiffBlock {
  label: string;
  segments: DiffSegment[];
}

export interface SelectionRow {
  key: string;
  op: 'add' | 'remove' | 'variant';
  id: string;
  label: string;
  detail: string | null;
  rationale: string | null;
  applicable: boolean;
  reason: string | null;
}

export interface ProposalView {
  id: string;
  type: ProposalFile['type'];
  /** Effective status: `stale` when an open proposal's element changed since its base. */
  status: ProposalStatus;
  storedStatus: ProposalStatus;
  origin: ProposalFile['origin'];
  source: ProposalFile['source'];
  createdAt: string;
  target: string;
  collection: CollectionName | null;
  rationale: string | null;
  checks: ProposalFile['checks'];
  sensitive: boolean;
  /** Why it is left out of a batch acceptance (sensitive fact, date to check), or null. */
  batchExcluded: string | null;
  staleReason: 'changed' | 'missing' | null;
  applicable: { ok: boolean; reason: string | null };
  dependsOn: Array<{ id: string; status: ProposalStatus | 'introuvable'; label: string }>;
  supersedes: string | null;
  duplicateOf: string | null;
  diff: DiffBlock[];
  conflict: { base: Line[] | null; current: Line[] | null; proposed: Line[] } | null;
  selection: SelectionRow[] | null;
  /** Initial value of "modifier puis accepter" (shape of the edited payload), null for a selection. */
  editable: unknown;
  resolution: ProposalFile['resolution'];
  sourceFile: string | null;
  userStatement: string | null;
  payload: unknown;
}

const LANGS = ['fr', 'en'] as const;

const FIELD_LABEL: Record<string, string> = {
  position: 'Intitulé du poste',
  organization: 'Organisation',
  location: 'Lieu',
  contract: 'Contrat',
  start: 'Début',
  end: 'Fin',
  degree: 'Diplôme',
  field: 'Spécialité',
  institution: 'Établissement',
  honors: 'Mention',
  levelEquivalent: 'Équivalence',
  name: 'Nom',
  role: 'Rôle',
  url: 'Lien',
  repos: 'Dépôts',
  short: 'Sigle ou nom',
  long: 'Forme longue',
  code: 'Code',
  edition: 'Édition',
  aliases: 'Alias',
  related: 'Termes voisins',
  ambiguous: 'Sigle ambigu',
  category: 'Catégorie',
  issuer: 'Organisme',
  date: 'Date',
  language: 'Langue',
  cefr: 'Niveau CECRL',
  certification: 'Certification',
  text: 'Texte',
  detail: 'Détail',
  label: 'Libellé',
  tags: 'Tags',
  skills: 'Compétences liées',
  locked: 'Verrouillé',
  archived: 'Archivé',
};

const isBilingual = (v: unknown): v is Bilingual => !!v && typeof v === 'object' && 'fr' in v && 'en' in v;

/** Readable name of a category id: library label, pending proposal label, else the id itself (ADR 0023). */
export type CategoryLabel = (id: string) => string;
const rawCategory: CategoryLabel = (id) => id;

/** Value of a field, with a category id shown by its label. */
const fieldText = (key: string, value: unknown, categoryLabel: CategoryLabel) =>
  key === 'category' && typeof value === 'string' ? categoryLabel(value) : display(value);

/** Readable value of a field (lists, bilingual values, location, link). */
export function display(value: unknown): string {
  if (value === null || value === undefined) return '(vide)';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'oui' : 'non';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.length ? value.map(display).join(', ') : '(aucun)';
  if (isBilingual(value)) return `FR : ${value.fr ?? '(non traduit)'} | EN : ${value.en ?? '(non traduit)'}`;
  const o = value as Record<string, unknown>;
  if ('city' in o && 'country' in o) return `${String(o.city)}, ${pick(o.country as Bilingual)}`;
  if ('url' in o && 'display' in o) return `${String(o.display)} (${String(o.url)})`;
  return Object.entries(o)
    .map(([k, v]) => `${FIELD_LABEL[k] ?? k} : ${display(v)}`)
    .join(' ; ');
}

function variantLines(variants: Variant[]): Line[] {
  return variants.flatMap((v) =>
    LANGS.map((l) => ({
      label: `${v.id}${v.label ? ` (${v.label})` : ''} · ${l.toUpperCase()}`,
      text: v.text[l] ?? '(non traduit)',
    })),
  );
}

/** Readable lines of an element (bullet, item) for the conflict columns and new items. */
export function elementLines(value: unknown, categoryLabel: CategoryLabel = rawCategory): Line[] {
  if (!value || typeof value !== 'object') return [{ label: 'Valeur', text: display(value) }];
  const o = value as Record<string, unknown>;
  const out: Line[] = [];
  for (const [key, v] of Object.entries(o)) {
    if (key === 'id') continue;
    if (key === 'variants') out.push(...variantLines(v as Variant[]));
    else if (key === 'bullets') {
      (v as Bullet[]).forEach((b, i) =>
        out.push({ label: `Puce ${i + 1}`, text: (b.variants as Variant[]).map((x) => pick(x.text)).join(' / ') }),
      );
    } else out.push({ label: FIELD_LABEL[key] ?? key, text: fieldText(key, v, categoryLabel) });
  }
  return out;
}

function selectionLines(sel: Selection | null, p: Extract<ProposalFile, { type: 'selection' }>): Line[] | null {
  if (!sel) return null;
  return selectionElements(p.payload).map((el) => ({
    label: el.op === 'variant' ? `Variante de ${el.id}` : el.id,
    text:
      el.op === 'variant'
        ? (sel.variantChoice[el.id] ?? '(par défaut)')
        : sel.include.includes(el.id)
          ? 'coché'
          : 'non coché',
  }));
}

function findAny(library: Library, id: string): { collection: CollectionName; label: string } | null {
  for (const [collection, items] of Object.entries(library) as Array<
    [CollectionName, Array<Record<string, unknown>>]
  >) {
    for (const item of items) {
      if (item.id === id) return { collection, label: itemLabel(collection, item) };
      for (const b of (item.bullets as Bullet[] | undefined) ?? []) {
        if (b.id === id) return { collection, label: `puce « ${truncate(pick(b.variants[0]?.text), 70)} »` };
      }
    }
  }
  return null;
}

function proposedLines(p: ProposalFile, categoryLabel: CategoryLabel): Line[] {
  switch (p.type) {
    case 'variant':
      return LANGS.map((l) => ({
        label: `${p.payload.label ?? 'nouvelle variante'} · ${l.toUpperCase()}`,
        text: p.payload.text[l] ?? '(non traduit)',
      }));
    case 'translation':
      return [{ label: `Traduction ${p.payload.lang.toUpperCase()}`, text: p.payload.text }];
    case 'edit':
      return [
        {
          label: FIELD_LABEL[p.payload.field] ?? p.payload.field,
          text: fieldText(p.payload.field, p.payload.newValue, categoryLabel),
        },
      ];
    case 'alias':
      return [{ label: p.payload.kind === 'alias' ? 'Alias ajouté' : 'Terme voisin ajouté', text: p.payload.alias }];
    case 'item':
      return elementLines(p.payload.item, categoryLabel);
    case 'selection':
      return selectionElements(p.payload).map((el) => ({
        label: el.op === 'variant' ? `Variante de ${el.id}` : el.id,
        text: el.op === 'add' ? 'coché' : el.op === 'remove' ? 'non coché' : el.value!,
      }));
  }
}

/** Element as it was when the proposal was computed, when the snapshot matches the recorded hash. */
function baseSnapshot(p: ProposalFile): unknown {
  if (!p.base || p.base.snapshot === undefined) return undefined;
  return hashSubject(p.base.snapshot) === p.base.hash ? p.base.snapshot : undefined;
}

function libraryDiff(p: LibraryProposal, current: unknown, categoryLabel: CategoryLabel): DiffBlock[] {
  const owner = current as Record<string, unknown> | null;
  switch (p.type) {
    case 'variant': {
      const ref = (owner?.variants as Variant[] | undefined)?.[0];
      return LANGS.filter((l) => p.payload.text[l] !== null).map((l) => ({
        label: `Nouvelle variante (${l.toUpperCase()})${ref ? `, comparée à « ${ref.id} »` : ''}`,
        segments: wordDiff(ref?.text[l] ?? null, p.payload.text[l]),
      }));
    }
    case 'translation': {
      const lang = p.payload.lang;
      const other = lang === 'fr' ? 'en' : 'fr';
      const target = p.target.variantId
        ? (owner?.variants as Variant[] | undefined)?.find((v) => v.id === p.target.variantId)?.text
        : p.target.field
          ? getPath(owner, p.target.field)
          : undefined;
      const bi = isBilingual(target) ? target : null;
      const blocks: DiffBlock[] = [];
      if (bi?.[other])
        blocks.push({ label: `Texte source (${other.toUpperCase()})`, segments: [{ op: 'eq', text: bi[other]! }] });
      blocks.push({
        label: `Traduction ${lang.toUpperCase()}`,
        segments: wordDiff(bi?.[lang] ?? null, p.payload.text),
      });
      return blocks;
    }
    case 'edit': {
      const now = owner ? getPath(owner, p.payload.field) : undefined;
      return [
        {
          label: `${FIELD_LABEL[p.payload.field] ?? p.payload.field} (${p.payload.field})`,
          segments: wordDiff(
            fieldText(p.payload.field, now ?? p.payload.oldValue, categoryLabel),
            fieldText(p.payload.field, p.payload.newValue, categoryLabel),
          ),
        },
      ];
    }
    case 'alias': {
      const list = ((owner?.[p.payload.kind === 'alias' ? 'aliases' : 'related'] as string[] | undefined) ?? []).join(
        ', ',
      );
      return [
        {
          label: p.payload.kind === 'alias' ? 'Alias (équivalents stricts)' : 'Termes voisins',
          segments: [
            ...(list ? [{ op: 'eq' as const, text: `${list}, ` }] : []),
            { op: 'ins' as const, text: p.payload.alias },
          ],
        },
      ];
    }
    case 'item': {
      if (p.payload.duplicateOf) {
        // Complement (ADR 0015): the bullets of the validated element, then the bullets to add.
        const existing = ((owner?.bullets as Bullet[] | undefined) ?? []).map((b, i) => ({
          label: `Puce existante ${i + 1}`,
          segments: [{ op: 'eq' as const, text: (b.variants as Variant[]).map((x) => pick(x.text)).join(' / ') }],
        }));
        const added = ((p.payload.item as { bullets?: Bullet[] }).bullets ?? []).map((b, i) => ({
          label: `Puce ajoutée ${i + 1}`,
          segments: [{ op: 'ins' as const, text: (b.variants as Variant[]).map((x) => pick(x.text)).join(' / ') }],
        }));
        return [...existing, ...added];
      }
      return elementLines(p.payload.item, categoryLabel).map((l) => ({
        label: l.label,
        segments: [{ op: 'ins', text: l.text }],
      }));
    }
  }
}

export function buildProposalViews(proposals: ProposalFile[], ctx: SubjectContext): ProposalView[] {
  const byId = new Map(proposals.map((p) => [p.id, p]));
  const statusOf = (id: string) => byId.get(id)?.status ?? 'introuvable';
  // Proposed categories (ADR 0023): the open ones by reserved id, and any of them (open first) for the
  // reason shown on a skill whose category was rejected.
  const openCats = openCategoryProposals(proposals);
  const anyCats = new Map<string, ProposalFile>();
  for (const p of proposals) {
    if (p.type !== 'item' || p.payload.itemType !== 'category' || p.payload.duplicateOf) continue;
    if (!anyCats.has(p.payload.item.id)) anyCats.set(p.payload.item.id, p);
  }
  for (const [id, p] of openCats) anyCats.set(id, p);
  const proposedLabel = (p: ProposalFile) =>
    p.type === 'item' ? pick((p.payload.item as { label?: Bilingual }).label) || '(sans libellé)' : '';
  const categoryLabel: CategoryLabel = (id) => {
    const validated = ctx.library.categories.find((c) => c.id === id);
    if (validated) return pick(validated.label) || id;
    const pending = openCats.get(id);
    return pending ? `${proposedLabel(pending)} (en attente)` : id;
  };
  return proposals.map((p): ProposalView => {
    const open = p.status === 'pending' || p.status === 'stale';
    const fresh = proposalFreshness(p, ctx);
    const stale = open && fresh.stale;
    const status: ProposalStatus = open ? (stale ? 'stale' : 'pending') : p.status;
    let applicable = { ok: true, reason: null as string | null };
    let selection: SelectionRow[] | null = null;
    let diff: DiffBlock[] = [];

    if (p.type === 'selection') {
      const rationale = p.rationale;
      const current = ctx.selection(p.target.kind, p.target.id);
      selection = selectionElements(p.payload).map((el) => {
        let ok = true;
        let reason: string | null = null;
        // F-SEL-10: a removal that would hide a whole experience or a locked element is refused.
        const violations = el.op === 'remove' && current ? removalViolations(ctx.library, current, el.id) : [];
        if (violations.length > 0) {
          ok = false;
          reason = `refusé (F-SEL-10) : ${violations.map((v) => v.message).join(' ; ')}`;
        }
        if (el.value?.startsWith('prop:')) {
          const dep = el.value.slice(5);
          const s = statusOf(dep);
          if (s === 'rejected' || s === 'superseded') [ok, reason] = [false, 'la variante proposée a été rejetée'];
          else if (s === 'introuvable') [ok, reason] = [false, 'proposition de variante introuvable'];
          else if (s === 'pending' || s === 'stale')
            reason = 'acceptée avec la proposition de variante dont elle dépend';
        }
        const found = findAny(ctx.library, el.id);
        const variantOf =
          el.op === 'variant' && el.value?.startsWith('prop:') ? `variante proposée ${el.value.slice(5)}` : el.value;
        return {
          key: el.key,
          op: el.op,
          id: el.id,
          label: found ? `${COLLECTION_LABEL[found.collection]} : ${found.label}` : `${el.id} (introuvable)`,
          detail: el.op === 'variant' ? `variante : ${variantOf}` : null,
          rationale: rationale[el.id] ?? null,
          applicable: ok && (found !== null || el.op === 'remove'),
          reason: found || el.op === 'remove' ? reason : 'élément introuvable dans la bibliothèque',
        };
      });
      if (fresh.reason === 'missing') applicable = { ok: false, reason: 'preset ou candidature introuvable' };
      else if (!selection.some((r) => r.applicable)) applicable = { ok: false, reason: 'aucun élément applicable' };
    } else {
      try {
        const r = applyLibraryProposal(ctx.library, p);
        if (!r.changed)
          applicable = { ok: true, reason: 'déjà présent dans la bibliothèque : acceptation sans modification' };
        // A skill whose category is not validated (ADR 0023): pending, rejected or unknown.
        const needed = requiredCategory(p);
        if (needed && !ctx.library.categories.some((c) => c.id === needed)) {
          const dep = anyCats.get(needed);
          if (dep && openCats.has(needed))
            applicable = {
              ok: true,
              reason: `acceptée avec la catégorie proposée « ${proposedLabel(dep)} » dont elle dépend`,
            };
          // Same reasons as the store (acceptLibrary): "rejected" only for a rejected or superseded
          // category; an accepted one deleted from the library since is an unknown category.
          else if (dep && (dep.status === 'rejected' || dep.status === 'superseded'))
            applicable = {
              ok: false,
              reason: `la catégorie proposée « ${proposedLabel(dep)} » a été rejetée : modifiez puis acceptez avec une autre catégorie`,
            };
          else applicable = { ok: false, reason: `catégorie inconnue : ${needed}` };
        }
      } catch (err) {
        if (!(err instanceof ProposalError)) throw err;
        applicable = { ok: false, reason: err.message };
      }
      diff = libraryDiff(p, fresh.current, categoryLabel);
    }

    let conflict: ProposalView['conflict'] = null;
    if (stale) {
      const base = baseSnapshot(p);
      const asLines = (v: unknown): Line[] | null =>
        v === undefined || v === null
          ? null
          : p.type === 'selection'
            ? selectionLines(v as Selection, p)
            : p.type === 'edit'
              ? [
                  {
                    label: FIELD_LABEL[p.payload.field] ?? p.payload.field,
                    text: fieldText(p.payload.field, getPath(v, p.payload.field), categoryLabel),
                  },
                ]
              : elementLines(v, categoryLabel);
      const baseLines = asLines(base);
      const current = asLines(fresh.current)?.map((line) => {
        const before = baseLines?.find((b) => b.label === line.label);
        return before && before.text !== line.text ? { ...line, segments: wordDiff(before.text, line.text) } : line;
      });
      conflict = { base: baseLines, current: current ?? null, proposed: proposedLines(p, categoryLabel) };
    }

    return {
      id: p.id,
      type: p.type,
      status,
      storedStatus: p.status,
      origin: p.origin,
      source: p.source,
      createdAt: p.createdAt,
      target: describeTarget(p, ctx.library),
      collection:
        p.type === 'selection' ? null : p.type === 'item' ? ITEM_COLLECTION[p.payload.itemType] : p.target.collection,
      rationale: typeof p.rationale === 'string' ? p.rationale : null,
      checks: p.checks,
      sensitive: isSensitive(p),
      batchExcluded: batchExclusion(p),
      staleReason: stale ? fresh.reason : null,
      applicable,
      dependsOn: p.dependsOn.map((id) => {
        const dep = byId.get(id);
        return {
          id,
          status: statusOf(id),
          label: dep ? describeTarget(dep, ctx.library) : id,
        };
      }),
      supersedes: p.supersedes,
      duplicateOf: p.type === 'item' ? p.payload.duplicateOf : null,
      diff,
      conflict,
      selection,
      editable: p.type === 'selection' ? null : editableOf(p),
      resolution: p.resolution,
      sourceFile: p.sourceFile,
      userStatement: p.userStatement,
      payload: p.payload,
    };
  });
}
