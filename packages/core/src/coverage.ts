// Keyword coverage of an offer (§6.8, F-OFF-02 to 04, annex B.3). Claude extracts the terms; the code
// computes their coverage, deterministically, on the text projected for the effective selection (the
// same projection as the PDF). A term counts under its exact form (q = 1) or a strict equivalent
// (q = 0.9: alias of the analysis, form of the matching library skill or annex A entry), never under a
// `related` term. Missing terms fall in three groups (F-OFF-03): (a) in the library but not checked,
// (b) under another label or as a `related` term, (c) absent. Zod-free (types only), ADR 0013.
import { REGULATORY_CATEGORY } from './constants.js';
import type { Projection } from './projection.js';
import type { OfferAnalysis, OfferTerm } from './schema/application.js';
import type { Bilingual, Lang } from './schema/common.js';
import type { Library, Skill } from './schema/library.js';
import type { Options, SectionKey, Selection } from './schema/preset.js';
import { isSectionEnabled, visibleIds } from './selection-ops.js';
import {
  DM_AMBIGUOUS_TERMS,
  findTerm,
  isAmbiguousTerm,
  sameTerm,
  tokenizeForMatch,
  type MatchToken,
} from './text/normalize.js';
import { ANNEX_A, annexForms, dmContextMarkers } from './vocab/annex-a.js';

export type TermWeight = OfferTerm['weight'];

/** F-OFF-04: w = 3 (titre), 2 (requis), 1 (souhaité). */
export const TERM_WEIGHTS: Record<TermWeight, 1 | 2 | 3> = { titre: 3, requis: 2, souhaite: 1 };
/** F-OFF-04: q = 1 for the exact form, 0.9 for an alias or an acronym. */
export const Q_EXACT = 1;
export const Q_ALIAS = 0.9;

export type CoverageLevel = 'faible' | 'moyen' | 'bon' | 'fort';
/** Lower bound of each level (ADR 0013, confirming F-OFF-04): faible < 40 % ≤ moyen < 60 % ≤ bon < 80 % ≤ fort. */
export const COVERAGE_THRESHOLDS = { moyen: 0.4, bon: 0.6, fort: 0.8 } as const;

export function coverageLevel(ratio: number): CoverageLevel {
  const r = ratio + 1e-9; // 0.6 computed as 0.59999… is still « bon »
  if (r >= COVERAGE_THRESHOLDS.fort) return 'fort';
  if (r >= COVERAGE_THRESHOLDS.bon) return 'bon';
  if (r >= COVERAGE_THRESHOLDS.moyen) return 'moyen';
  return 'faible';
}

/** Target of `setChecked` (selection operations), with a plain array: the interface keeps it in Immer state. */
export interface FixTarget {
  section: SectionKey;
  itemId: string;
  bulletIds?: string[];
  bulletId?: string;
}

/** Action of « cocher l'élément » (group a), applied by the interface with the selection operations. */
export type CoverageFix =
  | {
      kind: 'check';
      target: FixTarget;
      /** Other sections to enable (a regulatory skill shown inside Compétences needs that section). */
      enable: SectionKey[];
      /** Variant to choose as well, when the term is in a variant other than the current one. */
      variant: { ownerId: string; variantId: string } | null;
    }
  | { kind: 'title'; id: string; variantId: string }
  | { kind: 'summary'; id: string; variantId: string }
  | { kind: 'variant'; ownerId: string; variantId: string };

export interface CoverageMatch {
  form: string;
  kind: 'exact' | 'alias';
  /** Path of the projected field (`experience.<id>.<bullet>`, `skills.lines[0].items[1]`…). */
  path: string;
  where: string;
  excerpt: string;
  /** Standard found with another edition (annex B.3 step 9: ignored for coverage, reported apart). */
  editionNote: string | null;
}

export interface ElementRef {
  collection: string;
  itemId: string;
  bulletId: string | null;
}

export type CoverageSuggestion =
  | ({ kind: 'unchecked'; form: string; q: 1 | 0.9; where: string; excerpt: string; fix: CoverageFix } & ElementRef)
  | { kind: 'related'; skillId: string; skill: string; related: string }
  | ({ kind: 'label'; where: string; excerpt: string; inCv: boolean } & Partial<ElementRef>);

