import { NextResponse } from 'next/server';
import { requireCron } from '@/lib/require-cron';
import { exportMonthlyCSVForAllClients } from '@/lib/csv-export';

// Scheduled on the 1st of the month on Render. Exports the *previous* month
// (i.e. the month that just closed) for every client.
export async function POST(req: Request) {
  const unauthorized = requireCron(req);
  if (unauthorized) return unauthorized;

  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const month = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

  const result = await exportMonthlyCSVForAllClients(month);
  return NextResponse.json({ status: 'ok', month, ...result });
}
