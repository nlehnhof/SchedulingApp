import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { errorResponse } from '@/lib/error-response';
import { resolveCalendarLink } from '@/lib/resolve-calendar-link';

// The visitor link may be a calendar's raw UUID or (premium-and-above only)
// a custom slug — resolveCalendarLink() is the one shared place that
// decides which, so every visitor route stays consistent (PLAN.md Section 4
// feature 2 / Section 5).
export async function GET(
  _req: Request,
  { params }: { params: { clientLink: string } }
) {
  const resolved = await resolveCalendarLink(params.clientLink);
  if (!resolved) {
    return NextResponse.json({ error: 'This booking link is not valid.' }, { status: 404 });
  }

  const supabase = createServiceClient();
  const { data: reasons, error } = await supabase
    .from('appointment_reasons')
    .select('id, name, duration_min')
    .eq('calendar_id', resolved.calendarId)
    .order('order', { ascending: true });

  if (error) return errorResponse(error, 'Could not load booking options.');
  return NextResponse.json({
    reasons: (reasons ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      durationMin: r.duration_min,
    })),
  });
}
