import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { errorResponse } from '@/lib/error-response';

export async function GET() {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('error_log')
    .select('*')
    .eq('client_id', client.clientId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return errorResponse(error, 'Could not load the error log.');
  return NextResponse.json({ errors: data });
}
