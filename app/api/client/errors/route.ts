import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { requireCalendarAccess } from '@/lib/require-calendar';
import { errorResponse } from '@/lib/error-response';

export async function GET(req: Request) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const { searchParams } = new URL(req.url);
  const calendar = await requireCalendarAccess(searchParams.get('calendarId'), client.clientId);
  if (calendar instanceof NextResponse) return calendar;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('error_log')
    .select('*')
    .eq('calendar_id', calendar.calendarId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return errorResponse(error, 'Could not load the error log.');
  return NextResponse.json({ errors: data });
}
