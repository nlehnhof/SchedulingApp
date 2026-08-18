import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { verifyAppointmentToken } from '@/lib/appointment-token';
import { meetsMinNotice } from '@/lib/min-notice';
import { isRateLimited, clientIp } from '@/lib/rate-limit';
import type { Rule } from '@/lib/types';

// Resolves a visitor's signed single-appointment token (L7 launch phase —
// see lib/appointment-token.ts) to what app/manage/[token]/page.tsx needs
// to render: what's booked, and whether cancel/reschedule are even offered.
// No login — token possession IS the auth, same posture as the booking
// flow itself, so this is rate-limited by IP the same way
// app/api/visitor/[clientLink]/book/route.ts is.
export async function GET(req: Request, { params }: { params: { token: string } }) {
  if (isRateLimited(`manage:${clientIp(req)}`, 30, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again in a few minutes.' }, { status: 429 });
  }

  const appointmentId = verifyAppointmentToken(params.token);
  if (!appointmentId) {
    return NextResponse.json({ error: 'This link is invalid.' }, { status: 404 });
  }

  const supabase = createServiceClient();
  const { data: appointment } = await supabase
    .from('appointments')
    .select('id, calendar_id, visitor_name, start_time, end_time, reason_id, status')
    .eq('id', appointmentId)
    .maybeSingle();
  if (!appointment) {
    return NextResponse.json({ error: 'This appointment no longer exists.' }, { status: 404 });
  }

  const [{ data: calendar }, { data: reason }, { data: rules }] = await Promise.all([
    supabase
      .from('booking_calendars')
      .select('display_name, timezone, allow_visitor_management')
      .eq('id', appointment.calendar_id)
      .single(),
    supabase.from('appointment_reasons').select('name').eq('id', appointment.reason_id).maybeSingle(),
    supabase.from('rules').select('*').eq('calendar_id', appointment.calendar_id),
  ]);

  const allowManagement = calendar?.allow_visitor_management ?? true;
  const withinNotice = meetsMinNotice((rules ?? []) as Rule[], new Date(appointment.start_time));

  return NextResponse.json({
    appointment: {
      id: appointment.id,
      start: appointment.start_time,
      end: appointment.end_time,
      visitorName: appointment.visitor_name,
      status: appointment.status,
    },
    reasonName: reason?.name ?? null,
    clientName: calendar?.display_name ?? null,
    canManage: allowManagement && withinNotice,
    allowManagement,
    withinNotice,
  });
}
