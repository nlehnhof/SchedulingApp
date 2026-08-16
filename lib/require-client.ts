import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from './auth';
import type { Tier } from './tier';

export interface CollaboratorCalendar {
  calendarId: string;
  clientId: string; // the owning client's id, not the collaborator's own
  calendarDisplayName: string | null;
  role: 'viewer' | 'editor';
}

/**
 * Resolves the authenticated caller from the NextAuth session, or returns a
 * 401 NextResponse to short-circuit the route handler.
 *
 * `clientId` is nullable — a caller can be signed in as a pure collaborator
 * (Elite team access, 0018 migration) with no `clients` row of their own at
 * all, access coming entirely through `collaboratorCalendars` instead. Every
 * route that assumes `clientId` is always a real owner id (billing, team
 * management, calendar create/delete) must explicitly reject a null
 * `clientId` itself — this helper only 401s when there's no session AND no
 * access of either kind, not when the caller merely lacks an owner account.
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
 *   // client.clientId / client.tier / client.tutorialCompletedAt / client.collaboratorCalendars
 */
export async function requireClient(): Promise<
  | {
      clientId: string | null;
      tier: Tier;
      tutorialCompletedAt: string | null;
      collaboratorCalendars: CollaboratorCalendar[];
      isCollaboratorOnly: boolean;
    }
  | NextResponse
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const clientId: string | null = (session as any)?.clientId ?? null;
  const collaboratorCalendars: CollaboratorCalendar[] = (session as any)?.collaboratorCalendars ?? [];
  if (!clientId && collaboratorCalendars.length === 0) {
    // Authenticated, but neither an owner account nor any accepted
    // collaborator access exists — shouldn't normally happen (the signIn
    // callback always creates/finds one or the other), but fail closed
    // rather than letting a session through with nothing to actually
    // access.
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const sessionTier = (session as any)?.tier;
  const tier: Tier =
    sessionTier === 'elite' ? 'elite' : sessionTier === 'premium' ? 'premium' : 'free';
  const tutorialCompletedAt = (session as any)?.tutorialCompletedAt ?? null;
  const isCollaboratorOnly = !!(session as any)?.isCollaboratorOnly;

  return { clientId, tier, tutorialCompletedAt, collaboratorCalendars, isCollaboratorOnly };
}
