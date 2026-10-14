// Layout `visuel` (F-MOD-03, ADR 0017, 0019 and 0020): for a human reader, not for ATS portals. A tinted
// band across the page (round photo, name, title), then two columns: a tinted sidebar on the left
// (contacts, then skills, standards, languages, certifications, interests) and the main column on the
// right (summary, experience, education, projects). Section headings are pills; the tint stops with the
// content.
// Text order in the PDF: band, sidebar, main column (the visual order, left to right). Which section goes
// to the sidebar is decided by the projection (`side`).
// This file contains NO visible text: every string (labels and punctuation included) comes from the
// projection passed in `sys.inputs.project`. Written in code mode only. T-ATS-17 checks the integrity
// rules here (no literal text, eval, hide, white text, size below 9pt) and, as in the ATS layouts, no
// table and no place(); grid is allowed for the page layout only.
#let data = json(bytes(sys.inputs.project))
#let theme = data.theme
#let accent = rgb(theme.accent)
// Without a tint (accent too light for one, ADR 0017), the band and the sidebar have no background and
// a vertical rule separates the columns.
#let tint = if theme.tint != none { rgb(theme.tint) } else { none }
#let gap = theme.leading * 1em
#let side-width = 6.8cm
#let pad = 0.35cm
// Left inset of the main column; the name of the band starts on the same edge.
#let main-inset = 0.55cm
// Strokes of 1.25 pt: still above 1 pt when an A4 page is fitted on a Letter sheet (ADR 0020).
#let rule = 1.25pt + accent
// One size for the title of the band and every section heading: three sizes on the page (name,
// headings, text). « Normes et réglementation » holds on one line of the sidebar in IBM Plex Sans.
#let heading-size = theme.headingSize * 1pt
// Insets of the pills, in body sizes: inside a heading, `em` would follow the default heading size.
#let pill-x = 0.55 * theme.bodySize * 1pt
#let pill-y = 0.3 * theme.bodySize * 1pt
// Below a heading: more than the space between two lines, less than half the space above the heading.
#let after-heading = 0.65 * theme.bodySize * 1pt

#set document(title: data.meta.title, author: data.meta.author, date: none)
#set page(paper: data.paper, margin: theme.margin * 1cm)
#set page(height: auto) if data.measure
#set text(
  font: theme.family,
  fallback: false,
  lang: data.lang,
  hyphenate: false,
  ligatures: false,
  tracking: 0pt,
  size: theme.bodySize * 1pt,
  spacing: theme.wordSpacing * 100%,
  // No last line of a single word (runt): with the optimized line breaking below, a high cost makes
  // Typst accept a shorter line before rather than a runt (ADR 0020).
  costs: (runt: 100000%),
)
#set smartquote(enabled: false)
#set par(justify: false, leading: gap, spacing: gap, linebreaks: theme.linebreaks)
// The bullet sits on the edge of the text (no indent): one left edge per column.
#set list(indent: 0pt, body-indent: 0.45em, spacing: gap, marker: text(fill: accent, sym.bullet))

// Section heading: a pill hanging in the margin, so that its text starts on the edge of the column. The
// same pill in both columns (size, alignment, stroke); in the main column it is also filled with the
// tint. The text is black, the accent is in the pill: headings outweigh the entry titles in every font.
// Much more space above than below: the heading belongs to what follows (ADR 0020).
#let heading-pill(it, filled) = block(above: theme.sectionGap * 1pt, below: after-heading, sticky: true, {
  h(-pill-x)
  box(
    fill: if filled { tint },
    stroke: rule,
    radius: heading-size,
    inset: (x: pill-x, y: pill-y),
    text(size: heading-size, weight: 700, it.body),
  )
})

// Rich text: segments, `nb` ones as non-breaking boxes, URLs as clear clickable text (ATS-10).
#let rich(segs) = {
  for s in segs {
    let body = if s.url != none { link(s.url, s.t) } else { s.t }
    if s.nb { box(body) } else { body }
  }
}

// Title line of an entry: the dates follow the title on its last line when they fit there, otherwise
// they go alone to the next line; always against the right edge (ADR 0020).
#let title-line(e) = layout(size => {
  let title = strong(rich(e.title))
  let dates = if e.dates != none { box(text(fill: accent, e.dates)) }
  let fits = if dates == none { true } else {
    let room = box(width: measure(data.punct.space).width + measure(dates).width)
    let wrapped = measure(block(width: size.width, par(title + room))).height
    wrapped <= measure(block(width: size.width, par(title))).height + 0.01pt
  }
  par({
    title
    if dates != none {
      if fits { data.punct.space } else { linebreak() }
      h(1fr)
      dates
    }
    if e.subtitle != none {
      linebreak()
      emph(rich(e.subtitle))
    }
  })
})

