import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { requireCalendarAccess } from '@/lib/require-calendar';
import { ruleSchema } from '@/lib/validation';
import { errorResponse } from '@/lib/error-response';

export async function GET(req: Request) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const { searchParams } = new URL(req.url);
  const calendar = await requireCalendarAccess(searchParams.get('calendarId'), client.clientId);
  if (calendar instanceof NextResponse) return calendar;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('rules')
    .select('*')
    .eq('calendar_id', calendar.calendarId);
  if (error) return errorResponse(error, 'Could not load rules.');
  return NextResponse.json({ rules: data });
}

export async function POST(req: Request) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const { searchParams } = new URL(req.url);
  const calendar = await requireCalendarAccess(searchParams.get('calendarId'), client.clientId);
  if (calendar instanceof NextResponse) return calendar;

  const parsed = ruleSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('rules')
    .insert({
      calendar_id: calendar.calendarId,
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
