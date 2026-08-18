import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { requireCalendarAccess, requireWriteRole } from '@/lib/require-calendar';
import { listGoogleCalendars } from '@/lib/google-calendar';
import { calendarSelectSchema } from '@/lib/validation';
import { errorResponse } from '@/lib/error-response';

function ownerOf(calendar: any): any {
  return Array.isArray(calendar?.clients) ? calendar.clients[0] : calendar?.clients;
}

// Not premium-gated — Google Calendar sync is a core feature (Phase 1),
// available to every client regardless of tier. Scoped to one
// booking_calendars row (?calendarId=) — each of a client's calendars picks
// its own real Google Calendar + timezone, using the one Google login
// (google_refresh_token) stored on the OWNING client, not necessarily the
// caller — a collaborator (Elite team access, 0018 migration) has no
// `clients` row of their own at all, so google_refresh_token is always
// resolved through the calendar's actual owner via a join, never
// `client.clientId` directly.
export async function GET(req: Request) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const { searchParams } = new URL(req.url);
  const calendar = await requireCalendarAccess(searchParams.get('calendarId'), client);
  if (calendar instanceof NextResponse) return calendar;

  const supabase = createServiceClient();
  const { data: calendarRow, error } = await supabase
    .from('booking_calendars')
    .select('google_calendar_id, timezone, allow_visitor_management, clients(google_refresh_token)')
    .eq('id', calendar.calendarId)
    .single();
  if (error) return errorResponse(error, 'Could not load calendar settings.');
  const owner = ownerOf(calendarRow);

  // No Google account linked at all (e.g. the admin test-credentials login,
  // or a client who hasn't reconnected since enabling Calendar scopes) —
  // nothing to list, but not an error: the page shows a "connect Google"
  // state instead of a picker. Timezone is still returned/settable either
  // way — it's a per-calendar setting, not dependent on Google linkage.
  if (!owner?.google_refresh_token) {
    return NextResponse.json({
      linked: false,
      calendars: [],
      selected: calendarRow.google_calendar_id,
      timezone: calendarRow.timezone,
      allowVisitorManagement: calendarRow.allow_visitor_management,
    });
  }

  try {
    const calendars = await listGoogleCalendars(owner.google_refresh_token);
    return NextResponse.json({
      linked: true,
      calendars,
      selected: calendarRow.google_calendar_id,
      timezone: calendarRow.timezone,
      allowVisitorManagement: calendarRow.allow_visitor_management,
    });
  } catch (err) {
    return errorResponse(
      err,
      'Could not load your Google calendars. Try signing out and back in to reconnect Google Calendar.'
    );
  }
}

export async function PATCH(req: Request) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const { searchParams } = new URL(req.url);
  const calendar = await requireCalendarAccess(searchParams.get('calendarId'), client);
  if (calendar instanceof NextResponse) return calendar;
  const writeError = requireWriteRole(calendar.role);
  if (writeError) return writeError;

  const parsed = calendarSelectSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const supabase = createServiceClient();
  const updates: Record<string, unknown> = {};

  if (body.googleCalendarId !== undefined) {
    const { data: calendarRow, error } = await supabase
      .from('booking_calendars')
      .select('clients(google_refresh_token)')
      .eq('id', calendar.calendarId)
      .single();
    if (error) return errorResponse(error, 'Could not load your account.');
    const owner = ownerOf(calendarRow);
    if (!owner?.google_refresh_token) {
      return NextResponse.json(
        { error: 'Connect Google Calendar (sign in with Google) before selecting a calendar.' },
        { status: 400 }
      );
    }

    // Confirm the requested calendar actually belongs to this account's
    // Google account before saving it, rather than trusting the id blind —
    // a caller hand-crafting this request otherwise couldn't do anything
    // worse than point their own sync at a calendar they can't read
    // (Google's API would just start failing the poll), but validating up
    // front turns that into a clear 400 instead of a silent, confusing
    // sync failure later.
    let googleCalendars;
    try {
      googleCalendars = await listGoogleCalendars(owner.google_refresh_token);
    } catch (err) {
      return errorResponse(err, 'Could not verify your Google calendars. Try again.');
    }
    if (!googleCalendars.some((c) => c.id === body.googleCalendarId)) {
      return NextResponse.json(
        { error: 'That calendar was not found on your Google account.' },
        { status: 400 }
      );
    }

    updates.google_calendar_id = body.googleCalendarId;
  }

  if (body.timezone !== undefined) {
    updates.timezone = body.timezone;
  }

  if (body.allowVisitorManagement !== undefined) {
    updates.allow_visitor_management = body.allowVisitorManagement;
  }

  const { error: updateError } = await supabase
    .from('booking_calendars')
    .update(updates)
    .eq('id', calendar.calendarId);
  if (updateError) return errorResponse(updateError, 'Could not save calendar settings.');

  return NextResponse.json({
    selected: body.googleCalendarId,
    timezone: body.timezone,
    allowVisitorManagement: body.allowVisitorManagement,
  });
}
