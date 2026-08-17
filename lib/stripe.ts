import Stripe from 'stripe';
import { createServiceClient } from './supabase';

let stripe: Stripe | null = null;

// Singleton — Stripe's own SDK guidance is to reuse one client rather than
// constructing per-request (connection pooling).
export function getStripe(): Stripe {
  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-07-29.dahlia',
    });
  }
  return stripe;
}

/**
 * Returns the client's existing Stripe customer id, or creates one and
 * persists it. Centralized here (rather than inlined in the checkout route)
 * so the webhook's checkout.session.completed handler can also call it
 * without duplicating the "create if missing" logic.
 */
export async function getOrCreateStripeCustomer(
  clientId: string,
  email: string,
  existingCustomerId: string | null
): Promise<string> {
  if (existingCustomerId) return existingCustomerId;

  const customer = await getStripe().customers.create({
    email,
    metadata: { clientId },
  });

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('clients')
    .update({ stripe_customer_id: customer.id })
    .eq('id', clientId);
  if (error) throw error;

  return customer.id;
}

/**
 * Elite-only: calendars beyond the included allotment (see
 * CALENDAR_INCLUDED_LIMIT_BY_TIER in app/api/client/calendars/route.ts) are
 * billed at $5/mo each via a quantity-based subscription item on the
 * client's *existing* subscription — one Stripe subscription per client,
 * not a second one — rather than metered usage billing, since the quantity
 * (current extra-calendar count) is already known exactly at write time.
 * Called after every calendar create/delete once the caller is confirmed
 * Elite; a no-op if `subscriptionId` is null (shouldn't happen for a real
 * Elite client, but defensive) or STRIPE_ELITE_EXTRA_CALENDAR_PRICE_ID
 * hasn't been set yet — same "configure later" pattern as
 * STRIPE_ELITE_PRICE_ID (see app/api/client/billing/checkout/route.ts).
 * Callers must treat this as best-effort (catch and log, don't block the
 * calendar operation on it) since a transient Stripe failure here is a
 * billing-reconciliation problem, not a reason to refuse the calendar
 * create/delete itself.
 */
export async function syncExtraCalendarQuantity(
  subscriptionId: string | null,
  extraCount: number
): Promise<void> {
  const priceId = process.env.STRIPE_ELITE_EXTRA_CALENDAR_PRICE_ID;
  if (!subscriptionId || !priceId) return;

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const existingItem = subscription.items.data.find((item) => item.price?.id === priceId);

  if (extraCount <= 0) {
    if (existingItem) await stripe.subscriptionItems.del(existingItem.id);
    return;
  }

  if (existingItem) {
    if (existingItem.quantity !== extraCount) {
      await stripe.subscriptionItems.update(existingItem.id, { quantity: extraCount });
    }
  } else {
    await stripe.subscriptionItems.create({
      subscription: subscriptionId,
      price: priceId,
      quantity: extraCount,
    });
  }
}
