import { NextResponse } from 'next/server';
import { requireClient } from '@/lib/require-client';
import { syncGoogleCalendarForClient } from '@/lib/google-calendar';

// Lets the client manually re-trigger their own Google Calendar sync from
// the Error Log page instead of waiting for the next 30-min cron run.
export async function POST() {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  try {
    await syncGoogleCalendarForClient(client.clientId);
    return NextResponse.json({ status: 'ok' });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'sync_failed' }, { status: 500 });
  }
}
