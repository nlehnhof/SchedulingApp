import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { ruleSchema } from '@/lib/validation';
import { errorResponse } from '@/lib/error-response';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const parsed = ruleSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('rules')
    .update({
      rule_type: body.ruleType,
      day_of_week: body.dayOfWeek ?? null,
      start_time: body.startTime ?? null,
      end_time: body.endTime ?? null,
      max_concurrent: body.maxConcurrent ?? null,
      config: body.config ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('client_id', client.clientId) // scope to this client, no cross-tenant edits
    .select()
    .single();

  if (error) return errorResponse(error, 'Could not save rule.');
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const supabase = createServiceClient();
  const { error, count } = await supabase
    .from('rules')
    .delete({ count: 'exact' })
    .eq('id', params.id)
    .eq('client_id', client.clientId);

  if (error) return errorResponse(error, 'Could not delete rule.');
  if (!count) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ status: 'deleted' });
}
