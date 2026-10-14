# Typography criteria and typographic defects for a one-page A4 CV (Typst) — research notes

State as of October 2026; every page cited was accessed on 2026-10-08. Evidence tags: **[R]** empirical research (legibility/eye-tracking studies); **[C]** expert convention (typographers, designers); **[S]** standard or official technical documentation (W3C, OQLF, Typst, clear-print bodies); **[G]** career-guide practice (university or commercial); **[M]** my own measurement of the repo's font files (`packages/render/fonts/*.ttf`, read-only fontkit script in the session scratchpad); **[U]** seen only in a search-result snippet or a secondary summary, page not fetched or fetch failed: unverified. "Test:" turns a sourced rule into a pass/fail check on the finished PDF. The consolidated criteria matrix and defect checklist are in section 3, under Inferences.

## 1. Butterick's *Practical Typography*: the "Résumés" chapter and related rules

### Takeaway
Butterick's numbers for body text are 10–12 pt in print, line spacing of 120–145 % of the point size, and 45–90 characters per line (2–3 lowercase alphabets). Emphasis should be minimal and use one channel: bold or italic, never both, no underlining, and no italic in sans serif. His résumé critique targets density, headings and gray boxes that are too large, "where and when" information that is buried, and system fonts such as Calibri. Carlito is a metric clone of Calibri, so that last point applies here.

