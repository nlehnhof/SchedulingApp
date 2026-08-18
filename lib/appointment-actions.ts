import * as Sentry from '@sentry/nextjs';
import { createServiceClient } from './supabase';
import { deleteGoogleCalendarEvent } from './google-calendar';

function ownerOf(calendar: any): any {
  return Array.isArray(calendar?.clients) ? calendar.clients[0] : calendar?.clients;
}

/**
 * Deletes an appointment and best-effort cleans up its written-back Google
 * event, in one place — used by the client-owned DELETE
 * (app/api/client/appointments/[id]/route.ts) and the visitor-facing manage
 * link (app/api/manage/[token]/cancel/route.ts, L7 launch phase), so the
 * Google write-back deletion and error-log behavior never has two
 * implementations to keep in sync.
 */
export async function cancelAppointment(
  appointmentId: string,
  calendarId: string
): Promise<{ status: 'deleted' } | { status: 'not_found' }> {
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from('appointments')
    .select('google_event_id')
    .eq('id', appointmentId)
    .eq('calendar_id', calendarId)
    .maybeSingle();

  const { error, count } = await supabase
    .from('appointments')
    .delete({ count: 'exact' })
    .eq('id', appointmentId)
    .eq('calendar_id', calendarId);

  if (error) throw error;
  if (!count) return { status: 'not_found' };

  if (existing?.google_event_id) {
    const { data: calendarRow } = await supabase
      .from('booking_calendars')
      .select('google_calendar_id, clients(google_refresh_token)')
      .eq('id', calendarId)
      .single();
    const owner = ownerOf(calendarRow);
    if (owner?.google_refresh_token) {
      try {
        await deleteGoogleCalendarEvent(
          owner.google_refresh_token,
          calendarRow?.google_calendar_id || 'primary',
          existing.google_event_id
        );
      } catch (err: any) {
        Sentry.captureException(err);
        await supabase.from('error_log').insert({
          calendar_id: calendarId,
          error_type: 'google_writeback_failed',
          message: err?.message ?? String(err),
        });
      }
    }
  }

  return { status: 'deleted' };
}
