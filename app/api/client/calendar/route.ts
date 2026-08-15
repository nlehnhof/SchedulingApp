import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { listGoogleCalendars } from '@/lib/google-calendar';
import { calendarSelectSchema } from '@/lib/validation';
import { errorResponse } from '@/lib/error-response';

// Not premium-gated — Google Calendar sync is a core feature (Phase 1),
// available to every client regardless of tier.
export async function GET() {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('clients')
    .select('google_refresh_token, google_calendar_id')
    .eq('id', client.clientId)
    .single();
  if (error) return errorResponse(error, 'Could not load calendar settings.');

  // No Google account linked at all (e.g. the admin test-credentials login,
  // or a client who hasn't reconnected since enabling Calendar scopes) —
  // nothing to list, but not an error: the page shows a "connect Google"
  // state instead of a picker.
  if (!data.google_refresh_token) {
    return NextResponse.json({ linked: false, calendars: [], selected: data.google_calendar_id });
  }

  try {
    const calendars = await listGoogleCalendars(data.google_refresh_token);
    return NextResponse.json({ linked: true, calendars, selected: data.google_calendar_id });
  } catch (err) {
    return errorResponse(
      err,
      'Could not load your Google calendars. Try signing out and back in to reconnect Google Calendar.'
    );
  }
}

export async function PATCH(req: Request) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const parsed = calendarSelectSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('clients')
    .select('google_refresh_token')
    .eq('id', client.clientId)
    .single();
  if (error) return errorResponse(error, 'Could not load your account.');
  if (!data.google_refresh_token) {
    return NextResponse.json(
      { error: 'Connect Google Calendar (sign in with Google) before selecting a calendar.' },
      { status: 400 }
    );
  }

  // Confirm the requested calendar actually belongs to this client's Google
  // account before saving it, rather than trusting the id blind — a client
  // hand-crafting this request otherwise couldn't do anything worse than
  // point their own sync at a calendar they can't read (Google's API would
  // just start failing the poll), but validating up front turns that into
  // a clear 400 instead of a silent, confusing sync failure later.
  let calendars;
  try {
    calendars = await listGoogleCalendars(data.google_refresh_token);
  } catch (err) {
    return errorResponse(err, 'Could not verify your Google calendars. Try again.');
  }
  if (!calendars.some((c) => c.id === parsed.data.calendarId)) {
    return NextResponse.json(
      { error: 'That calendar was not found on your Google account.' },
      { status: 400 }
    );
  }

  const { error: updateError } = await supabase
    .from('clients')
    .update({ google_calendar_id: parsed.data.calendarId })
    .eq('id', client.clientId);
  if (updateError) return errorResponse(updateError, 'Could not save calendar selection.');

  return NextResponse.json({ selected: parsed.data.calendarId });
}