### Cited Findings
#### Body text
- [C] Body text should be 10–12 pt in printed documents and 15–25 px on the web, because screens are read from farther away. **Test:** the modal body-text size, weighted by character count, is 10–12 pt. Sources: [Butterick, Point size](https://practicaltypography.com/point-size.html); [Butterick, Summary of key rules](https://practicaltypography.com/summary-of-key-rules.html).
- [C] Fonts look different sizes at the same nominal size. Butterick says to "let your eyes be the judge" and, when switching fonts, to match line breaks rather than the number. Source: [Point size](https://practicaltypography.com/point-size.html).
- [C] Smaller point sizes call for tighter line spacing and shorter lines. Newspapers stay legible at small sizes because of snug spacing and short lines. For emphasis, step up by about half a point (for example from 11 pt) instead of jumping to 14 pt. Source: [Point size](https://practicaltypography.com/point-size.html).
- [C] Line spacing should be 120–145 % of the point size. Microsoft Word's presets all miss this range: "single" ≈ 117 %, "1.5 lines" ≈ 175 %, "double" ≈ 233 %. Fonts that run small need less line spacing. **Test:** within a body paragraph, baseline-to-baseline distance ÷ font size is between 1.20 and 1.45. Source: [Butterick, Line spacing](https://practicaltypography.com/line-spacing.html).
- [C] Line length should be 45–90 characters including spaces, or 2–3 lowercase alphabets. Measure it in characters per line, not in cm, because characters per cm depend on point size. Line length is set mainly through the page margins. If indentation is used for hierarchy, the lines must be long enough that the indented ones also stay in range. **Test:** the average characters per full (non-final) line is 45–90, or the column width ÷ the width of "abcdefghijklmnopqrstuvwxyz" in the body font is 2–3. Source: [Butterick, Line length](https://practicaltypography.com/line-length.html).
- [C] Page margins: about 1.5–2.0 in left and right for 12 pt text on US letter paper. Smaller point sizes need larger margins, and margins exist to hit the characters-per-line target. His worked example uses 2 in margins, 11 pt type and 15 pt line spacing (≈ 136 %). He gives no A4 figures. Source: [Butterick, Page margins](https://practicaltypography.com/page-margins.html).
- [C] Mark paragraphs with either a first-line indent of 1–4× the point size or 4–10 pt of space between paragraphs (≈ 50–100 % of the body size), not both. Word processors collapse adjacent spacing to the larger of the two values. Sources: [Space between paragraphs](https://practicaltypography.com/space-between-paragraphs.html); [Summary of key rules](https://practicaltypography.com/summary-of-key-rules.html).

#### Emphasis
- [C] Bold and italic are mutually exclusive: never both on the same text, never on whole paragraphs, and used as little as possible. In sans serif fonts, skip italic because the slant is too subtle, and use bold only. **Test:** no span uses a bold-italic face, and emphasized spans are a small share of all characters. Source: [Butterick, Bold or italic](https://practicaltypography.com/bold-or-italic.html).
- [C] Never underline in a printed document; use bold or italic instead. **Test:** no underline decoration on text. Source: [Butterick, Underlining](https://practicaltypography.com/underlining.html).
- [C] All caps is acceptable for headings shorter than one line, labels and small sizes, never for paragraphs. Caps and small caps get 5–12 % extra letterspacing, with kerning on. Sources: [All caps](https://practicaltypography.com/all-caps.html); [Summary of key rules](https://practicaltypography.com/summary-of-key-rules.html).
- [C] Straight quotes are called one of the "most grievous" typographic errors. Use curly quotes and apostrophes, except in code. **Test:** no U+0027 or U+0022 in prose. Source: [Straight and curly quotes](https://practicaltypography.com/straight-and-curly-quotes.html).
- [C] Ranges take an en dash (1880–1912), normally set flush; spaces are allowed if it looks cramped. After "from", write "to", not a dash. Source: [Hyphens and dashes](https://practicaltypography.com/hyphens-and-dashes.html).

#### Headings and vertical space
- [C] Rules for headings:
  - Use three heading levels at most; two is better.
  - Increase the size only a little: with a 12 pt body, try 12.5–13 pt rather than 14–15 pt. A bold heading may even be set 0.5–1 pt smaller.
  - Use bold or italic, not both.
  - Space above and below is the best way to emphasize a heading.
  - Keep each heading with the next paragraph.
  - No all caps, no underline, no centering, no hyphenation in headings.
  - At most two levels of indentation.

  Source: [Butterick, Headings](https://practicaltypography.com/headings.html).
- [C] The space below a heading should be smaller than the space above, so the heading sits with the text it introduces. Where paragraph spacing already exists, heading spacing must be larger than it. Butterick gives no number and calls the amount a judgment call. **Test:** gap from the previous block to the heading is larger than the gap from the heading to its first line, and larger than the gap between paragraphs. Source: [Butterick, Space above and below](https://practicaltypography.com/space-above-and-below.html).

#### Alignment, hyphenation, widows, lists
- [C] Justified text is a matter of preference, not a mark of professionalism. It works by adding white space between words and requires hyphenation. Word processors and browsers justify poorly, and Butterick prefers left-aligned text there. Source: [Justified text](https://practicaltypography.com/justified-text.html).
- [C] Hyphenation is mandatory with justified text and optional with left-aligned text, but it becomes more important as lines get shorter. Suppress it in headings. Consecutive line-end hyphens are shown as an error. Source: [Hyphenation](https://practicaltypography.com/hyphenation.html).
- [C] A widow is the last line of a paragraph alone at the top of the next page. An orphan is the first line alone at the bottom of a page. A widow can be a single word. Butterick doesn't switch on automatic widow/orphan control unless there is a visible problem. He adds that a small word left alone on a paragraph's last line "always looks bad". Source: [Widow and orphan control](https://practicaltypography.com/widow-and-orphan-control.html).
- [C] Lists: use automatic list formatting and avoid asterisks (too small and too high). Butterick prefers hollow bullets because they are subtler. Bullets should be noticeable but no bigger. He gives no numeric indent or gap values. Source: [Bulleted and numbered lists](https://practicaltypography.com/bulleted-and-numbered-lists.html).

#### Layout maxims
- [C] The nine maxims are:
  1. Decide first how the body text will look: size, line length, line spacing, font.
  2. Divide the page into foreground and background.
  3. Make adjustments in the smallest visible increments.
  4. When in doubt, try it both ways.
  5. Be consistent: same treatment for same elements, different treatment for different elements.
  6. Relate each new element to existing ones (grids).
  7. Keep it simple: restrain the urge to use several colors, fonts or logos.
  8. Imitate what you like.
  9. Don't fear white space.

  Source: [Maxims of page layout](https://practicaltypography.com/maxims-of-page-layout.html).

#### Résumé chapter
- [C] The main problem with résumés is that they are "uncomfortably dense with text". Source: [Butterick, Résumés](https://practicaltypography.com/resumes.html).
  - Faults in the "before" example: page margins too small and lines too long; body set in a system font (Calibri); headings and gray boxes too large relative to the body text; the key "where and when" information buried; ugly bullets.
  - Fixes in the "after" example: bigger margins and shorter lines; Calibri replaced by Equity and Concourse; headings no longer dominate; school and employer names easy to notice; gentler bullets; nonessential information moved to page 2.
- [C] Length: unless an employer demands one page, a longer résumé is fine. Never assume the reader gets past page 1, so the most important information goes on page one. Use good letterhead paper, not colored or textured "résumé paper". PDFs are increasingly used to preserve typography. Source: [Résumés](https://practicaltypography.com/resumes.html).

### Inferences
Applied to the design ([M] numbers are measured from the repo fonts):

**Body size.** 10.5 pt is inside the 10–12 pt band. The compact density (10 pt) sits exactly on the floor.

**Line spacing.** Typst's `leading` is not baseline-to-baseline:
- It is the gap between the bottom edge of one line (baseline by default) and the top edge of the next (cap height by default), per the [Typst `par` docs](https://typst.app/docs/reference/model/par/) and [Typst `text` docs](https://typst.app/docs/reference/text/text/). So baseline-to-baseline = cap height + leading.
- [M] Cap heights: Carlito 0.642 em, Source Sans 3 0.660 em, IBM Plex Sans 0.698 em. The OS/2 values match the bounding boxes of the "H" and "x" glyphs.
- With leading 0.55 em, line spacing is **119.2 % (Carlito), 121.0 % (Source Sans 3), 124.8 % (IBM Plex Sans)**. Carlito falls just under Butterick's 120 % floor: 12.51 pt against 12.60 pt at 10.5 pt. The other two are at the bottom of the range.
- Leading needed to reach 120 %: Carlito ≥ 0.558 em, Source Sans 3 ≥ 0.540 em, IBM Plex Sans ≥ 0.502 em. To reach about 130 %: 0.658, 0.640 and 0.602 em. Typst's default 0.65 em would give 129.2 %, 131.0 % and 134.8 %.

**Line length, main column** (10.35 cm = 293.4 pt). [M] Measured with a neutral English + French sample, average width per character including spaces is 0.407 em (Carlito), 0.415 em (Source Sans 3) and 0.448 em (IBM Plex Sans). That gives:

| Font | Characters per line at 10.5 pt | Alphabets at 10.5 pt | Characters per line at 10 pt |
|---|---|---|---|
| Carlito | ~69 | 2.37 | ~72 |
| Source Sans 3 | ~67 | 2.28 | ~71 |
| IBM Plex Sans | ~62 | 2.13 | ~66 |

All are inside 45–90 characters and 2–3 alphabets. Bullet lines lose the hanging indent: at 10.5 pt Carlito, one character ≈ 1.5 mm, so a 5 mm indent costs about 3 characters. Bold text is 2–6 % wider [M].

**Line length, sidebar** (5.7 cm = 161.6 pt). [M] About 38 (Carlito), 37 (Source Sans 3) and 34 (IBM Plex Sans) characters per line, or 1.31, 1.25 and 1.17 alphabets. That is below Butterick's 45 characters / 2 alphabets. It is acceptable for lists of short items, but any running prose in the sidebar would fail his rule.

**Headings.** 12 pt bold is +1.5 pt over a 10.5 pt body, while Butterick would suggest +0.5–1 pt, or the same size in bold, and lean on spacing. The rounded tinted "pills" are the direct analogue of his "gray boxes too large relative to body text". The tester should check that pills don't dominate, for example pill height compared with the body line pitch, and how much tinted area there is.

**Organization and place in dark-grey italic.** This is two de-emphasis cues on the item Butterick wants "easily noticed" (employer/school names), and italic in a sans serif goes against his bold-only advice. It is a deliberate convention (job title first), not an error. It should still be checked against the "where and when" visibility criterion.

**Font choice.** Carlito is metric-compatible with Calibri, so Butterick's "system font" critique carries over. That critique is aesthetic convention, not a legibility finding, and the ATS constraints justify the choice.

**Straight quotes.** The ATS rule `set smartquote(enabled: false)` means any straight quote typed in the source text stays straight. That is a Butterick-level defect unless the stored text already uses ’ (U+2019). Test on the extracted text.

### Gaps
- Butterick gives no numbers for the space above or below headings, the bullet indent, the bullet-to-text gap, or A4 margins. His résumé "after" sample sizes are not given in the text; they would have to be measured from the image.
- *Practical Typography* is an undated, living web book; the content is as accessed on 2026-10-08.

## 2. Bringhurst, Lupton, platform guidelines and legibility research

### Takeaway
Bringhurst's rules:
- A measure of 45–75 characters (66 ideal; 40–50 in multi-column work).
- Leading chosen to suit the typeface, text and measure.
- Sizes drawn from a scale with "a modest set of distinct and related intervals".
- Vertical spaces in measured intervals of the leading.

Research partly agrees: Tinker & Paterson found about 57 characters per line at 10 pt in print, and Dyson & Haselgrove about 55 on screen. But long lines are read faster on screen, and reader preference doesn't follow performance. Lupton's and Material's numbers could not be verified.

### Cited Findings
#### Measure (line length)
- [C] Bringhurst: 45–75 characters suits a single-column page in a serifed text face at text size, with 66 as the ideal. Multi-column work is better at 40–50 on average. Source: [Bringhurst 2.1.2, quoted by R. Rutter](http://webtypography.net/2.1.2).
- [C] Bringhurst is summarized as warning that justified text needs at least about 40 characters per line. Source: [Wikipedia, Line length](https://en.wikipedia.org/wiki/Line_length).
- [R] Tinker & Paterson (1929): 59–97 mm (about 57 characters per line) is optimal for 10 pt print. Source: [Wikipedia, Line length](https://en.wikipedia.org/wiki/Line_length).
- [R][U] Tinker, as summarized in SDSU theses: 10 pt type on a 19-pica (≈ 80 mm) line with 1–2 pt of leading as an ideal combination. Acceptable pairs: 8 pt / 17 picas, 12 pt / 23 picas, 14 pt / 27 picas. Source: [SDSU thesis record](https://openprairie.sdstate.edu/etd/3066) (search snippet).
- [R] Screen studies:
  - Dyson & Haselgrove (2001): about 55 characters per line is the best compromise between speed and comprehension.
  - Dyson & Kipping (1998): 100-character lines were read faster than 25-character lines with the same comprehension.
  - Shaikh (2005): preferences were split between the shortest (35) and longest (95) line lengths.

  Sources: [Wikipedia, Line length](https://en.wikipedia.org/wiki/Line_length); [Dyson & Kipping, *Visible Language*](https://journals.uc.edu/index.php/vl/article/view/5671).
- [R] Weinschenk: "People Read Faster with a Longer Line Length, but they Prefer a Shorter Line Length" (chapter title). Source: [O'Reilly, *100 Things Every Designer Needs to Know About People*, ch. 18](https://oreilly.com/library/view/100-things-every/9780132658638/ch18.html).
- [S] WCAG 2.2, SC 1.4.8 (AAA, web content) requires a mechanism to get:
  - a width of 80 characters or fewer (40 for CJK);
  - no justification;
  - line spacing of at least 1.5;
  - paragraph spacing of at least 1.5× the line spacing;
  - resizing to 200 % without horizontal scrolling.

  It cites Legge et al. 1985 among others. Source: [W3C Understanding 1.4.8](https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html).

#### Leading and vertical rhythm
- [C] Bringhurst 2.2.1: choose a basic leading that suits the typeface, text and measure. Leading is the baseline-to-baseline distance, the basic rhythmic unit, and no fixed ratio is given. Rutter's web adaptation says line-heights of 1.3 and above are typical. Source: [webtypography.net 2.2.1](http://webtypography.net/2.2.1).
- [C] Bringhurst 2.2.2: add and delete vertical space in measured intervals. After headings and other "intrusions", the main text should return "on beat and in phase". Rutter applies this as heading margins in multiples of the base line-height. Source: [webtypography.net 2.2.2](http://webtypography.net/2.2.2).
- [S] Typst settings (online docs):
  - `par.leading` is the space between the bottom edge of one line and the top edge of the next (default 0.65em).
  - `par.spacing` is the space between paragraphs (default 1.2em) and collapses to the larger of adjacent values.
  - `text.top-edge` defaults to "cap-height" and `bottom-edge` to "baseline".
  - `tracking` defaults to 0pt and word `spacing` to 100%.
  - `hyphenate: auto` hyphenates only when text is justified.

  Sources: [Typst `par`](https://typst.app/docs/reference/model/par/); [Typst `text`](https://typst.app/docs/reference/text/text/).

#### Ragged setting, spacing and hyphenation (Bringhurst §2.1, §2.4)
- [C] Rule 2.1.3: set ragged if ragged setting suits the text and page. Narrow (multi-column) measures set ragged lighten the page, and "many unserifed faces look best when set ragged" at any measure. Source: [webtypography.net 2.1.3](http://webtypography.net/2.1.3).
- [C] Other rule titles, all from [webtypography.net table of contents](http://webtypography.net/toc/):
  - 2.1.4 Use a single word space between sentences.
  - 2.1.6 Letterspace strings of caps, small caps and long digit strings.
  - 2.1.7 Don't letterspace the lower case without a reason.
  - 2.1.8 Kern consistently and modestly, or not at all.
  - 2.1.9 Don't alter the widths or shapes of letters.
  - 2.1.10 Don't stretch the space until it breaks.
  - 2.4.1 At hyphenated line ends, leave at least 2 characters behind and take at least 3 forward.
  - 2.4.3 Avoid more than three consecutive hyphenated lines.
  - 2.4.6 Link short numerical expressions with hard spaces.
  - 2.4.8 Never begin a page with the last line of a multi-line paragraph.

#### Scale, number of sizes, contrast between levels
- [C] Bringhurst 3.1.1, "Don't compose without a scale": use the old scale or one of your own, but at first limit yourself to "a modest set of distinct and related intervals". Source: [webtypography.net 3.1.1](http://webtypography.net/3.1.1).
- [C][U] The classical scale as recorded by Bringhurst is 6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 21, 24, (30), 36, 48, 60, 72. This summary includes 30; other renderings omit it. Source: [Spencer Mortensen, The typographic scale](https://spencermortensen.com/articles/typographic-scale) (snippet).
- [C] Tim Brown's modular scale (*A List Apart* no. 327, 2011-05-03): sizes come from a meaningful ratio (his example is the golden ratio, 1.618), multiplied and divided from the body size and a second important number. He calls it "a tool, not magic". Source: [More Meaningful Typography](https://alistapart.com/article/more-meaningful-typography/).
- [C] Robin Williams (*The Non-Designer's Design Book*): elements that are "not really different and not really the same" create conflict, not contrast. "Don't be a wimp": combine several contrasts (size, weight and so on). Source: [I'd Rather Be Writing, 2009-01-03](https://idratherbewriting.com/2009/01/03/contrast-is-prominent-in-good-design/).
- [C][U] Williams's example that 12 pt next to 13 pt reads as a mistake appeared only in a search summary and was not in the fetched page. Source: [O'Reilly, ch. 5 Contrast](https://www.oreilly.com/library/view/the-non-designers-design/9780321563088/ch05.html).

#### Bullets and hanging indents
- [C][U] Ilene Strizver (CreativePro, "TypeTalk: Biting the Bullet") describes two acceptable treatments for wrapped bullet lines. Either flush with the bullet, which gives a cleaner edge, or aligned with the first line's text (a hanging indent), which gives more emphasis. The professional hanging setting uses "indent to here", never manual line breaks or tabs. Source: [CreativePro](https://creativepro.com/?p=7513) (fetch returned 403; content from search snippet).

#### Platforms
- [S][U] Apple Human Interface Guidelines: minimum text size of 11 pt on iOS and iPadOS, according to secondary summaries; the official page did not render for the fetcher. Sources: [Median.co summary](https://median.co/blog/apples-ui-dos-and-donts-typography); [Apple HIG Typography](https://developer.apple.com/design/human-interface-guidelines/typography).

### Inferences
**Measure.** The main column (62–69 characters at 10.5 pt) is inside Bringhurst's 45–75 and close to his ideal of 66. Compact Carlito (about 72 characters at 10 pt) approaches the upper bound of 75; Butterick's 90 is looser. The sidebar (34–40 characters) is at or below Bringhurst's 40–50 for multi-column work. Tinker's acceptable pairing of 12 pt with a 23-pica line puts a 24.4-pica column (103.5 mm) at the right order of magnitude for 10.5–12 pt. His 10 pt optimum (about 19 picas) is shorter. The research supports the range, not a precise number.

**Sizes.** The page uses 26 pt (name), 13 pt (title), 12 pt (headings) and 10.5 pt (body), plus any smaller contact or sidebar sizes: four or five sizes in all.
- 10.5 and 13 are off the classical scale.
- Ratios to the body are 2.48×, 1.24× and 1.14×.
- On a 1.25 progression from 10.5 pt (13.1, 16.4, 20.5, 25.6), the title is about step 1 and the name about step 4.
- The 12 pt headings sit off-scale, 1 pt below the title (ratio 1.08). That is a Williams-style "conflict" risk, reduced only by the other cues (pill, accent color, bold).

**Rhythm test** (Bringhurst 2.2.2). Vertical gaps between entries and around headings should be multiples, or simple fractions, of the body baseline-to-baseline distance: 12.5 pt (Carlito), 12.7 pt (Source Sans 3) or 13.1 pt (IBM Plex Sans) at 10.5 pt. This is a rhythm and consistency test, not a legibility test.

**Hanging indent test.** The x position where continuation lines start equals the x position of the first line's text (±0.5 pt), which is greater than the bullet's x. The bullet-to-text gap is identical for every bullet.

#### Disagreements to report
- **Line length:**
  - Butterick: 45–90 characters.
  - Bringhurst: 45–75, with 66 ideal.
  - WCAG 1.4.8: 80 or fewer.
  - Dyson & Haselgrove: about 55 on screen.
  - Dyson & Kipping: 100 is read faster.
  - Readers prefer shorter or extreme lengths.
- **Leading:**
  - Butterick: 120–145 %.
  - WCAG 1.4.8 (AAA, web): 150 % or more.
  - Word "single" ≈ 117 %.
  - Bringhurst gives no number.
- **Heading contrast:**
  - Butterick: minimal steps of 0.5–1 pt.
  - Williams: strong, multi-cue contrast.
  - Clear-print guidance: headings at least 20 % larger (section 5).
- **Italic in sans serif:** Butterick and the French guides say avoid it; US university guides allow it if used consistently.

### Gaps
- Ellen Lupton, *Thinking with Type*: no reliable page was retrieved. Search returned spam mirrors and the thinkingwithtype.com fetch failed, so her line-length and leading values are not verified here.
- Material Design 3 baseline type scale: not verified. The official site is JavaScript-only, and the material-web docs show only a token-naming example.
- Apple HIG numbers come from secondary sources only.
- Bringhurst's own leading examples (such as 10/12) and any rule of his on bullets or hanging punctuation were not verified.
- Tinker's numbers beyond the Wikipedia summary were seen only in snippets; rightreading.com refused the connection.

## 3. Typographic defects a designer checks: definitions and how to detect them

### Takeaway
On a one-page, ragged-right CV with no hyphenation, the defects that can actually occur are:
- runts (a single word on a bullet's last line);
- bad rag;
- inconsistent punctuation spacing and date formats;
- straight quotes;
- over-emphasis (too many style channels);
- weak contrast between hierarchy levels;
- color misuse and contrast failures;
- misalignment and inconsistent vertical spacing;
- a heading separated from its entry at a column or page break.

Rivers and stacked hyphens are structurally unlikely, since there is no justification and no hyphenation. Terminology conflicts between authorities, so Typst's own definitions (`text.costs`) are a convenient operational standard.

### Cited Findings
#### Definitions
- [S] Typst `text.costs` (all defaults 100 %):
  - runt: "ending a paragraph with a line with a single word";
  - widow: leaving a single line of a paragraph on the next page;
  - orphan: leaving a single line on the previous page;
  - hyphenation: splitting a word across lines.

  Source: [Typst `text`](https://typst.app/docs/reference/text/text/).
- [C] Wikipedia definitions:
  - widow: a paragraph-ending line at the top of the next page or column;
  - orphan: a paragraph-opening line alone at the bottom;
  - runt: a word, part of a word or very short line alone at the end of a paragraph.

  Terminology is not standardized and is sometimes reversed. The *Chicago Manual of Style* 15th edition (2003) required eliminating both widows and orphans; the 16th (2011) relaxed this and lets a page end with a paragraph's first line. Source: [Wikipedia, Widows and orphans](https://en.wikipedia.org/wiki/Widows_and_orphans).
- [C] Conflicting usage from Ilene Strizver (Fonts.com/MyFonts Fontology):
  - "widow": a very short line, usually one word or the end of a hyphenated word, at the end of a paragraph or column (that is, a runt);
  - "orphan": a single word or short line at the start of a column or page;
  - rag: the irregular vertical edge of a block of type. A good rag moves in and out in small increments; a bad rag "creates distracting shapes of white space". Fix it by editing, manual breaks, or changing the size or column width. She gives no numbers.

  Source: [MyFonts/Fonts.com, Rags, widows & orphans](https://www.myfonts.com/pages/fontscom-learning-fontology-level-2-text-typography-rags-widows-orphans).
- [S] French terms (OQLF):
  - *ligne creuse* (synonym *ligne boiteuse*): a line whose text does not fill the measure, most often a paragraph's last line (English: short line, break line). [Fetched; OQLF, updated 2023.](https://vitrinelinguistique.oqlf.gouv.qc.ca/fiche-gdt/fiche/8889871/ligne-creuse)
  - *veuve*: a paragraph's last line, usually a *ligne creuse*, isolated at the top of the next page or column. [OQLF *ligne veuve*](https://vitrinelinguistique.oqlf.gouv.qc.ca/fiche-gdt/fiche/8382641/ligne-veuve) (definition from search summary).
  - *orpheline*: a paragraph's first line isolated at the bottom of a page or column. [OQLF *ligne orpheline*](https://vitrinelinguistique.oqlf.gouv.qc.ca/fiche-gdt/fiche/26561167/ligne-orpheline) (definition from search summary).
- [C] Bringhurst 2.4.8: never begin a page with the last line of a multi-line paragraph. Source: [webtypography.net TOC](http://webtypography.net/toc/).
- [U] Bringhurst is summarized as tolerating orphans more than widows ("orphans have no past but a future; widows have a past but no future"). Source: search summary attributed to [Wikipedia](https://en.wikipedia.org/wiki/Widows_and_orphans).
- [C][U] River (French *lézarde*): a channel of white space formed when word spaces line up by coincidence. It is mostly seen in justified text or loose spacing; the fix is to reduce variation in word spacing to even out the *gris typographique*. Sources: [Elephorm (FR)](https://www.elephorm.com/formation/maitriser-indesign-2026-les-fondamentaux/supprimer-les-lezardes-maitrise-de-la-justification-et-de-la-cesure); [CreativePro, "A River Runs Through It"](https://creativepro.com/type-how-to-a-river-runs-through-it/) (snippets).
- [C] Justification adds white space between words, and without hyphenation the gaps become "gruesome". Source: [Butterick, Justified text](https://practicaltypography.com/justified-text.html).
- [C][U] Bad rag patterns: a "staircase" of line endings stepping consistently in or out, or a rag so straight it reads as a vertical river. Source: [TechRepublic](https://www.techrepublic.com/article/how-to-fix-your-rags-widows-and-orphans/) (snippet).
- [C] Stacked hyphens: avoid more than three consecutive hyphenated lines (Bringhurst 2.4.3); Butterick shows consecutive line-end hyphens as an error. Sources: [webtypography.net 2.4.3](https://webtypography.net.clagnut.com/2.4.3); [Butterick, Hyphenation](https://practicaltypography.com/hyphenation.html).
- [C] A heading separated from its text at a break: use "keep with next". Source: [Butterick, Headings](https://practicaltypography.com/headings.html).

#### Punctuation spacing, dashes, quotes, dates
- [S] French spacing, OQLF table (updated 2024). [OQLF, *Espacement avant et après les signes de ponctuation*](https://vitrinelinguistique.oqlf.gouv.qc.ca/22039/la-typographie/espacement/espacement-avant-et-apres-les-signes-de-ponctuation-et-les-symboles).
  - Colon: non-breaking space before, normal space after.
  - ; ! ?: the OQLF opts for no space before. A thin non-breaking space is acceptable and is French (France) usage.
  - « »: non-breaking spaces inside.
  - %: non-breaking space before.
  - Parentheses: no inner spaces.
  - Dash in running text (*tiret*): non-breaking spaces around it.
- [C] English ranges use an en dash, normally closed up: 2019–2021. Source: [Butterick, Hyphens and dashes](https://practicaltypography.com/hyphens-and-dashes.html).
- [C][U] French ranges: traditional French typography uses a (non-breaking) hyphen for simple intervals (1939-1945). When the ends of the range are compound, it uses a spaced en dash ("15 août 1769 – 5 mai 1821"). The Anglo-American tradition uses the en dash. Sources: [Hapax U2000 table](https://hapax.qc.ca/Tableaux-15.0/U2000.pdf); [EFA, *Normes typographiques*](https://fiches-pratiques.efa.gr/books/les-normes/page/normes-typographiques/export/pdf) (snippets).
- [C] Use a single word space between sentences (2.1.4), and hard spaces inside short numerical expressions (2.4.6). Source: [webtypography.net TOC](http://webtypography.net/toc/).
- [G] Consistency in career guides:
  - Harvard: "Be consistent in format and content", with consistent spacing, underlining, italics, bold and capitalization. [Harvard Mignone Center](https://careerservices.fas.harvard.edu/resources/create-a-strong-resume/)
  - MIT UPOP: pay attention to small formatting details such as boldface and italics; "Dates: Spell out Month and Year right-justified"; proofread the dates. [MIT UPOP PDF](https://upop.mit.edu/wp-content/uploads/2024/02/UPOP_Resume_Guidelines.pdf)

#### Emphasis, hierarchy, color
- [G] MIT UPOP lists over-formatting to avoid: "multiple fonts, underlining, graphics or colors". Source: [MIT UPOP](https://upop.mit.edu/wp-content/uploads/2024/02/UPOP_Resume_Guidelines.pdf).
- [S] Clear print guidance: use bold, caps and italics only occasionally; never underline; don't use colour alone to convey information. Source: [Sensory Trust factsheet](https://www.sensorytrust.org.uk/information/factsheets/access-information-print.html).
- [S] WCAG 2.2, SC 1.4.3: contrast of at least 4.5:1 for text and 3:1 for large-scale text. Large scale means at least 18 pt regular or 14 pt bold. Source: [W3C Understanding 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- [G] French guides on color:
  - Randstad: 2–3 colours at most, and no light text on a light background. [Randstad, 2025-10-23](https://www.randstad.fr/conseils-carriere/cv/comment-faire-une-bonne-presentation-cv-conseils-exemples/)
  - Rekrute: one colour besides black is enough. [Rekrute](https://www.rekrute.com/emplois-une-mise-en-page-lisible-pour-votre-cv-conseils-carriere-803.html) (snippet)
- [C] Williams: contrast versus conflict, as above. Source: [I'd Rather Be Writing](https://idratherbewriting.com/2009/01/03/contrast-is-prominent-in-good-design/).
- [C] Butterick's maxims: be consistent, keep it simple, relate each element to existing ones. Source: [Maxims of page layout](https://practicaltypography.com/maxims-of-page-layout.html).

### Inferences
#### A. Criteria matrix (thresholds to test on the finished PDF)
| # | Criterion (source class) | Threshold | Design value to check | How to measure on the PDF |
|---|---|---|---|---|
| 1 | Body size [C][G] | 10–12 pt (Butterick, MIT, FR guides); 12 pt minimum for clear print [S] | 10.5 pt; 10 pt compact | Font-size histogram weighted by characters; take the mode |
| 2 | Smallest text [G][S] | Career guides: ≥ 10 pt for all text. Project lint: < 9 pt is blocking | Contact and sidebar sizes | Minimum span size |
| 3 | Line spacing [C] | Baseline-to-baseline ÷ size between 1.20 and 1.45 | [M] 1.192 / 1.210 / 1.248 at 0.55 em | Δy between consecutive baselines in the same paragraph |
| 4 | Line length, main column [C] | 45–90 characters (Butterick); 45–75, 66 ideal (Bringhurst); 2–3 alphabets | [M] ~62–69 characters | Mean characters on non-final lines of multi-line paragraphs |
| 5 | Line length, sidebar [C] | Multi-column 40–50 (Bringhurst); prose ≥ 45 (Butterick) | [M] ~34–40 characters | As above; flag sidebar paragraphs of 3+ lines |
| 6 | Emphasis channels [C][G] | No bold+italic; no underline; italic avoided in sans serif (Butterick) or used consistently (US guides) | Bold titles, bold accent dates, grey italic organizations, pills | List of (font face, size, color, background) tuples per role |
| 7 | Hierarchy contrast [C][S] | Headings ≥ 20 % larger (clear print), or a clearly different cue (Williams); small steps acceptable to Butterick | 12/10.5 = 1.14; 13/12 = 1.08 | Size ratios of adjacent levels plus cue difference |
| 8 | Space above heading > space below [C] | Strictly greater, and greater than paragraph spacing | Pill margins | Vertical gaps from text bounding boxes and the pill rectangle |
| 9 | Text contrast [S] | ≥ 4.5:1. 12 pt bold is not "large" (that needs 14 pt bold), so pill text needs 4.5:1 | Accent on pill tint; grey on white; text on the sidebar tint | Fill color of text and of the shape behind it |
| 10 | Margins [G][C] | 0.5–1 in (1.27–2.54 cm), MIT; project ≥ 1.5 cm | Template | Minimum distance from any text or graphic box to the page edge |
| 11 | Dates [G] | One format and one dash style per language; right-aligned edges identical | Right-aligned bold accent dates | Regex over date strings; x_max of date items equal (±0.5 pt) |
| 12 | Quotes [C] | No straight quotes in prose | `smartquote` disabled | Search for U+0027 and U+0022 in extracted text |

#### B. Defect checklist (definition, does it apply, test)
**Runt / *ligne creuse*.**
- Applies: yes. This is the most likely defect, given ragged setting, no hyphenation, and the short sidebar measure.
- Fail: the last line of any multi-line bullet holds a single word (the Typst definition).
- Warn, my heuristic: the last line has fewer than 10 characters or covers less than 15 % of the measure.
- Measure: group text items by baseline; a paragraph is consecutive lines sharing the same left x and pitch; count the words on its last line.

**Widow and orphan at a page or column break.**
- Applies only to a two-page output or a flowing column.
- Fail: a split paragraph leaves one line on either side, or a heading ends a column or page (keep-with-next failure).
- Measure: check the first and last lines at each break.

**Bad rag.**
- Applies: yes, worst in the sidebar. Butterick notes that hyphenation matters more as lines get shorter.
- Warn, my heuristic: a non-final line under 70 % of the measure (a hole), or three or more consecutive non-final lines whose length changes in the same direction by more than 10 % of the measure each (a staircase or wedge).
- Measure: non-final line widths ÷ column width.

**Rivers.**
- Applies: unlikely, since the text is ragged with fixed word spacing (Typst `spacing` 100 %, no justification).
- Check: inter-word gaps within a line are equal (±0.3 pt). If so, rivers can only be coincidental; confirm by eye with a blur or squint test.

**Stacked hyphens.**
- Applies: no, because hyphenation is off and the project boxes compound words.
- Test: no line ends with "-" (U+002D/U+2010). If hyphenation is ever enabled: at most 3 consecutive hyphenated lines, and the 2/3 rule.

**Punctuation spacing.**
- French: ":" is preceded by U+00A0 or U+202F. Before ";", "!" and "?", use either a thin non-breaking space throughout (France) or nothing throughout (OQLF): consistency is the test. « » take non-breaking spaces inside.
- English: no space before ":", ";", "!" or "?".
- Never two spaces in a row.
- Measure: regex on text per language. Extractors may turn non-breaking spaces into plain spaces (see Gaps), so test the projection or Typst source if needed.

**Mixed date formats.**
- Applies: yes.
- Test: every range matches one pattern per language: same month form (spelled out or abbreviated), same dash and spacing, same "present" or *aujourd'hui* token.

**Straight quotes.** As matrix row 12.

**Too many emphasis channels.**
- Applies: yes. The design combines size, bold, accent color, italic, grey and pill backgrounds.
- Fail: any bold-italic span; two different roles styled identically; one role styled two ways.
- Warn: one element carries more than two cues beyond its size (my heuristic).

**Weak hierarchy contrast.**
- Applies: yes, for heading (12 pt) against title (13 pt).
- Warn: adjacent levels differ by less than 1.2× in size and share weight and color, which is Williams's "conflict".

**Color misuse.**
- Applies: yes.
- Fail: any text color below 4.5:1 against its actual background (white, pill tint or sidebar tint).
- Warn: more than one accent hue plus greys (French guides: 2–3 colours at most; MIT: avoid colors).
- Grayscale print test: dates and headings stay distinguishable without hue, which bold ensures.

**Misalignment or inconsistent spacing.**
- Applies: yes.
- Warn, my heuristic: more than three distinct left x positions per column (column edge, bullet, bullet text).
- Fail: right-aligned dates don't share x_max; equivalent gaps differ by more than 0.5 pt.

**Underline, all-caps paragraphs, letterspaced lowercase, faked bold or italic.**
- Applies: guarded by the template rules (tracking 0).
- Check: `pdffonts` lists real Bold and Italic faces (for example Carlito-Bold), not synthesized ones (Bringhurst 2.1.9).

#### C. Measurement toolkit
- **Text and positions.** The repo already contains `pdfjs-dist` (in `node_modules`). `getTextContent()` gives, per item, the string, the transform (x, y of the baseline, and a scale that equals the font size when unrotated), the width, and the font name. Colors and filled rectangles such as pills and the sidebar tint require `getOperatorList()`.
- **Poppler.** `pdftotext -bbox-layout`, already used by `test:ats`, gives word, line and block boxes. `pdffonts` lists the embedded faces.
- **Grouping.** Group items into lines by baseline (±0.5 pt), then into paragraphs by shared left x and constant pitch. PDF items can split or merge words.
- **Source-side checks.** The Typst source and the projection already know sizes, leading and spacing, so several checks (sizes, minimum size, contrast) are better done statically, as the template linter already does for text under 9 pt.

### Gaps
- No authoritative numeric threshold exists for runts (beyond Typst's "single word") or for bad rag. The 10-character, 15 %, 70 % and 10 % values above are my heuristics.
- Not verified: whether Typst's `costs.runt` applies under `linebreaks: "simple"` (first-fit), which may be the default for non-justified paragraphs. The fetched `par` doc lists the two algorithms but its default was not captured; check empirically, for example with `linebreaks: "optimized"`.
- Not verified: whether pdf.js and Poppler keep U+00A0 and U+202F in extracted text.
- No source was found for "stacks" (the same word repeated at consecutive line starts or ends), a defect some designers check.

## 4. CV-specific guides (career services, English and French)

### Takeaway
University guides converge on:
- 10–12 pt for all text, with no separate allowance for contact details;
- one font;
- margins of 0.5–1 in;
- restrained, consistent bold and italics;
- dates spelled out and right-aligned (MIT); don't start each line with a date (Harvard).

French guides (commercial career platforms) say 10 pt minimum, 11–12 preferred, one font, avoid italics and all caps, and 2–3 colours at most. Butterick dissents on length (two pages are fine) and wants employer names prominent.

### Cited Findings
- [G] MIT UPOP *Resume Guidelines* (PDF, uploaded February 2024). Source: [MIT UPOP](https://upop.mit.edu/wp-content/uploads/2024/02/UPOP_Resume_Guidelines.pdf).
  - Margins ½–1 in; one page.
  - One font for the whole document, no script fonts (Arial, Times New Roman, Calibri and similar).
  - Font size 10–12 pt.
  - Consistent boldface and italics.
  - Submit a PDF with your name in the file title.
  - Name in a large font at the top.
  - Dates: month and year spelled out, right-justified.
  - Location alongside the company or position.
  - Avoid over-formatting (multiple fonts, underlining, graphics or colors).
  - US companies don't expect headshots.
  - Review a printed copy to check formatting.
- [G] *Harvard College Guide to Creating a Strong Resume* (Mignone Center; page © 2026). This page gives no numeric font or margin rules. Source: [Harvard](https://careerservices.fas.harvard.edu/resources/create-a-strong-resume/).
  - Be consistent in format and content.
  - Make it easy to read, balancing white space.
  - Use consistent spacing, underlining, italics, bold and capitalization for emphasis.
  - Reverse chronological order; headings in order of importance.
  - "Don't start each line with a date."
  - Formatting must survive conversion to PDF.
- [G][U] Harvard templates and other Harvard guides, via search summaries: 10–12 pt (11 recommended) and margins of 0.5–1 in (0.8–1 recommended). Source: [Harvard HES guide PDF](https://cdn-careerservices.fas.harvard.edu/wp-content/uploads/sites/161/2023/08/HES_resume-and-letter.pdf) (404 when fetched).
- [G][U] Stanford Career Education, via search summary: 10–12 pt, or 11–12 pt for fonts that run small such as Times New Roman; margins of 0.75–1.0 in, with top and bottom down to 0.5 in. Source: [Stanford document](https://neuroscience.stanford.edu/sites/default/files/4_easy_steps_to_writing_your_resume.docx) (not fetched).
- [G] Ladders eye-tracking study, 2018, reported by HR Dive (Riia O'Donnell, 2018-11-08). This is a commercial study; the article gives no sample size or method. Source: [HR Dive](https://www.hrdive.com/news/eye-tracking-study-shows-recruiters-look-at-resumes-for-7-seconds/541582/).
  - The initial screen averages 7.4 s (6 s in 2012).
  - Did well: simple layouts with clear sections and headings, E- or F-pattern layouts, bold titles, bulleted accomplishments.
  - Did poorly: cluttered layouts, too little white space, multiple columns, long sentences.
- [G] JobTeaser (France, 2025-06-23, by "Laura"). Source: [JobTeaser](https://www.jobteaser.com/fr/advices/meilleures-et-pires-polices-cv).
  - Body text at 12; section titles larger and bold.
  - One font; avoid italics, all caps and multiple typefaces.
  - Must be readable on screen and on paper.
  - Avoid narrow fonts.
- [G] Randstad France (2025-10-23). Some of this conflicts with ATS-oriented and Ladders advice. Source: [Randstad](https://www.randstad.fr/conseils-carriere/cv/comment-faire-une-bonne-presentation-cv-conseils-exemples/).
  - Minimum 10 pt, preferably 11–12; section titles larger and bold.
  - 2–3 colours at most; no light text on light backgrounds.
  - PDF; one page, two at most.
  - Recommends a two-column layout and skill bars or stars.
- [G][U] stylingcv (French, commercial). Source: [stylingcv](https://stylingcv.com/fr/2025/02/28/meilleures-polices-cv-guide-complet-2026/) (snippet).
  - Body 10–12 pt, section titles 12–14 pt, name 16–20 pt; never below 10 pt.
  - Black or dark-grey text.
  - Print a test copy: small text readable on screen can be illegible on paper.
- [G] Resume Genius (2026-04-10): 1 in margins by default, never below 0.5 in or above 1 in. It also claims, from its own survey, that 72 % of hiring managers say poor spacing and alignment lowers their opinion of a résumé. Source: [Resume Genius](https://resumegenius.com/how-to-write-a-resume/resume-fonts-margins-paper-guidelines).
- [C] Butterick: a résumé may run longer than one page unless one page is demanded; key information goes on page 1; school and employer names should be easy to notice; dates and places should not be buried. Source: [Butterick, Résumés](https://practicaltypography.com/resumes.html).

### Inferences
**Sizes.** The design passes the common 10–12 pt band at 10.5 pt; compact 10 pt is on the floor. Any contact or sidebar text at 9–9.5 pt, which the project's 9 pt floor allows, falls below every career guide's minimum. Suggested test: no text below 10 pt except a footer or legal line.

**Margins.** The project minimum of 1.5 cm (0.59 in) sits inside the 0.5–1 in band (1.27–2.54 cm). Butterick's 1.5–2 in is a different context: US letter, long documents, 12 pt.

**Dates.** Right-aligned dates on the job-title line match MIT ("right-justified") and Harvard ("don't start each line with a date").

**Italic organizations.** French guides (JobTeaser) and clear-print guidance advise avoiding or limiting italics; US university guides accept italics if used consistently.

**Colors.** Black, dark grey and one accent make 3 colours, at the upper limit of Randstad's 2–3. MIT advises avoiding colors altogether, the conservative US norm.

**Visual template** (two columns, photo). Market norms disagree. Ladders found multiple columns did poorly, and MIT says US employers don't expect headshots. Randstad (France) recommends two columns.

### Gaps
- Current Harvard numeric guides (PDFs returned 404) and the Stanford and Cornell pages could not be retrieved; their numbers here are unverified snippets.
- No page from a French public body (Apec, France Travail, Onisep) with typographic numbers was retrieved. The French guidance here comes from commercial career platforms.
- No guide gives a separate minimum for contact details or other small text; every range applies to the whole document.
- The Ladders study's methodology (sample size, peer review) is not available.

## 5. Ratios between name, title, headings and body; space above vs below headings

### Takeaway
No research backs any particular size ratio; the conventions diverge. Butterick wants headings only 0.5–1 pt larger, or the same size in bold. Clear-print guidance wants headings at least 20 % larger. Williams wants unmistakable, multi-cue contrast.

A defensible test (my inference) has three parts:
- the name is at least 2× the body size;
- each hierarchy level differs from its neighbors by at least 1.2× in size, or by a clearly different cue (weight, color, case, box);
- the space above a heading is larger than the space below it and larger than paragraph spacing, ideally a multiple of the body line pitch.

### Cited Findings
- [C] Butterick, Headings: increase heading size by 0.5–1 pt (12 → 12.5–13 pt); a bold heading may be 0.5–1 pt smaller; space above and below is the best emphasis; three levels at most. Source: [Headings](https://practicaltypography.com/headings.html).
- [C] Butterick: emphasize by half-point steps, and adjust in the smallest visible increments. Sources: [Point size](https://practicaltypography.com/point-size.html); [Maxims](https://practicaltypography.com/maxims-of-page-layout.html).
- [S] Clear print: headings should be at least 20 % larger than body text. Source: [Sensory Trust](https://www.sensorytrust.org.uk/information/factsheets/access-information-print.html).
- [C] Williams: elements that are only "sort of" different create conflict; contrast must be strong and combine several attributes. Source: [I'd Rather Be Writing](https://idratherbewriting.com/2009/01/03/contrast-is-prominent-in-good-design/).
- [C] Bringhurst: use a modest set of distinct, related intervals. Tim Brown: a ratio-based modular scale. Sources: [webtypography.net 3.1.1](http://webtypography.net/3.1.1); [A List Apart](https://alistapart.com/article/more-meaningful-typography/).
- [G] MIT UPOP: "Name: large font, top of the page". Source: [MIT UPOP](https://upop.mit.edu/wp-content/uploads/2024/02/UPOP_Resume_Guidelines.pdf).
- [G][U] Commercial French guide: name 16–20 pt, section titles 12–14 pt, body 10–12 pt. Source: [stylingcv](https://stylingcv.com/fr/2025/02/28/meilleures-polices-cv-guide-complet-2026/) (snippet).
- [C] The space below a heading should be smaller than the space above, and heading spacing larger than paragraph spacing. Source: [Butterick, Space above and below](https://practicaltypography.com/space-above-and-below.html).
- [C] Vertical space should come in measured intervals, so the text returns "on beat". Source: [webtypography.net 2.2.2](http://webtypography.net/2.2.2).
- [S] Typst defaults: paragraph spacing 1.2em against leading 0.65em, so by default the gap between paragraphs is about 1.85× the gap between lines. Source: [Typst `par`](https://typst.app/docs/reference/model/par/).
- [S] WCAG 1.4.8 (AAA): paragraph spacing at least 1.5× line spacing. Source: [W3C 1.4.8](https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html).
- [C] Butterick: 4–10 pt between paragraphs, about 50–100 % of the body size. Source: [Space between paragraphs](https://practicaltypography.com/space-between-paragraphs.html).

### Inferences
**Size ratios in the design:**

| Element | Size | Ratio to 10.5 pt body | Verdict |
|---|---|---|---|
| Name | 26 pt | 2.48× | Passes ≥ 2×. Above the commercial 16–20 pt band, which is normal for a visual header |
| Title | 13 pt | 1.24× | Passes the clear-print ≥ 1.2× |
| Section headings | 12 pt | 1.14× | Below clear-print's 1.2×, above Butterick's +1 pt; distinguished only by bold, accent color and pill |
| Job title | 10.5 pt bold | 1.0× | Weight-only contrast, which Butterick accepts |

Heading against title is 1.08× (1 pt apart). That is a Williams "conflict" risk unless their styling differs clearly. Two clean options: the same size with a different treatment, or a ratio of at least 1.2×. In the compact density with a 10 pt body, the ratios become 1.2× (heading), 1.3× (title) and 2.6× (name), assuming those sizes don't scale with the body (to verify).

**Modular fit.** The name and title approximate a 1.25 progression from 10.5 pt (13.1 / 16.4 / 20.5 / 25.6): the title is about step 1 and the name about step 4. The 12 pt heading is off that progression.

**Proposed spacing thresholds** (my inference; no authoritative ratio was found):
- the space above a heading is at least 1.5× the space below it;
- the space above is at least one body line pitch (about 12.5–13.1 pt at 10.5 pt);
- all gaps of the same kind are equal to within 0.5 pt.

Measure the space above from the bottom of the last text box or descender of the previous section to the top of the pill rectangle. Measure the space below from the bottom of the pill to the cap height of the entry's first line, or compare baselines.

**Observation for the tester.** The templates set `#set par(justify: false, leading: gap, spacing: gap)`, so paragraph spacing equals leading (`packages/render/templates/visuel.typ`, `ats-classique.typ`, `lettre.typ`). Consecutive paragraphs and tight list items are therefore separated by no more than the lines inside a paragraph, unless the templates add `v()` elsewhere. Butterick (4–10 pt between paragraphs when there are no indents) and WCAG 1.4.8 both expect a visible paragraph gap, although tight résumé bullet lists are common practice. Check how entries and bullets are separated.

### Gaps
- No empirical study was found on the best size ratios between a CV's name, headings and body; all ratio advice is convention.
- No authoritative number exists for the ratio of space above to space below a heading. The commonly repeated "2:1 to 3:1" appeared only in low-quality sources (an npm-hosted "design principles" file) and is not cited as a finding.

## 6. Screen vs print: is 10–10.5 pt comfortable, and what do accessibility minimums say?

### Takeaway
**On paper**, for normal vision at about 40 cm, 10–10.5 pt in these fonts is within the research "fluent range". The x-height subtends 0.24–0.27°, above the 0.2° critical print size and comparable to newspapers and books (0.23–0.24°).

**For accessibility**, clear-print guidance asks for 12 pt minimum, 14 pt preferred, and an x-height of at least 2 mm (RNIB, unverified). At 10.5 pt these fonts don't meet that: their x-height is 1.77–1.91 mm.

**On screen**, a 10.5 pt A4 PDF shows at 14 CSS px at 100 % zoom, just below Butterick's 15–25 px web range. Fitted to a phone's width it shows at about 7 px, far below Apple's 11 pt minimum, so phone reading needs zooming and panning.

CV guides handle this by telling people to check the document on both screen and paper, not by raising the size. The NN/g user-experience research says PDFs are poor for on-screen and especially mobile reading.

### Cited Findings
- [R] Legge & Bigelow (2011), "Does print size matter for reading?", *Journal of Vision* 11(5):8. Source: [PMC3428264](https://pmc.ncbi.nlm.nih.gov/articles/PMC3428264/).
  - The critical print size is about 0.2° of x-height: about 1.4 mm, or a 4 pt x-height, at 40 cm.
  - The fluent range runs from 0.2° to 2°, a 10-fold range, for normal vision.
  - Newspaper running text averages 0.23° (1.64 mm x-height); hardcover and paperback books 0.24°.
  - At 40 cm, angle in degrees ≈ x-height in points ÷ 20.
  - "virtually all running text" lies within the fluent range.
- [C] Butterick: 10–12 pt in print and 15–25 px on the web, because screens are viewed from farther away. Source: [Point size](https://practicaltypography.com/point-size.html).
- [S] W3C: 1 pt = 1.333 CSS px, so 14 pt ≈ 18.5 px and 18 pt ≈ 24 px. Source: [W3C Understanding 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- [S] WCAG 1.4.8 (AAA): 80 characters or fewer, no justification, line spacing at least 1.5, paragraph spacing at least 1.5× line spacing, resizing to 200 % without horizontal scrolling. Source: [W3C 1.4.8](https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html).
- [S][U] US Web Design System: body text at an effective size of at least 16 px; 80 characters or fewer per line on desktop. Source: [USWDS Typography](https://designsystem.digital.gov/components/typography/) (snippet).
- [S][U] Apple HIG: 11 pt minimum on iOS and iPadOS. Source: [Median.co](https://median.co/blog/apples-ui-dos-and-donts-typography) (secondary).
- [S] Clear print (Sensory Trust factsheet, no date). Source: [Sensory Trust](https://www.sensorytrust.org.uk/information/factsheets/access-information-print.html).
  - 12 pt minimum, 14 pt preferred; large print 16 pt or more, with most requests at 18–20 pt (RNIB).
  - Sans serif; avoid light weights.
  - Bold, caps and italics only occasionally; no underlining; no hyphenation.
  - Left-aligned, not justified.
  - More than single line spacing; generous margins.
  - Headings at least 20 % larger than body text.
  - Don't rely on colour alone; maximize contrast.
- [S][U] RNIB: "a very minimum type size of 12 point, or ideally 14 point". Measured with a ruler, the x-height should be about 2.3 mm, with 2 mm as the absolute minimum; RNIB's 12 pt target for general readers gives about 2 mm. Sources: [Effortmark, Caroline Jarrett](https://www.effortmark.co.uk/conflicting-guidance-on-choice-of-font-sizefor-visually-impaired-people/) (403 when fetched); [Croydon Council, "Making text accessible"](https://www.croydon.gov.uk/sites/default/files/2021-02/makingtextaccessible.pdf) (snippet).
- [R/C] Nielsen & Kaley (NN/g, 2020-06-28): PDFs are optimized for paper sizes, not viewports. They are poor for on-screen and mobile reading and are best kept for printing, with HTML offered for on-screen use. Source: [NN/g, Avoid PDF for on-screen reading](https://www.nngroup.com/articles/avoid-pdf-for-on-screen-reading/).
- [G] How guides handle the two media:
  - JobTeaser: make it readable on both screen and paper. [JobTeaser](https://www.jobteaser.com/fr/advices/meilleures-et-pires-polices-cv)
  - stylingcv [U]: print a test copy. [stylingcv](https://stylingcv.com/fr/2025/02/28/meilleures-polices-cv-guide-complet-2026/)
  - MIT UPOP: review a printed copy. [MIT UPOP](https://upop.mit.edu/wp-content/uploads/2024/02/UPOP_Resume_Guidelines.pdf)
  - Harvard: formatting must survive conversion to PDF. [Harvard](https://careerservices.fas.harvard.edu/resources/create-a-strong-resume/)

### Inferences
Computations; [M] where font metrics are used.

**Paper at 40 cm.** [M] x-height and visual angle by size:

| Font | 10.5 pt | 10 pt | 9 pt |
|---|---|---|---|
| Carlito | 1.77 mm (0.253°) | 1.68 mm (0.241°) | 1.52 mm (0.217°) |
| Source Sans 3 | 1.80 mm (0.258°) | 1.71 mm (0.246°) | 1.54 mm (0.221°) |
| IBM Plex Sans | 1.91 mm (0.274°) | 1.82 mm (0.261°) | 1.64 mm (0.235°) |

Every case is above the 0.2° critical print size, so the sizes are supported by research for normal vision. The 9 pt project floor is also above it: 0.2° corresponds to about 8.3 pt in Carlito.

**Clear print.** Reaching an x-height of 2.0 mm needs at least 11.9 pt (Carlito), 11.7 pt (Source Sans 3) or 11.0 pt (IBM Plex Sans). Reaching 2.3 mm needs 13.6, 13.4 or 12.6 pt. So 10.5 pt misses the clear-print bar by about 1–1.5 pt. At equal size, IBM Plex Sans has the largest x-height (0.516 em against 0.486 and 0.478) and comes closest.

**Viewing distance.** If the page is seen at physical size from 60 cm, the angles fall to 0.16–0.18°, below the critical print size. That argues for zooming in on screen; actual on-screen size depends on zoom and display scaling.

**Screen at 100 % zoom** (1 pt = 1.333 px):
- 10.5 pt = 14.0 px, 10 pt = 13.3 px, 9 pt = 12 px.
- Butterick's 15 px floor is reached at about 107 % zoom (10.5 pt) or 113 % (10 pt).
- The USWDS 16 px is reached at about 114 % or 120 %.

**Phone.** Assuming a common viewport width of 390 CSS px (not sourced), fitting an A4 page (793.7 px wide at 100 %) to the width scales it by about 0.49:
- body text shows at about 6.9 px and the 26 pt name at about 17 px;
- reaching 11 px body text (Apple's minimum) takes 1.6× zoom. The main column (391 px at 100 %) then measures 307 px and fits, but the reader must pan between the sidebar and the main column;
- at Butterick's 15 px, the main column is 419 px, wider than 390, so the reader must pan horizontally within each line;
- this matches NN/g's critique.

**Line spacing on screen.** 119–125 % is well below WCAG 1.4.8's 150 %. That criterion is AAA and written for web content, so it doesn't bind a PDF CV, but it signals discomfort for low-vision readers.

**How the norms fit together.** CV guidance (10–12 pt) optimizes for one-page density and recruiters with normal vision. Clear-print guidance targets public documents and readers with low vision. A CV that must be accessible would need 12 pt or more, likely two pages, or an accessible alternative such as tagged PDF or HTML. Within one page, legibility is maximized by choosing the font with the largest x-height (IBM Plex Sans), keeping all text at 10 pt or above, and keeping leading at or above 120 %.

### Gaps
- No peer-reviewed study was found on reading CVs or A4 PDFs on phones, and no reliable statistics on how many recruiters read on phones.
- The primary RNIB page was not fetched (403 or unavailable); the x-height figures (2.3 mm, 2 mm) come from search summaries.
- The Apple HIG and USWDS numbers come from secondary or snippet sources. The 390 px phone width is an assumption.
- Legge & Bigelow assume 40 cm and normal vision. No data were collected here for presbyopic readers or for typical laptop distances. The 60 cm angles above are geometric extrapolations.
- PDF viewer behavior at "100 %" (mapping 1 pt to 1.333 px) depends on the viewer and OS scaling and was not verified.
