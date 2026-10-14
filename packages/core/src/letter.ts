// Cover letter (§6.10, F-LET-01 to 07, ADR 0016): what the server generates (sender, place and date,
// subject, salutation and closing formula, enclosure) and the letter projection, the single input of
// the letter template (Typst) and of its DOCX. Claude only writes the paragraphs, each with a role.
import { labelsFor } from './labels.js';
import { letterDocumentTitle, stripGenderMarkers } from './naming.js';
import { projectionTheme } from './project.js';
import type { ExpectedField, ProjectionIssue, ProjectionTheme, Rich } from './projection.js';
import type { LetterVersionFile } from './schema/application.js';
import type { EnVariant, Lang } from './schema/common.js';
import type { Template } from './schema/preset.js';
import type { Identity } from './schema/profile.js';
import { segmentText } from './text/segments.js';

export type LetterRecipient = NonNullable<LetterVersionFile['recipient']>;
export type LetterParagraph = LetterVersionFile['paragraphs'][number];

// ---------------------------------------------------------------------------------------------------
// Roles (F-LET-03; ADR 0016, user decision: order imposed, flexible).

/** Allowed sequences of roles: FR vous, moi (once or twice), nous; EN opening, evidence, [motivation], close. */
export const LETTER_ROLE_SEQUENCES: Record<Lang, ReadonlyArray<readonly string[]>> = {
  fr: [
    ['vous', 'moi', 'nous'],
    ['vous', 'moi', 'moi', 'nous'],
  ],
  en: [
    ['opening', 'evidence', 'motivation', 'close'],
    ['opening', 'evidence', 'close'],
    ['opening', 'evidence', 'evidence', 'close'],
  ],
};

/** Why a sequence of roles is refused in `lang`, or null when it is allowed. */
export function checkLetterRoles(lang: Lang, roles: readonly string[]): string | null {
  if (LETTER_ROLE_SEQUENCES[lang].some((seq) => seq.length === roles.length && seq.every((r, i) => roles[i] === r))) {
    return null;
  }
  const allowed = LETTER_ROLE_SEQUENCES[lang].map((s) => s.join(', ')).join(' ; ');
  return `rôles des paragraphes refusés (${roles.join(', ') || 'aucun'}) : ${lang === 'fr' ? 'en français' : 'en anglais'}, dans cet ordre : ${allowed}`;
}

/** Roles whose paragraph may state facts about the company or the job, taken from offer.md (F-LET-06). */
export const OFFER_ROLES: readonly string[] = ['vous', 'motivation'];
/** Roles whose paragraph states facts about the candidate (letter-facts, annex C). */
export const CANDIDATE_ROLES: readonly string[] = ['moi', 'evidence'];

// ---------------------------------------------------------------------------------------------------
// Generated parts.

/**
 * Date of the letter (F-LET-01): FR « Lyon, le 1er octobre 2026 » (ordinal « 1er »), en-GB « 1 October
 * 2026 », en-US « October 1, 2026 ». No place in English. The date is the day of the rendering (ADR 0016).
 */
export function formatLetterDate(date: Date, lang: Lang, variant: EnVariant, city: string | null): string {
  const day = date.getDate();
  const month = labelsFor(lang).months[date.getMonth()]!;
  const year = date.getFullYear();
  if (lang === 'fr') {
    const d = `${day === 1 ? '1er' : day} ${month} ${year}`;
    return city ? `${city}, le ${d}` : `Le ${d}`;
  }
  return variant === 'en-US' ? `${month} ${day}, ${year}` : `${day} ${month} ${year}`;
}

const VOWEL = /^[aeiouyàâäéèêëîïôöùûüÿæœ]/iu;

/** Lowercase initial of a job title, except for an acronym (« DSI adjoint », « RA/QA manager »). */
function lowerInitial(title: string): string {
  const first = title.split(/[\s/-]/)[0] ?? '';
  if (first.length > 1 && first === first.toLocaleUpperCase('fr') && /\p{L}/u.test(first)) return title;
  if (title.length > 1 && title[1] === title[1]!.toLocaleUpperCase('fr') && /\p{Lu}/u.test(title[1]!)) return title;
  return title.charAt(0).toLocaleLowerCase('fr') + title.slice(1);
}

/**
 * Subject (F-LET-02). FR « Objet : Candidature au poste d'ingénieur logiciel dispositifs médicaux –
 * Réf. ACME-1234 »: « de » elided before a vowel, lowercase initial, gender markers removed (annex
 * B.4). EN (ADR 0016): « Application for the position of … – Ref. … », without a label.
 */
