import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { calendarCreateSchema } from '@/lib/validation';
import { errorResponse } from '@/lib/error-response';
import { syncExtraCalendarQuantity } from '@/lib/stripe';

// Elite feature: multiple booking calendars per client account. Free and
// Premium stay at the pre-Elite behavior of exactly 1 calendar (created
// automatically for every client — see lib/auth.ts's signIn callback and
// the 0015 migration's backfill for existing clients); Elite includes 10 in
// the base $49/mo plan. Calendars past the included 10 aren't blocked
// outright — each one adds $5/mo to the subscription (see
// lib/stripe.ts's syncExtraCalendarQuantity) — up to a hard cap of 20 total,
// which *is* a flat block (prevents runaway per-seat billing/abuse rather
// than metering indefinitely).
const CALENDAR_INCLUDED_LIMIT_BY_TIER: Record<string, number> = { free: 1, premium: 1, elite: 10 };
const CALENDAR_MAX_LIMIT_BY_TIER: Record<string, number> = { free: 1, premium: 1, elite: 20 };
const EXTRA_CALENDAR_PRICE_PER_MONTH = 5;

// Powers both the "Manage calendars" page (owned calendars only, via
// client.clientId) and the dashboard calendar switcher (owned + accepted
// collaborator calendars, via client.collaboratorCalendars — Elite team
// access, 0018 migration) — the switcher needs the combined list so a
// person who's both an owner and a collaborator elsewhere sees everything
// they can access in one place, grouped by `role`.
export async function GET() {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  let owned: { id: string; display_name: string | null; slug: string | null; created_at: string }[] = [];
  if (client.clientId) {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('booking_calendars')
      .select('id, display_name, slug, created_at')
      .eq('client_id', client.clientId)
      .order('created_at', { ascending: true });
    if (error) return errorResponse(error, 'Could not load your calendars.');
    owned = data ?? [];
  }

  const calendars = [
    ...owned.map((c) => ({ ...c, role: 'owner' as const })),
    ...client.collaboratorCalendars.map((c) => ({
      id: c.calendarId,
      display_name: c.calendarDisplayName,
      slug: null,
      created_at: null,
      role: c.role,
    })),
  ];

  return NextResponse.json({
    calendars,
    // Only meaningful against owned calendars — a collaborator isn't
    // subject to the owner's calendar cap. `limit` stays the hard max for
    // backward compat with existing consumers (gates "can I even create
    // another one at all"); `includedLimit` is the free-with-plan count,
    // and only differs from `limit` for Elite.
    limit: client.clientId ? CALENDAR_MAX_LIMIT_BY_TIER[client.tier] ?? 1 : 0,
    includedLimit: client.clientId ? CALENDAR_INCLUDED_LIMIT_BY_TIER[client.tier] ?? 1 : 0,
    extraCalendarPricePerMonth: EXTRA_CALENDAR_PRICE_PER_MONTH,
  });
}

export async function POST(req: Request) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;
  if (!client.clientId) {
    return NextResponse.json({ error: 'Only an account owner can create calendars.' }, { status: 403 });
  }

  const parsed = calendarCreateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceClient();
  const included = CALENDAR_INCLUDED_LIMIT_BY_TIER[client.tier] ?? 1;
  const max = CALENDAR_MAX_LIMIT_BY_TIER[client.tier] ?? 1;
  const { count } = await supabase
    .from('booking_calendars')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', client.clientId);

  const currentCount = count ?? 0;
  if (currentCount >= max) {
    return NextResponse.json(
      {
        error:
          client.tier === 'elite'
            ? `You've reached the ${max}-calendar limit.`
            : 'Upgrade to Elite to add more than one booking calendar.',
      },
      { status: 403 }
    );
  }

  const { data, error } = await supabase
    .from('booking_calendars')
    .insert({
      client_id: client.clientId,
      display_name: parsed.data.displayName ?? null,
      timezone: parsed.data.timezone ?? 'UTC',
    })
    .select('id, display_name, slug, created_at')
    .single();

  if (error) return errorResponse(error, 'Could not create calendar.');

  const extraCount = currentCount + 1 - included;
  if (client.tier === 'elite' && extraCount > 0) {
    try {
      const { data: row } = await supabase
        .from('clients')
        .select('stripe_subscription_id')
        .eq('id', client.clientId)
        .single();
      await syncExtraCalendarQuantity(row?.stripe_subscription_id ?? null, extraCount);
    } catch (err) {
      Sentry.captureException(err);
      console.error(`Failed to sync extra-calendar billing for client ${client.clientId}.`, err);
    }
  }

  return NextResponse.json(data);
}
