import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { requireCron } from '@/lib/require-cron';
import { runGoogleSync } from '@/lib/cron-jobs';

// Normally run by /api/cron/tick every 30 min (see README "Deploying to Render"). A
// cron that silently stops running is otherwise invisible (L8 launch
// phase) — capture to Sentry rather than letting an uncaught throw just
// 500 with nothing recorded.
export async function POST(req: Request) {
  const unauthorized = requireCron(req);
  if (unauthorized) return unauthorized;

  try {
    const result = await runGoogleSync();
    return NextResponse.json({ status: 'ok', ...result });
  } catch (err) {
    Sentry.captureException(err);
    console.error('google-sync cron failed.', err);
    return NextResponse.json({ error: 'google-sync failed' }, { status: 500 });
  }
}
