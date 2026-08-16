import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { requireCalendarAccess } from '@/lib/require-calendar';
import { getEffectiveTier } from '@/lib/premium-grants';

function ownerOf(calendar: any): any {
  return Array.isArray(calendar?.clients) ? calendar.clients[0] : calendar?.clients;
}

export async function GET(req: Request) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const { searchParams } = new URL(req.url);
  const calendar = await requireCalendarAccess(searchParams.get('calendarId'), client);
  if (calendar instanceof NextResponse) return calendar;

  const supabase = createServiceClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [{ data: appointments }, { data: rules }, { data: errors }, { data: reasons }, { data: calendarRow }] =
    await Promise.all([
      supabase
        .from('appointments')
        .select('*')
        .eq('calendar_id', calendar.calendarId)
        .gte('start_time', monthStart.toISOString())
        .order('start_time', { ascending: true }),
      supabase.from('rules').select('*').eq('calendar_id', calendar.calendarId),
      supabase
        .from('error_log')
        .select('*')
        .eq('calendar_id', calendar.calendarId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('appointment_reasons').select('id, name').eq('calendar_id', calendar.calendarId),
      // Fetched here (rather than a separate round-trip from the client)
      // so DashboardHome has what it needs to render the "Your booking
      // link" card (PLAN.md Section 2 item 1) and empty-state nudges
      // (item 2) without a second request. Branding/slug live on the
      // selected calendar now, not the client account. Tier is resolved
      // through the calendar's OWNING client (joined here), not
      // `client.clientId` directly — a collaborator (0018 migration) has
      // no `clients` row of their own, and even for an owner viewing their
      // own calendar this is the same value either way.
      supabase
        .from('booking_calendars')
        .select('id, display_name, slug, clients(email, tier)')
        .eq('id', calendar.calendarId)
        .single(),
    ]);

  const all = appointments ?? [];
  const allErrors = errors ?? [];
  const now = new Date();
  const nextBooked = all.find((apt: any) => new Date(apt.start_time) >= now);
  const owner = ownerOf(calendarRow);

  // Effective tier (raw column or a live premium_grants override — see
  // lib/premium-grants.ts) so a comped client sees their custom slug link
  // and doesn't get nagged by the premium upsell card like a real free-tier
  // client would.
  const tier = owner ? await getEffectiveTier(owner.tier, owner.email) : 'free';

  return NextResponse.json({
    appointments: all,
    rules: rules ?? [],
    errors: allErrors,
    // So the Home page's "Upcoming" AppointmentCards can show the reason
    // name instead of falling back to the raw reason_id UUID — same lookup
    // app/dashboard/schedule/page.tsx already builds from its own reasons
    // fetch, just supplied here since Home doesn't otherwise load reasons.
    reasons: reasons ?? [],
    calendar: calendarRow
      ? {
          id: calendarRow.id,
          displayName: calendarRow.display_name,
          slug: calendarRow.slug,
          tier,
        }
      : null,
    hasReasons: (reasons ?? []).length > 0,
    stats: {
      total: all.length,
      this_month: all.length,
      next_booked: nextBooked ?? null,
      pending_errors: allErrors.filter((e: any) => !e.acknowledged).length,
    },
  });
}