export interface CoverageTerm {
  term: string;
  aliases: string[];
  weight: TermWeight;
  domain: OfferTerm['domain'];
  /** Untrusted data (§7.5): shown as a quotation, never interpreted. */
  sourceSentence: string;
  w: 1 | 2 | 3;
  q: 0 | 0.9 | 1;
  match: CoverageMatch | null;
  /** null when the term is covered. */
  group: 'a' | 'b' | 'c' | null;
  suggestions: CoverageSuggestion[];
  /** Why an occurrence was not counted (ambiguous acronym, short acronym outside Compétences). */
  notes: string[];
}

export interface Coverage {
  analysis: { origin: OfferAnalysis['origin']; createdAt: string; terms: number };
  terms: CoverageTerm[];
  sumW: number;
  sumWQ: number;
  /** Σ w·q / Σ w, null without any term. */
  ratio: number | null;
  level: CoverageLevel | null;
  counts: { covered: number; a: number; b: number; c: number };
}

export interface CoverageInput {
  analysis: OfferAnalysis;
  /** Cleaned offer (offer.md): DM context of the ambiguous acronyms (annex B.3 step 8). */
  offerText: string;
  projection: Pick<Projection, 'expected' | 'lang'>;
  library: Library;
  /** Effective selection: tells which library elements are shown (group a). */
  selection: Selection;
  options: Pick<Options, 'regulatoryPlacement'>;
}

const SECTION_FR: Record<string, string> = {
  experience: 'Expérience',
  education: 'Formation',
  projects: 'Projets',
  skills: 'Compétences',
  regulatory: 'Normes et réglementation',
  certifications: 'Certifications',
  languages: 'Langues',
  interests: "Centres d'intérêt",
};
const ENTRY_COLLECTION = { experience: 'experiences', education: 'education', projects: 'projects' } as const;
const ENTRY_SECTION = { experiences: 'experience', education: 'education', projects: 'projects' } as const;

/** Function words ignored by the « other label » comparison of group (b). */
const STOP_WORDS = new Set([
  'a',
  'au',
  'aux',
  'avec',
  'd',
  'dans',
  'de',
  'des',
  'du',
  'en',
  'et',
  'l',
  'la',
  'le',
  'les',
  'ou',
  'par',
  'pour',
  'sans',
  'selon',
  'sur',
  'un',
  'une',
  'an',
  'and',
  'by',
  'for',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
]);

interface Field {
  path: string;
  text: string;
  tokens: MatchToken[];
  where: string;
  /** In the Compétences section (or the standards line or section). */
  inSkills: boolean;
  /** Skills linked to the element (`skills` of the entry and of the bullet). */
  linked: Skill[];
  ref: ElementRef | null;
}

interface EntryLike {
  id: string;
  archived: boolean;
  skills: string[];
  bullets: Array<{ id: string; skills: string[]; variants: Array<{ id: string; text: Bilingual }> }>;
}

interface LibraryText extends Field {
  /** Shown by the effective selection: then it is already among the projected fields. */
  shown: boolean;
  fix: CoverageFix | null;
}

const excerptOf = (s: string) => (s.length > 110 ? `${s.slice(0, 109)}…` : s);
const isShortAcronym = (s: string) => /^\p{L}{1,2}$/u.test(s.trim());
const isDmAmbiguous = (s: string) => (DM_AMBIGUOUS_TERMS as readonly string[]).includes(s.trim());
const skillForms = (s: Skill) => [s.short, ...s.aliases];

/** Drops a final -s/-x then -e: « ingénieure » ~ « ingénieur », « revues » ~ « revue » (group b only). */
function stem(word: string): string {
  let s = word;
  if (s.length > 3 && /[sx]$/.test(s)) s = s.slice(0, -1);
  if (s.length > 3 && s.endsWith('e')) s = s.slice(0, -1);
  return s;
}

/** Content words of a token sequence, give or take a final -e/-s (« other label » comparison). */
export function contentStems(tokens: MatchToken[]): string[] {
  return tokens
    .filter((t) => t.kind !== 'word' || !STOP_WORDS.has(t.norm))
    .map((t) => (t.kind === 'word' ? stem(t.norm) : t.norm));
}