// Entry: title line (title, dates, organization and place), then the bullets. The first entry of a
// section stays close to its heading: the larger spacing of the two would win otherwise.
#let entry(e, first) = {
  let above = if first { after-heading } else { theme.entryGap * 1pt }
  block(above: above, below: gap, breakable: true, {
    title-line(e)
    if e.bullets.len() > 0 {
      list(..e.bullets.map(b => rich(b.text)))
    }
  })
}

// Line of the main column (same as the ATS layout).
#let main-line(l) = par({
  if l.label != none {
    strong(l.label)
    data.punct.labelSep
  }
  for (i, item) in l.items.enumerate() {
    if i > 0 { l.sep }
    rich(item)
  }
})

// Label of the sidebar (« Langages », « E-mail : »): bold, in the accent color, above what it introduces;
// smaller than the headings, darker than the text.
#let side-label(t) = block(above: 0.7em, below: 0.3em, sticky: true, text(weight: 700, fill: accent, t))

// Line of the sidebar: a labelled line puts its label above its items; otherwise one item per line,
// as a list.
#let side-line(l) = {
  if l.label != none {
    side-label(l.label)
    par(for (i, item) in l.items.enumerate() {
      if i > 0 { l.sep }
      rich(item)
    })
  } else {
    list(..l.items.map(rich))
  }
}

// Photo (§5.2): the image alone, cropped to a circle, inline in the band (no place()), with its
// alternative text for the PDF tags.
#let photo(src, p) = box(clip: true, radius: 50%, image(src, width: p.width * 1cm, height: p.width * 1cm, alt: p.alt))

// Name and title (ATS-03), in the band.
#let identity(h) = {
  // pdf.js starts a new line only beyond half the height of the name: keep the title well below it.
  block(below: 0.75em, text(size: (theme.nameSize + 6) * 1pt, weight: 700, fill: accent, h.name))
  if h.title != none {
    text(size: heading-size, rich(h.title))
  }
}

// Icon of a link (ADR 0025): the image alone, in the accent color, from the path given by the renderer
// for its kind, the height of the text and centred on it; its alternative text (the name of the link)
// goes to the PDF tags only. The only image of the template besides the photo (T-ATS-17).
#let link-icon(i) = box(baseline: 0.15em, image(data.icons.at(i.kind), height: 0.95em, alt: i.alt))

// Contacts at the top of the sidebar: each label above its value, each value as a non-breaking box, an
// icon before its URL on the same line. A value wider than the column (a long URL) is set smaller to stay
// on one line, never below 9 pt (§8.5).
#let contacts(cs) = layout(size => for c in cs {
  let body = if c.icon != none { link-icon(c.icon) + data.punct.space + c.text } else { c.text }
  let value = box(if c.url != none { link(c.url, body) } else { body })
  let natural = measure(value).width
  let fitted = if natural > size.width { calc.max(9, 0.98 * theme.bodySize * size.width / natural) } else {
    theme.bodySize
  }
  if c.label != none { side-label(c.label) }
  par(text(size: fitted * 1pt, value))
})

#let section-body(s, line-fn) = {
  heading(level: 1, outlined: false, bookmarked: false, s.heading)
  for (i, e) in s.entries.enumerate() { entry(e, i == 0) }
  for l in s.lines { line-fn(l) }
}

#{
  let h = data.header
  let main = data.sections.filter(s => not s.side)
  let side = data.sections.filter(s => s.side)
  let side-body = {
    show heading: it => heading-pill(it, false)
    contacts(h.contacts)
    for s in side { section-body(s, side-line) }
  }
  let main-body = {
    show heading: it => heading-pill(it, true)
    if h.summary != none {
      block(below: 0.4em, par(rich(h.summary)))
    }
    for s in main { section-body(s, main-line) }
    if data.closing != none {
      block(above: theme.sectionGap * 1pt, par(data.closing))
    }
  }
  // The band: the round photo above the sidebar, the name above the main column; without a photo, the
  // name runs across the band, on the edge of the sidebar text.
  let band = if data.photo != none {
    let ring = box(stroke: 1.5pt + accent, radius: 50%, inset: 2pt, photo(data.photoSrc, data.photo))
    (align(center, ring), identity(h))
  } else {
    (grid.cell(colspan: 2, identity(h)),)
  }
  // The tint stops with the content: the second row is as tall as the longer column (ADR 0020).
  grid(
    columns: (side-width, 1fr),
    fill: (x, y) => if y == 0 or x == 0 { tint },
    stroke: (x, y) => (
      bottom: if y == 0 { 1.5pt + accent },
      right: if tint == none and x == 0 and y == 1 { rule },
    ),
    inset: (x, y) => if y == 0 and x == 1 { (left: main-inset, right: pad, y: 0.45cm) } else if y == 0 {
      (x: pad, y: 0.45cm)
    } else if x == 0 { (x: pad, y: 0.45cm) } else { (left: main-inset, y: 0.45cm) },
    align: (x, y) => if y == 0 { horizon } else { auto },
    ..band,
    side-body, main-body,
  )
}

// Measurement marker (§8.5 step 4): queried as <cv-end>.
#context [#metadata(here().position()) <cv-end>]
