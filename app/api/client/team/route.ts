import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { requireCalendarAccess, requireOwnerRole } from '@/lib/require-calendar';
import { teamInviteSchema } from '@/lib/validation';
import { errorResponse } from '@/lib/error-response';
import { sendCollaboratorInviteEmail } from '@/lib/email';

// Elite team access (0018 migration). Scoped to one calendar (?calendarId=)
// — a collaborator's role can vary by calendar, so there's no
// account-wide "team" list, only a per-calendar one. Owner-only: an Editor
// can help manage bookings but must not see or change who else has access
// (not explicitly stated in the original proposal, treated as the safer
// default — "who can see/edit my dashboard" is itself sensitive).
export async function GET(req: Request) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const { searchParams } = new URL(req.url);
  const calendar = await requireCalendarAccess(searchParams.get('calendarId'), client);
  if (calendar instanceof NextResponse) return calendar;
  const ownerError = requireOwnerRole(calendar.role);
  if (ownerError) return ownerError;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('client_collaborators')
    .select('id, email, role, invited_at, accepted_at')
    .eq('calendar_id', calendar.calendarId)
    .order('invited_at', { ascending: true });

  if (error) return errorResponse(error, 'Could not load team members.');
  return NextResponse.json({ collaborators: data });
}

export async function POST(req: Request) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;
  if (!client.clientId) {
    return NextResponse.json({ error: 'Only an account owner can invite collaborators.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const calendar = await requireCalendarAccess(searchParams.get('calendarId'), client);
  if (calendar instanceof NextResponse) return calendar;
  const ownerError = requireOwnerRole(calendar.role);
  if (ownerError) return ownerError;

  const parsed = teamInviteSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from('client_collaborators')
    .select('id')
    .eq('calendar_id', calendar.calendarId)
    .eq('email', body.email)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: 'That email already has access to this calendar.' },
      { status: 409 }
    );
  }

  const [{ data: row, error }, { data: calendarRow }] = await Promise.all([
    supabase
      .from('client_collaborators')
      .insert({
        calendar_id: calendar.calendarId,
        email: body.email,
        role: body.role,
        invited_by: client.clientId,
      })
      .select('id, email, role, invited_at, accepted_at')
      .single(),
    supabase
      .from('booking_calendars')
      .select('display_name, clients(email)')
      .eq('id', calendar.calendarId)
      .single(),
  ]);

  if (error) {
    // UNIQUE(calendar_id, email) — narrow double-submit race past the
    // existence check above.
    if ((error as any).code === '23505') {
      return NextResponse.json(
        { error: 'That email already has access to this calendar.' },
        { status: 409 }
      );
    }
    return errorResponse(error, 'Could not invite this collaborator.');
  }

  // Best-effort — a failed send must never fail the invite that already
  // succeeded (same pattern as every other email send in this codebase).
  // The row stays exactly as created either way: the invitee can still
  // accept just by signing in, the email is a convenience notification.
  const owner: any = Array.isArray((calendarRow as any)?.clients)
    ? (calendarRow as any).clients[0]
    : (calendarRow as any)?.clients;
  try {
    const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    await sendCollaboratorInviteEmail({
      inviteeEmail: body.email,
      ownerDisplayName: calendarRow?.display_name || owner?.email || 'A Gather client',
      ownerEmail: owner?.email ?? '',
      role: body.role,
      calendarDisplayName: calendarRow?.display_name || 'their calendar',
      appUrl,
    });
  } catch (err: any) {
    await supabase.from('error_log').insert({
      calendar_id: calendar.calendarId,
      error_type: 'collaborator_invite_email_failed',
      message: err?.message ?? String(err),
    });
  }

  return NextResponse.json(row);
}
