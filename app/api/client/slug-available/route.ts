import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { slugSchema } from '@/lib/validation';

// Read-only availability check — not itself the sensitive endpoint (the
// actual write happens in PATCH /api/client/branding, which does the
// tier === 'premium' check). Still behind requireClient() for consistency
// with every other app/api/client/* route, even though it isn't
// premium-gated: any authenticated client can probe slug availability.
export async function GET(req: Request) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get('slug') ?? '';
  const parsed = slugSchema.safeParse(raw.toLowerCase());
  if (!parsed.success) {
    return NextResponse.json({ available: false, reason: 'invalid_format' });
  }

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('clients')
    .select('id')
    .eq('slug', parsed.data)
    .neq('id', client.clientId)
    .maybeSingle();

  return NextResponse.json({ available: !data });
}
