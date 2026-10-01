export type CronJob = 'google-sync' | 'cleanup' | 'export-monthly';

// Daily jobs run in the first 30-minute window of this UTC hour (03:00-03:29,
// a quiet hour for US/EU visitors). UTC only: Render evaluates cron in UTC.
export const DAILY_JOB_UTC_HOUR = 3;

/**
 * Which jobs the single every-30-min tick should run at `now`.
 * - google-sync: every tick.
 * - cleanup: once a day, in the daily window. A missed window waits for
 *   tomorrow (the deletes are idempotent and nothing is time-critical).
 * - export-monthly: day 1 of the month from the daily window onward, on EVERY
 *   tick that day, so a missed or failed window catches up on the next tick.
 *   This is safe because the job skips calendars already in csv_exports.
 */
export function dueJobs(now: Date): CronJob[] {
  const jobs: CronJob[] = ['google-sync'];
  const inDailyWindow = now.getUTCHours() === DAILY_JOB_UTC_HOUR && now.getUTCMinutes() < 30;
  if (inDailyWindow) jobs.push('cleanup');
  if (now.getUTCDate() === 1 && now.getUTCHours() >= DAILY_JOB_UTC_HOUR) jobs.push('export-monthly');
  return jobs;
}
