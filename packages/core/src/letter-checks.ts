// Guardrails of the cover letter (F-LET-04, F-LET-06, annex C `letter-facts`, ADR 0016). Unlike the
// propose_* tools, a letter version is an addition, never rejected for its content: every check is a
// warning shown with the version. Only unknown sourceIds are refused (F-LET-04). Reference source
// (annex C): the elements cited in sourceIds, plus offer.md for the paragraphs `vous` / `motivation`,
// plus the durations computed from the dates.
import {
  buildSkillDictionary,
  checkForeignContent,
  checkProtectedFacts,
  detectSkills,
  durationNumbers,
  experienceDurations,
  numbersIn,
} from './guardrails.js';
import { CANDIDATE_ROLES, OFFER_ROLES, type LetterParagraph } from './letter.js';
import type { OfferTerm } from './schema/application.js';
import { COLLECTIONS, type Library } from './schema/library.js';
import type { Selection } from './schema/preset.js';
import { visibleIds } from './selection-ops.js';

export interface LetterCheck {
  rule: 'letter-facts' | 'unchecked-sources' | 'formulas' | 'no-foreign-content' | 'protected-facts';
  ok: false;
  level: 'warning';
  /** 0-based paragraph index, null for the whole letter. */
  paragraph: number | null;
  message: string;
  found?: string[];
}

type AnyRecord = Record<string, unknown>;

/** Every string of a value (ids, tags and references excluded). */
function stringsOf(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => stringsOf(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value))
      if (!['id', 'tags', 'skills', 'category'].includes(k)) stringsOf(v, out);
  }
  return out;
}

interface Found {
  item: AnyRecord;
  /** Set when the id is a bullet: its item is `item`. */
  bullet: AnyRecord | null;
}

function findById(library: Library, id: string): Found | null {
  for (const name of COLLECTIONS) {
    for (const item of library[name] as unknown as AnyRecord[]) {
      if (item.id === id) return { item, bullet: null };
      const bullet = ((item.bullets as AnyRecord[] | undefined) ?? []).find((b) => b.id === id);
      if (bullet) return { item, bullet };
    }
  }
  return null;
}

/** sourceIds absent from the library (F-LET-04: the version is refused). */
export function unknownSourceIds(sourceIds: readonly string[], library: Library): string[] {
  return sourceIds.filter((id) => !findById(library, id));
}

export interface LetterCheckInput {
  paragraphs: readonly LetterParagraph[];
  sourceIds: readonly string[];
  library: Library;
  /** Selection of the application: a cited element it does not show is flagged (F-LET-04). */
  selection: Selection;
  /** offer.md (untrusted data): admitted only in `vous` / `motivation`. */
  offerText: string;
  /** Terms of the offer analyses: an offer skill attributed to the candidate is detected. */
  offerTerms: readonly OfferTerm[];
  now?: Date;
}

