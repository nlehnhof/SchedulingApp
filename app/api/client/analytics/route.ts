import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { errorResponse } from '@/lib/error-response';
import { isAtLeast } from '@/lib/tier';

const WINDOW_DAYS = 180;
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Premium feature 4 (PLAN.md Section 4 feature 4): booking volume,
 * busiest days/hours, status breakdown, and reason popularity, aggregated
 * from data the app already has. Premium-or-above is checked here
 * server-side (403 below premium) as defense-in-depth even though the UI
 * already hides the nav entry — PLAN.md Section 5.
 *
 * Aggregation happens here in the route rather than shipping raw
 * appointment rows to the client — the query itself is a plain select
 * bounded to a fixed window (no per-client volume this app is likely to
 * see in practice would make that select expensive), then reduced once
 * server-side into a small summary payload. A dedicated SQL aggregate
 * function/view would scale further, but that's more infrastructure than
 * this pass's scope calls for and nothing else in the codebase uses raw
 * SQL aggregation either (lib/csv-export.ts follows the same
 * select-then-reduce-in-JS pattern).
 *
 * "No-show rate" from PLAN.md's feature description isn't a status this
 * schema actually tracks (Appointment.status is only 'confirmed' |
 * 'red_flag' — see lib/types.ts) — there's no separate no-show concept
 * captured anywhere in the app today. This reports a true status breakdown
 * (confirmed vs. red_flag/conflict) instead of fabricating a no-show
 * metric the data doesn't support.
 */
export async function GET() {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  if (!isAtLeast(client.tier, 'premium')) {
    return NextResponse.json({ error: 'Analytics is a premium feature.' }, { status: 403 });
  }

  const supabase = createServiceClient();
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - WINDOW_DAYS);

  const [{ data: appointments, error: aptError }, { data: reasons, error: reasonError }] =
    await Promise.all([
      supabase
        .from('appointments')
        .select('start_time, status, reason_id')
        .eq('client_id', client.clientId)
        .gte('start_time', windowStart.toISOString()),
      supabase.from('appointment_reasons').select('id, name').eq('client_id', client.clientId),
    ]);

  if (aptError) return errorResponse(aptError, 'Could not load analytics data.');
  if (reasonError) return errorResponse(reasonError, 'Could not load analytics data.');

  const reasonNameById = new Map((reasons ?? []).map((r) => [r.id, r.name]));
  const rows = appointments ?? [];

  const byWeek = new Map<string, number>();
  const byDayOfWeek = new Array(7).fill(0) as number[];
  const byHour = new Array(24).fill(0) as number[];
  const byStatus: Record<string, number> = {};
  const byReason = new Map<string, number>();

  for (const apt of rows) {
    const d = new Date(apt.start_time);
    const weekKey = isoWeekKey(d);
    byWeek.set(weekKey, (byWeek.get(weekKey) ?? 0) + 1);
    byDayOfWeek[d.getDay()]++;
    byHour[d.getHours()]++;
    byStatus[apt.status] = (byStatus[apt.status] ?? 0) + 1;
    const reasonName = reasonNameById.get(apt.reason_id) ?? 'Unknown';
    byReason.set(reasonName, (byReason.get(reasonName) ?? 0) + 1);
  }

  return NextResponse.json({
    windowDays: WINDOW_DAYS,
    total: rows.length,
    volumeByWeek: Array.from(byWeek.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, count]) => ({ week, count })),
    byDayOfWeek: byDayOfWeek.map((count, i) => ({ day: DAY_LABELS[i], count })),
    byHour: byHour.map((count, hour) => ({ hour, count })),
    statusBreakdown: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
    reasonPopularity: Array.from(byReason.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => ({ reason, count })),
  });
}

/** ISO 8601 week key (e.g. "2026-W03"), UTC-based to avoid DST edge cases. */
function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
