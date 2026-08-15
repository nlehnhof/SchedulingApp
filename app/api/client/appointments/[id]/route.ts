import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { appointmentEditSchema } from '@/lib/validation';
import { errorResponse } from '@/lib/error-response';
import { createGoogleCalendarEvent, deleteGoogleCalendarEvent, updateGoogleCalendarEvent } from '@/lib/google-calendar';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const parsed = appointmentEditSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const supabase = createServiceClient();

  // Fetched up front (in parallel with the RPC's own lookups) so the
  // best-effort Google write-back below doesn't need a second round-trip.
  const [{ data: existing }, { data: clientRow }, { data: reason }] = await Promise.all([
    supabase
      .from('appointments')
      .select('google_event_id')
      .eq('id', params.id)
      .eq('client_id', client.clientId)
      .maybeSingle(),
    supabase
      .from('clients')
      .select('google_refresh_token, google_calendar_id')
      .eq('id', client.clientId)
      .single(),
    supabase.from('appointment_reasons').select('name').eq('id', body.reasonId).maybeSingle(),
  ]);

  const { data, error } = await supabase.rpc('update_appointment', {
    p_appointment_id: params.id,
    p_client_id: client.clientId,
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
  // (covers the case where the client linked their calendar after the
  // appointment was originally booked).
  if (clientRow?.google_refresh_token) {
    try {
      const calendarId = clientRow.google_calendar_id || 'primary';
      const eventInput = {
        summary: `${reason?.name ?? 'Appointment'} — ${body.visitorName}`,
        description: body.notes,
        start: new Date(row.result_start),
        end: new Date(row.result_end),
      };
      if (existing?.google_event_id) {
        await updateGoogleCalendarEvent(
          clientRow.google_refresh_token,
          calendarId,
          existing.google_event_id,
          eventInput
        );
      } else {
        const eventId = await createGoogleCalendarEvent(clientRow.google_refresh_token, calendarId, eventInput);
        await supabase.from('appointments').update({ google_event_id: eventId }).eq('id', params.id);
      }
    } catch (err: any) {
      await supabase.from('error_log').insert({
        client_id: client.clientId,
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

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from('appointments')
    .select('google_event_id')
    .eq('id', params.id)
    .eq('client_id', client.clientId)
    .maybeSingle();

  const { error, count } = await supabase
    .from('appointments')
    .delete({ count: 'exact' })
    .eq('id', params.id)
    .eq('client_id', client.clientId); // scope to this client, no cross-tenant deletes

  if (error) return errorResponse(error, 'Could not delete appointment.');
  if (!count) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Best-effort: clean up the written-back Google event too, same
  // never-fail-the-request pattern as the write-back on create/edit.
  if (existing?.google_event_id) {
    const { data: clientRow } = await supabase
      .from('clients')
      .select('google_refresh_token, google_calendar_id')
      .eq('id', client.clientId)
      .single();
    if (clientRow?.google_refresh_token) {
      try {
        await deleteGoogleCalendarEvent(
          clientRow.google_refresh_token,
          clientRow.google_calendar_id || 'primary',
          existing.google_event_id
        );
      } catch (err: any) {
        await supabase.from('error_log').insert({
          client_id: client.clientId,
          error_type: 'google_writeback_failed',
          message: err?.message ?? String(err),
        });
      }
    }
  }

  return NextResponse.json({ status: 'deleted' });
}
