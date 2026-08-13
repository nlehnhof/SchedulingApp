import { NextResponse } from 'next/server';
import { requireClient } from '@/lib/require-client';
import { exportSchema } from '@/lib/validation';
import { exportMonthlyCSV } from '@/lib/csv-export';

export async function POST(req: Request) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const parsed = exportSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await exportMonthlyCSV(client.clientId, parsed.data.month);
    return NextResponse.json({ status: 'export_queued' });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err?.message }, { status: 500 });
  }
}
