import { describe, expect, it } from 'vitest';
import { isAtLeast, COLLABORATOR_LIMIT_BY_TIER } from './tier';

describe('isAtLeast', () => {
  it('ranks free < premium < elite', () => {
    expect(isAtLeast('free', 'premium')).toBe(false);
    expect(isAtLeast('premium', 'premium')).toBe(true);
    expect(isAtLeast('elite', 'premium')).toBe(true);
    expect(isAtLeast('elite', 'elite')).toBe(true);
    expect(isAtLeast('premium', 'elite')).toBe(false);
  });
});

describe('COLLABORATOR_LIMIT_BY_TIER', () => {
  it('gives free tier zero seats', () => {
    expect(COLLABORATOR_LIMIT_BY_TIER.free).toBe(0);
  });

  it('gives premium a finite cap', () => {
    expect(COLLABORATOR_LIMIT_BY_TIER.premium).toBe(2);
  });

  it('gives elite unlimited seats', () => {
    expect(COLLABORATOR_LIMIT_BY_TIER.elite).toBeNull();
  });
});
