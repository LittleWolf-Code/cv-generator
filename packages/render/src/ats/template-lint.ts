// T-ATS-17: static analysis of the templates (§12.1). Rejects grid(, table(, hide(, eval(,
// `fill: white` on text, a size below 9pt, any literal visible text (markup text or string literal
// containing a letter or a digit), place( outside the photo() function, anything but the image
// inside photo() (§5.2: no text in the place), and image( outside photo() (ATS-08: no icon).
// Two profiles (ADR 0017), chosen by the name of the template, never by its content:
// - `ats` (ats-classique, the letter): every rule above;
// - `visuel`: the same rules except that grid( is allowed (page layout only), photo() may crop the
//   image to a circle (box, clip, radius, and a height equal to the width; ADR 0019), and the icon of a
//   link may be drawn by link-icon(), which holds one image and nothing else (ADR 0025). Integrity rules
//   (literal text, eval, hide, white text, < 9 pt) and the bans on table( and place( outside photo() stay.
// The scanner understands just enough Typst: markup vs code mode, strings, comments, labels.

export interface LintViolation {
  rule:
    | 'forbidden-call'
    | 'white-text'
    | 'small-text'
    | 'literal-text'
    | 'place-outside-photo'
    | 'photo-content'
    | 'image-outside-photo'
    | 'icon-content';
  line: number;
  excerpt: string;
}

const STATEMENT_KEYWORDS = new Set(['let', 'set', 'show', 'import', 'include', 'if', 'for', 'while']);

class Scanner {
  readonly violations: LintViolation[] = [];
  /** Source with comments and string contents blanked (same length, newlines kept). */
  readonly masked: string[];
  /** Source with comments blanked only. */
  readonly noComments: string[];
  readonly strings: Array<{ start: number; value: string }> = [];
  i = 0;

  constructor(readonly src: string) {
    this.masked = [...src];
    this.noComments = [...src];
  }

  lineOf(pos: number): number {
    return this.src.slice(0, pos).split('\n').length;
  }

  report(rule: LintViolation['rule'], pos: number, excerpt?: string) {
    const line = this.lineOf(pos);
    this.violations.push({ rule, line, excerpt: excerpt ?? this.src.split('\n')[line - 1]!.trim() });
  }

  blank(from: number, to: number, alsoComments = false) {
    for (let k = from; k < to; k++) {
      if (this.masked[k] !== '\n') this.masked[k] = ' ';
      if (alsoComments && this.noComments[k] !== '\n') this.noComments[k] = ' ';
    }
  }

  /** Skips a comment at the cursor; returns true if one was skipped. */
  comment(): boolean {
    if (this.src.startsWith('//', this.i)) {
      const end = this.src.indexOf('\n', this.i);
      const stop = end < 0 ? this.src.length : end;
      this.blank(this.i, stop, true);
      this.i = stop;
      return true;
    }
    if (this.src.startsWith('/*', this.i)) {
      const end = this.src.indexOf('*/', this.i + 2);
      const stop = end < 0 ? this.src.length : end + 2;
      this.blank(this.i, stop, true);
      this.i = stop;
      return true;
    }
    return false;
  }

  string() {
    const start = this.i;
    let k = this.i + 1;
    let value = '';
    while (k < this.src.length && this.src[k] !== '"') {
      if (this.src[k] === '\\') {
        value += this.src[k + 1] ?? '';
        k += 2;
      } else {
        value += this.src[k];
        k++;
      }
    }
    this.strings.push({ start, value });
    this.blank(start + 1, k);
    this.i = k + 1;
  }

  /** Code until the matching closer (or, at statement level, until a newline at depth 0). */
  code(closer: string | null) {
    let depth = 0;
    while (this.i < this.src.length) {
      if (this.comment()) continue;
      const c = this.src[this.i]!;
      if (c === '"') {
        this.string();
        continue;
      }
      if (c === '[') {
        this.i++;
        this.markup(']');
        continue;
      }
      if (c === '(' || c === '{') depth++;
      if (c === ')' || c === '}') {
        if (depth === 0 && closer === c) {
          this.i++;
          return;
        }
        depth--;
      }
      if (c === '\n' && depth === 0 && closer === null) return;
      this.i++;
    }
  }

