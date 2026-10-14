// Spelling controlled by the English variant (§5.4): en-GB « licence, organisation », en-US « license,
// organization ». A word list written for the project (ADR 0015), limited to words a CV uses; a
// warning, never a refusal: the library holds one English text for both variants, and the user decides.
// Pure and Zod-free.
import type { EnVariant } from '../schema/common.js';

/** `both`: each variant flags the other's form; `us`: only en-US flags the British form (the US form is also correct in British English). */
type Direction = 'both' | 'us';

const PAIRS: Array<[gb: string, us: string, dir: Direction]> = [];
const pair = (gb: string, us: string, dir: Direction = 'both') => PAIRS.push([gb, us, dir]);

// -ise / -ize (en-GB follows the spec: organisation). Only stems whose -ise form is not also American.
const IZE_STEMS = [
  'organi',
  'optimi',
  'standardi',
  'prioriti',
  'customi',
  'minimi',
  'maximi',
  'utili',
  'reali',
  'recogni',
  'speciali',
  'summari',
  'visuali',
  'moderni',
  'centrali',
  'decentrali',
  'digitali',
  'industriali',
  'characteri',
  'harmoni',
  'authori',
  'finali',
  'initiali',
  'normali',
  'seriali',
  'deseriali',
  'synchroni',
  'virtuali',
  'containeri',
  'categori',
  'capitali',
  'commerciali',
  'conceptuali',
  'critici',
  'emphasi',
  'familiari',
  'formali',
  'generali',
  'globali',
  'internationali',
  'locali',
  'mobili',
  'operationali',
  'personali',
  'parameteri',
  'rationali',
  'stabili',
  'sterili',
  'symboli',
  'tokeni',
  'vectori',
  'memori',
  'saniti',
  'anonymi',
  'pseudonymi',
  'computeri',
  'mechani',
  'modulari',
  'neutrali',
  'economi',
  'hospitali',
  'immuni',
  'moneti',
];
const IZE_SUFFIXES: Array<[gb: string, us: string]> = [
  ['se', 'ze'],
  ['sed', 'zed'],
  ['ses', 'zes'],
  ['sing', 'zing'],
  ['sation', 'zation'],
  ['sations', 'zations'],
  ['ser', 'zer'],
  ['sers', 'zers'],
];
for (const stem of IZE_STEMS) for (const [gb, us] of IZE_SUFFIXES) pair(stem + gb, stem + us);

// -yse / -yze (never « analyses », also the plural of « analysis »).
for (const stem of ['analy', 'cataly', 'paraly']) {
  for (const [gb, us] of [
    ['se', 'ze'],
    ['sed', 'zed'],
    ['sing', 'zing'],
    ['ser', 'zer'],
    ['sers', 'zers'],
  ] as const) {
    pair(stem + gb, stem + us);
  }
}

// -our / -or.
for (const stem of [
  'behavio',
  'colo',
  'favo',
  'hono',
  'labo',
  'neighbo',
  'humo',
  'rumo',
  'endeavo',
  'flavo',
  'harbo',
  'vapo',
  'tumo',
  'odo',
  'vigo',
  'armo',
]) {
  for (const [gb, us] of [
    ['ur', 'r'],
    ['urs', 'rs'],
    ['ured', 'red'],
    ['uring', 'ring'],
    ['ural', 'ral'],
    ['urite', 'rite'],
    ['urites', 'rites'],
    ['urable', 'rable'],
    ['urful', 'rful'],
  ] as const) {
    pair(stem + gb, stem + us);
  }
}

// -re / -er: the American form is also British for devices (« flow meter »): flagged in en-US only.
for (const [gb, us] of [
  ['centre', 'center'],
  ['centres', 'centers'],
  ['centred', 'centered'],
  ['metre', 'meter'],
  ['metres', 'meters'],
  ['millimetre', 'millimeter'],
  ['millimetres', 'millimeters'],
  ['centimetre', 'centimeter'],
  ['centimetres', 'centimeters'],
  ['kilometre', 'kilometer'],
  ['kilometres', 'kilometers'],
  ['litre', 'liter'],
  ['litres', 'liters'],
  ['fibre', 'fiber'],
  ['fibres', 'fibers'],
  ['calibre', 'caliber'],
  ['theatre', 'theater'],
] as const) {
  pair(gb, us, gb.startsWith('centr') ? 'both' : 'us');
}

