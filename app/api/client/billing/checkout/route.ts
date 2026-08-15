import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { getStripe, getOrCreateStripeCustomer } from '@/lib/stripe';
import { errorResponse } from '@/lib/error-response';

// Starts (or resumes) the upgrade flow. tier is never written here — only
// the webhook (app/api/stripe/webhook/route.ts) ever sets it, once Stripe
// confirms the subscription actually exists. This route just gets the
// client to Stripe's hosted Checkout page.
export async function POST() {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const supabase = createServiceClient();
  const { data: row, error } = await supabase
    .from('clients')
    .select('email, stripe_customer_id')
    .eq('id', client.clientId)
    .single();
  if (error) return errorResponse(error, 'Could not load your account.');

  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  try {
    // Already premium with a subscription on file — nothing to check out,
    // send them to manage the existing subscription instead of letting
    // them create a second one.
    if (client.tier === 'premium' && row.stripe_customer_id) {
      const portalSession = await getStripe().billingPortal.sessions.create({
        customer: row.stripe_customer_id,
        return_url: `${appUrl}/dashboard/billing`,
      });
      return NextResponse.json({ url: portalSession.url });
    }

    const customerId = await getOrCreateStripeCustomer(
      client.clientId,
      row.email,
      row.stripe_customer_id
    );

    const checkoutSession = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: client.clientId,
      line_items: [{ price: process.env.STRIPE_PREMIUM_PRICE_ID!, quantity: 1 }],
      success_url: `${appUrl}/dashboard/billing?checkout=success`,
      cancel_url: `${appUrl}/dashboard/billing?checkout=cancelled`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    return errorResponse(err, 'Could not start checkout.');
  }
}
