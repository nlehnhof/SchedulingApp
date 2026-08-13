import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';

export async function GET() {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const supabase = createServiceClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [{ data: appointments }, { data: rules }, { data: errors }] = await Promise.all([
    supabase
      .from('appointments')
      .select('*')
      .eq('client_id', client.clientId)
      .gte('start_time', monthStart.toISOString())
      .order('start_time', { ascending: true }),
    supabase.from('rules').select('*').eq('client_id', client.clientId),
    supabase
      .from('error_log')
      .select('*')
      .eq('client_id', client.clientId)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const all = appointments ?? [];
  const allErrors = errors ?? [];
  const now = new Date();
  const nextBooked = all.find((apt: any) => new Date(apt.start_time) >= now);

  return NextResponse.json({
    appointments: all,
    rules: rules ?? [],
    errors: allErrors,
    stats: {
      total: all.length,
      this_month: all.length,
      next_booked: nextBooked ?? null,
      pending_errors: allErrors.filter((e: any) => !e.acknowledged).length,
    },
  });
}
