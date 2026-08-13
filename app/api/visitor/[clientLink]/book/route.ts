import { NextResponse } from 'next/server';
import { bookAppointment } from '@/lib/booking';
import { bookSchema } from '@/lib/validation';
import { errorResponse } from '@/lib/error-response';
import { isRateLimited, clientIp } from '@/lib/rate-limit';
import { resolveClientLink } from '@/lib/resolve-client-link';

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

  const resolved = await resolveClientLink(params.clientLink);
  if (!resolved) {
    return NextResponse.json({ error: 'This booking link is not valid.' }, { status: 404 });
  }

  const parsed = bookSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  try {
    const result = await bookAppointment({
      clientId: resolved.clientId,
      visitorName: body.visitorName,
      visitorPhone: body.visitorPhone,
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