  /** One embedded expression after `#` in markup. */
  hashExpression() {
    this.i++; // '#'
    const c = this.src[this.i];
    if (c === '{' || c === '(') {
      this.i++;
      this.code(c === '{' ? '}' : ')');
      return;
    }
    const ident = /^[A-Za-z_][\w-]*/.exec(this.src.slice(this.i))?.[0] ?? '';
    this.i += ident.length;
    if (STATEMENT_KEYWORDS.has(ident)) {
      this.code(null);
      return;
    }
    if (ident === 'context') {
      while (this.src[this.i] === ' ') this.i++;
    }
    // Chain: (args), [content], .field
    for (;;) {
      const n = this.src[this.i];
      if (n === '(') {
        this.i++;
        this.code(')');
      } else if (n === '[') {
        this.i++;
        this.markup(']');
      } else if (n === '.' && /[A-Za-z_]/.test(this.src[this.i + 1] ?? '')) {
        this.i++;
        this.i += /^[A-Za-z_][\w-]*/.exec(this.src.slice(this.i))![0].length;
      } else {
        return;
      }
    }
  }

  /** Markup mode: only whitespace, comments, labels and #expressions are allowed. */
  markup(closer: string | null) {
    while (this.i < this.src.length) {
      if (this.comment()) continue;
      const c = this.src[this.i]!;
      if (closer && c === closer) {
        this.i++;
        return;
      }
      if (c === '#') {
        this.hashExpression();
        continue;
      }
      if (c === '<') {
        const label = /^<[\w.:-]+>/.exec(this.src.slice(this.i));
        if (label) {
          this.i += label[0].length;
          continue;
        }
      }
      if (!/\s/.test(c)) {
        this.report('literal-text', this.i);
        // Skip the rest of the line to report each offending line once.
        const end = this.src.indexOf('\n', this.i);
        this.i = end < 0 ? this.src.length : end;
        continue;
      }
      this.i++;
    }
  }
}

/** Extent [start, end) of the body of `let <name>(...)` (photo, link-icon), if any. */
function functionBody(masked: string, name: string): [number, number] | null {
  const m = new RegExp(`(?<![\\w-])let\\s+${name}\\s*\\(`).exec(masked);
  if (!m) return null;
  let depth = 0;
  let started = false;
  for (let k = m.index; k < masked.length; k++) {
    const c = masked[k]!;
    if (c === '(' || c === '{' || c === '[') {
      depth++;
      started = true;
    } else if (c === ')' || c === '}' || c === ']') {
      depth--;
    } else if (c === '\n' && depth === 0 && started) {
      return [m.index, k];
    }
  }
  return [m.index, masked.length];
}

export type LintProfile = 'ats' | 'visuel';

/** Profile of a template: the visual layout only gets the relaxed one; any other name gets every rule. */
export function lintProfileOf(layout: string): LintProfile {
  return layout === 'visuel' ? 'visuel' : 'ats';
}

/**
 * Identifiers allowed in photo(): placing one image, sized by a width, with its alternative text (`alt`,
 * PDF tags only, never visible; ADR 0020). Parameters are added.
 */
const PHOTO_ALLOWED: Record<LintProfile, Set<string>> = {
  ats: new Set(['let', 'photo', 'place', 'top', 'right', 'image', 'width', 'alt']),
  // Inline image cropped to a circle (no place() needed).
  visuel: new Set([
    'let',
    'photo',
    'place',
    'top',
    'right',
    'image',
    'width',
    'height',
    'alt',
    'box',
    'clip',
    'radius',
    'true',
  ]),
};

/**
 * What link-icon() may contain (visual profile only, ADR 0025): one inline image, sized by a height and
 * set on the baseline. The fields of the icon are allowed in their place only: its kind as the key of
 * the path given by the renderer (`data.icons.at(i.kind)`), its name as the alternative text of the
 * image (`alt: i.alt`, PDF tags only, never visible). Parameters are added.
 */
