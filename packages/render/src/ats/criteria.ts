// ATS readability criteria of §12.3 (ats-classique column; `toVisualColumn` gives the « Visuel » one).
// Messages are in French and never quote the e-mail or the phone number (they may be returned to Claude).
import { canon, rangePattern, type AtsCriterion, type Density, type Projection } from '@cv/core';
import { detectContacts, detectEntries, detectHeadings, detectName, type Extraction } from './detect.js';
import type { PdfTextItem } from './extract.js';
import type { PdfInfo } from './pdfinfo.js';
import type { LintViolation } from './template-lint.js';

export type { Extraction } from './detect.js';

const crit = (
  id: string,
  label: string,
  status: AtsCriterion['status'],
  message: string,
  details?: Record<string, unknown>,
): AtsCriterion => (details ? { id, label, status, message, details } : { id, label, status, message });

const lines = (text: string) => text.split(/\r?\n/);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * T-ATS-01. The overflow message suggests the compact density only while it is not active (F-UI-06);
 * for a letter, it asks to shorten a paragraph (ADR 0016).
 */
export function checkPages(
  pages: number,
  overflowLines: number,
  fillRatio: number,
  density: Density = 'normale',
  doc: 'cv' | 'letter' = 'cv',
): AtsCriterion {
  if (pages === 1) {
    return crit('T-ATS-01', 'Pages', 'green', `1 page (remplissage ${Math.round(fillRatio * 100)} %)`, {
      pages,
      fillRatio,
    });
  }
  return crit(
    'T-ATS-01',
    'Pages',
    'red',
    `${doc === 'letter' ? 'La lettre' : 'Le CV'} dépasse d'environ ${overflowLines} ligne${overflowLines > 1 ? 's' : ''} (${pages} pages) : ${
      doc === 'letter'
        ? 'raccourcissez un paragraphe (nouvelle version)'
        : density === 'compacte'
          ? 'décochez une puce ou une entrée (la densité compacte est déjà active)'
          : 'décochez une puce ou passez en densité compacte'
    }`,
    { pages, overflowLines, fillRatio },
  );
}

/** T-ATS-02: every expected text found in each extraction (canon). */
export function checkTextsFound(p: Pick<Projection, 'expected'>, extractions: Extraction[]): AtsCriterion {
  const missing: Array<{ extractor: string; path: string }> = [];
  for (const ex of extractions) {
    const hay = canon(ex.text);
    for (const f of p.expected) if (!hay.includes(canon(f.text))) missing.push({ extractor: ex.name, path: f.path });
  }
  if (missing.length === 0) {
    return crit(
      'T-ATS-02',
      'Textes retrouvés',
      'green',
      `${p.expected.length} textes attendus retrouvés (${extractions.map((e) => e.name).join(', ')})`,
    );
  }
  return crit(
    'T-ATS-02',
    'Textes retrouvés',
    'red',
    `${missing.length} texte(s) attendu(s) absent(s) de l'extraction`,
    { missing },
  );
}

/** T-ATS-03: glued consecutive words, or words cut after "-", "–" or "/" at a line end. */
export function checkGluedWords(p: Pick<Projection, 'expected'>, extractions: Extraction[]): AtsCriterion {
  let pairs = 0;
  const glued: Array<{ extractor: string; pair: string }> = [];
  const broken: Array<{ extractor: string; word: string }> = [];
  const compound = new Set(p.expected.flatMap((f) => f.text.split(/\s+/)).filter((w) => /[^\s][-–/][^\s]/u.test(w)));
  for (const ex of extractions) {
    for (const f of p.expected) {
      const words = f.text.split(/\s+/).filter(Boolean);
      for (let i = 0; i + 1 < words.length; i++) {
        pairs++;
        const re = new RegExp(`${escapeRegExp(words[i]!)}\\s+${escapeRegExp(words[i + 1]!)}`, 'u');
        if (!re.test(ex.text)) glued.push({ extractor: ex.name, pair: `${words[i]} ${words[i + 1]}` });
      }
    }
    const ls = lines(ex.text);
    for (let i = 0; i + 1 < ls.length; i++) {
      const end = /(\S*[-–/])$/u.exec(ls[i]!.trimEnd());
      const start = /^(\S+)/u.exec(ls[i + 1]!.trimStart());
      if (end && start && compound.has(end[1]! + start[1]!))
        broken.push({ extractor: ex.name, word: end[1]! + start[1]! });
    }
  }
  const bad = glued.length + broken.length;
  const ratio = pairs ? bad / pairs : 0;
  if (bad === 0)
    return crit('T-ATS-03', 'Mots collés ou coupés', 'green', `${pairs} paires de mots vérifiées, aucune anomalie`);
  return crit(
    'T-ATS-03',
    'Mots collés ou coupés',
    ratio >= 0.01 ? 'red' : 'orange',
    `${bad} anomalie(s) sur ${pairs} paires (${(ratio * 100).toFixed(2)} %)`,
    { glued: glued.slice(0, 20), broken: broken.slice(0, 20) },
  );
}

