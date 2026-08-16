import { describe, expect, it } from 'vitest';
import { relativeLuminance, contrastRatio, pickInkColor, ensureContrast, brandAccentOverride } from './brand-color';

describe('relativeLuminance', () => {
  it('returns 0 for black and 1 for white', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('handles 3-digit hex shorthand', () => {
    expect(relativeLuminance('#fff')).toBeCloseTo(relativeLuminance('#FFFFFF'), 5);
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
  });

  it('is 1 for identical colors', () => {
    expect(contrastRatio('#FFB454', '#FFB454')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#FFB454', '#0D0F17')).toBeCloseTo(contrastRatio('#0D0F17', '#FFB454'), 5);
  });
});

describe('pickInkColor', () => {
  it('picks void ink for a light accent', () => {
    expect(pickInkColor('#FFFFFF')).toBe('#08090F');
  });

  it('picks white ink for a dark accent', () => {
    expect(pickInkColor('#111111')).toBe('#FFFFFF');
  });
});

describe('ensureContrast', () => {
  it('leaves an already-legible color unchanged', () => {
    // #FFB454 (the default lume) already passes 4.5:1 on the canvas per DESIGN.md.
    expect(ensureContrast('#FFB454', '#0D0F17')).toBe('#FFB454');
  });

  it('lightens a color that fails contrast against the canvas', () => {
    const dark = '#1A1A1A'; // near-canvas, effectively invisible
    const result = ensureContrast(dark, '#0D0F17');
    expect(result).not.toBe('#1A1A1A');
    expect(contrastRatio(result, '#0D0F17')).toBeGreaterThanOrEqual(4.5);
  });

  it('never returns a ratio below the requested minimum', () => {
    const result = ensureContrast('#202030', '#0D0F17', 7);
    expect(contrastRatio(result, '#0D0F17')).toBeGreaterThanOrEqual(7);
  });
});

describe('brandAccentOverride', () => {
  it('pairs a legible lume with matching ink', () => {
    const { lume, lumeInk } = brandAccentOverride('#101015');
    expect(contrastRatio(lume, '#0D0F17')).toBeGreaterThanOrEqual(4.5);
    expect(lumeInk).toBe(pickInkColor(lume));
  });
});