function projectedFields(projection: CoverageInput['projection'], library: Library): Field[] {
  const skillById = new Map(library.skills.map((s) => [s.id, s]));
  const out: Field[] = [];
  for (const { path, text } of projection.expected) {
    if (/^(?:header\.(?:name|contacts)|heading\.|closing)/.test(path) || path.endsWith('.dates')) continue;
    let where = path;
    let inSkills = false;
    let linked: Skill[] = [];
    let ref: ElementRef | null = null;
    const entry = /^(experience|education|projects)\.([^.]+)\.(.+)$/.exec(path);
    const line = /^(skills|regulatory|certifications|languages|interests)\.lines/.exec(path);
    if (path === 'header.title') where = 'Titre du CV';
    else if (path === 'header.summary') where = 'Accroche';
    else if (entry) {
      const key = entry[1] as keyof typeof ENTRY_COLLECTION;
      const itemId = entry[2]!;
      const part = entry[3]!;
      const collection = ENTRY_COLLECTION[key];
      const items: EntryLike[] = library[collection];
      const item = items.find((e) => e.id === itemId);
      const bullet =
        part === 'title' || part === 'subtitle' ? null : (item?.bullets.find((b) => b.id === part) ?? null);
      where = `${SECTION_FR[key]} : ${part === 'title' ? 'intitulé' : part === 'subtitle' ? 'organisation et lieu' : 'puce'}`;
      linked = [...(item?.skills ?? []), ...(bullet?.skills ?? [])]
        .map((id) => skillById.get(id))
        .filter((s): s is Skill => !!s);
      ref = { collection, itemId, bulletId: bullet?.id ?? null };
    } else if (line) {
      where = SECTION_FR[line[1]!]!;
      inSkills = line[1] === 'skills' || line[1] === 'regulatory';
    }
    out.push({ path, text, tokens: tokenizeForMatch(text), where, inSkills, linked, ref });
  }
  return out;
}

