import { NextResponse } from 'next/server';
import { createServiceClient } from './supabase';
import { getEffectiveTier } from './premium-grants';
import type { CollaboratorCalendar } from './require-client';
import type { Tier } from './tier';

export type CalendarRole = 'owner' | 'editor' | 'viewer';

/**
 * Confirms the caller can access `calendarId` — either as its owner (via
 * `client.clientId`) or as an accepted collaborator on it (via
 * `client.collaboratorCalendars`, Elite team access, 0018 migration) —
 * before a route touches it. Returns 404 rather than 403 so a client
 * probing calendar ids they don't own/collaborate on can't distinguish
 * "exists but isn't yours" from "doesn't exist". This is the explicit
 * ownership check that substitutes for RLS, since the service-role client
 * bypasses RLS entirely and every route is responsible for its own scoping
 * (see 0003_rls.sql's header comment).
 *
 * The returned `role` is what every write route must check before mutating
 * anything: `'viewer'` can never write. Some actions (billing, team
 * management, calendar create/delete) are owner-only even for an
 * `'editor'` — those routes check `role !== 'owner'` themselves on top of
 * this.
 */
export async function requireCalendarAccess(
  calendarId: string | null | undefined,
  client: { clientId: string | null; collaboratorCalendars: CollaboratorCalendar[] }
): Promise<{ calendarId: string; role: CalendarRole } | NextResponse> {
  if (!calendarId) {
    return NextResponse.json({ error: 'calendarId is required' }, { status: 400 });
  }

  if (client.clientId) {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('booking_calendars')
      .select('id')
      .eq('id', calendarId)
      .eq('client_id', client.clientId)
      .maybeSingle();
    if (data) return { calendarId, role: 'owner' };
  }

  const collaboration = client.collaboratorCalendars.find((c) => c.calendarId === calendarId);
  if (collaboration) return { calendarId, role: collaboration.role };

  return NextResponse.json({ error: 'not_found' }, { status: 404 });
}

/** Every write route (POST/PATCH/DELETE on bookings-related data) calls this after requireCalendarAccess(). */
export function requireWriteRole(role: CalendarRole): NextResponse | null {
  if (role === 'viewer') {
    return NextResponse.json({ error: 'Viewers cannot make changes.' }, { status: 403 });
  }
  return null;
}

/** Billing, team management, and calendar create/delete stay owner-only even for an editor. */
export function requireOwnerRole(role: CalendarRole): NextResponse | null {
  if (role !== 'owner') {
    return NextResponse.json({ error: 'Only the calendar owner can do this.' }, { status: 403 });
  }
  return null;
}

function ownerOf(calendar: any): any {
  return Array.isArray(calendar?.clients) ? calendar.clients[0] : calendar?.clients;
}

/**
 * A premium/Elite-gated *calendar-scoped* feature (branding, analytics,
 * confirmation emails, ...) must gate on the CALENDAR's owning client's
 * effective tier, never the requester's own — a collaborator (Elite team
 * access, 0018 migration) acting as Editor on someone else's Elite calendar
 * has no subscription of their own at all, and must not be locked out of a
 * feature their access grant already covers. For a caller accessing their
 * own calendar this resolves to the exact same value as their own tier, so
 * every existing owner-only route stays correct unchanged.
 */
export async function calendarOwnerTier(calendarId: string): Promise<Tier> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('booking_calendars')
    .select('clients(tier, email)')
    .eq('id', calendarId)
    .single();
  const owner = ownerOf(data);
  if (!owner) return 'free';
  return getEffectiveTier(owner.tier, owner.email);
}
