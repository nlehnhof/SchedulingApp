import { NextResponse } from 'next/server';
import { bookAppointment } from '@/lib/booking';
import { bookSchema } from '@/lib/validation';
import { errorResponse } from '@/lib/error-response';
import { isRateLimited, clientIp } from '@/lib/rate-limit';
import { resolveCalendarLink } from '@/lib/resolve-calendar-link';
import { createServiceClient } from '@/lib/supabase';

export async function POST(
  req: Request,
  { params }: { params: { clientLink: string } }
) {
  // No login gates this endpoint (it's the public visitor booking flow), so
  // it's the one most worth throttling against being hammered — 20 attempts
  // per 10 minutes per IP is generous for a real visitor retrying a
  // conflicted slot, but blocks scripted abuse.
  if (isRateLimited(`book:${clientIp(req)}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: 'Too many booking attempts. Please try again in a few minutes.' },
      { status: 429 }
    );
  }

  const resolved = await resolveCalendarLink(params.clientLink);
  if (!resolved) {
    return NextResponse.json({ error: 'This booking link is not valid.' }, { status: 404 });
  }

  const parsed = bookSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  // Anonymous/unauthenticated route — never trust the client's own claim of
  // which required checkboxes it checked without re-verifying against the
  // reason's actual stored list, scoped to this calendar (same double-scoping
  // the book_appointment SQL function itself uses for reason_id + calendar_id).
  const supabase = createServiceClient();
  const { data: reason, error: reasonError } = await supabase
    .from('appointment_reasons')
    .select('required_checkboxes')
    .eq('id', body.reasonId)
    .eq('calendar_id', resolved.calendarId)
    .maybeSingle();
  if (reasonError) return errorResponse(reasonError, 'Booking failed. Please try again.');
  if (!reason) {
    return NextResponse.json({ error: 'Invalid reason.' }, { status: 400 });
  }
  const requiredCheckboxes = (reason.required_checkboxes ?? []) as string[];
  if (requiredCheckboxes.length > 0) {
    const checked = new Set(body.checkedRequiredCheckboxes ?? []);
    const allChecked = requiredCheckboxes.every((label) => checked.has(label));
    if (!allChecked) {
      return NextResponse.json(
        { error: 'Please check all required boxes before booking.' },
        { status: 400 }
      );
    }
  }

  try {
    const result = await bookAppointment({
      calendarId: resolved.calendarId,
      visitorName: body.visitorName,
      visitorPhone: body.visitorPhone,
      visitorEmail: body.visitorEmail,
      reasonId: body.reasonId,
      startTime: body.startTime,
      notes: body.notes,
    });
    return NextResponse.json(result);
  } catch (err) {
    // Previously leaked the raw Postgres/Supabase error message to an
    // unauthenticated visitor — generic message now, real detail still
    // logged server-side (security review 2026-08-13).
    return errorResponse(err, 'Booking failed. Please try again.');
  }
}