// ATS-06 list, plus U+0000 and C0 controls: a glyph missing from the font is extracted as U+0000
// (ADR 0002). Control characters are matched on purpose.
/* eslint-disable no-control-regex */
const FORBIDDEN_CHARS =
  /[\uFB00-\uFB06\uE000-\uF8FF\uFFFD\u200B-\u200D\u2060\uFEFF\u00AD\u2010\u2011\u00A0\u202F\u0000-\u0008\u000B\u000E-\u001F]/gu;

/** T-ATS-04: forbidden characters in the raw extraction, without any normalization. */
export function checkForbiddenChars(extractions: Extraction[]): AtsCriterion {
  const found: Array<{ extractor: string; codePoint: string; context: string }> = [];
  for (const ex of extractions) {
    for (const m of ex.text.matchAll(FORBIDDEN_CHARS)) {
      const cp = `U+${m[0].codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`;
      found.push({
        extractor: ex.name,
        codePoint: cp,
        context: ex.text.slice(Math.max(0, m.index - 15), m.index + 15),
      });
    }
  }
  if (found.length === 0)
    return crit('T-ATS-04', 'Caractères interdits', 'green', 'Aucun caractère interdit dans le texte extrait brut');
  const codes = [...new Set(found.map((f) => f.codePoint))].join(', ');
  return crit('T-ATS-04', 'Caractères interdits', 'red', `${found.length} caractère(s) interdit(s) : ${codes}`, {
    found: found.slice(0, 20),
  });
}

const SPACED_LETTERS = /(?<![\p{L}\p{N}])(?:\p{L}[ \u00A0\u2000-\u200A\u202F]+){3,}\p{L}(?![\p{L}\p{N}])/u;

/** T-ATS-05: letter-spaced words. */
export function checkSpacedLetters(extractions: Extraction[]): AtsCriterion {
  for (const ex of extractions) {
    const m = SPACED_LETTERS.exec(ex.text);
    if (m) return crit('T-ATS-05', 'Lettres espacées', 'red', `Lettres espacées détectées (${ex.name}) : « ${m[0]} »`);
  }
  return crit('T-ATS-05', 'Lettres espacées', 'green', 'Aucune suite de lettres espacées');
}

/** T-ATS-06: first line = full name; heading lines reproduce projection.headings. */
export function checkOrder(p: Projection, extractions: Extraction[]): AtsCriterion {
  const problems: string[] = [];
  for (const ex of extractions) {
    if (p.identity && !detectName(p, ex.text).ok) {
      problems.push(`${ex.name} : la première ligne n'est pas « Prénom Nom »`);
    }
    const h = detectHeadings(p, ex.text);
    if (!h.ok) {
      problems.push(`${ex.name} : intitulés lus « ${h.found.join(' > ')} », attendus « ${p.headings.join(' > ')} »`);
    }
  }
  if (problems.length === 0)
    return crit('T-ATS-06', 'Ordre', 'green', `Nom en première ligne, ${p.headings.length} intitulés dans l'ordre`);
  return crit('T-ATS-06', 'Ordre', 'red', problems.join(' ; '), { problems });
}

