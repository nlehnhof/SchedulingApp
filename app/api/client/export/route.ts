import { NextResponse } from 'next/server';
import { requireClient } from '@/lib/require-client';
import { requireCalendarAccess } from '@/lib/require-calendar';
import { exportSchema } from '@/lib/validation';
import { exportMonthlyCSV } from '@/lib/csv-export';
import { errorResponse } from '@/lib/error-response';

export async function POST(req: Request) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const { searchParams } = new URL(req.url);
  const calendar = await requireCalendarAccess(searchParams.get('calendarId'), client.clientId);
  if (calendar instanceof NextResponse) return calendar;

  const parsed = exportSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await exportMonthlyCSV(calendar.calendarId, parsed.data.month);
    return NextResponse.json({ status: 'export_queued' });
  } catch (err) {
    // Was previously `{ status: 'error', message: ... }` — the frontend's
    // postJSON helper only ever reads the `error` field, so that shape
    // silently never surfaced the real message. Fixed as part of this pass.
    return errorResponse(err, 'Export failed. Please try again.');
  }
}
