// Layout `ats-classique` (F-MOD-02): one column, rules ATS-01 to ATS-17 and §8.5.
// This file contains NO visible text: every string (labels and punctuation included) comes from
// the projection passed in `sys.inputs.project`. Written in code mode only. Forbidden here, and
// checked by T-ATS-17: grid, table, hide, eval, white text, size below 9pt, literal text,
// place() outside photo(), anything but the image inside photo().
#let data = json(bytes(sys.inputs.project))
#let theme = data.theme
#let accent = rgb(theme.accent)
#let gap = theme.leading * 1em

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
#set list(indent: 0.4em, body-indent: 0.5em, spacing: gap)
// Section heading: black, one point above the heading size of the theme, over an accent rule of 1.25
// pt (still above 1 pt when an A4 page is fitted on a Letter sheet), so that headings outweigh the
// entry titles in every font (ADR 0020). More space above than below: the heading belongs to what
// follows.
#show heading: it => block(
  width: 100%,
  above: theme.sectionGap * 1pt,
  below: 0.6 * theme.bodySize * 1pt,
  inset: (bottom: 2pt),
  stroke: (bottom: 1.25pt + accent),
  sticky: true,
  text(size: (theme.headingSize + 1) * 1pt, weight: 700, it.body),
)

// Rich text: segments, `nb` ones as non-breaking boxes, URLs as clear clickable text (ATS-10).
#let rich(segs) = {
  for s in segs {
    let body = if s.url != none { link(s.url, s.t) } else { s.t }
    if s.nb { box(body) } else { body }
  }
}

// ATS-05: dates as a non-breaking box, right-aligned by h(1fr), no grid. They follow the title on its
// last line when they fit there; otherwise they go alone to the next line, still against the right edge
// (ADR 0020: a break between h(1fr) and the dates used to leave them on the left).
#let title-line(e) = layout(size => {
  let title = strong(rich(e.title))
  let dates = if e.dates != none { box(e.dates) }
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

// The first entry of a section stays close to its heading: the larger spacing of the two would win
// otherwise (ADR 0020).
#let entry(e, first) = {
  let above = if first { 0.6 * theme.bodySize * 1pt } else { theme.entryGap * 1pt }
  block(above: above, below: gap, breakable: true, {
    title-line(e)
    if e.bullets.len() > 0 {
      list(..e.bullets.map(b => rich(b.text)))
    }
  })
}

// Photo (§5.2): the image alone, top right. The only place() of the template, with no text in it
// (T-ATS-17); its alternative text goes to the PDF tags only. `src` is the shadow file mapped by the
// compiler; the height follows the 3:4 ratio.
#let photo(src, p) = place(top + right, image(src, width: p.width * 1cm, alt: p.alt))

// Identity block (ATS-03): name, title and contacts, in the body.
#let identity(h) = {
  block(below: 0.5em, text(size: theme.nameSize * 1pt, weight: 700, h.name))
  if h.title != none {
    block(below: 0.5em, text(size: theme.titleSize * 1pt, weight: 700, fill: accent, rich(h.title)))
  }
  if h.contacts.len() > 0 {
    // ATS-03: contacts in the body, each one a non-breaking box. The separator stays at the end of a line
    // with the contact before it, never at the start of the next line (ADR 0020).
    par({
      let last = h.contacts.len() - 1
      for (i, c) in h.contacts.enumerate() {
        let value = if c.url != none { link(c.url, c.text) } else { c.text }
        let item = if c.label != none { c.label + data.punct.space + value } else { value }
        if i < last {
          box(item + data.punct.pipeSep.trim(at: end))
          data.punct.space
        } else {
          box(item)
        }
      }
    })
  }
}

#let line-of(l) = par({
  if l.label != none {
    strong(l.label)
    data.punct.labelSep
  }
  for (i, item) in l.items.enumerate() {
    if i > 0 { l.sep }
    rich(item)
  }
})

#{
  let h = data.header
  if data.photo == none {
    identity(h)
  } else {
    // §5.2: the identity block is narrowed by the photo and its gap, without any grid, and is at
    // least as tall as the photo so that what follows starts below it.
    let p = data.photo
    layout(size => {
      let body = block(width: size.width, inset: (right: (p.width + p.gap) * 1cm), identity(h))
      block(width: 100%, height: calc.max(measure(body).height, p.width * 4 / 3 * 1cm), {
        photo(data.photoSrc, p)
        body
      })
    })
  }
  if h.summary != none {
    block(above: 0.8em, par(rich(h.summary)))
  }
  for s in data.sections {
    heading(level: 1, outlined: false, bookmarked: false, s.heading)
    for (i, e) in s.entries.enumerate() { entry(e, i == 0) }
    for l in s.lines { line-of(l) }
  }
  if data.closing != none {
    block(above: theme.sectionGap * 1pt, par(data.closing))
  }
}

// Measurement marker (§8.5 step 4): queried as <cv-end>.
#context [#metadata(here().position()) <cv-end>]