const ICON_ALLOWED = new Set(['let', 'link-icon', 'box', 'baseline', 'image', 'height']);
const ICON_FIELDS = [/data\.icons\.at\(\s*[\w-]+\.kind\s*\)/g, /alt\s*:\s*[\w-]+\.alt(?![\w-])/g];

/**
 * Positions of what a function holding an image (photo, link-icon) may not contain: content blocks,
 * strings, and any identifier (field names included) other than those needed to place the image. `1cm`
 * units are not identifiers. `fields`: expressions allowed as a whole, blanked before the check.
 */
function contentViolations(
  masked: string,
  body: [number, number],
  name: string,
  ids: Set<string>,
  fields: RegExp[] = [],
): number[] {
  let src = masked.slice(body[0], body[1]);
  for (const f of fields) src = src.replace(f, (m) => ' '.repeat(m.length));
  const params = (new RegExp(`${name}\\s*\\(([^)]*)\\)`).exec(src)?.[1] ?? '')
    .split(',')
    .map((p) => p.trim().split(/[\s:=]/)[0]!)
    .filter(Boolean);
  const allowed = new Set([...ids, ...params]);
  const out: number[] = [];
  for (const m of src.matchAll(/["[]/g)) out.push(body[0] + m.index);
  for (const m of src.matchAll(/(?<!\w)[A-Za-z_][\w-]*/g)) if (!allowed.has(m[0])) out.push(body[0] + m.index);
  return out;
}

export function lintTemplate(source: string, profile: LintProfile = 'ats'): LintViolation[] {
  const s = new Scanner(source);
  s.markup(null);
  const masked = s.masked.join('');

  for (const str of s.strings) {
    if (/[\p{L}\p{N}]/u.test(str.value)) s.report('literal-text', str.start, `"${str.value}"`);
  }
  const forbidden =
    profile === 'visuel' ? /(?<![\w.-])(table|hide|eval)\s*\(/g : /(?<![\w.-])(grid|table|hide|eval)\s*\(/g;
  for (const m of masked.matchAll(forbidden)) s.report('forbidden-call', m.index);
  const body = functionBody(masked, 'photo');
  const inside = (b: [number, number] | null, pos: number) => b !== null && pos >= b[0] && pos < b[1];
  for (const m of masked.matchAll(/(?<![\w.-])place\s*\(/g)) {
    if (!inside(body, m.index)) s.report('place-outside-photo', m.index);
  }
  if (body) {
    for (const pos of contentViolations(masked, body, 'photo', PHOTO_ALLOWED[profile])) s.report('photo-content', pos);
  }
  // ATS-08: no image but the photo; the visual layout may also draw the icon of a link (ADR 0025).
  const icon = profile === 'visuel' ? functionBody(masked, 'link-icon') : null;
  for (const m of masked.matchAll(/(?<![\w.-])image\s*\(/g)) {
    if (!inside(body, m.index) && !inside(icon, m.index)) s.report('image-outside-photo', m.index);
  }
  if (icon) {
    for (const pos of contentViolations(masked, icon, 'link-icon', ICON_ALLOWED, ICON_FIELDS)) {
      s.report('icon-content', pos);
    }
  }
  const noComments = s.noComments.join('');
  for (const m of noComments.matchAll(
    /fill\s*:\s*(white|luma\(\s*(?:255|100%)\s*\)|rgb\(\s*"#?(?:fff|ffffff)"\s*\)|rgb\(\s*255\s*,\s*255\s*,\s*255)/gi,
  )) {
    s.report('white-text', m.index);
  }
  for (const m of noComments.matchAll(/size\s*:\s*(\d+(?:\.\d+)?)\s*pt/g)) {
    if (parseFloat(m[1]!) < 9) s.report('small-text', m.index);
  }
  return s.violations.sort((a, b) => a.line - b.line);
}