export function letterSubject(
  jobTitle: string,
  reference: string | null,
  lang: Lang,
): { label: string | null; text: string } {
  const title = stripGenderMarkers(jobTitle);
  if (lang === 'fr') {
    const lower = lowerInitial(title);
    const of = VOWEL.test(lower) ? "d'" : 'de ';
    return { label: 'Objet :', text: `Candidature au poste ${of}${lower}${reference ? ` – Réf. ${reference}` : ''}` };
  }
  return { label: null, text: `Application for the position of ${title}${reference ? ` – Ref. ${reference}` : ''}` };
}

/** Enclosure line (F-LET-02). */
export const enclosureLine = (lang: Lang) => (lang === 'fr' ? 'P. J. : CV' : 'Enclosure: CV');

export interface LetterFormulas {
  salutation: string;
  closing: string;
}

/**
 * Salutation and closing formula, generated together (F-LET-05; ADR 0016 for the cases the spec does
 * not cover). FR: « Madame, », « Monsieur, » or « Madame, Monsieur, », never followed by the name; the
 * closing repeats it exactly. en-GB: « Dear Hiring Manager, » / « Dear Madam, » / « Dear Sir, » →
 * « Yours faithfully, »; a name → « Yours sincerely, ». en-US: always « Sincerely, ». `name` is written
 * as it must appear after the title (« Martin »); a name without civility is written in full.
 */
export function letterFormulas(r: LetterRecipient | null, lang: Lang, variant: EnVariant): LetterFormulas {
  const civility = r?.civility ?? null;
  const name = r?.name ?? null;
  if (lang === 'fr') {
    const appel = civility === 'madame' ? 'Madame' : civility === 'monsieur' ? 'Monsieur' : 'Madame, Monsieur';
    return {
      salutation: `${appel},`,
      closing: `Je vous prie d'agréer, ${appel}, l'expression de mes salutations distinguées.`,
    };
  }
  const us = variant === 'en-US';
  const title = civility === 'madame' ? (us ? 'Ms.' : 'Ms') : civility === 'monsieur' ? (us ? 'Mr.' : 'Mr') : null;
  if (us) {
    const salutation = name ? `Dear ${title ? `${title} ${name}` : name},` : 'Dear Hiring Manager,';
    return { salutation, closing: 'Sincerely,' };
  }
  if (name) return { salutation: `Dear ${title ? `${title} ${name}` : name},`, closing: 'Yours sincerely,' };
  const generic =
    civility === 'madame' ? 'Dear Madam,' : civility === 'monsieur' ? 'Dear Sir,' : 'Dear Hiring Manager,';
  return { salutation: generic, closing: 'Yours faithfully,' };
}

/**
 * Consistency of a salutation and a closing (F-LET-05): the FR closing repeats the salutation exactly;
 * en-GB « Yours faithfully » goes with an unnamed salutation, « Yours sincerely » with a name; en-US
 * closes with « Sincerely, ». Returns the problem, or null.
 */
export function checkFormulaPair(f: LetterFormulas, lang: Lang, variant: EnVariant): string | null {
  if (lang === 'fr') {
    const appel = f.salutation.replace(/,$/, '');
    return f.closing.includes(`, ${appel}, `)
      ? null
      : `formule finale « ${f.closing} » sans l'appel exact « ${appel} »`;
  }
  if (variant === 'en-US')
    return f.closing === 'Sincerely,' ? null : `en-US : « Sincerely, » attendu, pas « ${f.closing} »`;
  const unnamed = /^Dear (Hiring Manager|Madam|Sir),$/.test(f.salutation);
  const expected = unnamed ? 'Yours faithfully,' : 'Yours sincerely,';
  return f.closing === expected ? null : `en-GB : « ${f.salutation} » appelle « ${expected} », pas « ${f.closing} »`;
}

// ---------------------------------------------------------------------------------------------------
// Projection.

export interface LetterProjection {
  version: 1;
  kind: 'letter';
  /** Template file (`lettre.typ`): the single letter template (F-MOD-05). */
  layout: 'lettre';
  lang: Lang;
  enVariant: EnVariant;
  paper: 'a4' | 'us-letter';
  measure: boolean;
  meta: { title: string; author: string };
  theme: ProjectionTheme;
  sender: { name: string; lines: string[] };
  /** FR: recipient and date aligned right (French usage); EN: left (ADR 0016). */
  recipient: { lines: string[]; right: boolean };
  date: { text: string; right: boolean };
  subject: { label: string | null; text: Rich };
  space: string;
  salutation: string;
  paragraphs: Array<{ role: string; text: Rich }>;
  closing: string;
  signature: string;
  enclosure: string;
  expected: ExpectedField[];
  warnings: ProjectionIssue[];
  blocking: ProjectionIssue[];
}

