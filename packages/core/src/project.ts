// core.project (§8.5 step 2): flat render JSON for one language. Pure function, the single
// input of the Typst and DOCX templates.
import { formatRange, formatYearMonth, hasMonth } from './dates.js';
import { cefrText, HEADINGS, labelsFor, US_DRIVING_LICENSE } from './labels.js';
import { cvDocumentTitle } from './naming.js';
import type {
  ExpectedField,
  ProjectedContact,
  ProjectedEntry,
  ProjectedLine,
  ProjectedPhoto,
  ProjectedSection,
  Projection,
  ProjectionIssue,
  ProjectionTheme,
  Rich,
} from './projection.js';
import type { Bilingual, EnVariant, Lang } from './schema/common.js';
import type { Location } from './schema/common.js';
import type { Identity } from './schema/profile.js';
import type { Density, Options, SectionKey, Template } from './schema/preset.js';
import type { Selected, SelectedEntry } from './select.js';
import { spellingIssues } from './text/en-spelling.js';
import { MUTED_TEXT, sidebarTint, THEME_FONT_META } from './theme.js';
import { plainText, segmentText } from './text/segments.js';

export interface ProjectContext {
  lang: Lang;
  enVariant: EnVariant;
  options: Options;
  template: Template;
  identity: Identity | null;
}

/** Sections of the sidebar (left column) in the visual layout (ADR 0017, 0019); the others go to the main column. */
const SIDEBAR_SECTIONS = new Set<SectionKey>(['skills', 'regulatory', 'certifications', 'languages', 'interests']);

/** Photo size per density (3:4 ratio): smaller in compact density, like the other spacings. */
const PHOTO: Record<Density, Omit<ProjectedPhoto, 'alt'>> = {
  normale: { width: 2.4, gap: 0.5 },
  compacte: { width: 2.1, gap: 0.4 },
};

/**
 * Sizes and spacings per density (ADR 0020). `pitch` is the distance between two baselines, in body
 * sizes: at least 1.20 (Butterick: 120 to 145 %), whatever the font; the leading follows from the cap
 * height of the font. The vertical scale grows step by step: lines of an entry (leading) < entries
 * (`entryGap`, about 1.5 times the leading) < sections (`sectionGap`, above a heading). The compact
 * density saves on margins, sizes and gaps, never below these floors.
 */
const DENSITY: Record<
  Density,
  Omit<
    ProjectionTheme,
    'font' | 'family' | 'wordSpacing' | 'accent' | 'muted' | 'tint' | 'density' | 'leading' | 'linebreaks'
  > & {
    pitch: number;
  }
> = {
  normale: {
    bodySize: 10.5,
    nameSize: 20,
    titleSize: 12,
    headingSize: 12,
    pitch: 1.25,
    margin: 1.8,
    sectionGap: 20,
    entryGap: 10,
  },
  compacte: {
    bodySize: 10,
    nameSize: 18,
    titleSize: 11.5,
    headingSize: 11.5,
    pitch: 1.2,
    margin: 1.5,
    sectionGap: 17,
    entryGap: 8.5,
  },
};

type FieldTarget = NonNullable<ProjectionIssue['target']>;

/** Theme of a template (font, accent, density and its sizes): shared by the CV and the letter (F-MOD-05). */
export function projectionTheme(template: Template): ProjectionTheme {
  const font = THEME_FONT_META[template.theme.font];
  const { pitch, ...sizes } = DENSITY[template.theme.density];
  return {
    font: template.theme.font,
    family: font.family,
    wordSpacing: font.wordSpacing,
    accent: template.theme.accent,
    muted: MUTED_TEXT,
    tint: sidebarTint(template.theme.accent),
    density: template.theme.density,
    ...sizes,
    leading: Math.round((pitch - font.capHeight) * 1000) / 1000,
    linebreaks: 'optimized',
  };
}

