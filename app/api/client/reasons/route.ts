import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { reasonSchema } from '@/lib/validation';

export async function GET() {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('appointment_reasons')
    .select('*')
    .eq('client_id', client.clientId)
    .order('order', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reasons: data });
}

export async function POST(req: Request) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const parsed = reasonSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('appointment_reasons')
    .upsert(
      {
        client_id: client.clientId,
        name: body.name,
        duration_min: body.durationMin,
        order: body.order ?? 0,
      },
      { onConflict: 'client_id,name' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    reasonId: data.id,
    name: data.name,
    durationMin: data.duration_min,
  });
}
