import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { requireCalendarAccess, requireWriteRole } from '@/lib/require-calendar';
import { errorResponse } from '@/lib/error-response';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const { searchParams } = new URL(req.url);
  const calendar = await requireCalendarAccess(searchParams.get('calendarId'), client);
  if (calendar instanceof NextResponse) return calendar;
  const writeError = requireWriteRole(calendar.role);
  if (writeError) return writeError;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('error_log')
    .update({ acknowledged: true })
    .eq('id', params.id)
    .eq('calendar_id', calendar.calendarId) // scope to this calendar, no cross-tenant edits
    .select()
    .single();

  if (error) return errorResponse(error, 'Could not acknowledge this error.');
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(data);
}
