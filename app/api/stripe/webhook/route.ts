import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import * as Sentry from '@sentry/nextjs';
import { getStripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase';
import type { Tier } from '@/lib/tier';

// Maps a Stripe Price id back to the tier it sells. Built from env so this
// stays in sync with whichever Price ids are actually configured — an unset
// STRIPE_ELITE_PRICE_ID (until the user creates that Price and adds the env
// var) just means no subscription can ever match 'elite' yet, not a crash.
function priceIdToTier(priceId: string | undefined): Tier | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_ELITE_PRICE_ID) return 'elite';
  if (priceId === process.env.STRIPE_PREMIUM_PRICE_ID) return 'premium';
  return null;
}

/**
 * Derives the tier a subscription grants from the Price it's actually on,
 * not just its status — previously this only checked
 * active/trialing-vs-not, so a real Elite subscription would have silently
 * collapsed into 'premium' (both are "paid and active") once a second paid
 * tier existed. Falls back to the old status-only premium/free split only
 * if no line item's price matches a known tier (defensive — shouldn't
 * happen for a subscription created through this app's own checkout).
 */
function tierFromSubscription(subscription: Stripe.Subscription): Tier {
  if (!['active', 'trialing'].includes(subscription.status)) return 'free';

  const matchedTiers = subscription.items.data
    .map((item) => priceIdToTier(item.price?.id))
    .filter((t): t is Tier => t !== null);
  // Highest-ranked match wins if a subscription somehow has multiple line
  // items on different tiers (shouldn't happen given single-price checkout).
  if (matchedTiers.includes('elite')) return 'elite';
  if (matchedTiers.includes('premium')) return 'premium';
  return 'premium'; // active/trialing but no price matched a known tier — fall back to today's behavior.
}

// Stripe's SDK needs Node APIs (crypto) for signature verification — the
// default edge runtime doesn't have them.
export const runtime = 'nodejs';

// No requireClient()/cron-secret here — this is a public endpoint that only
// Stripe calls, authenticated by the signature header instead (same idea as
// lib/require-cron.ts's shared-secret check, just Stripe's own mechanism).
// This handler is the *only* place `tier` is written for a real client;
// every other route only ever reads it (see PLAN.md Section 5, and
// lib/require-client.ts's header comment).
export async function POST(req: Request) {
  const signature = req.headers.get('stripe-signature');
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    Sentry.captureException(err);
    console.error('Stripe webhook signature verification failed.', err);
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  const supabase = createServiceClient();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const clientId = session.client_reference_id;
      if (!clientId || typeof session.customer !== 'string') break;

      const update: Record<string, unknown> = { stripe_customer_id: session.customer };
      if (typeof session.subscription === 'string') {
        update.stripe_subscription_id = session.subscription;
      }
      const { error } = await supabase.from('clients').update(update).eq('id', clientId);
      if (error) {
        Sentry.captureException(error);
        console.error('Failed to record Stripe customer on checkout completion.', error);
      }
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

      const tier = tierFromSubscription(subscription);
      // current_period_end lives on the subscription item, not the
      // subscription itself, as of this SDK's API version — take the first
      // line item's, which is correct for this app's single-price-per-
      // subscription checkout (the only case that exists).
      const periodEnd = subscription.items.data[0]?.current_period_end;
      const { error, count } = await supabase
        .from('clients')
        .update(
          {
            tier,
            stripe_subscription_id: subscription.id,
            stripe_subscription_status: subscription.status,
            stripe_current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
            stripe_trial_end: subscription.trial_end
              ? new Date(subscription.trial_end * 1000).toISOString()
              : null,
          },
          { count: 'exact' }
        )
        .eq('stripe_customer_id', customerId);

      if (error) {
        Sentry.captureException(error);
        console.error('Failed to sync tier from subscription update.', error);
      } else if (!count) {
        Sentry.captureMessage(`No client found for Stripe customer ${customerId}.`, 'error');
        console.error(`No client found for Stripe customer ${customerId}.`);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

      const { error, count } = await supabase
        .from('clients')
        .update(
          {
            tier: 'free',
            stripe_subscription_status: 'canceled',
            stripe_current_period_end: null,
            stripe_trial_end: null,
          },
          { count: 'exact' }
        )
        .eq('stripe_customer_id', customerId);

      if (error) {
        Sentry.captureException(error);
        console.error('Failed to downgrade tier on subscription deletion.', error);
      } else if (!count) {
        Sentry.captureMessage(`No client found for Stripe customer ${customerId}.`, 'error');
        console.error(`No client found for Stripe customer ${customerId}.`);
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
