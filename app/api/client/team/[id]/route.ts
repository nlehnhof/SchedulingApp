import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { requireCalendarAccess, requireOwnerRole, calendarOwnerTier } from '@/lib/require-calendar';
import { teamRoleUpdateSchema } from '@/lib/validation';
import { errorResponse } from '@/lib/error-response';
import { COLLABORATOR_LIMIT_BY_TIER } from '@/lib/tier';

// Same tier gate as POST /api/client/team (L2 launch phase) — a downgraded
// owner must not be able to promote a viewer to editor, or otherwise touch
// team roles, once their tier no longer allows any seats at all. A calendar
// already over its seat limit (frozen collaborators, see route.ts's header
// comment) can still have roles changed among its *existing* members as
// long as the tier allows collaborators at all — only a 0-seat tier (free)
// is blocked outright.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const { searchParams } = new URL(req.url);
  const calendar = await requireCalendarAccess(searchParams.get('calendarId'), client);
  if (calendar instanceof NextResponse) return calendar;
  const ownerError = requireOwnerRole(calendar.role);
  if (ownerError) return ownerError;

  const ownerTier = await calendarOwnerTier(calendar.calendarId);
  if (COLLABORATOR_LIMIT_BY_TIER[ownerTier] === 0) {
    return NextResponse.json(
      { error: 'Team access is a Premium feature. Upgrade to Premium to manage collaborators.' },
      { status: 403 }
    );
  }

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
