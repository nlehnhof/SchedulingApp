import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { revokeGoogleToken } from '@/lib/google-calendar';

// Smaller, non-destructive sibling of DELETE /api/client/account (L6 launch
// phase) — clears google_refresh_token and revokes it with Google, without
// touching any rules/reasons/appointments. Sync simply stops on every
// calendar the account owns; existing appointments and their Google events
// (already written) stay exactly as they are, since nothing here calls
// deleteGoogleCalendarEvent. Owner only, same guard as account deletion —
// a pure collaborator never had google_refresh_token of their own to clear.
export async function POST() {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;
  if (!client.clientId) {
    return NextResponse.json({ error: 'Only an account owner can disconnect Google.' }, { status: 403 });
  }

  const supabase = createServiceClient();
  const { data: row, error: fetchError } = await supabase
    .from('clients')
    .select('google_refresh_token')
    .eq('id', client.clientId)
    .single();
  if (fetchError) {
    return NextResponse.json({ error: 'Could not load your account.' }, { status: 500 });
  }

  if (row.google_refresh_token) {
    try {
      await revokeGoogleToken(row.google_refresh_token);
    } catch (err) {
      console.error(`Failed to revoke Google token for client ${client.clientId} on disconnect.`, err);
    }
  }

  const { error: updateError } = await supabase
    .from('clients')
    .update({ google_refresh_token: null })
    .eq('id', client.clientId);
  if (updateError) {
    return NextResponse.json({ error: 'Could not disconnect Google. Try again.' }, { status: 500 });
  }

  return NextResponse.json({ status: 'disconnected' });
}