export interface LetterContext {
  version: Pick<LetterVersionFile, 'version' | 'recipient' | 'paragraphs'>;
  lang: Lang;
  enVariant: EnVariant;
  application: { company: string; jobTitle: string; offerReference: string | null };
  identity: Identity | null;
  /** Theme of the application (font, accent, density): the letter follows the CV (F-MOD-05). */
  template: Template;
  /** Terms kept on one line (skills of the library), as in the CV. */
  protectedTerms: string[];
  /** Day of the rendering (ADR 0016). */
  date: Date;
}

export function projectLetter(ctx: LetterContext): LetterProjection {
  const { lang, enVariant, identity } = ctx;
  const blocking: ProjectionIssue[] = [];
  const warnings: ProjectionIssue[] = [];
  const expected: ExpectedField[] = [];
  const expect = (path: string, s: string | null) => {
    if (s && s.trim()) expected.push({ path, text: s });
  };
  const rich = (s: string): Rich => segmentText(s, ctx.protectedTerms);

  if (!identity) {
    blocking.push({
      code: 'IDENTITY_MISSING',
      message: 'identité absente : renseignez le profil (nom, e-mail, téléphone, ville et pays) : il signe la lettre',
    });
  }
  const name = identity ? `${identity.firstName} ${identity.lastName}` : '';
  const country = identity ? (identity.location.country[lang] ?? identity.location.country.fr ?? '') : '';
  const senderLines = identity
    ? [identity.phone, identity.email, country ? `${identity.location.city}, ${country}` : identity.location.city]
    : [];
  expect('sender.name', name);
  senderLines.forEach((l, i) => expect(`sender.lines[${i}]`, l));

  const r = ctx.version.recipient;
  const recipientLines: string[] = [];
  if (r?.name) {
    const us = enVariant === 'en-US';
    const word =
      r.civility === 'madame'
        ? lang === 'fr'
          ? 'Madame'
          : us
            ? 'Ms.'
            : 'Ms'
        : r.civility === 'monsieur'
          ? lang === 'fr'
            ? 'Monsieur'
            : us
              ? 'Mr.'
              : 'Mr'
          : null;
    recipientLines.push(word ? `${word} ${r.name}` : r.name);
  }
  if (r?.function) recipientLines.push(r.function);
  recipientLines.push(r?.company ?? ctx.application.company);
  if (r?.city) recipientLines.push(r.city);
  recipientLines.forEach((l, i) => expect(`recipient.lines[${i}]`, l));

  const dateText = formatLetterDate(ctx.date, lang, enVariant, identity?.location.city ?? null);
  expect('date', dateText);
  const subject = letterSubject(ctx.application.jobTitle, ctx.application.offerReference, lang);
  expect('subject', subject.label ? `${subject.label} ${subject.text}` : subject.text);

  const formulas = letterFormulas(r, lang, enVariant);
  const mismatch = checkFormulaPair(formulas, lang, enVariant);
  if (mismatch) warnings.push({ code: 'FORMULA_MISMATCH', message: mismatch });
  expect('salutation', formulas.salutation);
  ctx.version.paragraphs.forEach((p, i) => expect(`paragraphs[${i}]`, p.text));
  expect('closing', formulas.closing);
  expect('signature', name);
  const enclosure = enclosureLine(lang);
  expect('enclosure', enclosure);

  return {
    version: 1,
    kind: 'letter',
    layout: 'lettre',
    lang,
    enVariant,
    paper: lang === 'en' && enVariant === 'en-US' ? 'us-letter' : 'a4',
    measure: false,
    meta: { title: letterDocumentTitle(name, ctx.application.company, lang), author: name },
    theme: projectionTheme(ctx.template),
    sender: { name, lines: senderLines },
    recipient: { lines: recipientLines, right: lang === 'fr' },
    date: { text: dateText, right: lang === 'fr' },
    subject: { label: subject.label, text: rich(subject.text) },
    space: ' ',
    salutation: formulas.salutation,
    paragraphs: ctx.version.paragraphs.map((p) => ({ role: p.role, text: rich(p.text) })),
    closing: formulas.closing,
    signature: name,
    enclosure,
    expected,
    warnings,
    blocking,
  };
}
