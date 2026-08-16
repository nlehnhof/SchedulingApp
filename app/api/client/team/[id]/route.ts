import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { requireCalendarAccess, requireOwnerRole } from '@/lib/require-calendar';
import { teamRoleUpdateSchema } from '@/lib/validation';
import { errorResponse } from '@/lib/error-response';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const { searchParams } = new URL(req.url);
  const calendar = await requireCalendarAccess(searchParams.get('calendarId'), client);
  if (calendar instanceof NextResponse) return calendar;
  const ownerError = requireOwnerRole(calendar.role);
  if (ownerError) return ownerError;

  const parsed = teamRoleUpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('client_collaborators')
    .update({ role: parsed.data.role })
    .eq('id', params.id)
    .eq('calendar_id', calendar.calendarId) // scope to this calendar, no cross-tenant edits
    .select('id, email, role, invited_at, accepted_at')
    .single();

  if (error) return errorResponse(error, 'Could not update this collaborator.');
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(data);
}

// Revoking deletes the row outright — the collaborator's next session
// refresh (JWT strategy, session() callback re-derives collaboratorCalendars
// fresh from the DB every time — see lib/auth.ts) drops this calendar out
// of their access automatically, no separate invalidation step needed.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const { searchParams } = new URL(req.url);
  const calendar = await requireCalendarAccess(searchParams.get('calendarId'), client);
  if (calendar instanceof NextResponse) return calendar;
  const ownerError = requireOwnerRole(calendar.role);
  if (ownerError) return ownerError;

  const supabase = createServiceClient();
  const { error, count } = await supabase
    .from('client_collaborators')
    .delete({ count: 'exact' })
    .eq('id', params.id)
    .eq('calendar_id', calendar.calendarId);

  if (error) return errorResponse(error, 'Could not revoke this collaborator.');
  if (!count) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ status: 'revoked' });
}
