-- Widens the `tier` CHECK constraint (added in 0007_client_onboarding_and_tier.sql
-- as `CHECK (tier IN ('free', 'premium'))`, inline on the column so Postgres
-- auto-named it — almost certainly `clients_tier_check`, but this migration
-- looks the name up via pg_constraint instead of hardcoding a guess, so it
-- can't silently no-op against a differently-named constraint on a live
-- database) to also allow 'elite', a third paid tier above premium.
--
-- Elite is $99/mo, unlocking multiple booking calendars (hard-capped at 5)
-- and shared per-calendar dashboard access — see gather-elite-proposal.md
-- and the approved plan for the full feature design. This migration is
-- Phase A only: it just makes 'elite' a legal value for `clients.tier`.
-- Phases B/C (the actual Elite-exclusive features) come in later migrations.
--
-- Before applying: create a $99/mo recurring Price for Elite in the Stripe
-- dashboard (same account/mode as the existing Premium price) and set
-- STRIPE_ELITE_PRICE_ID in the environment alongside the existing
-- STRIPE_PREMIUM_PRICE_ID. Until that env var is set, checkout for the
-- 'elite' tier returns a clear 400 (see app/api/client/billing/checkout/route.ts)
-- rather than silently charging the wrong amount or failing obscurely.
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT con.conname INTO v_constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
  WHERE rel.relname = 'clients'
    AND con.contype = 'c'
    AND att.attname = 'tier';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE clients DROP CONSTRAINT %I', v_constraint_name);
  END IF;

  ALTER TABLE clients ADD CONSTRAINT clients_tier_check CHECK (tier IN ('free', 'premium', 'elite'));
END $$;
