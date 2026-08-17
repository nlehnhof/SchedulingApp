// Pure color-math helpers for the per-client accent override on the visitor
// booking flow (Nightshift, DESIGN.md section 2.4). A client picks an
// arbitrary hex; these functions make sure it stays legible on the app's
// dark canvas instead of trusting the raw value.

const VOID = '#08090F';
const WHITE = '#FFFFFF';
const CANVAS = '#0D0F17';

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function normalizeHex(hex: string): string {
  const trimmed = hex.trim().replace(/^#/, '');
  if (trimmed.length === 3) {
    return trimmed
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return trimmed;
}

function hexToRgb(hex: string): Rgb {
  const normalized = normalizeHex(hex);
  const int = parseInt(normalized, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

// Space-separated "R G B" triple, matching the format globals.css uses for
// every `--*-rgb` token so Tailwind's `rgb(var(--x-rgb) / <alpha-value>)`
// pattern (and therefore opacity modifiers like `bg-lume/14`) works.
export function hexToRgbTriple(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `${Math.round(r)} ${Math.round(g)} ${Math.round(b)}`;
}

function rgbToHex({ r, g, b }: Rgb): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')}`
    .toUpperCase();
}

function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

// WCAG 2.x relative luminance, 0 (black) to 1 (white).
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

// WCAG 2.x contrast ratio, 1 (no contrast) to 21 (max contrast).
export function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

// Text/icon color to place on top of a fill of `hex`. Never assumes dark
// ink — a light accent gets void ink, a dark accent gets white ink.
export function pickInkColor(hex: string): string {
  return relativeLuminance(hex) > 0.5 ? VOID : WHITE;
}

function toHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case rn:
      h = (gn - bn) / d + (gn < bn ? 6 : 0);
      break;
    case gn:
      h = (bn - rn) / d + 2;
      break;
    default:
      h = (rn - gn) / d + 4;
  }
  return { h: h * 60, s, l };
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  if (s === 0) {
    const v = l * 255;
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hn = h / 360;
  return {
    r: hue2rgb(p, q, hn + 1 / 3) * 255,
    g: hue2rgb(p, q, hn) * 255,
    b: hue2rgb(p, q, hn - 1 / 3) * 255,
  };
}

// Lightens `hex` in HSL space, in fixed steps, until it passes `minRatio`
// against `backgroundHex` (default: the app canvas). Returns the original
// hex unchanged if it already passes. Never darkens — a client's accent
// that's already legible should render exactly as picked.
export function ensureContrast(hex: string, backgroundHex: string = CANVAS, minRatio = 4.5): string {
  if (contrastRatio(hex, backgroundHex) >= minRatio) {
    return rgbToHex(hexToRgb(hex));
  }

  const { h, s, l } = toHsl(hexToRgb(hex));
  const STEP = 0.02;
  let lightness = l;
  while (lightness < 1) {
    lightness = Math.min(1, lightness + STEP);
    const candidate = rgbToHex(hslToRgb(h, s, lightness));
    if (contrastRatio(candidate, backgroundHex) >= minRatio) {
      return candidate;
    }
  }
  return WHITE;
}

// The full override: a legible accent plus the ink color to pair with it,
// ready to apply as inline `--lume` / `--lume-ink` CSS variables.
export function brandAccentOverride(hex: string): { lume: string; lumeInk: string } {
  const lume = ensureContrast(hex);
  return { lume, lumeInk: pickInkColor(lume) };
}
