// Every visible label of a CV comes from here through the projection: templates contain no text
// (§8.5). Headings are fixed in ATS layouts (§5.3).
import type { EnVariant, Lang } from './schema/common.js';
import type { CefrLevel, ContractType } from './schema/library.js';
import type { SectionKey } from './schema/preset.js';
import type { LinkKind } from './schema/profile.js';

export const HEADINGS: Record<Exclude<SectionKey, 'summary'>, Record<Lang, string>> = {
  experience: { fr: 'Expérience professionnelle', en: 'Professional Experience' },
  education: { fr: 'Formation', en: 'Education' },
  skills: { fr: 'Compétences', en: 'Skills' },
  regulatory: { fr: 'Normes et réglementation', en: 'Standards & Regulatory' },
  projects: { fr: 'Projets', en: 'Projects' },
  certifications: { fr: 'Certifications', en: 'Certifications' },
  languages: { fr: 'Langues', en: 'Languages' },
  interests: { fr: "Centres d'intérêt", en: 'Interests' },
};

export interface Labels {
  email: string;
  phone: string;
  present: string;
  /** Between a label and its value: French typography puts a space before the colon. */
  labelSep: string;
  listSep: string;
  pipeSep: string;
  rangeSep: string;
  open: string;
  close: string;
  space: string;
  native: string;
  referencesNote: string;
  /** Alternative text of the photo, before the full name (PDF tags, PDF/UA; never visible). */
  photoOf: string;
  months: readonly string[];
  contract: Record<ContractType, string | null>;
  /** Name of a link without a name of its own (`name` style, alternative text of the icon; ADR 0025). */
  linkNames: Record<LinkKind, string>;
}

const FR: Labels = {
  email: 'E-mail :',
  phone: 'Tél. :',
  present: "aujourd'hui",
  labelSep: ' : ',
  listSep: ', ',
  pipeSep: ' | ',
  rangeSep: ' – ',
  open: ' (',
  close: ')',
  space: ' ',
  native: 'langue maternelle',
  referencesNote: 'Références disponibles sur demande',
  photoOf: 'Photo de',
  months: [
    'janvier',
    'février',
    'mars',
    'avril',
    'mai',
    'juin',
    'juillet',
    'août',
    'septembre',
    'octobre',
    'novembre',
    'décembre',
  ],
  contract: {
    cdi: null,
    cdd: 'CDD',
    stage: 'stage',
    alternance: 'alternance',
    freelance: 'freelance',
    interim: 'intérim',
    these: 'thèse',
  },
  linkNames: { linkedin: 'LinkedIn', github: 'GitHub', portfolio: 'Portfolio', other: 'Site web' },
};

const EN: Labels = {
  email: 'Email:',
  phone: 'Phone:',
  present: 'Present',
  labelSep: ': ',
  listSep: ', ',
  pipeSep: ' | ',
  rangeSep: ' – ',
  open: ' (',
  close: ')',
  space: ' ',
  native: 'native',
  referencesNote: 'References available on request',
  photoOf: 'Photo of',
  months: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
  contract: {
    cdi: null,
    cdd: 'fixed-term',
    stage: 'internship',
    alternance: 'work-study',
    freelance: 'freelance',
    interim: 'temporary',
    these: 'PhD',
  },
  linkNames: { linkedin: 'LinkedIn', github: 'GitHub', portfolio: 'Portfolio', other: 'Website' },
};

/**
 * Driving licence line of an en-US CV (§5.4): generated, whatever the English text entered (which
 * follows en-GB: « Full driving licence (category B) »). « Class B » is a heavy-truck licence there.
 */
export const US_DRIVING_LICENSE = "Driver's license";

export function labelsFor(lang: Lang, _variant: EnVariant = 'en-GB'): Labels {
  return lang === 'fr' ? FR : EN;
}

export function cefrText(level: CefrLevel, lang: Lang): string {
  return level === 'native' ? labelsFor(lang).native : level;
}
