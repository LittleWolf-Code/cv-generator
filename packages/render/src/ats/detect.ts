// Fields detected in an extraction (F-ATS-02): the name on the first line, the identity e-mail and
// phone, the recognized headings and one date range per entry. T-ATS-06, 07 and 08 are computed from
// these detections, so the ATS view and the lights share one definition.
import {
  canon,
  collapseSpaces,
  digitsOf,
  findEmails,
  findPhones,
  samePhone,
  type DetectedFields,
  type Projection,
} from '@cv/core';

export interface Extraction {
  /** `pdf.js`, `pdftotext` or `docx`. */
  name: string;
  text: string;
}

const lines = (text: string) => text.split(/\r?\n/);

/** Index of the first line equal (canon) to a heading, or -1. */
export function firstHeadingLine(ls: string[], headings: readonly string[]): number {
  const set = new Set(headings.map(canon));
  return ls.findIndex((l) => set.has(canon(l)));
}

/** T-ATS-06, first part: the first non-empty line is "Prénom Nom". */
export function detectName(p: Projection, text: string): DetectedFields['name'] {
  const line = lines(text).find((l) => l.trim()) ?? null;
  return { line, ok: !!p.identity && canon(line ?? '') === canon(p.identity.fullName) };
}

/** T-ATS-06, second part: the lines equal to a heading reproduce `projection.headings`. */
export function detectHeadings(p: Projection, text: string): DetectedFields['headings'] {
  const set = new Set(p.headings.map(canon));
  const found = lines(text).filter((l) => l.trim() && set.has(canon(l)));
  return {
    found,
    expected: p.headings,
    ok: found.map(canon).join('|') === p.headings.map(canon).join('|'),
  };
}

/** T-ATS-08: identity contacts before the first heading, each on one line; other contacts anywhere. */
export function detectContacts(p: Projection, text: string): DetectedFields['contacts'] {
  if (!p.identity) return null;
  const id = p.identity;
  const ls = lines(text);
  const cut = firstHeadingLine(ls, p.headings);
  const top = ls.slice(0, cut < 0 ? ls.length : cut);
  const topText = top.join('\n');
  const phoneDigits = digitsOf(id.phone);
  return {
    emails: findEmails(topText),
    phones: findPhones(topText).map((ph) => ph.number),
    email: top.some((l) => l.includes(id.email)),
    phone: top.some((l) => digitsOf(l).includes(phoneDigits)),
    location: top.some((l) => l.includes(id.city) && l.includes(id.country)),
    otherEmails: findEmails(text).filter((e) => e !== id.email).length,
    otherPhones: findPhones(text).filter((ph) => !samePhone(ph.number, id.phone)).length,
  };
}

/**
 * T-ATS-07: for each entry, in order, the range is whole on the line holding the start of its title
 * (3 first words) or on the next one, exactly once (ADR 0004).
 */
export function detectEntries(
  p: Projection,
  text: string,
): Array<DetectedFields['entries'][number] & { problem: string | null }> {
  const ls = lines(text).map(collapseSpaces);
  let cursor = 0;
  return p.datedEntries.map((e) => {
    const base = { id: e.id, title: e.title, dates: e.dates };
    const head = collapseSpaces(e.title).split(' ').slice(0, 3).join(' ');
    let t = ls.findIndex((l, i) => i >= cursor && l.includes(head));
    if (t < 0) return { ...base, line: null, ok: false, problem: `intitulé introuvable pour ${e.id}` };
    const onLine = [t, t + 1].filter((i) => i < ls.length).find((i) => ls[i]!.includes(e.dates));
    let problem: string | null = null;
    let line: string | null = null;
    if (onLine === undefined) {
      problem = `la plage « ${e.dates} » de ${e.id} n'est pas entière sur la ligne de l'intitulé ou la suivante`;
    } else {
      line = ls[onLine]!;
      const count = line.split(e.dates).length - 1;
      if (count !== 1) problem = `${count} plages sur la ligne de ${e.id}`;
      t = onLine;
    }
    cursor = t + 1;
    return { ...base, line, ok: problem === null, problem };
  });
}

export function detectFields(p: Projection, ex: Extraction): DetectedFields {
  return {
    extractor: ex.name,
    name: detectName(p, ex.text),
    headings: detectHeadings(p, ex.text),
    contacts: detectContacts(p, ex.text),
    entries: detectEntries(p, ex.text).map(({ problem: _problem, ...e }) => e),
  };
}
