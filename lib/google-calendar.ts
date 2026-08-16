import { createServiceClient } from './supabase';
import { toNaiveISOString } from './date-format';
import type { GoogleBlock } from './types';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const EVENTS_URL = (calendarId: string) =>
  `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
const CALENDAR_LIST_URL = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';

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
 * Google always returns event.start/end.dateTime as a full RFC3339 instant
 * with an explicit offset (e.g. '2026-08-17T12:00:00-06:00'), reflecting
 * whatever time zone the calendar itself is configured with. Everywhere
 * else, this app treats appointment times as *naive* local wall-clock
 * values with no offset at all (see lib/date-format.ts) — slot times in
 * getAvailableSlots are built with plain `Date.setHours()` and compared
 * with `new Date(naiveString)`, which both resolve against the server
 * process's own local time, not any particular IANA zone. `new Date()` DOES
 * respect an explicit offset, so passing Google's dateTime straight through
 * silently compares a true absolute instant against a naive one — on a
 * server that isn't running in the calendar's own offset, appointments that
 * visibly overlap on the calendar stop overlapping in that comparison and
 * the slot gets offered anyway. The fix is to strip the offset rather than
 * convert through it: the literal digits before it already ARE the
 * calendar's local wall-clock time, which is exactly what needs to line up
 * against the rest of the app's naive slot/appointment times.
 */
export function stripTimeZoneOffset(dateTime: string): string {
  return dateTime.replace(/(?:Z|[+-]\d{2}:\d{2})$/, '');
}

export interface GoogleCalendarListEntry {
  id: string;
  summary: string;
  primary: boolean;
}

/**
 * Lists every calendar on the client's Google account (their own calendars
 * plus any they've been given access to), for the calendar-picker on
 * app/dashboard/calendar. Same `calendar.readonly` scope already granted at
 * sign-in (lib/auth.ts) covers this endpoint — no new consent needed.
 */
export async function listGoogleCalendars(refreshToken: string): Promise<GoogleCalendarListEntry[]> {
  const accessToken = await refreshAccessToken(refreshToken);

  const res = await fetch(CALENDAR_LIST_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to list Google calendars: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();

  return (json.items ?? []).map((cal: any) => ({
    id: cal.id,
    summary: cal.summary ?? cal.id,
    primary: !!cal.primary,
  }));
}

/**
 * Fetch events on one of the client's Google calendars — which calendar is
 * controlled by `clients.google_calendar_id` (0011 migration; defaults to
 * 'primary' for every client that hasn't picked one) — from 30 days ago to
 * 30 days from now (matches the polling window in
 * SCHEDULING_APP_ORCHESTRATION.md #5).
 */
export async function getGoogleCalendarEvents(
  refreshToken: string,
  calendarId: string = 'primary'
): Promise<GoogleBlock[]> {
  const accessToken = await refreshAccessToken(refreshToken);

  const timeMin = new Date();
  timeMin.setDate(timeMin.getDate() - 30);
  const timeMax = new Date();
  timeMax.setDate(timeMax.getDate() + 30);

  const url = new URL(EVENTS_URL(calendarId));
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
      start: stripTimeZoneOffset(event.start.dateTime),
      end: stripTimeZoneOffset(event.end.dateTime),
    }));
}

export interface GoogleCalendarEventInput {
  summary: string;
  description?: string | null;
  start: Date;
  end: Date;
  // IANA zone name (clients.timezone) the start/end wall-clock values are
  // expressed in. Required, and deliberately paired with a naive (no 'Z'/
  // offset) dateTime rather than `.toISOString()`: appointment times are
  // stored and passed around this whole app as naive local wall-clock
  // values (see lib/date-format.ts's header comment), never true UTC. Using
  // `.toISOString()` here would silently relabel that local time as UTC,
  // shifting the event on Google's side by exactly the client's real UTC
  // offset — e.g. a 9am appointment in Denver (UTC-6) showing up at 3am.
  timeZone: string;
}

function eventBody(event: GoogleCalendarEventInput) {
  return {
    summary: event.summary,
    description: event.description || undefined,
    start: { dateTime: toNaiveISOString(event.start).slice(0, 19), timeZone: event.timeZone },
    end: { dateTime: toNaiveISOString(event.end).slice(0, 19), timeZone: event.timeZone },
  };
}

/**
 * Creates an event on the client's selected Google calendar for a booked
 * appointment. Returns the new event's id so the caller can store it
 * (appointments.google_event_id, 0012 migration) and later update/delete
 * the same event instead of creating a duplicate.
 */
export async function createGoogleCalendarEvent(
  refreshToken: string,
  calendarId: string,
  event: GoogleCalendarEventInput
): Promise<string> {
  const accessToken = await refreshAccessToken(refreshToken);

  const res = await fetch(EVENTS_URL(calendarId), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventBody(event)),
  });
  if (!res.ok) {
    throw new Error(`Failed to create Google Calendar event: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return json.id as string;
}

/** Updates an existing written-back event, e.g. after the client edits an appointment. */
export async function updateGoogleCalendarEvent(
  refreshToken: string,
  calendarId: string,
  eventId: string,
  event: GoogleCalendarEventInput
): Promise<void> {
  const accessToken = await refreshAccessToken(refreshToken);

  const res = await fetch(`${EVENTS_URL(calendarId)}/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventBody(event)),
  });
  if (!res.ok) {
    throw new Error(`Failed to update Google Calendar event: ${res.status} ${await res.text()}`);
  }
}

/**
 * Deletes a written-back event, e.g. after the client cancels an appointment.
 * A 404/410 means it's already gone on Google's side (deleted manually,
 * calendar unlinked and relinked, etc.) — treated as success since there's
 * nothing left to undo.
 */
export async function deleteGoogleCalendarEvent(
  refreshToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const accessToken = await refreshAccessToken(refreshToken);

  const res = await fetch(`${EVENTS_URL(calendarId)}/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Failed to delete Google Calendar event: ${res.status} ${await res.text()}`);
  }
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
    .select('id, google_refresh_token, google_calendar_id')
    .eq('id', clientId)
    .single();

  if (!client?.google_refresh_token) return; // no calendar linked, nothing to sync

  let events: GoogleBlock[];
  try {
    events = await getGoogleCalendarEvents(client.google_refresh_token, client.google_calendar_id || 'primary');
  } catch (err: any) {
    await supabase.from('error_log').insert({
      client_id: clientId,
      error_type: 'google_sync_failure',
      message: err?.message ?? String(err),
    });
    return;
  }

  // Exclude events this app itself wrote back (see createGoogleCalendarEvent)
  // — otherwise every synced appointment would overlap its own event on
  // Google's side and get red-flagged as a conflict against itself.
  const { data: ownEvents } = await supabase
    .from('appointments')
    .select('google_event_id')
    .eq('client_id', clientId)
    .not('google_event_id', 'is', null);
  const ownEventIds = new Set((ownEvents ?? []).map((row) => row.google_event_id));
  events = events.filter((event) => !ownEventIds.has(event.id));

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
