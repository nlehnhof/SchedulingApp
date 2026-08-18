import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { verifyAppointmentToken } from '@/lib/appointment-token';
import { cancelAppointment } from '@/lib/appointment-actions';
import { meetsMinNotice } from '@/lib/min-notice';
import { isRateLimited, clientIp } from '@/lib/rate-limit';
import { errorResponse } from '@/lib/error-response';
import type { Rule } from '@/lib/types';

// Visitor-facing cancel (L7 launch phase) — reuses cancelAppointment (the
// same helper the owner's DELETE /api/client/appointments/[id] calls) so the
// Google write-back deletion and error-log behavior stay in exactly one
// place. Gated on the calendar's allow_visitor_management flag and the same
// min_notice rule the availability calculator already enforces, so a client
// who turned off self-service or requires 24h notice can't be bypassed via
// this route just because it doesn't go through requireCalendarAccess.
export async function POST(req: Request, { params }: { params: { token: string } }) {
  if (isRateLimited(`manage-cancel:${clientIp(req)}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again in a few minutes.' }, { status: 429 });
  }

  const appointmentId = verifyAppointmentToken(params.token);
  if (!appointmentId) {
    return NextResponse.json({ error: 'This link is invalid.' }, { status: 404 });
  }

  const supabase = createServiceClient();
  const { data: appointment } = await supabase
    .from('appointments')
    .select('id, calendar_id, start_time')
    .eq('id', appointmentId)
    .maybeSingle();
  if (!appointment) {
    return NextResponse.json({ error: 'This appointment no longer exists.' }, { status: 404 });
  }

  const [{ data: calendar }, { data: rules }] = await Promise.all([
    supabase.from('booking_calendars').select('allow_visitor_management').eq('id', appointment.calendar_id).single(),
    supabase.from('rules').select('*').eq('calendar_id', appointment.calendar_id),
  ]);

  if (calendar && calendar.allow_visitor_management === false) {
    return NextResponse.json(
      { error: 'This calendar does not allow self-service changes. Please contact them directly.' },
      { status: 403 }
    );
  }
  if (!meetsMinNotice((rules ?? []) as Rule[], new Date(appointment.start_time))) {
    return NextResponse.json(
      { error: 'This appointment is too close to its start time to cancel online. Please contact them directly.' },
      { status: 403 }
    );
  }

  try {
    const result = await cancelAppointment(appointment.id, appointment.calendar_id);
    if (result.status === 'not_found') {
      return NextResponse.json({ error: 'This appointment no longer exists.' }, { status: 404 });
    }
    return NextResponse.json({ status: 'cancelled' });
  } catch (err) {
    return errorResponse(err, 'Could not cancel this appointment. Please try again.');
  }
}
