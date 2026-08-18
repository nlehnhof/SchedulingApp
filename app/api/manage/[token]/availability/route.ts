import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { getAvailableSlots } from '@/lib/availability';
import { getGoogleCalendarEvents } from '@/lib/google-calendar';
import { verifyAppointmentToken } from '@/lib/appointment-token';
import { isRateLimited, clientIp } from '@/lib/rate-limit';
import type { Appointment, AppointmentReason, GoogleBlock, Rule } from '@/lib/types';

function ownerOf(calendar: any): any {
  return Array.isArray(calendar?.clients) ? calendar.clients[0] : calendar?.clients;
}

// Slot picker for the reschedule step of app/manage/[token] (L7 launch
// phase) — same shape as app/api/visitor/[clientLink]/availability, except
// `booked` excludes the appointment being rescheduled: it currently
// occupies its own slot, and capacity rules (first_n_only, max_per_window,
// sequential_fill) must not count it against itself while the visitor picks
// a new time. update_appointment (the RPC the reschedule route actually
// calls) does the same exclusion server-side for the final conflict check —
// this route only powers what's offered, not what's enforced.
export async function GET(req: Request, { params }: { params: { token: string } }) {
  if (isRateLimited(`manage-availability:${clientIp(req)}`, 60, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again in a few minutes.' }, { status: 429 });
  }

  const appointmentId = verifyAppointmentToken(params.token);
  if (!appointmentId) {
    return NextResponse.json({ error: 'This link is invalid.' }, { status: 404 });
  }

  const supabase = createServiceClient();
  const { data: appointment } = await supabase
    .from('appointments')
    .select('id, calendar_id, reason_id')
    .eq('id', appointmentId)
    .maybeSingle();
  if (!appointment) {
    return NextResponse.json({ error: 'This appointment no longer exists.' }, { status: 404 });
  }

  const [{ data: calendar }, { data: reason }, { data: rules }, { data: booked }] = await Promise.all([
    supabase
      .from('booking_calendars')
      .select('google_calendar_id, clients(google_refresh_token)')
      .eq('id', appointment.calendar_id)
      .maybeSingle(),
    supabase
      .from('appointment_reasons')
      .select('*')
      .eq('id', appointment.reason_id)
      .eq('calendar_id', appointment.calendar_id)
      .maybeSingle(),
    supabase.from('rules').select('*').eq('calendar_id', appointment.calendar_id),
    supabase
      .from('appointments')
      .select('*')
      .eq('calendar_id', appointment.calendar_id)
      .neq('id', appointment.id)
      .gt('expires_at', new Date().toISOString()),
  ]);

  if (!reason) return NextResponse.json({ error: 'Reason not found' }, { status: 404 });

  const owner = ownerOf(calendar);
  let googleBlocks: GoogleBlock[] = [];
  if (owner?.google_refresh_token) {
    try {
      googleBlocks = await getGoogleCalendarEvents(owner.google_refresh_token, calendar?.google_calendar_id || 'primary');
    } catch {
      googleBlocks = [];
    }
  }

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30);

  const slots = getAvailableSlots({
    startDate,
    endDate,
    reason: reason as AppointmentReason,
    rules: (rules ?? []) as Rule[],
    booked: (booked ?? []) as Appointment[],
    googleBlocks,
  });

  return NextResponse.json({
    slots: slots
      .filter((s) => s.available)
      .map((s) => ({
        date: s.start.slice(0, 10),
        time: s.start.slice(11, 16),
        start: s.start,
        end: s.end,
        available: s.available,
      })),
  });
}
