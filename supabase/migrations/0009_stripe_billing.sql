-- Real billing for the premium tier. 0007 added `tier` with "no billing
-- integration this pass — set directly in the DB (or via a future
-- admin-only toggle)"; this migration is that follow-up. `tier` itself is
-- unchanged (still the single column every premium-gated route checks) —
-- these new columns just let a webhook (app/api/stripe/webhook/route.ts)
-- keep it in sync with a real Stripe subscription instead of a manual flip.
--
-- stripe_customer_id: set the first time a client starts Checkout
-- (lib/stripe.ts's getOrCreateStripeCustomer). Nullable — most free clients
-- will never have one. Unique so a customer can never be attributed to two
-- client rows.
ALTER TABLE clients ADD COLUMN stripe_customer_id TEXT;
CREATE UNIQUE INDEX idx_clients_stripe_customer_id ON clients(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- stripe_subscription_id / stripe_subscription_status: mirror of the
-- client's current Stripe subscription, written only by the webhook
-- handler (never trust a client-supplied value here — same posture as
-- `tier` per PLAN.md Section 5). Status is Stripe's own string
-- ('active', 'trialing', 'past_due', 'canceled', ...); the webhook derives
-- `tier` from it but the raw string is kept too so the billing page can
-- show something more specific than just "premium/free".
ALTER TABLE clients ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE clients ADD COLUMN stripe_subscription_status TEXT;
