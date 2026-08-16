import { NextResponse } from 'next/server';
import { requireClient } from '@/lib/require-client';
import { requireCalendarAccess } from '@/lib/require-calendar';
import { syncGoogleCalendarForCalendar } from '@/lib/google-calendar';
import { errorResponse } from '@/lib/error-response';

// Lets the client manually re-trigger sync for one of their calendars from
// the Error Log page instead of waiting for the next 30-min cron run.
export async function POST(req: Request) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const body = await req.json().catch(() => ({}));
  const calendar = await requireCalendarAccess(body?.calendarId, client.clientId);
  if (calendar instanceof NextResponse) return calendar;

  try {
    await syncGoogleCalendarForCalendar(calendar.calendarId);
    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    return errorResponse(err, 'Sync failed. Please try again.');
  }
}
