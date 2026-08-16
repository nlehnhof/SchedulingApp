import { createServiceClient } from './supabase';
import { getAvailableSlots, nextAvailableSlot } from './availability';
import { sendBookingConfirmationEmail } from './email';
import { createGoogleCalendarEvent, getGoogleCalendarEvents } from './google-calendar';
import { getEffectiveTier } from './premium-grants';
import type { Appointment, AppointmentReason, BookingResult, GoogleBlock, Rule } from './types';

export interface BookAppointmentInput {
  clientId: string;
  visitorName: string;
  visitorPhone: string;
  visitorEmail: string;
  reasonId: string;
  startTime: string; // ISO
  notes?: string;
}

/**
 * Books an appointment via the `book_appointment` Postgres function, which
 * handles locking + conflict detection atomically (see
 * supabase/migrations/0002_booking_function.sql). On conflict, falls back to
 * the availability calculator to suggest the next open slot for the same
 * reason.
 */
export async function bookAppointment(input: BookAppointmentInput): Promise<BookingResult> {
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc('book_appointment', {
    p_client_id: input.clientId,
    p_visitor_name: input.visitorName,
    p_visitor_phone: input.visitorPhone,
    p_reason_id: input.reasonId,
    p_start_time: input.startTime,
    p_notes: input.notes ?? null,
    p_visitor_email: input.visitorEmail,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;

  if (row?.result_status === 'booked') {
    // Premium-tier automatic confirmation email (feature request: "should
    // automatically come from the client's email"). Best-effort — a failed
    // send must never fail a booking that already succeeded, so this is
    // isolated in its own try/catch and logged to error_log the same way
    // lib/google-calendar.ts logs a sync failure, rather than thrown.
    const [{ data: client }, { data: reason }] = await Promise.all([
      supabase
        .from('clients')
        .select('email, display_name, tier, timezone, google_refresh_token, google_calendar_id')
        .eq('id', input.clientId)
        .single(),
      supabase
        .from('appointment_reasons')
        .select('name, duration_min')
        .eq('id', input.reasonId)
        .single(),
    ]);

    // Left undefined (not false) unless a send was actually attempted, so
    // the visitor UI can tell "not premium, nothing attempted" apart from
    // "attempted and failed" rather than collapsing both to "not sent".
    let confirmationEmailSent: boolean | undefined;

    // Anonymous visitor flow (no session), so the premium_grants override
    // has to be checked explicitly here too — see lib/premium-grants.ts.
    const isPremium = client ? (await getEffectiveTier(client.tier, client.email)) === 'premium' : false;

    if (isPremium && client && reason) {
      try {
        const start = new Date(input.startTime);
        const end = new Date(start.getTime() + reason.duration_min * 60_000);
        await sendBookingConfirmationEmail({
          visitorEmail: input.visitorEmail,
          visitorName: input.visitorName,
          clientDisplayName: client.display_name || client.email,
          clientEmail: client.email,
          reasonName: reason.name,
          start,
          end,
        });
        confirmationEmailSent = true;
      } catch (err: any) {
        confirmationEmailSent = false;
        await supabase.from('error_log').insert({
          client_id: input.clientId,
          error_type: 'booking_confirmation_email_failed',
          message: err?.message ?? String(err),
        });
      }
    }

    // Write the booking back to the client's Google Calendar, same
    // best-effort pattern as the confirmation email above — a failed write
    // must never fail a booking that already succeeded in Postgres.
    if (client?.google_refresh_token && reason) {
      try {
        const start = new Date(row.result_start);
        const end = new Date(row.result_end);
        const eventId = await createGoogleCalendarEvent(
          client.google_refresh_token,
          client.google_calendar_id || 'primary',
          {
            summary: `${reason.name} — ${input.visitorName}`,
            description: input.notes,
            start,
            end,
            timeZone: client.timezone || 'UTC',
          }
        );
        await supabase
          .from('appointments')
          .update({ google_event_id: eventId })
          .eq('id', row.appointment_id);
      } catch (err: any) {
        await supabase.from('error_log').insert({
          client_id: input.clientId,
          error_type: 'google_writeback_failed',
          message: err?.message ?? String(err),
        });
      }
    }

    return {
      status: 'booked',
      appointment: {
        id: row.appointment_id,
        start: row.result_start,
        end: row.result_end,
      },
      confirmationEmailSent,
    };
  }

  // Conflict: suggest the next available slot for this reason.
  const [{ data: reason }, { data: rules }, { data: booked }, { data: googleClient }] =
    await Promise.all([
      supabase
        .from('appointment_reasons')
        .select('*')
        .eq('id', input.reasonId)
        .single(),
      supabase.from('rules').select('*').eq('client_id', input.clientId),
      supabase
        .from('appointments')
        .select('*')
        .eq('client_id', input.clientId)
        .gt('expires_at', new Date().toISOString()),
      supabase
        .from('clients')
        .select('google_refresh_token, google_calendar_id')
        .eq('id', input.clientId)
        .maybeSingle(),
    ]);

  // Same live-check as the visitor availability route — don't suggest a
  // slot that's already taken on the client's Google Calendar. Best-effort:
  // falls back to no live blocks on a Google outage rather than failing the
  // whole conflict response.
  let googleBlocks: GoogleBlock[] = [];
  if (googleClient?.google_refresh_token) {
    try {
      googleBlocks = await getGoogleCalendarEvents(
        googleClient.google_refresh_token,
        googleClient.google_calendar_id || 'primary'
      );
    } catch {
      googleBlocks = [];
    }
  }

  let nextAvailable;
  if (reason) {
    const searchStart = new Date(input.startTime);
    const searchEnd = new Date(searchStart);
    searchEnd.setDate(searchEnd.getDate() + 30);

    const slots = getAvailableSlots({
      startDate: searchStart,
      endDate: searchEnd,
      reason: reason as AppointmentReason,
      rules: (rules ?? []) as Rule[],
      booked: (booked ?? []) as Appointment[],
      googleBlocks,
    });
    nextAvailable = nextAvailableSlot(slots, searchStart);
  }

  return {
    status: 'conflict',
    message: 'That slot just booked! Try this instead?',
    nextAvailable,
  };
}
