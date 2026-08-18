import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { requireCron } from '@/lib/require-cron';
import { createServiceClient } from '@/lib/supabase';
import { errorResponse } from '@/lib/error-response';

// Scheduled daily on Render. Deletes expired appointments (30-day retention,
// see Constraints) and prunes error_log entries older than 30 days.
export async function POST(req: Request) {
  const unauthorized = requireCron(req);
  if (unauthorized) return unauthorized;

  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [{ error: aptError, count: aptCount }, { error: logError, count: logCount }] =
    await Promise.all([
      supabase.from('appointments').delete({ count: 'exact' }).lt('expires_at', now),
      supabase
        .from('error_log')
        .delete({ count: 'exact' })
        .lt('created_at', thirtyDaysAgo.toISOString()),
    ]);

  if (aptError || logError) {
    Sentry.captureException(aptError ?? logError);
    return errorResponse(aptError ?? logError, 'Cleanup job failed.');
  }

  return NextResponse.json({
    status: 'ok',
    appointmentsDeleted: aptCount ?? 0,
    errorLogEntriesDeleted: logCount ?? 0,
  });
}
