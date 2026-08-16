import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { slugSchema } from '@/lib/validation';

// Read-only availability check — not itself the sensitive endpoint (the
// actual write happens in PATCH /api/client/branding, which does the
// premium-or-above check). Still behind requireClient() for consistency
// with every other app/api/client/* route, even though it isn't
// tier-gated: any authenticated client can probe slug availability.
// Slugs live on booking_calendars now (0014-0016 migrations) — the
// optional `calendarId` param excludes that one calendar from the
// uniqueness check (so a calendar can "claim" its own current slug without
// it reading as taken), matching the old exclude-my-own-client-row logic.
export async function GET(req: Request) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get('slug') ?? '';
  const excludeCalendarId = searchParams.get('calendarId');
  const parsed = slugSchema.safeParse(raw.toLowerCase());
  if (!parsed.success) {
    return NextResponse.json({ available: false, reason: 'invalid_format' });
  }

  const supabase = createServiceClient();
  let query = supabase.from('booking_calendars').select('id').eq('slug', parsed.data);
  if (excludeCalendarId) query = query.neq('id', excludeCalendarId);
  const { data } = await query.maybeSingle();

  return NextResponse.json({ available: !data });
}
