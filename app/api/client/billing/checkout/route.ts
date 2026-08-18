import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { getStripe, getOrCreateStripeCustomer } from '@/lib/stripe';
import { errorResponse } from '@/lib/error-response';
import { isAtLeast, type Tier } from '@/lib/tier';

// Which Stripe Price backs each paid tier's checkout. STRIPE_ELITE_PRICE_ID
// is unset until the user creates the real $49/mo Price in their Stripe
// dashboard and adds the env var — checkout for 'elite' 500s with a clear
// message until then, rather than silently falling back to the Premium price.
const PRICE_ENV_BY_TIER: Record<'premium' | 'elite', string | undefined> = {
  premium: process.env.STRIPE_PREMIUM_PRICE_ID,
  elite: process.env.STRIPE_ELITE_PRICE_ID,
};

// Starts (or resumes) the upgrade flow for a target paid tier. tier is never
// written here — only the webhook (app/api/stripe/webhook/route.ts) ever
// sets it, once Stripe confirms the subscription actually exists. This
// route just gets the client to Stripe's hosted Checkout page.
export async function POST(req: Request) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;
  if (!client.clientId) {
    return NextResponse.json({ error: 'Only an account owner has billing to manage.' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const targetTier: Tier = body?.tier === 'elite' ? 'elite' : 'premium';
  const priceId = PRICE_ENV_BY_TIER[targetTier];
  if (!priceId) {
    // Developer-facing detail stays server-side (a missing Price env var is
    // an operational bug, not something a customer should see or act on) —
    // L5 launch phase. The customer gets a generic, actionable message.
    console.error(`Checkout for ${targetTier} isn't configured — STRIPE_${targetTier.toUpperCase()}_PRICE_ID is unset.`);
    return NextResponse.json(
      { error: "We couldn't start checkout. Email support@gathertime.com and we'll sort it out." },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const { data: row, error } = await supabase
    .from('clients')
    .select('email, stripe_customer_id')
    .eq('id', client.clientId)
    .single();
  if (error) return errorResponse(error, 'Could not load your account.');

  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  try {
    // Already on a paid tier with a subscription on file — nothing to check
    // out, send them to manage the existing subscription instead of letting
    // them create a second one (covers premium->elite upgrades too, which
    // go through the same billing portal rather than a fresh Checkout).
    if (isAtLeast(client.tier, 'premium') && row.stripe_customer_id) {
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
      line_items: [{ price: priceId, quantity: 1 }],
      // Premium only, per L5 — Cal.com is free and Acuity gives 7 days, so a
      // self-serve launch with no trial loses on the first comparison.
      // Elite buyers are talking to us directly anyway, so no trial there.
      ...(targetTier === 'premium' ? { subscription_data: { trial_period_days: 14 } } : {}),
      success_url: `${appUrl}/dashboard/billing?checkout=success`,
      cancel_url: `${appUrl}/dashboard/billing?checkout=cancelled`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    return errorResponse(
      err,
      "We couldn't start checkout. Email support@gathertime.com and we'll sort it out."
    );
  }
}
