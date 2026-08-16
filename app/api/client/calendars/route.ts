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

export async function GET() {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('booking_calendars')
    .select('id, display_name, slug, created_at')
    .eq('client_id', client.clientId)
    .order('created_at', { ascending: true });

  if (error) return errorResponse(error, 'Could not load your calendars.');
  return NextResponse.json({ calendars: data, limit: CALENDAR_LIMIT_BY_TIER[client.tier] ?? 1 });
}

export async function POST(req: Request) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

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
