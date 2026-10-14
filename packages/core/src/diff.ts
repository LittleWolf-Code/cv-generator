// Word diff (F-PRO-02): longest common subsequence over words and the blanks between them. Texts are
// short (a bullet is at most a few hundred characters); beyond MAX_CELLS the diff degrades to
// "everything removed, everything inserted" instead of growing quadratically.

export type DiffOp = 'eq' | 'del' | 'ins';
export interface DiffSegment {
  op: DiffOp;
  text: string;
}

const MAX_CELLS = 250_000;

function tokens(s: string): string[] {
  return s.match(/\s+|[^\s]+/gu) ?? [];
}

function push(out: DiffSegment[], op: DiffOp, text: string): void {
  if (!text) return;
  const last = out[out.length - 1];
  if (last && last.op === op) last.text += text;
  else out.push({ op, text });
}

export function wordDiff(before: string | null, after: string | null): DiffSegment[] {
  const a = tokens(before ?? '');
  const b = tokens(after ?? '');
  const out: DiffSegment[] = [];
  if (a.length * b.length > MAX_CELLS) {
    push(out, 'del', a.join(''));
    push(out, 'ins', b.join(''));
    return out;
  }
  // lcs[i][j] = length of the LCS of a[i..] and b[j..].
  const lcs: Uint16Array[] = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push(out, 'eq', a[i]!);
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      push(out, 'del', a[i++]!);
    } else {
      push(out, 'ins', b[j++]!);
    }
  }
  while (i < a.length) push(out, 'del', a[i++]!);
  while (j < b.length) push(out, 'ins', b[j++]!);
  return out;
}
