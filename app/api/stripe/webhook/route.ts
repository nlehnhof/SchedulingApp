import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase';

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
      if (error) console.error('Failed to record Stripe customer on checkout completion.', error);
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

      const tier = ['active', 'trialing'].includes(subscription.status) ? 'premium' : 'free';
      const { error, count } = await supabase
        .from('clients')
        .update(
          {
            tier,
            stripe_subscription_id: subscription.id,
            stripe_subscription_status: subscription.status,
          },
          { count: 'exact' }
        )
        .eq('stripe_customer_id', customerId);

      if (error) console.error('Failed to sync tier from subscription update.', error);
      else if (!count) console.error(`No client found for Stripe customer ${customerId}.`);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

      const { error, count } = await supabase
        .from('clients')
        .update(
          { tier: 'free', stripe_subscription_status: 'canceled' },
          { count: 'exact' }
        )
        .eq('stripe_customer_id', customerId);

      if (error) console.error('Failed to downgrade tier on subscription deletion.', error);
      else if (!count) console.error(`No client found for Stripe customer ${customerId}.`);
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
