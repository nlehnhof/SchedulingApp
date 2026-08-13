import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('error_log')
    .update({ acknowledged: true })
    .eq('id', params.id)
    .eq('client_id', client.clientId) // scope to this client, no cross-tenant edits
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(data);
}
