import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { getStripe } from '@/lib/stripe';
import { errorResponse } from '@/lib/error-response';

// Hands back a Stripe-hosted Customer Portal URL for managing/cancelling an
// existing subscription — cancellation itself is handled entirely on
// Stripe's side; our tier flips back to 'free' when the webhook sees the
// resulting customer.subscription.deleted event.
export async function POST() {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const supabase = createServiceClient();
  const { data: row, error } = await supabase
    .from('clients')
    .select('stripe_customer_id')
    .eq('id', client.clientId)
    .single();
  if (error) return errorResponse(error, 'Could not load your account.');

  if (!row.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account on file yet.' }, { status: 400 });
  }

  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  try {
    const portalSession = await getStripe().billingPortal.sessions.create({
      customer: row.stripe_customer_id,
      return_url: `${appUrl}/dashboard/billing`,
    });
    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    return errorResponse(err, 'Could not open billing portal.');
  }
}
