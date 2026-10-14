// WCAG 2.x contrast, for the theme accent color (F-MOD-01, NF-10: >= 4.5:1 on white).

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function rgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`couleur invalide : ${hex}`);
  return [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = rgb(hex).map(channel);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** Contrast ratio between two colors (1 to 21). */
export function contrastBetween(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

export function contrastOnWhite(hex: string): number {
  return 1.05 / (relativeLuminance(hex) + 0.05);
}

/** `share` of `hex` mixed into white (sRGB channels), as `#RRGGBB`: the light tint of an accent. */
export function tintOf(hex: string, share: number): string {
  return `#${rgb(hex)
    .map((c) => Math.round(255 - (255 - c) * share))
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

/** « 4,5:1 », the French way (one decimal, rounded down so that 4.49 never reads 4,5). */
export function formatRatio(ratio: number): string {
  return `${(Math.floor(ratio * 10) / 10).toFixed(1).replace('.', ',')}:1`;
}
