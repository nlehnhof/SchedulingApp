import { createServiceClient } from './supabase';
import { syncAllCalendars } from './google-calendar';
import { exportMonthlyCSVForAllClients } from './csv-export';

// Job bodies shared by the per-job routes (app/api/cron/<job>) and the single
// /api/cron/tick route. Logic is unchanged from when it lived in the routes.

export const runGoogleSync = () => syncAllCalendars();

/** Deletes expired appointments (30-day retention) and error_log rows older than 30 days. Throws the Supabase error on failure. */
export async function runCleanup() {
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
  if (aptError || logError) throw aptError ?? logError;

  return { appointmentsDeleted: aptCount ?? 0, errorLogEntriesDeleted: logCount ?? 0 };
}

/** Exports the month that just closed ("YYYY-MM", UTC) for every calendar not already exported. */
export async function runExportMonthly(now: Date = new Date()) {
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const month = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`;
  const result = await exportMonthlyCSVForAllClients(month);
  return { month, ...result };
}