/** Texts of every non-archived library element in `lang`, with what « cocher l'élément » would do. */
function libraryTexts(input: CoverageInput, lang: Lang): LibraryText[] {
  const { library, selection: sel } = input;
  const visible = visibleIds(library, sel);
  const included = new Set(sel.include);
  const skillById = new Map(library.skills.map((s) => [s.id, s]));
  const linkedOf = (ids: string[]) => ids.map((id) => skillById.get(id)).filter((s): s is Skill => !!s);
  const out: LibraryText[] = [];
  const push = (t: Omit<LibraryText, 'tokens' | 'path'>) => {
    if (t.text.trim()) out.push({ ...t, path: '', tokens: tokenizeForMatch(t.text) });
  };
  const tr = (b: Bilingual | null | undefined) => (b ? b[lang] : null);

  for (const t of library.titles.filter((x) => !x.archived)) {
    const chosen = !sel.overrides.title && sel.titleId === t.id;
    const current = sel.variantChoice[t.id] ?? t.variants[0]?.id;
    for (const v of t.variants) {
      const shown = chosen && v.id === current;
      push({
        text: tr(v.text) ?? '',
        where: 'Titres',
        inSkills: false,
        linked: [],
        ref: { collection: 'titles', itemId: t.id, bulletId: null },
        shown,
        fix: shown
          ? null
          : chosen
            ? { kind: 'variant', ownerId: t.id, variantId: v.id }
            : { kind: 'title', id: t.id, variantId: v.id },
      });
    }
  }
  for (const s of library.summaries.filter((x) => !x.archived)) {
    const chosen = isSectionEnabled(sel, 'summary') && sel.summaryId === s.id;
    const current = sel.variantChoice[s.id] ?? s.variants[0]?.id;
    for (const v of s.variants) {
      const shown = chosen && v.id === current;
      push({
        text: tr(v.text) ?? '',
        where: 'Accroches',
        inSkills: false,
        linked: [],
        ref: { collection: 'summaries', itemId: s.id, bulletId: null },
        shown,
        fix: shown
          ? null
          : chosen
            ? { kind: 'variant', ownerId: s.id, variantId: v.id }
            : { kind: 'summary', id: s.id, variantId: v.id },
      });
    }
  }

  const entries: Array<{
    collection: keyof typeof ENTRY_SECTION;
    e: EntryLike;
    label: string;
    texts: Array<string | null>;
  }> = [
    ...library.experiences.map((e) => ({
      collection: 'experiences' as const,
      e,
      label: `${tr(e.position) ?? ''} – ${e.organization}`,
      texts: [tr(e.position), e.organization],
    })),
    ...library.education.map((e) => ({
      collection: 'education' as const,
      e,
      label: `${tr(e.degree) ?? ''} – ${e.institution}`,
      texts: [tr(e.degree), tr(e.field), e.institution],
    })),
    ...library.projects.map((e) => ({
      collection: 'projects' as const,
      e,
      label: tr(e.name) ?? '',
      texts: [tr(e.name), tr(e.role)],
    })),
  ];
  for (const { collection, e, label, texts } of entries) {
    if (e.archived) continue;
    const section = ENTRY_SECTION[collection];
    const entryShown = visible.has(e.id);
    const bulletIds = e.bullets.map((b) => b.id);
    const where = `${SECTION_FR[section]} « ${excerptOf(label)} »`;
    for (const text of texts) {
      push({
        text: text ?? '',
        where,
        inSkills: false,
        linked: linkedOf(e.skills),
        ref: { collection, itemId: e.id, bulletId: null },
        shown: entryShown,
        fix: entryShown
          ? null
          : { kind: 'check', target: { section, itemId: e.id, bulletIds }, enable: [], variant: null },
      });
    }
    for (const b of e.bullets) {
      const bulletShown = entryShown && included.has(b.id);
      const current = sel.variantChoice[b.id] ?? b.variants[0]?.id;
      for (const v of b.variants) {
        const shown = bulletShown && v.id === current;
        push({
          text: tr(v.text) ?? '',
          where: `${where}, puce`,
          inSkills: false,
          linked: linkedOf([...e.skills, ...b.skills]),
          ref: { collection, itemId: e.id, bulletId: b.id },
          shown,
          fix: shown
            ? null
            : bulletShown
              ? { kind: 'variant', ownerId: b.id, variantId: v.id }
              : {
                  kind: 'check',
                  target: { section, itemId: e.id, bulletId: b.id },
                  enable: [],
                  variant: v.id === current ? null : { ownerId: b.id, variantId: v.id },
                },
        });
      }
    }
  }

  for (const s of library.skills.filter((x) => !x.archived)) {
    const regulatory = s.category === REGULATORY_CATEGORY;
    const section: SectionKey = regulatory ? 'regulatory' : 'skills';
    const inSubgroup = regulatory && input.options.regulatoryPlacement === 'skills-subgroup';
    const shown = visible.has(s.id) && (!inSubgroup || isSectionEnabled(sel, 'skills'));
    const fix: CoverageFix | null = shown
      ? null
      : { kind: 'check', target: { section, itemId: s.id }, enable: inSubgroup ? ['skills'] : [], variant: null };
    for (const text of [s.short, tr(s.long), ...s.aliases]) {
      push({
        text: text ?? '',
        where: `${SECTION_FR[section]} « ${s.short} »`,
        inSkills: true,
        linked: [s],
        ref: { collection: 'skills', itemId: s.id, bulletId: null },
        shown,
        fix,
      });
    }
  }
  const flat = [
    [
      'certifications',
      library.certifications.map((c) => ({ item: c, texts: [tr(c.name), c.issuer], skills: c.skills })),
    ],
    ['languages', library.languages.map((l) => ({ item: l, texts: [tr(l.language)], skills: [] as string[] }))],
    [
      'interests',
      library.interests.map((i) => ({ item: i, texts: [tr(i.text), tr(i.detail)], skills: [] as string[] })),
    ],
  ] as const;
  for (const [section, rows] of flat) {
    for (const { item, texts, skills } of rows) {
      if (item.archived) continue;
      const shown = visible.has(item.id);
      for (const text of texts) {
        push({
          text: text ?? '',
          where: `${SECTION_FR[section]} « ${excerptOf(texts[0] ?? item.id)} »`,
          inSkills: false,
          linked: linkedOf([...skills]),
          ref: { collection: section, itemId: item.id, bulletId: null },
          shown,
          fix: shown ? null : { kind: 'check', target: { section, itemId: item.id }, enable: [], variant: null },
        });
      }
    }
  }
  return out;
}

