import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { requireCalendarAccess, requireWriteRole } from '@/lib/require-calendar';
import { appointmentEditSchema } from '@/lib/validation';
import { errorResponse } from '@/lib/error-response';
import { createGoogleCalendarEvent, updateGoogleCalendarEvent } from '@/lib/google-calendar';
import { cancelAppointment } from '@/lib/appointment-actions';

function ownerOf(calendar: any): any {
  return Array.isArray(calendar?.clients) ? calendar.clients[0] : calendar?.clients;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const { searchParams } = new URL(req.url);
  const calendar = await requireCalendarAccess(searchParams.get('calendarId'), client);
  if (calendar instanceof NextResponse) return calendar;
  const writeError = requireWriteRole(calendar.role);
  if (writeError) return writeError;

  const parsed = appointmentEditSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const supabase = createServiceClient();

  // Fetched up front (in parallel with the RPC's own lookups) so the
  // best-effort Google write-back below doesn't need a second round-trip.
  const [{ data: existing }, { data: calendarRow }, { data: reason }] = await Promise.all([
    supabase
      .from('appointments')
      .select('google_event_id')
      .eq('id', params.id)
      .eq('calendar_id', calendar.calendarId)
      .maybeSingle(),
    supabase
      .from('booking_calendars')
      .select('timezone, google_calendar_id, clients(google_refresh_token)')
      .eq('id', calendar.calendarId)
      .single(),
    supabase.from('appointment_reasons').select('name').eq('id', body.reasonId).maybeSingle(),
  ]);
  const owner = ownerOf(calendarRow);

  const { data, error } = await supabase.rpc('update_appointment', {
    p_appointment_id: params.id,
    p_calendar_id: calendar.calendarId,
    p_visitor_name: body.visitorName,
    p_visitor_phone: body.visitorPhone,
    p_reason_id: body.reasonId,
    p_start_time: body.startTime,
    p_notes: body.notes ?? null,
  });

  if (error) return errorResponse(error, 'Could not save appointment changes.');

  const row = Array.isArray(data) ? data[0] : data;
  if (row?.result_status === 'conflict') {
    return NextResponse.json(
      { status: 'conflict', message: 'That time overlaps another appointment.' },
      { status: 409 }
    );
  }

  // Best-effort Google Calendar write-back, same pattern as lib/booking.ts —
  // a failed sync must never fail an edit that already succeeded. Updates
  // the existing written-back event if one exists; otherwise creates one
  // (covers the case where the calendar was linked to Google after the
  // appointment was originally booked).
  if (owner?.google_refresh_token) {
    try {
      const googleCalendarId = calendarRow?.google_calendar_id || 'primary';
      const eventInput = {
        summary: `${reason?.name ?? 'Appointment'} — ${body.visitorName}`,
        description: body.notes,
        start: new Date(row.result_start),
        end: new Date(row.result_end),
        timeZone: calendarRow?.timezone || 'UTC',
      };
      if (existing?.google_event_id) {
        await updateGoogleCalendarEvent(
          owner.google_refresh_token,
          googleCalendarId,
          existing.google_event_id,
          eventInput
        );
      } else {
        const eventId = await createGoogleCalendarEvent(owner.google_refresh_token, googleCalendarId, eventInput);
        await supabase.from('appointments').update({ google_event_id: eventId }).eq('id', params.id);
      }
    } catch (err: any) {
      Sentry.captureException(err);
      await supabase.from('error_log').insert({
        calendar_id: calendar.calendarId,
        error_type: 'google_writeback_failed',
        message: err?.message ?? String(err),
      });
    }
  }

  return NextResponse.json({
    status: 'updated',
    appointment: { id: row.appointment_id, start: row.result_start, end: row.result_end },
  });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const { searchParams } = new URL(req.url);
  const calendar = await requireCalendarAccess(searchParams.get('calendarId'), client);
  if (calendar instanceof NextResponse) return calendar;
  const writeError = requireWriteRole(calendar.role);
  if (writeError) return writeError;

  let result;
  try {
    result = await cancelAppointment(params.id, calendar.calendarId);
  } catch (err) {
    return errorResponse(err, 'Could not delete appointment.');
  }
  if (result.status === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({ status: 'deleted' });
}
