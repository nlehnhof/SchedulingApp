import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServiceClient } from '@/lib/supabase';
import { verifyAppointmentToken } from '@/lib/appointment-token';
import { meetsMinNotice } from '@/lib/min-notice';
import { isRateLimited, clientIp } from '@/lib/rate-limit';
import { errorResponse } from '@/lib/error-response';
import { rescheduleSchema } from '@/lib/validation';
import { createGoogleCalendarEvent, updateGoogleCalendarEvent } from '@/lib/google-calendar';
import type { Rule } from '@/lib/types';

function ownerOf(calendar: any): any {
  return Array.isArray(calendar?.clients) ? calendar.clients[0] : calendar?.clients;
}

// Visitor-facing reschedule (L7 launch phase). Goes through update_appointment
// — the same row-locking Postgres function the owner's PATCH
// /api/client/appointments/[id] calls — not a plain UPDATE, since a
// reschedule has exactly the same double-booking race as a fresh booking
// (CLAUDE.md's note on this function being the highest-risk logic in the
// app). Visitor identity (name/phone/reason) is never taken from the
// request body — it's re-read from the existing row, so this route can only
// ever move a real appointment's time, never impersonate a different one.
export async function POST(req: Request, { params }: { params: { token: string } }) {
  if (isRateLimited(`manage-reschedule:${clientIp(req)}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again in a few minutes.' }, { status: 429 });
  }

  const appointmentId = verifyAppointmentToken(params.token);
  if (!appointmentId) {
    return NextResponse.json({ error: 'This link is invalid.' }, { status: 404 });
  }

  const parsed = rescheduleSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { startTime } = parsed.data;

  const supabase = createServiceClient();
  const { data: appointment } = await supabase
    .from('appointments')
    .select('id, calendar_id, reason_id, visitor_name, visitor_phone, notes, start_time, google_event_id')
    .eq('id', appointmentId)
    .maybeSingle();
  if (!appointment) {
    return NextResponse.json({ error: 'This appointment no longer exists.' }, { status: 404 });
  }

  const [{ data: calendar }, { data: rules }, { data: reason }] = await Promise.all([
    supabase
      .from('booking_calendars')
      .select('allow_visitor_management, timezone, google_calendar_id, clients(google_refresh_token)')
      .eq('id', appointment.calendar_id)
      .single(),
    supabase.from('rules').select('*').eq('calendar_id', appointment.calendar_id),
    supabase.from('appointment_reasons').select('name').eq('id', appointment.reason_id).maybeSingle(),
  ]);

  if (calendar && calendar.allow_visitor_management === false) {
    return NextResponse.json(
      { error: 'This calendar does not allow self-service changes. Please contact them directly.' },
      { status: 403 }
    );
  }
  // Gate on the CURRENT appointment's start time — the min_notice window
  // that makes cancelling the existing booking too last-minute makes moving
  // it too last-minute for exactly the same reason.
  if (!meetsMinNotice((rules ?? []) as Rule[], new Date(appointment.start_time))) {
    return NextResponse.json(
      { error: 'This appointment is too close to its start time to reschedule online. Please contact them directly.' },
      { status: 403 }
    );
  }

  const { data, error } = await supabase.rpc('update_appointment', {
    p_appointment_id: appointment.id,
    p_calendar_id: appointment.calendar_id,
    p_visitor_name: appointment.visitor_name,
    p_visitor_phone: appointment.visitor_phone,
    p_reason_id: appointment.reason_id,
    p_start_time: startTime,
    p_notes: appointment.notes,
  });

  if (error) return errorResponse(error, 'Could not reschedule this appointment. Please try again.');

  const row = Array.isArray(data) ? data[0] : data;
  if (row?.result_status === 'conflict') {
    return NextResponse.json(
      { status: 'conflict', message: 'That time overlaps another appointment.' },
      { status: 409 }
    );
  }

  const owner = ownerOf(calendar);
  if (owner?.google_refresh_token) {
    try {
      const googleCalendarId = calendar?.google_calendar_id || 'primary';
      const eventInput = {
        summary: `${reason?.name ?? 'Appointment'} — ${appointment.visitor_name}`,
        description: appointment.notes ?? undefined,
        start: new Date(row.result_start),
        end: new Date(row.result_end),
        timeZone: calendar?.timezone || 'UTC',
      };
      if (appointment.google_event_id) {
        await updateGoogleCalendarEvent(
          owner.google_refresh_token,
          googleCalendarId,
          appointment.google_event_id,
          eventInput
        );
      } else {
        const eventId = await createGoogleCalendarEvent(owner.google_refresh_token, googleCalendarId, eventInput);
        await supabase.from('appointments').update({ google_event_id: eventId }).eq('id', appointment.id);
      }
    } catch (err: any) {
      Sentry.captureException(err);
      await supabase.from('error_log').insert({
        calendar_id: appointment.calendar_id,
        error_type: 'google_writeback_failed',
        message: err?.message ?? String(err),
      });
    }
  }

  return NextResponse.json({
    status: 'rescheduled',
    appointment: { id: row.appointment_id, start: row.result_start, end: row.result_end },
  });
}
