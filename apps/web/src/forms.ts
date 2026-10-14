// Form descriptors of each collection (F-LIB-05). The server validates with the shared Zod schema and
// sanitizes (annex B.1); the form only shapes the values (empty → null for optional fields).
import type { AnyItem, CollectionName } from './api';

export type FieldSpec =
  | { kind: 'text'; key: string; label: string; required?: boolean; hint?: string }
  | { kind: 'bilingual'; key: string; label: string; nullable?: boolean; multiline?: boolean; hint?: string }
  | { kind: 'date'; key: string; label: string; required?: boolean; ongoing?: string }
  | {
      kind: 'select';
      key: string;
      label: string;
      options: Array<{ value: string; label: string }>;
      nullLabel?: string;
    }
  | { kind: 'checkbox'; key: string; label: string; hint?: string }
  | { kind: 'list'; key: string; label: string; hint?: string }
  | { kind: 'tags'; key: string; label: string }
  | { kind: 'skills'; key: string; label: string }
  | { kind: 'category'; key: string; label: string }
  | { kind: 'location'; key: string; label: string }
  | { kind: 'link'; key: string; label: string }
  | { kind: 'links'; key: string; label: string; hint?: string; noun: string }
  | { kind: 'variants'; key: string; label: string }
  | { kind: 'bullets'; key: string; label: string }
  | { kind: 'languageCertification'; key: string; label: string };

export interface FormSpec {
  /** Singular label ("une expérience"). */
  noun: string;
  fields: FieldSpec[];
  empty: (defaults: Record<string, unknown>) => AnyItem;
}

const flags = { tags: [], locked: false, archived: false };
const bi = () => ({ fr: null, en: null });
const newVariant = () => ({ id: 'principale', label: null, text: bi() });

const tagsField: FieldSpec = { kind: 'tags', key: 'tags', label: 'Tags' };
const lockedField: FieldSpec = {
  kind: 'checkbox',
  key: 'locked',
  label: 'Verrouillé',
  hint: 'jamais décoché par une présélection automatique (F-SEL-10)',
};
const skillsField: FieldSpec = { kind: 'skills', key: 'skills', label: 'Compétences liées' };

export const CONTRACTS = [
  { value: 'cdi', label: 'CDI' },
  { value: 'cdd', label: 'CDD' },
  { value: 'stage', label: 'Stage' },
  { value: 'alternance', label: 'Alternance' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'interim', label: 'Intérim' },
  { value: 'these', label: 'Thèse' },
];

export const CEFR = [
  { value: 'A1', label: 'A1' },
  { value: 'A2', label: 'A2' },
  { value: 'B1', label: 'B1' },
  { value: 'B2', label: 'B2' },
  { value: 'C1', label: 'C1' },
  { value: 'C2', label: 'C2' },
  { value: 'native', label: 'Langue maternelle' },
];

