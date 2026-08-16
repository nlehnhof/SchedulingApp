import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { getAvailableSlots } from '@/lib/availability';
import { getGoogleCalendarEvents } from '@/lib/google-calendar';
import { resolveCalendarLink } from '@/lib/resolve-calendar-link';
import { getEffectiveTier } from '@/lib/premium-grants';
import { isAtLeast } from '@/lib/tier';
import type { Appointment, AppointmentReason, GoogleBlock, Rule } from '@/lib/types';

export async function GET(
  req: Request,
  { params }: { params: { clientLink: string } }
) {
  const resolved = await resolveCalendarLink(params.clientLink);
  if (!resolved) {
    return NextResponse.json({ error: 'This booking link is not valid.' }, { status: 404 });
  }
  const { calendarId } = resolved;

  const { searchParams } = new URL(req.url);
  const reasonId = searchParams.get('reasonId');
  if (!reasonId) {
    return NextResponse.json({ error: 'reasonId is required' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const [{ data: calendar }, { data: reason }, { data: rules }, { data: booked }] =
    await Promise.all([
      // google_refresh_token stays on `clients` (one Google login per
      // account); everything else a visitor needs is per-calendar now.
      supabase
        .from('booking_calendars')
        .select(
          'id, display_name, accent_color, logo_url, google_calendar_id, slot_fill_direction, clients(email, tier, google_refresh_token)'
        )
        .eq('id', calendarId)
        .maybeSingle(),
      supabase
        .from('appointment_reasons')
        .select('*')
        .eq('id', reasonId)
        .eq('calendar_id', calendarId)
        .maybeSingle(),
      supabase.from('rules').select('*').eq('calendar_id', calendarId),
      supabase
        .from('appointments')
        .select('*')
        .eq('calendar_id', calendarId)
        .gt('expires_at', new Date().toISOString()),
    ]);

  if (!calendar) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  if (!reason) return NextResponse.json({ error: 'Reason not found' }, { status: 404 });

  // See lib/resolve-calendar-link.ts's header comment — Supabase's
  // nested-relation shape can come back as an object or a single-element
  // array depending on how it infers the join's cardinality.
  const owner: any = Array.isArray((calendar as any).clients)
    ? (calendar as any).clients[0]
    : (calendar as any).clients;
  if (!owner) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30); // "next 30 days" per orchestration doc

  // Live-checked so a visitor is never offered a slot that's already taken
  // on the client's Google Calendar (a manually-created event, or another
  // app's booking on a shared calendar) — the 30-min cron sync alone only
  // catches this *after* a conflicting booking already happened. Best-effort:
  // a Google outage/expired token must never break the booking page, so a
  // failed fetch just falls back to no live blocks (the cron sync's
  // red_flag safety net still catches it within 30 min either way).
  let googleBlocks: GoogleBlock[] = [];
  if (owner.google_refresh_token) {
    try {
      googleBlocks = await getGoogleCalendarEvents(
        owner.google_refresh_token,
        calendar.google_calendar_id || 'primary'
      );
    } catch {
      googleBlocks = [];
    }
  }

  const slots = getAvailableSlots({
    startDate,
    endDate,
    reason: reason as AppointmentReason,
    rules: (rules ?? []) as Rule[],
    booked: (booked ?? []) as Appointment[],
    googleBlocks,
    fillDirection: calendar.slot_fill_direction as 'forward' | 'backward',
  });

  // Custom branding (premium feature 1) is only ever returned when the
  // owning client's *current effective* tier is premium-or-above — a
  // downgraded client's page gracefully falls back to the default look
  // instead of breaking (PLAN.md Section 4 feature 1 downgrade behavior).
  // Anonymous route, no session, so the premium_grants override
  // (lib/premium-grants.ts) has to be checked explicitly here too.
  const isPremium = isAtLeast(await getEffectiveTier(owner.tier, owner.email), 'premium');

  return NextResponse.json({
    // display_name replaces the raw login email visitors used to see
    // (PLAN.md Section 1/2 item 7), falling back to email when unset so
    // this is non-breaking for existing calendars.
    clientName: calendar.display_name || owner.email,
    branding: isPremium ? { accentColor: calendar.accent_color, logoUrl: calendar.logo_url } : null,
    slots: slots
      .filter((s) => s.available)
      .map((s) => ({
        date: s.start.slice(0, 10),
        time: s.start.slice(11, 16),
        start: s.start, // full ISO, needed by the booking request
        end: s.end,
        reason: reason.name,
        available: s.available, // TimeSlotGrid disables any slot missing this
      })),
  });
}
