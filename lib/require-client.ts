import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from './auth';
import type { Tier } from './tier';

/**
 * Resolves the authenticated client's ID (and tier/onboarding state) from
 * the NextAuth session, or returns a 401 NextResponse to short-circuit the
 * route handler.
 *
 * `tier` defaults to 'free' if it's somehow missing from the session
 * (fail-closed: an absent tier must never be treated as premium-or-above
 * access). Every tier-gated route must check the value itself — this helper
 * only surfaces it, it doesn't enforce anything — using `isAtLeast(tier,
 * 'premium')` (lib/tier.ts) for a premium-or-above feature, or `tier ===
 * 'elite'` directly for something Elite-exclusive.
 *
 * Usage:
 *   const client = await requireClient();
 *   if (client instanceof NextResponse) return client;
 *   // client.clientId / client.tier / client.tutorialCompletedAt are now available
 */
export async function requireClient(): Promise<
  | { clientId: string; tier: Tier; tutorialCompletedAt: string | null }
  | NextResponse
> {
  const session = await getServerSession(authOptions);
  const clientId = (session as any)?.clientId;
  if (!clientId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const sessionTier = (session as any)?.tier;
  const tier: Tier =
    sessionTier === 'elite' ? 'elite' : sessionTier === 'premium' ? 'premium' : 'free';
  const tutorialCompletedAt = (session as any)?.tutorialCompletedAt ?? null;
  return { clientId, tier, tutorialCompletedAt };
}
