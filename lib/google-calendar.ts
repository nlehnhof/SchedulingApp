import { createServiceClient } from './supabase';
import type { GoogleBlock } from './types';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const EVENTS_URL = (calendarId: string) =>
  `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to refresh Google access token: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return json.access_token as string;
}

/**
 * Fetch events on the client's primary calendar from 30 days ago to 30 days
 * from now (matches the polling window in SCHEDULING_APP_ORCHESTRATION.md #5).
 */
export async function getGoogleCalendarEvents(refreshToken: string): Promise<GoogleBlock[]> {
  const accessToken = await refreshAccessToken(refreshToken);

  const timeMin = new Date();
  timeMin.setDate(timeMin.getDate() - 30);
  const timeMax = new Date();
  timeMax.setDate(timeMax.getDate() + 30);

  const url = new URL(EVENTS_URL('primary'));
  url.searchParams.set('timeMin', timeMin.toISOString());
  url.searchParams.set('timeMax', timeMax.toISOString());
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Google Calendar events: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();

  return (json.items ?? [])
    .filter((event: any) => event.start?.dateTime && event.end?.dateTime) // skip all-day events
    .map((event: any) => ({
      id: event.id,
      summary: event.summary ?? '(no title)',
      start: event.start.dateTime,
      end: event.end.dateTime,
    }));
}

/**
 * Poll one client's Google Calendar and red-flag any booked appointment that
 * now overlaps a manually-created calendar block. Mirrors the pseudocode in
 * SCHEDULING_APP_ORCHESTRATION.md Phase 2 "Google Calendar Sync (Polling)".
 * Errors are caught and logged rather than thrown, per the doc's "graceful
 * fallback" implementation note — a sync failure must never block booking.
 */
export async function syncGoogleCalendarForClient(clientId: string): Promise<void> {
  const supabase = createServiceClient();

  const { data: client } = await supabase
    .from('clients')
    .select('id, google_refresh_token')
    .eq('id', clientId)
    .single();

  if (!client?.google_refresh_token) return; // no calendar linked, nothing to sync

  let events: GoogleBlock[];
  try {
    events = await getGoogleCalendarEvents(client.google_refresh_token);
  } catch (err: any) {
    await supabase.from('error_log').insert({
      client_id: clientId,
      error_type: 'google_sync_failure',
      message: err?.message ?? String(err),
    });
    return;
  }

  for (const event of events) {
    const { data: overlaps } = await supabase
      .from('appointments')
      .select('id')
      .eq('client_id', clientId)
      .lt('start_time', event.end)
      .gt('end_time', event.start)
      .gt('expires_at', new Date().toISOString())
      .neq('status', 'red_flag');

    for (const apt of overlaps ?? []) {
      await supabase.from('appointments').update({ status: 'red_flag' }).eq('id', apt.id);
      await supabase.from('error_log').insert({
        client_id: clientId,
        error_type: 'google_sync_conflict',
        message: `Appointment ${apt.id} conflicts with Google Calendar block: ${event.summary}`,
      });
    }
  }
}

/** Runs the sync for every client with a linked Google Calendar. Used by the cron job. */
export async function syncAllClients(): Promise<{ synced: number; skipped: number }> {
  const supabase = createServiceClient();
  const { data: clients } = await supabase
    .from('clients')
    .select('id, google_refresh_token');

  let synced = 0;
  let skipped = 0;
  for (const client of clients ?? []) {
    if (!client.google_refresh_token) {
      skipped++;
      continue;
    }
    await syncGoogleCalendarForClient(client.id);
    synced++;
  }
  return { synced, skipped };
}
