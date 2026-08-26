import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { requireCalendarAccess } from '@/lib/require-calendar';
import { getAvailableSlots } from '@/lib/availability';
import { parseLocalDateOnly } from '@/lib/date-format';
import { getGoogleCalendarEvents } from '@/lib/google-calendar';
import type { Appointment, AppointmentReason, GoogleBlock, Rule } from '@/lib/types';

// booking_calendars(...clients(google_refresh_token)) comes back as an array
// or a single object depending on the PostgREST join shape — same helper
// pattern already used in lib/booking.ts and lib/google-calendar.ts.
function ownerOf(calendarRow: any): any {
  return Array.isArray(calendarRow?.clients) ? calendarRow.clients[0] : calendarRow?.clients;
}

export async function GET(req: Request) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const { searchParams } = new URL(req.url);
  const calendar = await requireCalendarAccess(searchParams.get('calendarId'), client);
  if (calendar instanceof NextResponse) return calendar;

  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const reasonId = searchParams.get('reasonId');
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const [{ data: rules }, { data: booked }, { data: reasons }, { data: googleCalendarRow }] =
    await Promise.all([
      supabase.from('rules').select('*').eq('calendar_id', calendar.calendarId),
      supabase
        .from('appointments')
        .select('*')
        .eq('calendar_id', calendar.calendarId)
        .gt('expires_at', new Date().toISOString()),
      reasonId
        ? supabase.from('appointment_reasons').select('*').eq('id', reasonId)
        : supabase.from('appointment_reasons').select('*').eq('calendar_id', calendar.calendarId).limit(1),
      supabase
        .from('booking_calendars')
        .select('google_calendar_id, clients(google_refresh_token)')
        .eq('id', calendar.calendarId)
        .maybeSingle(),
    ]);

  const reason = reasons?.[0] as AppointmentReason | undefined;
  if (!reason) {
    return NextResponse.json({ error: 'No appointment reason found' }, { status: 400 });
  }

  // Live-fetch the calendar's own Google Calendar so a booking the client
  // made directly on Google (never going through this app) shows up here
  // too, not just as a red-flagged conflict the next time the 30-min cron
  // runs. Best-effort, same pattern as lib/booking.ts's conflict-suggestion
  // path — falls back to no events on a Google outage or unlinked account
  // rather than failing the whole schedule fetch.
  let googleEvents: GoogleBlock[] = [];
  const googleOwner = ownerOf(googleCalendarRow);
  if (googleOwner?.google_refresh_token) {
    try {
      googleEvents = await getGoogleCalendarEvents(
        googleOwner.google_refresh_token,
        googleCalendarRow?.google_calendar_id || 'primary',
        parseLocalDateOnly(startDate),
        new Date(parseLocalDateOnly(endDate).getTime() + 86400000) // +1 day, exclusive end
      );
    } catch {
      googleEvents = [];
    }
  }
  // Exclude events this app itself wrote back for a booked appointment
  // (appointments.google_event_id) — those already render as the
  // appointment itself, so showing them again as a separate Google block
  // would duplicate the same time slot on screen.
  const ownEventIds = new Set(
    ((booked ?? []) as Appointment[]).map((a) => a.google_event_id).filter((id): id is string => !!id)
  );
  googleEvents = googleEvents.filter((event) => !ownEventIds.has(event.id));

  const slots = getAvailableSlots({
    startDate: parseLocalDateOnly(startDate),
    endDate: parseLocalDateOnly(endDate),
    reason,
    rules: (rules ?? []) as Rule[],
    booked: (booked ?? []) as Appointment[],
    googleBlocks: googleEvents,
  });

  // Group flat slots + booked appointments + Google Calendar events into
  // per-day buckets for the calendar view (Phase 3: "Click date → see
  // available slots + booked appointments", color-coded by status).
  const days = new Map<
    string,
    { slots: typeof slots; appointments: Appointment[]; googleEvents: GoogleBlock[] }
  >();
  function bucket(day: string) {
    if (!days.has(day)) days.set(day, { slots: [], appointments: [], googleEvents: [] });
    return days.get(day)!;
  }
  for (const slot of slots) {
    bucket(slot.start.slice(0, 10)).slots.push(slot);
  }
  for (const apt of (booked ?? []) as Appointment[]) {
    bucket(apt.start_time.slice(0, 10)).appointments.push(apt);
  }
  for (const event of googleEvents) {
    bucket(event.start.slice(0, 10)).googleEvents.push(event);
  }

  return NextResponse.json({
    days: Array.from(days.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, bucket]) => ({ date, ...bucket })),
  });
}
