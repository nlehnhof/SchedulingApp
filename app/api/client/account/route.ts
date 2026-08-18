import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { getStripe } from '@/lib/stripe';
import { revokeGoogleToken } from '@/lib/google-calendar';

// Owner only (client.clientId must be set — a pure collaborator has no
// account of their own to delete, same guard as
// app/api/client/billing/checkout/route.ts). L6 launch phase; Google's
// verification review asks how a user deletes their data.
//
// Order matters: cancel billing and revoke Google access *before* deleting
// the row, so a failure partway through never leaves an active
// subscription or a live Google grant orphaned with no client row left to
// manage it from. Both steps are best-effort — logged and continued on
// failure, same pattern as the calendar Google write-back — because a
// deleted account that keeps billing or keeps Google access is worse than a
// failed cancel/revoke that has to get caught by hand afterward.
//
// The actual row delete cascades through every foreign key rooted at
// clients.id: booking_calendars (ON DELETE CASCADE, 0014) -> rules,
// appointment_reasons, appointments, error_log, csv_exports (ON DELETE
// CASCADE, 0016) and client_collaborators (ON DELETE CASCADE via
// calendar_id, 0018). Verified by reading every migration's FK definition
// before relying on it, per CLAUDE.md's note on this — nothing here needs
// an explicit dependency-order delete.
export async function DELETE() {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;
  if (!client.clientId) {
    return NextResponse.json({ error: 'Only an account owner can delete their account.' }, { status: 403 });
  }

  const supabase = createServiceClient();
  const { data: row, error: fetchError } = await supabase
    .from('clients')
    .select('stripe_subscription_id, google_refresh_token')
    .eq('id', client.clientId)
    .single();
  if (fetchError) {
    return NextResponse.json({ error: 'Could not load your account.' }, { status: 500 });
  }

  if (row.stripe_subscription_id) {
    try {
      await getStripe().subscriptions.cancel(row.stripe_subscription_id);
    } catch (err) {
      console.error(`Failed to cancel Stripe subscription for client ${client.clientId} on account deletion.`, err);
    }
  }

  if (row.google_refresh_token) {
    try {
      await revokeGoogleToken(row.google_refresh_token);
    } catch (err) {
      console.error(`Failed to revoke Google token for client ${client.clientId} on account deletion.`, err);
    }
  }

  const { error: deleteError } = await supabase.from('clients').delete().eq('id', client.clientId);
  if (deleteError) {
    return NextResponse.json({ error: 'Could not delete your account. Email support@gathertime.com.' }, { status: 500 });
  }

  return NextResponse.json({ status: 'deleted' });
}
