import { NextResponse } from 'next/server';
import { requireCron } from '@/lib/require-cron';
import { createServiceClient } from '@/lib/supabase';
import { sendSms, isSmsConfigured } from '@/lib/sms';
import { getEffectiveTier } from '@/lib/premium-grants';

/**
 * STUB — premium feature 3 (PLAN.md Section 4 feature 3), deliberately
 * deferred per the plan's explicit permission ("the Executor has explicit
 * permission to stop after step 7... a code-complete-but-unverified SMS
 * cron is worse than an honestly-deferred one"). This route is safe to
 * deploy and schedule as-is: lib/sms.ts has no real provider wired in, so
 * every send attempt below throws and is caught — this will run, query
 * real data, and report `sent: 0` until a provider is configured. It is
 * NOT sending anything to real visitors.
 *
 * What's real: the require-cron auth pattern, the tier + per-client
 * opt-in gated query (done as two plain queries — client ids, then
 * appointments — rather than a Supabase embedded-relation filter, to match
 * this codebase's existing query style rather than introducing a new
 * pattern for one route), the 24-25h reminder window, and the
 * per-appointment try/catch isolation PLAN.md Section 5 calls out
 * specifically (must NOT repeat exportMonthlyCSVForAllClients's current
 * unguarded loop in lib/csv-export.ts, where one client's failure silently
 * stops processing everyone after it).
 *
 * What's stubbed: lib/sms.ts's actual provider call. See its header
 * comment for how to wire up a real one.
 */
export async function POST(req: Request) {
  const unauthorized = requireCron(req);
  if (unauthorized) return unauthorized;

  if (!isSmsConfigured()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'SMS provider not configured (missing TWILIO_* env vars). See lib/sms.ts.',
    });
  }

  const supabase = createServiceClient();

  // Gate at query time, not just in the UI — this is a backend job with no
  // session to check tier against (PLAN.md Section 4 feature 3 / Section 5).
  // Fetches every opted-in client's raw tier + email rather than filtering
  // `tier = 'premium'` in the query itself, because "premium" can now also
  // come from a live premium_grants override (lib/premium-grants.ts) that
  // SQL alone can't see — filtered below with getEffectiveTier() instead.
  const { data: candidateClients, error: clientError } = await supabase
    .from('clients')
    .select('id, email, tier')
    .eq('sms_reminders_enabled', true);

  if (clientError) {
    console.error('sms-reminders: failed to query opted-in clients', clientError);
    return NextResponse.json({ status: 'error', error: 'Could not load clients.' }, { status: 500 });
  }

  const clientIds: string[] = [];
  for (const c of candidateClients ?? []) {
    if ((await getEffectiveTier(c.tier, c.email)) === 'premium') clientIds.push(c.id);
  }
  if (clientIds.length === 0) {
    return NextResponse.json({ status: 'ok', sent: 0, failed: 0, total: 0 });
  }

  const windowStart = new Date();
  windowStart.setHours(windowStart.getHours() + 24);
  const windowEnd = new Date();
  windowEnd.setHours(windowEnd.getHours() + 25);

  const { data: appointments, error: aptError } = await supabase
    .from('appointments')
    .select('id, visitor_phone, start_time')
    .in('client_id', clientIds)
    .eq('status', 'confirmed')
    .gte('start_time', windowStart.toISOString())
    .lt('start_time', windowEnd.toISOString());

  if (aptError) {
    console.error('sms-reminders: failed to query appointments', aptError);
    return NextResponse.json({ status: 'error', error: 'Could not load appointments.' }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  // Per-appointment try/catch: one failure must not abort the run for
  // every appointment after it — the exact bug PLAN.md flags in
  // exportMonthlyCSVForAllClients's current loop.
  for (const apt of appointments ?? []) {
    try {
      await sendSms({
        to: apt.visitor_phone,
        body: `Reminder: you have an appointment tomorrow at ${new Date(apt.start_time).toLocaleString()}.`,
      });
      sent++;
    } catch (err) {
      failed++;
      // Log the appointment id only — never the visitor phone number
      // alongside provider error detail (PLAN.md Section 5).
      console.error(`sms-reminders: failed to send for appointment ${apt.id}`, err);
    }
  }

  return NextResponse.json({ status: 'ok', sent, failed, total: appointments?.length ?? 0 });
}
