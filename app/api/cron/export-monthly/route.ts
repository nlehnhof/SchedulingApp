import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { requireCron } from '@/lib/require-cron';
import { runExportMonthly } from '@/lib/cron-jobs';

// Normally run by /api/cron/tick; kept for manual triggering. Exports the
// *previous* month (the month that just closed) for every calendar not
// already exported. Captured to Sentry on failure (L8 launch phase) — a
// monthly job that silently fails is invisible for up to a month otherwise.
export async function POST(req: Request) {
  const unauthorized = requireCron(req);
  if (unauthorized) return unauthorized;

  try {
    const result = await runExportMonthly();
    return NextResponse.json({ status: 'ok', ...result });
  } catch (err) {
    Sentry.captureException(err);
    console.error('export-monthly cron failed.', err);
    return NextResponse.json({ error: 'export-monthly failed' }, { status: 500 });
  }
}
