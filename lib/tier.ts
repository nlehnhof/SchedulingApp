export type Tier = 'free' | 'premium' | 'elite';

const TIER_RANK: Record<Tier, number> = { free: 0, premium: 1, elite: 2 };

/** True when `tier` is at least as high as `min` in the free < premium < elite ranking. */
export function isAtLeast(tier: Tier, min: Tier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[min];
}

/**
 * Collaborators a calendar owner can have on top of themselves. `null` means
 * unlimited. Sibling to `CALENDAR_INCLUDED_LIMIT_BY_TIER` /
 * `CALENDAR_MAX_LIMIT_BY_TIER` below — same shape, different resource.
 * Enforced server-side in app/api/client/team/*, never just hidden in nav
 * (see CLAUDE.md's note on this being a live bug).
 */
export const COLLABORATOR_LIMIT_BY_TIER: Record<Tier, number | null> = {
  free: 0,
  premium: 2,
  elite: null,
};

/**
 * Booking calendars a client's plan includes vs. hard-caps at. Sibling to
 * COLLABORATOR_LIMIT_BY_TIER above — same shape, different resource, and
 * kept here (not duplicated across the two calendars API routes, as it
 * used to be) so the two files can't drift. `included` is the
 * free-with-plan count; `max` is the hard ceiling a client can never
 * exceed even by paying more. Only Elite has a gap between the two
 * (calendars 11-20 meter at $5/mo each via lib/stripe.ts's
 * syncExtraCalendarQuantity) — Free and Premium have no overage path, so
 * included === max for them; hitting the cap is a hard stop, not an
 * upsell-to-pay-more moment.
 */
export const CALENDAR_INCLUDED_LIMIT_BY_TIER: Record<Tier, number> = { free: 1, premium: 3, elite: 10 };
export const CALENDAR_MAX_LIMIT_BY_TIER: Record<Tier, number> = { free: 1, premium: 3, elite: 20 };
