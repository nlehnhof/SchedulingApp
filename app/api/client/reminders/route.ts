import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { remindersSchema } from '@/lib/validation';
import { errorResponse } from '@/lib/error-response';
import { isAtLeast } from '@/lib/tier';

// Client-level (not per-calendar) — split out from what used to be the
// branding route once branding itself moved to booking_calendars (0014-0016
// migrations). A text-reminders opt-in is a delivery-channel preference
// tied to the account, not a per-storefront branding concern (see
// gather-elite-proposal.md's Phase B design notes).
export async function GET() {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('clients')
    .select('id, sms_reminders_enabled')
    .eq('id', client.clientId)
    .single();

  if (error) return errorResponse(error, 'Could not load reminder settings.');
  return NextResponse.json({
    id: data.id,
    tier: client.tier,
    sms_reminders_enabled: data.sms_reminders_enabled,
  });
}

export async function PATCH(req: Request) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  if (!isAtLeast(client.tier, 'premium')) {
    return NextResponse.json({ error: 'Reminders is a premium feature.' }, { status: 403 });
  }

  const parsed = remindersSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('clients')
    .update({ sms_reminders_enabled: parsed.data.smsRemindersEnabled })
    .eq('id', client.clientId)
    .select('id, sms_reminders_enabled')
    .single();

  if (error) return errorResponse(error, 'Could not save reminder settings.');
  return NextResponse.json({
    id: data.id,
    tier: client.tier,
    sms_reminders_enabled: data.sms_reminders_enabled,
  });
}
