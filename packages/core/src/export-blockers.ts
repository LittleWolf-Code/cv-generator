// Reasons why an export is refused (F-EXP-03): more than one page, a red criterion, a projected field
// not translated, a language without a CEFR level. Each reason has an explicit, actionable message and
// the fix the interface offers (F-UI-06): the element to open in the editor, the identity, the compact
// density or the ATS view. Pure and Zod-free: the interface imports it through `@cv/core/export`.
import type { AtsCriterion, AtsReport } from './ats-report.js';
import type { ProjectionIssue } from './projection.js';
import type { Density } from './schema/preset.js';

export type BlockerFix =
  | { kind: 'open'; collection: string; itemId: string; bulletId?: string }
  | { kind: 'identity' }
  | { kind: 'density' }
  | { kind: 'ats-view' };

/** One field of a list (untranslated fields, spelling): what it is and how to open it. */
export interface BlockerField {
  /** Readable field name (« texte de la puce », « intitulé », « pays »…). */
  field: string;
  fix: BlockerFix | null;
  /** Detail shown after the link (spelling: « organisation » → « organization »). */
  detail?: string;
}

export interface ExportBlocker {
  /** Criterion id (`T-ATS-01`…, `T-DOCX-01`…) or projection issue code (`UNTRANSLATED`…). */
  code: string;
  message: string;
  fix: BlockerFix | null;
  /** Every field concerned, each with its link (§5.4: all the untranslated fields, ADR 0015). */
  fields?: BlockerField[];
}

const FIELD_LABEL: Record<string, string> = {
  text: 'texte',
  position: 'intitulé',
  'location.country': 'pays',
  degree: 'diplôme',
  field: 'spécialité',
  honors: 'mention',
  levelEquivalent: 'équivalence de niveau',
  name: 'nom',
  role: 'rôle',
  long: 'forme longue',
  language: 'langue',
  detail: 'précision',
  label: 'libellé',
  drivingLicense: 'permis',
  workAuthorization: 'autorisation de travail',
};

/** Readable name of the field an issue targets. */
export function fieldLabel(target: NonNullable<ProjectionIssue['target']>): string {
  const base = FIELD_LABEL[target.field] ?? target.field;
  if (target.bulletId) {
    const what = target.field === 'text' ? 'puce' : `puce, ${base}`;
    return `${what}${target.variantId ? ` (variante ${target.variantId})` : ''}`;
  }
  if (target.variantId) return `${base} (variante ${target.variantId})`;
  return base;
}

const fieldOf = (issue: ProjectionIssue): BlockerField => ({
  field: issue.target ? fieldLabel(issue.target) : issue.message,
  fix: fixOfIssue(issue),
});

const COLLECTION_OF_SECTION: Record<string, string> = {
  experience: 'experiences',
  education: 'education',
  projects: 'projects',
};
const ENTRY_FIELDS = new Set(['title', 'dates', 'subtitle']);

/** Element named by an expected-field path (`experience.exp-x.b-y`, `header.contacts[0]`…), if any. */
export function fixOfPath(path: string): BlockerFix | null {
  if (path.startsWith('header.name') || path.startsWith('header.contacts')) return { kind: 'identity' };
  const [section, itemId, rest] = path.split('.');
  const collection = section ? COLLECTION_OF_SECTION[section] : undefined;
  if (!collection || !itemId) return null;
  return rest && !ENTRY_FIELDS.has(rest)
    ? { kind: 'open', collection, itemId, bulletId: rest }
    : { kind: 'open', collection, itemId };
}

function fixOfIssue(issue: ProjectionIssue): BlockerFix | null {
  const t = issue.target;
  if (!t) return issue.code === 'IDENTITY_MISSING' ? { kind: 'identity' } : null;
  if (t.collection === 'profile') return { kind: 'identity' };
  return t.bulletId
    ? { kind: 'open', collection: t.collection, itemId: t.itemId, bulletId: t.bulletId }
    : { kind: 'open', collection: t.collection, itemId: t.itemId };
}

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase('fr') + s.slice(1);

