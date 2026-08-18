-- L5 launch phase: the billing page needs to show a renewal date and, during
-- a trial, days remaining, without calling Stripe's API on every dashboard
-- load. Mirrors the pattern 0009 set for stripe_subscription_status — the
-- webhook (app/api/stripe/webhook/route.ts) is the only writer, on every
-- customer.subscription.created/updated event; every other route only reads.
ALTER TABLE clients ADD COLUMN stripe_current_period_end TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN stripe_trial_end TIMESTAMPTZ;
