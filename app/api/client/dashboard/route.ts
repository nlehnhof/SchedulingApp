import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';

export async function GET() {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const supabase = createServiceClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [{ data: appointments }, { data: rules }, { data: errors }, { data: reasons }, { data: clientRow }] =
    await Promise.all([
      supabase
        .from('appointments')
        .select('*')
        .eq('client_id', client.clientId)
        .gte('start_time', monthStart.toISOString())
        .order('start_time', { ascending: true }),
      supabase.from('rules').select('*').eq('client_id', client.clientId),
      supabase
        .from('error_log')
        .select('*')
        .eq('client_id', client.clientId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('appointment_reasons').select('id, name').eq('client_id', client.clientId),
      // Fetched here (rather than a separate round-trip from the client)
      // so DashboardHome has what it needs to render the "Your booking
      // link" card (PLAN.md Section 2 item 1) and empty-state nudges
      // (item 2) without a second request.
      supabase.from('clients').select('id, display_name, slug, tier').eq('id', client.clientId).single(),
    ]);

  const all = appointments ?? [];
  const allErrors = errors ?? [];
  const now = new Date();
  const nextBooked = all.find((apt: any) => new Date(apt.start_time) >= now);

  return NextResponse.json({
    appointments: all,
    rules: rules ?? [],
    errors: allErrors,
    // So the Home page's "Upcoming" AppointmentCards can show the reason
    // name instead of falling back to the raw reason_id UUID — same lookup
    // app/dashboard/schedule/page.tsx already builds from its own reasons
    // fetch, just supplied here since Home doesn't otherwise load reasons.
    reasons: reasons ?? [],
    client: clientRow
      ? {
          id: clientRow.id,
          displayName: clientRow.display_name,
          slug: clientRow.slug,
          tier: clientRow.tier,
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