/** What the user can do about a red criterion, appended to its message. */
const ACTION: Record<string, string> = {
  'T-ATS-02': 'comparez le texte extrait et les textes attendus dans la vue ATS',
  'T-ATS-03': 'repérez les mots collés ou coupés dans la vue ATS',
  'T-ATS-04': 'corrigez le texte en cause dans la bibliothèque (voir la vue ATS)',
  'T-ATS-05': 'voir la vue ATS',
  'T-ATS-06': 'voir les champs détectés dans la vue ATS',
  'T-ATS-07': 'voir les champs détectés dans la vue ATS',
  'T-ATS-08': "complétez l'identité (e-mail, téléphone, ville et pays)",
  'T-ATS-13': "attendez la mise à jour de l'aperçu, puis exportez à nouveau",
  'T-DOCX-01': 'voir le détail dans la vue ATS',
  'T-DOCX-02': 'voir le détail dans la vue ATS',
};
const TECHNICAL = 'défaut du rendu, pas de votre contenu : voir le détail dans la vue ATS';

function criterionBlocker(c: AtsCriterion, density: Density): ExportBlocker {
  if (c.id === 'T-ATS-01') {
    // The message of T-ATS-01 already says what to do (it accounts for the density, ADR 0011).
    return { code: c.id, message: c.message, fix: density === 'normale' ? { kind: 'density' } : null };
  }
  let fix: BlockerFix | null = { kind: 'ats-view' };
  if (c.id === 'T-ATS-08') fix = { kind: 'identity' };
  if (c.id === 'T-ATS-13') fix = null;
  if (c.id === 'T-ATS-02') {
    const missing = (c.details?.missing as Array<{ path: string }> | undefined) ?? [];
    fix = (missing[0] && fixOfPath(missing[0].path)) ?? fix;
  }
  return { code: c.id, message: `${c.message} : ${ACTION[c.id] ?? TECHNICAL}`, fix };
}

/**
 * Every reason why the export is refused, the overflow first. Empty when the export is possible.
 * `extra` adds criteria computed at export time (T-ATS-13, T-DOCX-01 to 03).
 */
export function exportBlockers(
  report: Pick<AtsReport, 'criteria' | 'projection' | 'lang'>,
  density: Density,
  extra: readonly AtsCriterion[] = [],
): ExportBlocker[] {
  const red = [...report.criteria, ...extra].filter((c) => c.status === 'red');
  const out: ExportBlocker[] = [];
  const pages = red.find((c) => c.id === 'T-ATS-01');
  if (pages) out.push(criterionBlocker(pages, density));

  const issues = report.projection.blocking;
  const untranslated = issues.filter((b) => b.code === 'UNTRANSLATED');
  if (untranslated.length > 0) {
    const n = untranslated.length;
    const language = report.lang.startsWith('en') ? 'en anglais' : 'en français';
    out.push({
      code: 'UNTRANSLATED',
      message: `${n} champ${n > 1 ? 's' : ''} affiché${n > 1 ? 's' : ''} non traduit${n > 1 ? 's' : ''} ${language} : traduisez-${n > 1 ? 'les' : 'le'} dans la bibliothèque (ou acceptez les traductions proposées), ou changez la langue du CV`,
      fix: fixOfIssue(untranslated[0]!),
      fields: untranslated.map(fieldOf),
    });
  }
  for (const issue of issues) {
    if (issue.code === 'UNTRANSLATED') continue;
    const message =
      issue.code === 'LANGUAGE_LEVEL_MISSING'
        ? `${capitalize(issue.message)} : choisissez un niveau de A1 à C2, ou « langue maternelle »`
        : capitalize(issue.message);
    out.push({ code: issue.code, message, fix: fixOfIssue(issue) });
  }
  for (const c of red) if (c.id !== 'T-ATS-01') out.push(criterionBlocker(c, density));

  const seen = new Set<string>();
  return out.filter((b) => {
    const key = `${b.code}|${b.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Non-blocking remarks of the projection shown under the export state (ADR 0015): spelling of the
 * English variant (§5.4), each field with its link. Other warnings keep their own display.
 */
export function exportWarnings(report: Pick<AtsReport, 'projection'>): ExportBlocker[] {
  const spelling = report.projection.warnings.filter((w) => w.code === 'SPELLING_VARIANT');
  if (spelling.length === 0) return [];
  const n = spelling.length;
  const variant = /orthographe (en-GB|en-US)/.exec(spelling[0]!.message)?.[1] ?? '';
  return [
    {
      code: 'SPELLING_VARIANT',
      message: `Orthographe ${variant} à vérifier dans ${n} champ${n > 1 ? 's' : ''} (avertissement, l'export reste possible)`,
      fix: fixOfIssue(spelling[0]!),
      fields: spelling.map((w) => ({ ...fieldOf(w), detail: w.message.replace(/^orthographe (en-GB|en-US) : /, '') })),
    },
  ];
}
