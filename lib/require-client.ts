import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from './auth';

/**
 * Resolves the authenticated client's ID (and tier/onboarding state) from
 * the NextAuth session, or returns a 401 NextResponse to short-circuit the
 * route handler.
 *
 * `tier` defaults to 'free' if it's somehow missing from the session
 * (fail-closed: an absent tier must never be treated as premium access).
 * Every premium-gated route must check `tier === 'premium'` itself — this
 * helper only surfaces the value, it doesn't enforce anything.
 *
 * Usage:
 *   const client = await requireClient();
 *   if (client instanceof NextResponse) return client;
 *   // client.clientId / client.tier / client.tutorialCompletedAt are now available
 */
export async function requireClient(): Promise<
  | { clientId: string; tier: 'free' | 'premium'; tutorialCompletedAt: string | null }
  | NextResponse
> {
  const session = await getServerSession(authOptions);
  const clientId = (session as any)?.clientId;
  if (!clientId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const tier: 'free' | 'premium' = (session as any)?.tier === 'premium' ? 'premium' : 'free';
  const tutorialCompletedAt = (session as any)?.tutorialCompletedAt ?? null;
  return { clientId, tier, tutorialCompletedAt };
}
