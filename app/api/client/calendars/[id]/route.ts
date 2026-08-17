import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { calendarCreateSchema } from '@/lib/validation';
import { errorResponse } from '@/lib/error-response';
import { syncExtraCalendarQuantity } from '@/lib/stripe';

// Kept in sync with app/api/client/calendars/route.ts's
// CALENDAR_INCLUDED_LIMIT_BY_TIER — only used here to recompute the
// extra-calendar billing quantity after a delete, not to gate anything.
const CALENDAR_INCLUDED_LIMIT_BY_TIER: Record<string, number> = { free: 1, premium: 1, elite: 10 };

// Quick rename from the "Manage calendars" list — full branding
// (accent color, logo, slug) still goes through PATCH /api/client/branding
// once a calendar is selected in the switcher.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;
  if (!client.clientId) {
    return NextResponse.json({ error: 'Only an account owner can manage calendars.' }, { status: 403 });
  }

  const parsed = calendarCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (parsed.data.displayName === undefined) {
    return NextResponse.json({ error: 'displayName is required.' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('booking_calendars')
    .update({ display_name: parsed.data.displayName })
    .eq('id', params.id)
    .eq('client_id', client.clientId) // scope to this client, no cross-tenant edits
    .select('id, display_name, slug, created_at')
    .single();

  if (error) return errorResponse(error, 'Could not rename calendar.');
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(data);
}

// A client always needs at least one calendar (everything — rules,
// reasons, appointments — is scoped to one), so deleting the last one is
// blocked rather than leaving the account in a broken state.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;
  if (!client.clientId) {
    return NextResponse.json({ error: 'Only an account owner can manage calendars.' }, { status: 403 });
  }

  const supabase = createServiceClient();
  const { count } = await supabase
    .from('booking_calendars')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', client.clientId);

  if ((count ?? 0) <= 1) {
    return NextResponse.json(
      { error: "Can't delete your only calendar." },
      { status: 400 }
    );
  }

  const { error, count: deletedCount } = await supabase
    .from('booking_calendars')
    .delete({ count: 'exact' })
    .eq('id', params.id)
    .eq('client_id', client.clientId); // scope to this client, no cross-tenant deletes

  if (error) return errorResponse(error, 'Could not delete calendar.');
  if (!deletedCount) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (client.tier === 'elite') {
    const included = CALENDAR_INCLUDED_LIMIT_BY_TIER.elite;
    const remaining = (count ?? 0) - deletedCount;
    const extraCount = Math.max(0, remaining - included);
    try {
      const { data: row } = await supabase
        .from('clients')
        .select('stripe_subscription_id')
        .eq('id', client.clientId)
        .single();
      await syncExtraCalendarQuantity(row?.stripe_subscription_id ?? null, extraCount);
    } catch (err) {
      console.error(`Failed to sync extra-calendar billing for client ${client.clientId}.`, err);
    }
  }

  return NextResponse.json({ status: 'deleted' });
}