export function computeCoverage(input: CoverageInput): Coverage {
  const { library, analysis } = input;
  const lang = input.projection.lang;
  const fields = projectedFields(input.projection, library);
  const libTexts = libraryTexts(input, lang);
  const offerTokens = tokenizeForMatch(input.offerText);
  const inOffer = (s: string) => findTerm(offerTokens, s, { ambiguous: false }) >= 0;

  const isAmbiguous = (s: string) =>
    isAmbiguousTerm(s) || library.skills.some((k) => k.ambiguous && skillForms(k).some((f) => f.trim() === s.trim()));
  const offerHasDmMarker = dmContextMarkers(isAmbiguous).some(inOffer);
  /** Long forms (and non-ambiguous aliases) of an acronym, from annex A and the library. */
  const longFormsOf = (acronym: string): string[] => {
    const forms: string[] = [];
    for (const e of ANNEX_A) if (e.short === acronym.trim()) forms.push(...annexForms(e).slice(1));
    for (const k of library.skills) {
      if (k.short === acronym.trim())
        forms.push(...[k.long?.fr, k.long?.en, ...k.aliases].filter((x): x is string => !!x));
    }
    return forms.filter((f) => !isAmbiguous(f));
  };
  // Annex B.3 step 8: an ambiguous DM acronym counts only for a `dm` term, or when the offer contains
  // its long form or another (non-ambiguous, DM-specific) annex A term.
  const dmOk = (term: OfferTerm, form: string) =>
    term.domain === 'dm' || offerHasDmMarker || longFormsOf(form).some(inOffer);

  type Located = { index: number; excluded: 'dm' | 'short' | null };
  const locate = (field: Field, form: string, ambiguous: boolean, dm: boolean): Located => {
    const index = findTerm(field.tokens, form, { ambiguous, dmContext: dm });
    if (index < 0) {
      const hidden =
        ambiguous && isDmAmbiguous(form) && !dm && findTerm(field.tokens, form, { ambiguous, dmContext: true }) >= 0;
      return { index: -1, excluded: hidden ? 'dm' : null };
    }
    // Acronyms of one or two letters count only in Compétences or in an element linked to that skill.
    if (
      ambiguous &&
      isShortAcronym(form) &&
      !field.inSkills &&
      !field.linked.some((s) => skillForms(s).some((f) => sameTerm(f, form)))
    ) {
      return { index: -1, excluded: 'short' };
    }
    return { index, excluded: null };
  };

  const equivalentsOf = (term: OfferTerm): string[] => {
    const forms = [...term.aliases];
    const restricted = isAmbiguous(term.term) && isDmAmbiguous(term.term) && !dmOk(term, term.term);
    if (!restricted) {
      for (const k of library.skills.filter((x) => !x.archived)) {
        const kf = [...skillForms(k), k.long?.fr, k.long?.en].filter((x): x is string => !!x);
        if (kf.some((f) => sameTerm(f, term.term))) forms.push(...kf);
      }
      for (const e of ANNEX_A) {
        const ef = annexForms(e);
        if (ef.some((f) => sameTerm(f, term.term))) forms.push(...ef);
      }
    }
    const out: string[] = [];
    for (const f of forms) if (!sameTerm(f, term.term) && !out.some((o) => sameTerm(o, f))) out.push(f);
    return out;
  };

  const editionNote = (form: string, token: MatchToken | undefined): string | null => {
    const [ft, ...rest] = tokenizeForMatch(form);
    if (!ft || rest.length || ft.kind !== 'standard' || !ft.edition || !token?.edition) return null;
    return ft.edition === token.edition
      ? null
      : `édition différente : « ${ft.raw} » dans l'offre, « ${token.raw} » dans le CV`;
  };

  // Duplicated terms (same normalized form) count once, with their highest weight.
  const unique: OfferTerm[] = [];
  for (const t of analysis.terms) {
    const i = unique.findIndex((u) => sameTerm(u.term, t.term));
    if (i < 0) unique.push(t);
    else if (TERM_WEIGHTS[t.weight] > TERM_WEIGHTS[unique[i]!.weight]) unique[i] = t;
  }

  const terms: CoverageTerm[] = unique.map((term) => {
    const notes = new Set<string>();
    const note = (excluded: Located['excluded'], form: string) => {
      if (excluded === 'dm') {
        notes.add(
          `sigle ambigu « ${form} » : il ne compte que pour une offre du domaine des dispositifs médicaux (terme de domaine DM, forme longue ou autre terme de l'annexe A dans l'offre)`,
        );
      } else if (excluded === 'short') {
        notes.add(
          `sigle court « ${form} » : il ne compte que dans les Compétences, ou dans un élément lié à cette compétence`,
        );
      }
    };
    const forms = [
      { form: term.term, q: Q_EXACT as 1 | 0.9 },
      ...equivalentsOf(term).map((form) => ({ form, q: Q_ALIAS as 1 | 0.9 })),
    ];

    let match: CoverageMatch | null = null;
    let q: CoverageTerm['q'] = 0;
    outer: for (const { form, q: fq } of forms) {
      const ambiguous = isAmbiguous(form);
      const dm = dmOk(term, form);
      for (const field of fields) {
        const r = locate(field, form, ambiguous, dm);
        note(r.excluded, form);
        if (r.index < 0) continue;
        q = fq;
        match = {
          form,
          kind: fq === Q_EXACT ? 'exact' : 'alias',
          path: field.path,
          where: field.where,
          excerpt: excerptOf(field.text),
          editionNote: editionNote(form, field.tokens[r.index]),
        };
        break outer;
      }
    }

    const suggestions: CoverageSuggestion[] = [];
    let group: CoverageTerm['group'] = null;
    if (!match) {
      // (a) In the library, not shown: exact forms first, at most 3 elements.
      const seen = new Set<string>();
      for (const { form, q: fq } of forms) {
        const ambiguous = isAmbiguous(form);
        const dm = dmOk(term, form);
        for (const lt of libTexts) {
          if (lt.shown || !lt.fix || !lt.ref) continue;
          const key = `${lt.ref.itemId}/${lt.ref.bulletId ?? ''}`;
          if (seen.has(key) || seen.size >= 3) continue;
          if (locate(lt, form, ambiguous, dm).index < 0) continue;
          seen.add(key);
          suggestions.push({
            kind: 'unchecked',
            form,
            q: fq,
            where: lt.where,
            excerpt: excerptOf(lt.text),
            fix: lt.fix,
            ...lt.ref,
          });
        }
      }
      if (suggestions.length) group = 'a';
      else {
        // (b) A `related` term of a skill (never counted), or another label: every content word of the
        // term in one field, give or take a final -e/-s (« Ingénieure » for « Ingénieur »). Ambiguous
        // acronyms are left out: a lookalike is precisely what must not count.
        const termTokens = tokenizeForMatch(term.term);
        for (const k of library.skills.filter((x) => !x.archived)) {
          for (const r of k.related) {
            if (sameTerm(r, term.term) || findTerm(tokenizeForMatch(r), term.term) >= 0) {
              suggestions.push({ kind: 'related', skillId: k.id, skill: k.short, related: r });
            }
          }
        }
        const wanted = isAmbiguous(term.term) ? [] : [...new Set(contentStems(termTokens))];
        if (wanted.length) {
          const near = (tokens: MatchToken[]) => {
            const have = new Set(contentStems(tokens));
            return wanted.every((w) => have.has(w));
          };
          let labels = 0;
          for (const f of fields) {
            if (labels >= 3) break;
            if (near(f.tokens)) {
              labels++;
              suggestions.push({
                kind: 'label',
                where: f.where,
                excerpt: excerptOf(f.text),
                inCv: true,
                ...(f.ref ?? {}),
              });
            }
          }
          for (const lt of libTexts) {
            if (labels >= 3) break;
            if (!lt.shown && near(lt.tokens)) {
              labels++;
              suggestions.push({
                kind: 'label',
                where: lt.where,
                excerpt: excerptOf(lt.text),
                inCv: false,
                ...(lt.ref ?? {}),
              });
            }
          }
        }
        group = suggestions.length ? 'b' : 'c';
      }
    }

    return {
      term: term.term,
      aliases: term.aliases,
      weight: term.weight,
      domain: term.domain,
      sourceSentence: term.sourceSentence,
      w: TERM_WEIGHTS[term.weight],
      q,
      match,
      group,
      suggestions,
      notes: match ? [] : [...notes],
    };
  });

  const sumW = terms.reduce((s, t) => s + t.w, 0);
  const sumWQ = Math.round(terms.reduce((s, t) => s + t.w * t.q, 0) * 1000) / 1000;
  const ratio = sumW > 0 ? sumWQ / sumW : null;
  return {
    analysis: { origin: analysis.origin, createdAt: analysis.createdAt, terms: analysis.terms.length },
    terms,
    sumW,
    sumWQ,
    ratio,
    level: ratio === null ? null : coverageLevel(ratio),
    counts: {
      covered: terms.filter((t) => t.group === null).length,
      a: terms.filter((t) => t.group === 'a').length,
      b: terms.filter((t) => t.group === 'b').length,
      c: terms.filter((t) => t.group === 'c').length,
    },
  };
}
