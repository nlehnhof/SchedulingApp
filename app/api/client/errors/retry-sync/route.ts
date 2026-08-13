import { NextResponse } from 'next/server';
import { requireClient } from '@/lib/require-client';
import { syncGoogleCalendarForClient } from '@/lib/google-calendar';
import { errorResponse } from '@/lib/error-response';

// Lets the client manually re-trigger their own Google Calendar sync from
// the Error Log page instead of waiting for the next 30-min cron run.
export async function POST() {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  try {
    await syncGoogleCalendarForClient(client.clientId);
    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    return errorResponse(err, 'Sync failed. Please try again.');
  }
}
