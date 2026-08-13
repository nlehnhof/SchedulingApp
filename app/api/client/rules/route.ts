import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { ruleSchema } from '@/lib/validation';
import { errorResponse } from '@/lib/error-response';

export async function GET() {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('rules')
    .select('*')
    .eq('client_id', client.clientId);
  if (error) return errorResponse(error, 'Could not load rules.');
  return NextResponse.json({ rules: data });
}

export async function POST(req: Request) {
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
    .insert({
      client_id: client.clientId,
      rule_type: body.ruleType,
      day_of_week: body.dayOfWeek ?? null,
      start_time: body.startTime ?? null,
      end_time: body.endTime ?? null,
      max_concurrent: body.maxConcurrent ?? null,
      config: body.config ?? null,
    })
    .select()
    .single();

  if (error) return errorResponse(error, 'Could not save rule.');
  return NextResponse.json(data);
}