export function project(selected: Selected, ctx: ProjectContext): Projection {
  const { lang, options, identity } = ctx;
  const labels = labelsFor(lang, ctx.enVariant);
  const warnings: ProjectionIssue[] = [...selected.warnings];
  const blocking: ProjectionIssue[] = [];
  const expected: ExpectedField[] = [];
  const datedEntries: Projection['datedEntries'] = [];
  const usedDates: string[] = [];

  /** Resolves a bilingual field; a missing translation blocks the export (O5) and falls back for the preview. */
  const tr = (value: Bilingual, target: FieldTarget): string => {
    const v = value[lang];
    if (v !== null) {
      // §5.4: spelling controlled by the English variant (a warning, never a block; ADR 0015).
      if (lang === 'en') {
        const issues = spellingIssues(v, ctx.enVariant);
        if (issues.length) {
          warnings.push({
            code: 'SPELLING_VARIANT',
            message: `orthographe ${ctx.enVariant} : ${issues.map((i) => `« ${i.word} » → « ${i.expected} »`).join(', ')}`,
            target,
          });
        }
      }
      return v;
    }
    blocking.push({
      code: 'UNTRANSLATED',
      message: `non traduit (${lang.toUpperCase()}) : ${target.collection}/${target.itemId}${target.bulletId ? `/${target.bulletId}` : ''} ${target.field}`,
      target,
    });
    return value[lang === 'fr' ? 'en' : 'fr'] ?? '';
  };
  const rich = (s: string): Rich => segmentText(s, selected.protectedTerms);
  const expect = (path: string, s: string | null) => {
    if (s && s.trim()) expected.push({ path, text: s });
  };
  const loc = (l: Location | null, target: FieldTarget): string[] =>
    l ? [l.city, tr(l.country, { ...target, field: 'location.country' })] : [];

  // Header.
  if (!identity) {
    blocking.push({
      code: 'IDENTITY_MISSING',
      message: 'identité absente : renseignez le profil (nom, e-mail, téléphone, ville et pays)',
    });
  }
  const fullName = identity ? `${identity.firstName} ${identity.lastName}` : '';
  expect('header.name', fullName);

  let titleText: string | null = null;
  if (selected.title) {
    titleText = tr(selected.title.text, {
      collection: 'titles',
      itemId: selected.title.id ?? 'overrides.title',
      field: 'text',
      ...(selected.title.variantId ? { variantId: selected.title.variantId } : {}),
    });
    expect('header.title', titleText);
  }

  const contacts: ProjectedContact[] = [];
  let identityCheck: Projection['identity'] = null;
  if (identity) {
    const country = tr(identity.location.country, {
      collection: 'profile',
      itemId: 'identity',
      field: 'location.country',
    });
    contacts.push({
      kind: 'email',
      label: labels.email,
      text: identity.email,
      url: `mailto:${identity.email}`,
      icon: null,
    });
    contacts.push({ kind: 'phone', label: labels.phone, text: identity.phone, url: null, icon: null });
    contacts.push({
      kind: 'location',
      label: null,
      text: `${identity.location.city}${labels.listSep}${country}`,
      url: null,
      icon: null,
    });
    for (const linkId of options.links) {
      const index = identity.links.findIndex((x) => x.id === linkId);
      const l = identity.links[index];
      if (!l) {
        warnings.push({ code: 'ORPHAN_REF', message: `lien inconnu ignoré : ${linkId}` });
        continue;
      }
      // ADR 0025: the name is resolved only when it is shown (name style, alternative text of the icon).
      // The icon is drawn by the visual layout only (ATS-08): elsewhere the URL stands alone.
      const style = l.style === 'icon' && ctx.template.layout !== 'visuel' ? 'url' : l.style;
      const name =
        style === 'url'
          ? null
          : l.name
            ? tr(l.name, { collection: 'profile', itemId: 'identity', field: `links.${index}.name` })
            : labels.linkNames[l.kind];
      contacts.push({
        kind: 'link',
        label: style === 'name' ? `${name}${labels.labelSep.trimEnd()}` : null,
        text: l.display,
        url: l.url,
        icon: style === 'icon' ? { kind: l.kind, alt: name! } : null,
      });
    }
    contacts.forEach((c, i) =>
      expect(`header.contacts[${i}]`, c.label ? `${c.label}${labels.space}${c.text}` : c.text),
    );
    identityCheck = {
      fullName,
      firstName: identity.firstName,
      lastName: identity.lastName,
      email: identity.email,
      phone: identity.phone,
      city: identity.location.city,
      country,
    };
  }

  let summary: Rich | null = null;
  if (selected.summary) {
    const s = tr(selected.summary.text, {
      collection: 'summaries',
      itemId: selected.summary.ownerId,
      variantId: selected.summary.variantId,
      field: 'text',
    });
    summary = rich(s);
    expect('header.summary', s);
  }

  const range = (start: string | null, end: string | null) => {
    if (start) usedDates.push(start);
    if (end) usedDates.push(end);
    return formatRange(start, end, options.dateStyle, lang);
  };

  const entryBullets = (key: string, collection: string, e: SelectedEntry<{ id: string }>) =>
    e.bullets.map(({ bullet, variant }) => {
      const t = tr(variant.text, {
        collection,
        itemId: e.item.id,
        bulletId: bullet.id,
        variantId: variant.variantId,
        field: 'text',
      });
      expect(`${key}.${e.item.id}.${bullet.id}`, t);
      return { id: bullet.id, text: rich(t) };
    });

  const finishEntry = (
    key: string,
    id: string,
    title: string,
    dates: string | null,
    subtitle: string | null,
    bullets: ProjectedEntry['bullets'],
  ): ProjectedEntry => {
    expect(`${key}.${id}.title`, title);
    expect(`${key}.${id}.dates`, dates);
    expect(`${key}.${id}.subtitle`, subtitle);
    if (dates) datedEntries.push({ id, title, dates });
    return { id, title: rich(title), dates, subtitle: subtitle ? rich(subtitle) : null, bullets };
  };

  /** ATS-18: the long form is rendered only when it is non-null and differs from `short`. */
  const skillRich = (s: { id: string; short: string; long: Bilingual | null }): Rich => {
    const short: Rich = [{ t: s.short, nb: true, url: null }];
    if (!s.long) return short;
    const long = tr(s.long, { collection: 'skills', itemId: s.id, field: 'long' });
    if (!long || long === s.short) return short;
    return [...short, ...rich(`${labels.open}${long}${labels.close}`)];
  };

  const sections: Array<Omit<ProjectedSection, 'side'>> = [];
  const pushLines = (key: ProjectedSection['key'], lines: ProjectedLine[]) => {
    if (lines.length === 0) return;
    const heading = HEADINGS[key][lang];
    lines.forEach((l, i) => {
      expect(`${key}.lines[${i}].label`, l.label);
      l.items.forEach((it, j) => expect(`${key}.lines[${i}].items[${j}]`, plainText(it)));
    });
    sections.push({ key, heading, entries: [], lines });
  };

  const regulatorySection = selected.sections.find((s) => s.key === 'regulatory');
  const regulatorySkills = regulatorySection?.key === 'regulatory' ? regulatorySection.skills : [];

  for (const section of selected.sections) {
    switch (section.key) {
      case 'experience': {
        const entries = section.entries.map((e) => {
          const target = { collection: 'experiences', itemId: e.item.id, field: 'position' };
          const contract = e.item.contract ? labels.contract[e.item.contract] : null;
          const position = tr(e.item.position, target);
          const title = contract ? `${position}${labels.open}${contract}${labels.close}` : position;
          const subtitle = [e.item.organization, ...loc(e.item.location, target)].join(labels.listSep);
          return finishEntry(
            'experience',
            e.item.id,
            title,
            range(e.item.start, e.item.end),
            subtitle,
            entryBullets('experience', 'experiences', e),
          );
        });
        if (entries.length)
          sections.push({ key: 'experience', heading: HEADINGS.experience[lang], entries, lines: [] });
        break;
      }
      case 'education': {
        const entries = section.entries.map((e) => {
          const target = { collection: 'education', itemId: e.item.id, field: 'degree' };
          let title = tr(e.item.degree, target);
          if (e.item.field) title += `${labels.listSep}${tr(e.item.field, { ...target, field: 'field' })}`;
          if (e.item.levelEquivalent) {
            title += `${labels.open}${tr(e.item.levelEquivalent, { ...target, field: 'levelEquivalent' })}${labels.close}`;
          }
          const subtitleParts = [e.item.institution, ...loc(e.item.location, target)];
          if (e.item.honors) subtitleParts.push(tr(e.item.honors, { ...target, field: 'honors' }));
          return finishEntry(
            'education',
            e.item.id,
            title,
            range(e.item.start, e.item.end),
            subtitleParts.join(labels.listSep),
            entryBullets('education', 'education', e),
          );
        });
        if (entries.length) sections.push({ key: 'education', heading: HEADINGS.education[lang], entries, lines: [] });
        break;
      }
      case 'projects': {
        const entries = section.entries.map((e) => {
          const target = { collection: 'projects', itemId: e.item.id, field: 'name' };
          const name = tr(e.item.name, target);
          const role = e.item.role ? tr(e.item.role, { ...target, field: 'role' }) : null;
          const title = role ? `${name}${labels.rangeSep}${role}` : name;
          // Organization, main link, then the repositories (ADR 0027): each URL is one block with its target.
          const links = [e.item.url, ...e.item.repos].filter((l): l is NonNullable<typeof l> => l !== null);
          const parts: Rich[] = [
            ...(e.item.organization ? [rich(e.item.organization)] : []),
            ...links.map((l): Rich => [{ t: l.display, nb: true, url: l.url }]),
          ];
          const entry = finishEntry(
            'projects',
            e.item.id,
            title,
            range(e.item.start, e.item.end),
            parts.length ? parts.map(plainText).join(labels.listSep) : null,
            entryBullets('projects', 'projects', e),
          );
          if (parts.length) entry.subtitle = parts.flatMap((p, i) => (i ? [...rich(labels.listSep), ...p] : p));
          return entry;
        });
        if (entries.length) sections.push({ key: 'projects', heading: HEADINGS.projects[lang], entries, lines: [] });
        break;
      }
      case 'skills': {
        const lines: ProjectedLine[] = section.groups.map((g) => ({
          label: tr(g.category.label, { collection: 'categories', itemId: g.category.id, field: 'label' }),
          items: g.skills.map(skillRich),
          sep: labels.listSep,
        }));
        if (ctx.options.regulatoryPlacement === 'skills-subgroup' && regulatorySkills.length > 0) {
          lines.push({ label: HEADINGS.regulatory[lang], items: regulatorySkills.map(skillRich), sep: labels.listSep });
        }
        if (options.drivingLicense && identity?.drivingLicense) {
          // §5.4: in en-US the label is generated (« Driver's license », never « Class B », a heavy-truck
          // licence in the United States); FR and en-GB use the text entered by the user (ADR 0015).
          const text =
            lang === 'en' && ctx.enVariant === 'en-US'
              ? US_DRIVING_LICENSE
              : tr(identity.drivingLicense, { collection: 'profile', itemId: 'identity', field: 'drivingLicense' });
          lines.push({ label: null, items: [rich(text)], sep: labels.listSep });
        }
        if (options.workAuthorization && identity?.workAuthorization) {
          lines.push({
            label: null,
            items: [
              rich(
                tr(identity.workAuthorization, {
                  collection: 'profile',
                  itemId: 'identity',
                  field: 'workAuthorization',
                }),
              ),
            ],
            sep: labels.listSep,
          });
        }
        pushLines('skills', lines);
        break;
      }
      case 'regulatory':
        if (ctx.options.regulatoryPlacement === 'own-section' && section.skills.length > 0) {
          pushLines('regulatory', [{ label: null, items: section.skills.map(skillRich), sep: labels.listSep }]);
        }
        break;
      case 'certifications':
        pushLines(
          'certifications',
          section.items.map((c) => {
            let t = `${tr(c.name, { collection: 'certifications', itemId: c.id, field: 'name' })}${labels.rangeSep}${c.issuer}`;
            if (c.date) {
              usedDates.push(c.date);
              t += `${labels.open}${formatYearMonth(c.date, options.dateStyle, lang)}${labels.close}`;
            }
            return { label: null, items: [rich(t)], sep: labels.listSep };
          }),
        );
        break;
      case 'languages': {
        const items = section.items.map((l) => {
          const name = tr(l.language, { collection: 'languages', itemId: l.id, field: 'language' });
          if (l.cefr === null) {
            blocking.push({
              code: 'LANGUAGE_LEVEL_MISSING',
              message: `niveau CECRL à préciser : ${name}`,
              target: { collection: 'languages', itemId: l.id, field: 'cefr' },
            });
          }
          let t = `${name}${labels.labelSep}${l.cefr ? cefrText(l.cefr, lang) : '?'}`;
          if (l.certification) {
            const cert = [
              l.certification.score ? `${l.certification.name} ${l.certification.score}` : l.certification.name,
            ];
            if (l.certification.year) cert.push(l.certification.year);
            t += `${labels.open}${cert.join(labels.listSep)}${labels.close}`;
          }
          return rich(t);
        });
        if (items.length) pushLines('languages', [{ label: null, items, sep: labels.pipeSep }]);
        break;
      }
      case 'interests': {
        const items = section.items.map((it) => {
          let t = tr(it.text, { collection: 'interests', itemId: it.id, field: 'text' });
          if (it.detail)
            t += `${labels.open}${tr(it.detail, { collection: 'interests', itemId: it.id, field: 'detail' })}${labels.close}`;
          return rich(t);
        });
        if (items.length) pushLines('interests', [{ label: null, items, sep: labels.listSep }]);
        break;
      }
    }
  }

  if (sections.length === 0) warnings.push({ code: 'EMPTY_SELECTION', message: 'aucune section active et non vide' });
  const withMonth = usedDates.filter(hasMonth).length;
  if (withMonth > 0 && withMonth < usedDates.length) {
    warnings.push({
      code: 'MIXED_DATE_PRECISION',
      message: "le document mélange des dates avec mois et des dates avec l'année seule",
    });
  }
  for (const s of sections) expect(`heading.${s.key}`, s.heading);
  const closing = options.referencesNote ? labels.referencesNote : null;
  if (options.photo && identity && !identity.photo) {
    warnings.push({
      code: 'PHOTO_MISSING',
      message: "photo cochée, mais aucune photo dans l'identité : importez-en une ou décochez l'option",
      target: { collection: 'profile', itemId: 'identity', field: 'photo' },
    });
  }
  expect('closing', closing);

  return {
    version: 1,
    layout: ctx.template.layout,
    lang,
    enVariant: ctx.enVariant,
    paper: lang === 'en' && ctx.enVariant === 'en-US' ? 'us-letter' : 'a4',
    measure: false,
    dateStyle: options.dateStyle,
    regulatoryPlacement: options.regulatoryPlacement,
    photo:
      options.photo && identity?.photo
        ? { ...PHOTO[ctx.template.theme.density], alt: `${labels.photoOf}${labels.space}${fullName}` }
        : null,
    meta: { title: cvDocumentTitle(fullName, titleText), author: fullName },
    theme: projectionTheme(ctx.template),
    punct: { labelSep: labels.labelSep, listSep: labels.listSep, pipeSep: labels.pipeSep, space: labels.space },
    header: { name: fullName, title: titleText ? rich(titleText) : null, contacts, summary },
    sections: sections.map((s) => ({
      ...s,
      side: ctx.template.layout === 'visuel' && SIDEBAR_SECTIONS.has(s.key),
    })),
    closing,
    headings: sections.map((s) => s.heading),
    expected,
    datedEntries,
    identity: identityCheck,
    warnings,
    blocking,
  };
}