const FORMULA_RE =
  /(madame,\s*monsieur|je vous prie d'agr[ée]er|salutations distingu[ée]es|\bdear\s+(?:hiring|sir|madam|mr|ms|mrs)|yours (?:sincerely|faithfully)|^\s*sincerely,?\s*$)/imu;

/** The checks of a letter version: warnings only (annex C, letter-facts). */
export function checkLetter(input: LetterCheckInput): LetterCheck[] {
  const { library } = input;
  const out: LetterCheck[] = [];
  const known = input.sourceIds.map((id) => ({ id, found: findById(library, id) })).filter((x) => x.found);

  // Cited elements the application does not show (F-LET-04).
  const shown = visibleIds(library, input.selection);
  const included = new Set(input.selection.include);
  const hidden = known
    .filter(({ id, found }) =>
      found!.bullet ? !(included.has(id) && shown.has(found!.item.id as string)) : !shown.has(id),
    )
    .map((x) => x.id);
  if (hidden.length) {
    out.push({
      rule: 'unchecked-sources',
      ok: false,
      level: 'warning',
      paragraph: null,
      found: hidden,
      message: `élément(s) cité(s) mais non coché(s) dans la sélection de la candidature : ${hidden.join(', ')}`,
    });
  }

  // Reference source: the cited elements (a bullet with its item), their dates, the durations.
  const sourceTexts = known.flatMap(({ found }) =>
    found!.bullet
      ? [...stringsOf(found!.bullet), ...stringsOf({ ...found!.item, bullets: [] })]
      : stringsOf(found!.item),
  );
  const years = known.flatMap(({ found }) =>
    ['start', 'end', 'date']
      .map((k) => found!.item[k])
      .filter((v): v is string => typeof v === 'string')
      .map((v) => Number(v.slice(0, 4))),
  );
  const durations = durationNumbers(experienceDurations(library, input.now ?? new Date()));
  const fromSources = new Set([...sourceTexts.flatMap(numbersIn), ...years, ...durations]);
  const fromOffer = new Set(numbersIn(input.offerText));

  // Skills of the library: written anywhere in it, or a skill of its own (annex C: « sans figurer dans
  // la bibliothèque »).
  const dict = buildSkillDictionary(library, input.offerTerms);
  const inLibrary = new Set([
    ...library.skills.filter((s) => !s.archived).map((s) => dict.canonical(s.id)),
    ...detectSkills(dict, stringsOf(library)).map((d) => d.id),
  ]);

  input.paragraphs.forEach((p, i) => {
    const offerRole = OFFER_ROLES.includes(p.role);
    const candidateRole = CANDIDATE_ROLES.includes(p.role);
    const numbers = [...new Set(numbersIn(p.text))];
    const strange = numbers.filter((n) => !fromSources.has(n) && !(offerRole && fromOffer.has(n)));
    if (strange.length) {
      const offerOnly = strange.filter((n) => fromOffer.has(n));
      out.push({
        rule: 'letter-facts',
        ok: false,
        level: 'warning',
        paragraph: i,
        found: strange.map(String),
        message: offerOnly.length
          ? `chiffre de l'offre hors des paragraphes vous/motivation : ${offerOnly.join(', ')}${strange.length > offerOnly.length ? ` ; absent des éléments cités : ${strange.filter((n) => !fromOffer.has(n)).join(', ')}` : ''}`
          : `chiffre absent des éléments cités (sourceIds) : ${strange.join(', ')}`,
      });
    }
    if (candidateRole) {
      // Device classes are protected facts (checked below), not skills.
      const skills = detectSkills(dict, [p.text]).filter(
        (d) => !d.viaAmbiguous && !inLibrary.has(d.id) && !/^class(?:e)?\s/i.test(d.label),
      );
      if (skills.length) {
        out.push({
          rule: 'letter-facts',
          ok: false,
          level: 'warning',
          paragraph: i,
          found: skills.map((s) => s.label),
          message: `compétence attribuée au candidat sans figurer dans la bibliothèque : ${skills.map((s) => s.label).join(', ')} (à n'écrire que si c'est vrai, et à ajouter à la bibliothèque)`,
        });
      }
    }
    const sources = offerRole ? [...sourceTexts, input.offerText] : sourceTexts;
    const classes = checkProtectedFacts([p.text], sources);
    if (!classes.ok) {
      out.push({ rule: 'protected-facts', ok: false, level: 'warning', paragraph: i, message: classes.message ?? '' });
    }
    const foreign = checkForeignContent([p.text], [...sources, input.offerText]);
    if (!foreign.ok) {
      out.push({
        rule: 'no-foreign-content',
        ok: false,
        level: 'warning',
        paragraph: i,
        message: foreign.message ?? '',
      });
    }
    if (FORMULA_RE.test(p.text)) {
      out.push({
        rule: 'formulas',
        ok: false,
        level: 'warning',
        paragraph: i,
        message: "formule d'appel ou de politesse écrite dans un paragraphe : elle est générée par le serveur",
      });
    }
  });
  return out;
}