/** T-ATS-07: each date range whole on one line (the title line or the next), one per entry, in the document style. */
export function checkDates(p: Projection, extractions: Extraction[]): AtsCriterion {
  const problems: string[] = [];
  const style = rangePattern(p.dateStyle, p.lang);
  for (const e of p.datedEntries) {
    if (!style.test(e.dates)) problems.push(`format de date inattendu pour ${e.id} : ${e.dates}`);
  }
  for (const ex of extractions) {
    for (const e of detectEntries(p, ex.text)) if (e.problem) problems.push(`${ex.name} : ${e.problem}`);
  }
  if (problems.length === 0) {
    return crit(
      'T-ATS-07',
      "Dates et ligne d'entrée",
      'green',
      `${p.datedEntries.length} plages de dates entières sur la ligne de leur intitulé`,
    );
  }
  return crit('T-ATS-07', "Dates et ligne d'entrée", 'red', problems.slice(0, 5).join(' ; '), { problems });
}

/** T-ATS-08: identity contacts before the first heading, each on one line; other contacts in orange. */
export function checkContacts(p: Projection, extractions: Extraction[]): AtsCriterion {
  if (!p.identity)
    return crit('T-ATS-08', 'Coordonnées', 'red', 'Identité absente : nom, e-mail, téléphone, ville et pays requis');
  const missing: string[] = [];
  const others = { emails: 0, phones: 0 };
  for (const ex of extractions) {
    const d = detectContacts(p, ex.text)!;
    if (!d.email) missing.push(`${ex.name} : e-mail`);
    if (!d.phone) missing.push(`${ex.name} : téléphone`);
    if (!d.location) missing.push(`${ex.name} : ville et pays`);
    others.emails = Math.max(others.emails, d.otherEmails);
    others.phones = Math.max(others.phones, d.otherPhones);
  }
  if (missing.length > 0) {
    return crit(
      'T-ATS-08',
      'Coordonnées',
      'red',
      `Non retrouvé(s) avant le premier intitulé, sur une seule ligne : ${missing.join(', ')}`,
      { missing },
    );
  }
  if (others.emails + others.phones > 0) {
    return crit(
      'T-ATS-08',
      'Coordonnées',
      'orange',
      `Coordonnées de l'identité retrouvées ; autres coordonnées détectées : ${others.emails} e-mail(s), ${others.phones} téléphone(s)`,
      others,
    );
  }
  return crit(
    'T-ATS-08',
    'Coordonnées',
    'green',
    'E-mail, téléphone, ville et pays retrouvés avant le premier intitulé, chacun sur une ligne',
  );
}

/** T-ATS-09: embedded fonts are exactly theme fonts, no Type 3, ToUnicode present. */
export function checkFonts(
  info: PdfInfo,
  expectedPostscript: readonly string[],
  pdffonts?: Array<{ name: string; emb: boolean; uni: boolean }> | null,
): AtsCriterion {
  const problems: string[] = [];
  if (info.fonts.length === 0) problems.push('aucune police embarquée');
  for (const f of info.fonts) {
    if (f.subtype === 'Type3') problems.push(`police Type 3 : ${f.baseFont}`);
    if (!expectedPostscript.includes(f.postscriptName)) problems.push(`police hors thème : ${f.postscriptName}`);
    if (!f.toUnicode) problems.push(`ToUnicode absent : ${f.postscriptName}`);
    if (!f.embedded) problems.push(`police non embarquée : ${f.postscriptName}`);
  }
  for (const row of pdffonts ?? []) {
    if (!row.emb || !row.uni) problems.push(`pdffonts : ${row.name} emb=${row.emb} uni=${row.uni}`);
  }
  const names = [...new Set(info.fonts.map((f) => f.postscriptName))];
  if (problems.length === 0) {
    return crit(
      'T-ATS-09',
      'Polices',
      'green',
      `Polices du thème uniquement : ${names.join(', ')}${pdffonts ? ' (confirmé par pdffonts)' : ''}`,
      { fonts: names },
    );
  }
  return crit('T-ATS-09', 'Polices', 'red', problems.join(' ; '), { fonts: names, problems });
}

