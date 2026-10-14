// Text of a job offer: untrusted data (§7.5). Cleaned when it is stored (offer.md): invisible
// characters removed (they can hide instructions), line endings and control characters normalized.
// Sentences that look like instructions for an AI are flagged in the interface, never executed.
// Zod-free: the interface imports this module through `@cv/core/offer` (ADR 0013).

/** Maximum length of an offer, in characters (an offer is a few thousand characters long). */
export const OFFER_MAX_CHARS = 100_000;

// §7.5: U+200B–U+200F, U+2060, U+FEFF, U+E0000–U+E007F. Also removed, for the same reason (text that
// is invisible or reordered on screen): soft hyphen U+00AD, invisible operators U+2061–U+2064 and the
// bidirectional controls U+202A–U+202E and U+2066–U+2069.
const INVISIBLE = /[\u00AD\u200B-\u200F\u2060-\u2064\u202A-\u202E\u2066-\u2069\uFEFF]|[\u{E0000}-\u{E007F}]/gu;
// C0 and C1 controls, except tab and line feed (CR is handled first): matching them is the point.
// eslint-disable-next-line no-control-regex
const CONTROLS = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g;

export interface CleanedOffer {
  text: string;
  /** Number of invisible or control characters removed. */
  removed: number;
}

/** Cleans an offer before it is stored as untrusted data (§7.5). */
export function cleanUntrusted(input: string): CleanedOffer {
  let removed = 0;
  const count = (re: RegExp) => (s: string) =>
    s.replace(re, () => {
      removed++;
      return '';
    });
  let s = input.normalize('NFC').replace(/\r\n?/g, '\n');
  s = count(INVISIBLE)(s);
  s = count(CONTROLS)(s);
  s = s
    .replace(/\t/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \u00A0]+$/u, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { text: s, removed };
}

export type InstructionLevel = 'consigne' | 'mention';

export interface InstructionFlag {
  /** 1-based line number in the cleaned offer. */
  line: number;
  /** Offsets of the sentence in the cleaned offer (UTF-16, end excluded). */
  start: number;
  end: number;
  sentence: string;
  /** `consigne`: reads like an instruction given to an AI; `mention`: names an AI or an assistant. */
  level: InstructionLevel;
  reasons: string[];
}

/** Lowercase, accents removed, apostrophes unified: patterns below are written on this form. */
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[’‘ʼ`]/g, "'")
    .toLowerCase();
}

const W = '(?<![\\p{L}\\p{N}])';
const E = '(?![\\p{L}\\p{N}])';
const rx = (body: string) => new RegExp(`${W}(?:${body})${E}`, 'u');

const INSTRUCTION_PATTERNS: Array<{ re: RegExp; reason: string; raw?: boolean }> = [
  {
    re: rx(
      '(?:ignore[rsz]?|ignorez|ignorons|disregard|oublie[rsz]?|oubliez|forget|neglige[rsz]?)[^.!?\\n]{0,80}?(?:instructions?|consignes?|directives?|prompts?|regles?|rules?|ce qui precede|everything above|tout ce qui precede)',
    ),
    reason: "demande d'ignorer des instructions",
  },
  {
    re: rx(
      '(?:previous|prior|above|earlier|precedentes?|anterieures?|ci-dessus)\\s+(?:instructions?|consignes?|prompts?)',
    ),
    reason: 'évoque des instructions précédentes',
  },
  {
    re: rx(
      "(?:you are|you're|tu es|vous etes|act as|agis comme|agissez comme|joue le role|jouez le role|pretend to be|fais comme si)[^.!?\\n]{0,40}?(?:ai|ia|assistant|chatbot|model|modele|gpt|claude|llm|recruteur|recruiter|ats)",
    ),
    reason: 'attribue un rôle à une IA',
  },
  {
    re: rx("en tant qu'\\s*(?:ia|assistant|intelligence artificielle|modele)|as an? (?:ai|assistant|language model)"),
    reason: "s'adresse à une IA",
  },
  {
    re: rx(
      'system prompt|prompt systeme|invite systeme|system message|message systeme|jailbreak|developer mode|mode developpeur',
    ),
    reason: 'évoque le fonctionnement interne d’une IA',
  },
  {
    re: rx(
      "(?:do not|don't|never|ne)\\s+(?:mention|reveal|tell|disclose|mentionne[zr]?|revele[zr]?|dis|dites|divulgue[zr]?)",
    ),
    reason: 'demande de cacher une information',
  },
  {
    re: rx(
      '(?:rank|classe[rz]?|recommande[rz]?|recommend|selectionne[rz]?|retiens|retenez|hire|embauche[rz]?)\\s+(?:this|ce|cette)\\s+(?:candidat(?:e)?|candidate|cv|resume|profil|profile)',
    ),
    reason: 'demande de classer ou retenir ce candidat',
  },
  { re: /<\s*\/?\s*(?:system|assistant|user|untrusted|instructions?|prompt)\b/u, reason: 'balise de conversation' },
];

const MENTION_PATTERNS: Array<{ re: RegExp; reason: string; raw?: boolean }> = [
  {
    re: rx('chatgpt|chat gpt|gpt-?\\d[\\w.]*|openai|claude|anthropic|gemini|bard|copilot|mistral|llama|llm|grok'),
    reason: 'nomme une IA',
  },
  { re: rx('assistant(?:e|s|es)?'), reason: 'mot « assistant »' },
  {
    re: rx('intelligence artificielle|artificial intelligence|modele de langage|language model'),
    reason: 'évoque une IA',
  },
  // Case-exact on the raw sentence: « IA », « AI », « I.A. ».
  { re: /(?<![\p{L}\p{N}])(?:IA|AI|I\.A\.|A\.I\.)(?![\p{L}\p{N}])/u, reason: 'sigle IA / AI', raw: true },
];

/** Sentences of one line, with their offsets in the line. */
function sentences(line: string): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  const re = /[^.!?…]+(?:[.!?…]+|$)/gu;
  for (const m of line.matchAll(re)) {
    const raw = m[0];
    const lead = raw.length - raw.trimStart().length;
    const text = raw.trim();
    if (!text) continue;
    out.push({ start: m.index + lead, end: m.index + lead + text.length });
  }
  return out;
}

/**
 * Sentences of an offer that look like instructions for an AI (§7.5): « ignore… instructions »,
 * « ChatGPT », « Claude », « assistant », « IA/AI »… They are only flagged; the offer stays data.
 */
export function flagInstructions(text: string): InstructionFlag[] {
  const flags: InstructionFlag[] = [];
  let offset = 0;
  text.split('\n').forEach((line, i) => {
    for (const s of sentences(line)) {
      const sentence = line.slice(s.start, s.end);
      const folded = fold(sentence);
      const test = (p: { re: RegExp; raw?: boolean }) => p.re.test(p.raw ? sentence : folded);
      const strong = INSTRUCTION_PATTERNS.filter(test).map((p) => p.reason);
      const weak = MENTION_PATTERNS.filter(test).map((p) => p.reason);
      if (strong.length === 0 && weak.length === 0) continue;
      flags.push({
        line: i + 1,
        start: offset + s.start,
        end: offset + s.end,
        sentence,
        level: strong.length > 0 ? 'consigne' : 'mention',
        reasons: [...strong, ...weak],
      });
    }
    offset += line.length + 1;
  });
  return flags;
}
