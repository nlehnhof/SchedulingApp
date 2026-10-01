import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { requireCron } from '@/lib/require-cron';
import { runCleanup } from '@/lib/cron-jobs';
import { errorResponse } from '@/lib/error-response';

// Normally run by /api/cron/tick; kept for manual triggering. Deletes expired
// appointments (30-day retention, see Constraints) and prunes error_log
// entries older than 30 days.
export async function POST(req: Request) {
  const unauthorized = requireCron(req);
  if (unauthorized) return unauthorized;

  try {
    const result = await runCleanup();
    return NextResponse.json({ status: 'ok', ...result });
  } catch (err) {
    Sentry.captureException(err);
    return errorResponse(err, 'Cleanup job failed.');
  }
}