/** T-ATS-10: every fragment >= 9 pt, body >= 10 pt. */
export function checkTextSize(items: PdfTextItem[]): AtsCriterion {
  const visible = items.filter((i) => i.str.trim());
  const min = Math.min(...visible.map((i) => i.size));
  const weight = new Map<number, number>();
  for (const i of visible) {
    const s = Math.round(i.size * 10) / 10;
    weight.set(s, (weight.get(s) ?? 0) + i.str.length);
  }
  const body = [...weight.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  const details = { min: Math.round(min * 100) / 100, body };
  if (min < 9 - 0.01)
    return crit('T-ATS-10', 'Taille du texte', 'red', `Texte de ${details.min} pt (minimum 9 pt)`, details);
  if (body < 10 - 0.01)
    return crit('T-ATS-10', 'Taille du texte', 'red', `Corps de ${body} pt (minimum 10 pt)`, details);
  return crit('T-ATS-10', 'Taille du texte', 'green', `Corps ${body} pt, plus petit texte ${details.min} pt`, details);
}

/** T-ATS-11. */
export function checkFileSize(bytes: number): AtsCriterion {
  const ko = Math.round(bytes / 1024);
  return bytes < 2 * 1024 * 1024
    ? crit('T-ATS-11', 'Poids du fichier', 'green', `${ko} Ko`, { bytes })
    : crit('T-ATS-11', 'Poids du fichier', 'red', `${ko} Ko (maximum 2 Mo)`, { bytes });
}

/** T-ATS-12: Title and Author set, Subject and Keywords empty, no encryption. */
export function checkMetadata(info: PdfInfo): AtsCriterion {
  const problems: string[] = [];
  if (!info.title?.trim()) problems.push('Title vide');
  if (!info.author?.trim()) problems.push('Author vide');
  if (info.subject?.trim()) problems.push('Subject non vide');
  if (info.keywords?.trim()) problems.push('Keywords non vide');
  if (info.encrypted) problems.push('fichier chiffré');
  return problems.length === 0
    ? crit(
        'T-ATS-12',
        'Métadonnées et sécurité',
        'green',
        'Title et Author renseignés, Subject et Keywords vides, aucun chiffrement',
      )
    : crit('T-ATS-12', 'Métadonnées et sécurité', 'red', problems.join(' ; '));
}

/**
 * T-ATS-13: SHA-256 of the exported file equal to the one of the last preview shown. Checked by the
 * interface at export; without the two hashes (MCP, tests, live preview) it does not apply, the
 * rendering being deterministic (NF-08).
 */
export function checkPreviewIsExport(
  previewSha256?: string | null,
  exportedSha256?: string | null,
  format: 'pdf' | 'docx' = 'pdf',
): AtsCriterion {
  if (!previewSha256 || !exportedSha256) {
    return crit(
      'T-ATS-13',
      'Aperçu = export',
      'na',
      "Sans objet ici (rendu déterministe) ; contrôlé à l'export dans l'interface",
    );
  }
  const short = (h: string) => h.slice(0, 12);
  const details = { previewSha256, exportedSha256 };
  if (previewSha256 !== exportedSha256) {
    return crit(
      'T-ATS-13',
      'Aperçu = export',
      'red',
      format === 'pdf'
        ? `Le fichier exporté (SHA-256 ${short(exportedSha256)}…) diffère de l'aperçu affiché (${short(previewSha256)}…)`
        : `Le preset enregistré (SHA-256 ${short(exportedSha256)}…) ne donne pas l'aperçu affiché (${short(previewSha256)}…)`,
      details,
    );
  }
  return crit(
    'T-ATS-13',
    'Aperçu = export',
    'green',
    format === 'pdf'
      ? `Fichier exporté identique à l'aperçu affiché (SHA-256 ${short(exportedSha256)}…)`
      : `DOCX produit à partir de la projection de l'aperçu affiché (SHA-256 du PDF ${short(exportedSha256)}…)`,
    details,
  );
}

/** T-ATS-14: symbols < 5 % of non-blank characters, mean word length between 4 and 20. */
export function checkConversionQuality(text: string): AtsCriterion {
  const nonBlank = text.replace(/\s+/gu, '');
  const symbols = (nonBlank.match(/\p{S}/gu) ?? []).length;
  const words = text.match(/\p{L}+/gu) ?? [];
  const mean = words.length ? words.reduce((a, w) => a + w.length, 0) / words.length : 0;
  const ratio = nonBlank.length ? symbols / nonBlank.length : 0;
  const details = { symbolRatio: Math.round(ratio * 1000) / 1000, meanWordLength: Math.round(mean * 10) / 10 };
  if (ratio >= 0.05 || mean < 4 || mean > 20) {
    return crit(
      'T-ATS-14',
      'Qualité de conversion',
      'orange',
      `Symboles ${(ratio * 100).toFixed(1)} %, longueur moyenne des mots ${details.meanWordLength}`,
      details,
    );
  }
  return crit(
    'T-ATS-14',
    'Qualité de conversion',
    'green',
    `Symboles ${(ratio * 100).toFixed(1)} %, longueur moyenne des mots ${details.meanWordLength}`,
    details,
  );
}

/** T-ATS-15. */
export function checkRegulatoryHeading(p: Projection): AtsCriterion {
  return p.regulatoryPlacement === 'own-section' && p.sections.some((s) => s.key === 'regulatory')
    ? crit(
        'T-ATS-15',
        'Intitulé non standard',
        'orange',
        '« Normes et réglementation » en section dédiée : intitulé non standard pour les ATS',
      )
    : crit('T-ATS-15', 'Intitulé non standard', 'green', 'Intitulés standard uniquement');
}

/** T-ATS-16. */
export function checkPhoto(p: Projection): AtsCriterion {
  return p.photo
    ? crit('T-ATS-16', 'Photo présente', 'orange', 'Photo présente : ignorée par les ATS, déconseillée hors de France')
    : crit('T-ATS-16', 'Photo présente', 'green', 'Pas de photo');
}

/** T-ATS-17; `visual`: the template was checked with the visual profile (integrity rules, ADR 0017). */
export function checkTemplate(violations: LintViolation[], visual = false): AtsCriterion {
  const label = visual ? 'Gabarit conforme (intégrité)' : 'Gabarit conforme';
  return violations.length === 0
    ? crit(
        'T-ATS-17',
        label,
        'green',
        visual
          ? "Analyse statique du gabarit sans écart (règles d'intégrité ; deux colonnes permises)"
          : 'Analyse statique du gabarit sans écart',
      )
    : crit('T-ATS-17', label, 'red', `${violations.length} écart(s) dans le gabarit`, { violations });
}

/** Layout criteria (ATS-02, 03 for the place, 04, 05, 07 to 10): orange instead of red in the visual layout. */
const VISUAL_ORANGE = new Set(['T-ATS-05', 'T-ATS-06', 'T-ATS-07', 'T-ATS-08']);

/**
 * « Visuel » column of §12.3 (F-MOD-03): T-ATS-05 to 08 become orange, T-ATS-15 and 16 do not apply.
 * The integrity criteria (T-ATS-01 to 04, 09 to 13) stay red when they fail; T-ATS-17 is computed with
 * the visual profile of the linter by the caller.
 */
export function toVisualColumn(c: AtsCriterion): AtsCriterion {
  if (VISUAL_ORANGE.has(c.id) && c.status === 'red') {
    return {
      ...c,
      status: 'orange',
      message: `${c.message} (mise en page du modèle visuel : avertissement, pas un blocage)`,
    };
  }
  if (c.id === 'T-ATS-15') {
    return crit(
      c.id,
      c.label,
      'na',
      'Sans objet en visuel : « Normes et réglementation » y est une section dédiée par défaut',
    );
  }
  if (c.id === 'T-ATS-16') {
    return crit(c.id, c.label, 'na', 'Sans objet en visuel : la photo fait partie de la mise en page');
  }
  return c;
}
