import { NextResponse } from 'next/server';
import { createServiceClient } from './supabase';

/**
 * Confirms `calendarId` belongs to `clientId` before a route touches it —
 * the explicit ownership check that substitutes for RLS, since the
 * service-role client bypasses RLS entirely and every route is responsible
 * for its own scoping (see 0003_rls.sql's header comment). Returns 404
 * rather than 403 so a client probing calendar ids they don't own can't
 * distinguish "exists but isn't yours" from "doesn't exist".
 *
 * Phase-B-only ownership model: a calendar belongs to you iff
 * `booking_calendars.client_id` matches your own `clientId`. Once
 * client_collaborators exists (Phase C), this also needs to accept "or you
 * appear in the session's collaboratorCalendars at >= viewer" — deferred
 * until that table exists.
 */
export async function requireCalendarAccess(
  calendarId: string | null | undefined,
  clientId: string
): Promise<{ calendarId: string } | NextResponse> {
  if (!calendarId) {
    return NextResponse.json({ error: 'calendarId is required' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('booking_calendars')
    .select('id')
    .eq('id', calendarId)
    .eq('client_id', clientId)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return { calendarId };
}
