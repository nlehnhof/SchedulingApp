export type Tier = 'free' | 'premium' | 'elite';

const TIER_RANK: Record<Tier, number> = { free: 0, premium: 1, elite: 2 };

/** True when `tier` is at least as high as `min` in the free < premium < elite ranking. */
export function isAtLeast(tier: Tier, min: Tier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[min];
}

/**
 * Collaborators a calendar owner can have on top of themselves. `null` means
 * unlimited. Sibling to `CALENDAR_INCLUDED_LIMIT_BY_TIER` /
 * `CALENDAR_MAX_LIMIT_BY_TIER` in app/api/client/calendars/route.ts — same
 * shape, different resource. Enforced server-side in app/api/client/team/*,
 * never just hidden in nav (see CLAUDE.md's note on this being a live bug).
 */
export const COLLABORATOR_LIMIT_BY_TIER: Record<Tier, number | null> = {
  free: 0,
  premium: 2,
  elite: null,
};
