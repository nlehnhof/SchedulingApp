import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { requireCron } from '@/lib/require-cron';
import { dueJobs, type CronJob } from '@/lib/cron-schedule';
import { runGoogleSync, runCleanup, runExportMonthly } from '@/lib/cron-jobs';

// The ONE Render cron job (every 30 min) hits this route; lib/cron-schedule.ts
// decides which jobs are due. The per-job routes stay for manual triggering.
// A failing job is logged and reported but never stops the others.
const RUNNERS: Record<CronJob, (now: Date) => Promise<unknown>> = {
  'google-sync': () => runGoogleSync(),
  cleanup: () => runCleanup(),
  'export-monthly': (now) => runExportMonthly(now),
};

export async function POST(req: Request) {
  const unauthorized = requireCron(req);
  if (unauthorized) return unauthorized;

  const now = new Date();
  const results = [];
  for (const job of dueJobs(now)) {
    const started = Date.now();
    try {
      const result = await RUNNERS[job](now);
      results.push({ job, ok: true, durationMs: Date.now() - started, result });
    } catch (err) {
      Sentry.captureException(err);
      console.error(`cron tick: ${job} failed.`, err);
      results.push({ job, ok: false, durationMs: Date.now() - started });
    }
  }
  return NextResponse.json({ ranAt: now.toISOString(), results });
}
