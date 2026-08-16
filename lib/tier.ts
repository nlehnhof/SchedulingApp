export type Tier = 'free' | 'premium' | 'elite';

const TIER_RANK: Record<Tier, number> = { free: 0, premium: 1, elite: 2 };

/** True when `tier` is at least as high as `min` in the free < premium < elite ranking. */
export function isAtLeast(tier: Tier, min: Tier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[min];
}