// -ce / -se.
pair('licence', 'license');
pair('licences', 'licenses');
pair('defence', 'defense');
pair('offence', 'offense');
pair('practise', 'practice', 'us');
pair('practised', 'practiced', 'us');
pair('practising', 'practicing', 'us');

// -ll- / -l-.
for (const [gb, us] of [
  ['modelling', 'modeling'],
  ['modelled', 'modeled'],
  ['labelling', 'labeling'],
  ['labelled', 'labeled'],
  ['travelling', 'traveling'],
  ['travelled', 'traveled'],
  ['cancelled', 'canceled'],
  ['cancelling', 'canceling'],
  ['signalling', 'signaling'],
  ['levelling', 'leveling'],
  ['fuelled', 'fueled'],
  ['counsellor', 'counselor'],
  ['fulfil', 'fulfill'],
  ['fulfils', 'fulfills'],
  ['fulfilment', 'fulfillment'],
  ['enrol', 'enroll'],
  ['enrols', 'enrolls'],
  ['enrolment', 'enrollment'],
  ['instil', 'instill'],
  ['skilful', 'skillful'],
] as const) {
  pair(gb, us);
}

// Programme: British English also writes « program » for software: flagged in en-US only.
pair('programme', 'program', 'us');
pair('programmes', 'programs', 'us');
pair('catalogue', 'catalog', 'us');
pair('catalogues', 'catalogs', 'us');
pair('analogue', 'analog', 'us');

// ae / oe (medical vocabulary).
for (const [gb, us] of [
  ['paediatric', 'pediatric'],
  ['paediatrics', 'pediatrics'],
  ['anaemia', 'anemia'],
  ['anaesthesia', 'anesthesia'],
  ['anaesthetic', 'anesthetic'],
  ['haemoglobin', 'hemoglobin'],
  ['haemorrhage', 'hemorrhage'],
  ['haematology', 'hematology'],
  ['haemodialysis', 'hemodialysis'],
  ['oesophagus', 'esophagus'],
  ['oedema', 'edema'],
  ['orthopaedic', 'orthopedic'],
  ['orthopaedics', 'orthopedics'],
  ['gynaecology', 'gynecology'],
  ['leukaemia', 'leukemia'],
  ['diarrhoea', 'diarrhea'],
  ['oestrogen', 'estrogen'],
  ['caesarean', 'cesarean'],
  ['aetiology', 'etiology'],
] as const) {
  pair(gb, us);
}

// Miscellaneous.
pair('grey', 'gray');
pair('aluminium', 'aluminum');
pair('manoeuvre', 'maneuver');
pair('mould', 'mold');
pair('sceptical', 'skeptical');

/** Form to flag → form expected, per variant. */
const FLAGS: Record<EnVariant, Map<string, string>> = { 'en-GB': new Map(), 'en-US': new Map() };
for (const [gb, us, dir] of PAIRS) {
  FLAGS['en-US'].set(gb, us);
  if (dir === 'both') FLAGS['en-GB'].set(us, gb);
}
// « license » is also the British verb: still flagged (the noun is the common case on a CV), with a note.
const NOTES: Partial<Record<EnVariant, Record<string, string>>> = {
  'en-GB': { license: "licence (nom ; le verbe s'écrit license)", licenses: 'licences (nom)' },
};

export interface SpellingIssue {
  word: string;
  expected: string;
}

const matchCase = (model: string, word: string) =>
  model === model.toUpperCase() && model.length > 1
    ? word.toUpperCase()
    : model[0] === model[0]!.toUpperCase()
      ? word[0]!.toUpperCase() + word.slice(1)
      : word;

/** Words of an English text that do not follow the spelling of `variant` (§5.4), each with the expected form. */
export function spellingIssues(text: string, variant: EnVariant): SpellingIssue[] {
  const out: SpellingIssue[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(/\p{L}+/gu)) {
    const word = m[0];
    const lower = word.toLowerCase();
    const expected = NOTES[variant]?.[lower] ?? FLAGS[variant].get(lower);
    if (!expected || seen.has(lower)) continue;
    seen.add(lower);
    out.push({ word, expected: NOTES[variant]?.[lower] ? expected : matchCase(word, expected) });
  }
  return out;
}

/** Number of word pairs in the list (documentation and tests). */
export const SPELLING_PAIR_COUNT = PAIRS.length;
