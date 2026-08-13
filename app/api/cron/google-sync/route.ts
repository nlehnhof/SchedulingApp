import { NextResponse } from 'next/server';
import { requireCron } from '@/lib/require-cron';
import { syncAllClients } from '@/lib/google-calendar';

// Scheduled every 30 min on Render (see README "Deploying to Render").
export async function POST(req: Request) {
  const unauthorized = requireCron(req);
  if (unauthorized) return unauthorized;

  const result = await syncAllClients();
  return NextResponse.json({ status: 'ok', ...result });
}