export const FORMS: Record<CollectionName, FormSpec> = {
  titles: {
    noun: 'un titre',
    fields: [{ kind: 'variants', key: 'variants', label: 'Variantes du titre' }, tagsField, lockedField],
    empty: () => ({ ...flags, variants: [newVariant()] }),
  },
  summaries: {
    noun: 'une accroche',
    fields: [{ kind: 'variants', key: 'variants', label: "Variantes de l'accroche" }, tagsField, lockedField],
    empty: () => ({ ...flags, variants: [newVariant()] }),
  },
  experiences: {
    noun: 'une expérience',
    fields: [
      { kind: 'bilingual', key: 'position', label: 'Intitulé du poste', hint: 'en entier, sans abréviation (ATS-22)' },
      { kind: 'text', key: 'organization', label: 'Organisation', required: true, hint: 'nom complet (ATS-22)' },
      { kind: 'location', key: 'location', label: 'Lieu' },
      { kind: 'select', key: 'contract', label: 'Contrat', options: CONTRACTS, nullLabel: 'non précisé' },
      { kind: 'date', key: 'start', label: 'Début', required: true },
      { kind: 'date', key: 'end', label: 'Fin', ongoing: 'en cours' },
      skillsField,
      { kind: 'bullets', key: 'bullets', label: 'Puces' },
      tagsField,
      lockedField,
    ],
    empty: () => ({
      ...flags,
      position: bi(),
      organization: '',
      location: null,
      contract: null,
      start: '',
      end: null,
      skills: [],
      bullets: [],
    }),
  },
  education: {
    noun: 'une formation',
    fields: [
      { kind: 'bilingual', key: 'degree', label: 'Diplôme' },
      { kind: 'bilingual', key: 'field', label: 'Spécialité', nullable: true },
      { kind: 'text', key: 'institution', label: 'Établissement', required: true, hint: 'nom complet (ATS-22)' },
      { kind: 'location', key: 'location', label: 'Lieu' },
      { kind: 'date', key: 'start', label: 'Début' },
      { kind: 'date', key: 'end', label: 'Fin' },
      { kind: 'bilingual', key: 'honors', label: 'Mention', nullable: true },
      {
        kind: 'bilingual',
        key: 'levelEquivalent',
        label: 'Équivalence de niveau',
        nullable: true,
        hint: "FR : « Bac+5, grade de master » ; EN : « Master's degree in Engineering, EQF level 7 »",
      },
      skillsField,
      { kind: 'bullets', key: 'bullets', label: 'Puces' },
      tagsField,
      lockedField,
    ],
    empty: () => ({
      ...flags,
      degree: bi(),
      field: null,
      institution: '',
      location: null,
      start: null,
      end: null,
      honors: null,
      levelEquivalent: null,
      skills: [],
      bullets: [],
    }),
  },
  projects: {
    noun: 'un projet',
    fields: [
      { kind: 'bilingual', key: 'name', label: 'Nom du projet' },
      { kind: 'bilingual', key: 'role', label: 'Rôle', nullable: true },
      { kind: 'text', key: 'organization', label: 'Organisation' },
      { kind: 'link', key: 'url', label: 'Lien principal' },
      {
        kind: 'links',
        key: 'repos',
        label: 'Dépôts',
        hint: "GitHub ou autre ; chaque URL s'affiche en clair après le lien principal (ATS-10)",
        noun: 'dépôt',
      },
      { kind: 'date', key: 'start', label: 'Début' },
      { kind: 'date', key: 'end', label: 'Fin' },
      skillsField,
      { kind: 'bullets', key: 'bullets', label: 'Puces' },
      tagsField,
      lockedField,
    ],
    empty: () => ({
      ...flags,
      name: bi(),
      role: null,
      organization: null,
      url: null,
      repos: [],
      start: null,
      end: null,
      skills: [],
      bullets: [],
    }),
  },
  skills: {
    noun: 'une compétence',
    fields: [
      { kind: 'text', key: 'short', label: 'Sigle ou nom', required: true, hint: 'rendu tel quel, sans coupure' },
      { kind: 'category', key: 'category', label: 'Catégorie' },
      {
        kind: 'bilingual',
        key: 'long',
        label: 'Forme longue',
        nullable: true,
        hint: 'seulement si le nom court est un sigle (ATS-18)',
      },
      { kind: 'text', key: 'code', label: 'Code de norme', hint: 'normes seulement : « IEC 62304 »' },
      { kind: 'text', key: 'edition', label: 'Édition', hint: 'vérifiée par la table A.2 : « 2006+AMD1:2015 »' },
      {
        kind: 'list',
        key: 'aliases',
        label: 'Alias (équivalents stricts)',
        hint: 'un par ligne ; ils comptent pour la couverture',
      },
      {
        kind: 'list',
        key: 'related',
        label: 'Termes voisins',
        hint: 'un par ligne ; suggestions seulement, ils ne couvrent jamais un terme',
      },
      { kind: 'checkbox', key: 'ambiguous', label: 'Sigle ambigu', hint: 'MDR, DM, CE, C, R, Go…' },
      tagsField,
      lockedField,
    ],
    empty: (d) => ({
      ...flags,
      category: (d.category as string | null) ?? '',
      short: '',
      long: null,
      code: null,
      edition: null,
      aliases: [],
      related: [],
      ambiguous: false,
    }),
  },
  certifications: {
    noun: 'une certification',
    fields: [
      { kind: 'bilingual', key: 'name', label: 'Intitulé' },
      { kind: 'text', key: 'issuer', label: 'Organisme', required: true },
      { kind: 'date', key: 'date', label: 'Date' },
      { kind: 'link', key: 'url', label: 'Lien' },
      skillsField,
      tagsField,
      lockedField,
    ],
    empty: () => ({ ...flags, name: bi(), issuer: '', date: null, url: null, skills: [] }),
  },
  languages: {
    noun: 'une langue',
    fields: [
      { kind: 'bilingual', key: 'language', label: 'Langue' },
      { kind: 'text', key: 'code', label: 'Code ISO 639-1', required: true, hint: '« en », « de »…' },
      { kind: 'select', key: 'cefr', label: 'Niveau CECRL', options: CEFR, nullLabel: "à préciser (bloque l'export)" },
      { kind: 'languageCertification', key: 'certification', label: 'Certification' },
      tagsField,
      lockedField,
    ],
    empty: () => ({ ...flags, code: '', language: bi(), cefr: null, certification: null }),
  },
  interests: {
    noun: "un centre d'intérêt",
    fields: [
      { kind: 'bilingual', key: 'text', label: "Centre d'intérêt" },
      { kind: 'bilingual', key: 'detail', label: 'Précision', nullable: true },
      tagsField,
      lockedField,
    ],
    empty: () => ({ ...flags, text: bi(), detail: null }),
  },
  categories: {
    noun: 'une catégorie',
    fields: [{ kind: 'bilingual', key: 'label', label: 'Libellé' }],
    empty: () => ({ label: bi() }),
  },
};

/** Issues whose path starts with `prefix.` (or equals it), with the prefix removed. */
export function sub<T extends { path: string }>(issues: T[], prefix: string): T[] {
  return issues
    .filter((i) => i.path === prefix || i.path.startsWith(`${prefix}.`))
    .map((i) => ({ ...i, path: i.path === prefix ? '' : i.path.slice(prefix.length + 1) }));
}
