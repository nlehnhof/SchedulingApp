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
