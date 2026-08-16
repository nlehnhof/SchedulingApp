import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { calendarCreateSchema } from '@/lib/validation';
import { errorResponse } from '@/lib/error-response';

// Elite feature: multiple booking calendars per client account. Free and
// Premium stay at the pre-Elite behavior of exactly 1 calendar (created
// automatically for every client — see lib/auth.ts's signIn callback and
// the 0015 migration's backfill for existing clients); Elite can create up
// to 5. This is a hard cap, not metered — see gather-elite-proposal.md's
// "Suggested limits" and the approved plan.
const CALENDAR_LIMIT_BY_TIER: Record<string, number> = { free: 1, premium: 1, elite: 5 };

// Powers both the "Manage calendars" page (owned calendars only, via
// client.clientId) and the dashboard calendar switcher (owned + accepted
// collaborator calendars, via client.collaboratorCalendars — Elite team
// access, 0018 migration) — the switcher needs the combined list so a
// person who's both an owner and a collaborator elsewhere sees everything
// they can access in one place, grouped by `role`.
export async function GET() {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  let owned: { id: string; display_name: string | null; slug: string | null; created_at: string }[] = [];
  if (client.clientId) {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('booking_calendars')
      .select('id, display_name, slug, created_at')
      .eq('client_id', client.clientId)
      .order('created_at', { ascending: true });
    if (error) return errorResponse(error, 'Could not load your calendars.');
    owned = data ?? [];
  }

  const calendars = [
    ...owned.map((c) => ({ ...c, role: 'owner' as const })),
    ...client.collaboratorCalendars.map((c) => ({
      id: c.calendarId,
      display_name: c.calendarDisplayName,
      slug: null,
      created_at: null,
      role: c.role,
    })),
  ];

  return NextResponse.json({
    calendars,
    // Only meaningful against owned calendars — a collaborator isn't
    // subject to the owner's calendar cap.
    limit: client.clientId ? CALENDAR_LIMIT_BY_TIER[client.tier] ?? 1 : 0,
  });
}

export async function POST(req: Request) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;
  if (!client.clientId) {
    return NextResponse.json({ error: 'Only an account owner can create calendars.' }, { status: 403 });
  }

  const parsed = calendarCreateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceClient();
  const limit = CALENDAR_LIMIT_BY_TIER[client.tier] ?? 1;
  const { count } = await supabase
    .from('booking_calendars')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', client.clientId);

  if ((count ?? 0) >= limit) {
    return NextResponse.json(
      {
        error:
          client.tier === 'elite'
            ? `You've reached the ${limit}-calendar limit.`
            : 'Upgrade to Elite to add more than one booking calendar.',
      },
      { status: 403 }
    );
  }

  const { data, error } = await supabase
    .from('booking_calendars')
    .insert({ client_id: client.clientId, display_name: parsed.data.displayName ?? null })
    .select('id, display_name, slug, created_at')
    .single();

  if (error) return errorResponse(error, 'Could not create calendar.');
  return NextResponse.json(data);
}
