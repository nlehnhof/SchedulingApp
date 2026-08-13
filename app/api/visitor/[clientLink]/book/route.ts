import { NextResponse } from 'next/server';
import { bookAppointment } from '@/lib/booking';
import { bookSchema } from '@/lib/validation';

export async function POST(
  req: Request,
  { params }: { params: { clientLink: string } }
) {
  const parsed = bookSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  try {
    const result = await bookAppointment({
      clientId: params.clientLink,
      visitorName: body.visitorName,
      visitorPhone: body.visitorPhone,
      reasonId: body.reasonId,
      startTime: body.startTime,
      notes: body.notes,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'booking_failed' }, { status: 500 });
  }
}
