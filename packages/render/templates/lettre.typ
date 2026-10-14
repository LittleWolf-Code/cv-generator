// Letter template (F-MOD-05): the single cover letter template, with the font and accent colour of the
// theme and the same rules as the ATS templates. This file contains NO visible text: every string
// (generated parts and punctuation included) comes from the letter projection passed in
// `sys.inputs.project`. Written in code mode only; checked by T-ATS-17 like the CV templates.
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
)
#set smartquote(enabled: false)
#set par(justify: false, leading: gap, spacing: gap)

// Rich text: segments, `nb` ones as non-breaking boxes (protected terms), as in the CV.
#let rich(segs) = {
  for s in segs {
    let body = if s.url != none { link(s.url, s.t) } else { s.t }
    if s.nb { box(body) } else { body }
  }
}

// A block of short lines, each one a non-breaking box; aligned right in French (ADR 0016).
#let lines-block(lines, right, below) = {
  let body = par(for (i, l) in lines.enumerate() {
    if i > 0 { linebreak() }
    box(l)
  })
  block(width: 100%, below: below, if right { align(end, body) } else { body })
}

#{
  // Sender (identity): name, phone, e-mail, city and country. No postal address (§5.2).
  block(below: 0.4em, text(size: theme.titleSize * 1pt, weight: 700, fill: accent, data.sender.name))
  lines-block(data.sender.lines, false, 1.4em)
  // Recipient, then place and date.
  lines-block(data.recipient.lines, data.recipient.right, 1.2em)
  lines-block((data.date.text,), data.date.right, 1.4em)
  // Subject.
  block(below: 1.4em, par({
    if data.subject.label != none {
      strong(data.subject.label)
      data.space
    }
    strong(rich(data.subject.text))
  }))
  // Salutation, paragraphs, closing formula.
  block(below: 1em, par(data.salutation))
  for p in data.paragraphs {
    block(below: 1em, par(rich(p.text)))
  }
  block(below: 1.6em, par(data.closing))
  block(below: 1.6em, par(strong(data.signature)))
  par(data.enclosure)
}

// Measurement marker (§8.5 step 4): queried as <cv-end>, as in the CV templates.
#context [#metadata(here().position()) <cv-end>]
