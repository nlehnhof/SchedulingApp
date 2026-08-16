import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { requireCalendarAccess } from '@/lib/require-calendar';
import { reasonUpdateSchema } from '@/lib/validation';
import { errorResponse } from '@/lib/error-response';

// Real rename support (PLAN.md Section 1/2 item 3): updates by id, so
// unlike the old POST-as-upsert-on-name flow this can actually change a
// reason's name without creating a new row.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const { searchParams } = new URL(req.url);
  const calendar = await requireCalendarAccess(searchParams.get('calendarId'), client.clientId);
  if (calendar instanceof NextResponse) return calendar;

  const parsed = reasonUpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const supabase = createServiceClient();
  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.durationMin !== undefined) update.duration_min = body.durationMin;
  if (body.order !== undefined) update.order = body.order;

  const { data, error } = await supabase
    .from('appointment_reasons')
    .update(update)
    .eq('id', params.id)
    .eq('calendar_id', calendar.calendarId) // scope to this calendar, no cross-tenant edits
    .select()
    .single();

  if (error) {
    // UNIQUE(calendar_id, name) violation — renaming to a name that already
    // exists among this client's other reasons.
    if ((error as any).code === '23505') {
      return errorResponse(error, 'A reason with this name already exists.', 409);
    }
    return errorResponse(error, 'Could not save reason changes.');
  }
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(data);
}

// PLAN.md Section 1: reasons previously had no DELETE at all. `reason_id`
// on appointments is `NOT NULL REFERENCES appointment_reasons(id)` with no
// ON DELETE clause (0001_init.sql), so deleting a reason with existing
// appointments fails with a Postgres foreign-key violation (23503) — that
// gets surfaced here as a clear message via errorResponse() rather than a
// raw constraint error leaking to the client (PLAN.md Section 5).
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const { searchParams } = new URL(req.url);
  const calendar = await requireCalendarAccess(searchParams.get('calendarId'), client.clientId);
  if (calendar instanceof NextResponse) return calendar;

  const supabase = createServiceClient();
  const { error, count } = await supabase
    .from('appointment_reasons')
    .delete({ count: 'exact' })
    .eq('id', params.id)
    .eq('calendar_id', calendar.calendarId); // scope to this calendar, no cross-tenant deletes

  if (error) {
    if ((error as any).code === '23503') {
      return errorResponse(
        error,
        "Can't delete this reason — it's used by existing appointments. Delete or reassign those appointments first.",
        409
      );
    }
    return errorResponse(error, 'Could not delete reason.');
  }
  if (!count) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ status: 'deleted' });
}
