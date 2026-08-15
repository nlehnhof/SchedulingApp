-- Premium trial/comp feature: an admin-managed allowlist of client emails
-- that get 'premium' access indefinitely, independent of Stripe billing.
-- See lib/premium-grants.ts for the full rationale and the list of call
-- sites that must check this (never `clients.tier` alone) for an
-- authorization decision.
--
-- Managed directly via the Supabase SQL Editor — insert/delete rows there.
-- No admin UI by design; this is for a small number of comped accounts.
--
-- email (not client_id) is the join key so a grant can be added before the
-- client has ever signed in — matches how clients.email is already the
-- natural pre-auth key elsewhere (see lib/auth.ts's signIn upsert).
CREATE TABLE premium_grants (
  email TEXT PRIMARY KEY,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT
);

-- Store lowercase so a grant can't silently miss-match a differently-cased
-- login email (lib/premium-grants.ts lowercases before every lookup too).
ALTER TABLE premium_grants ADD CONSTRAINT premium_grants_email_lowercase
  CHECK (email = lower(email));

-- RLS: service-role only, same posture as every other table (0003_rls.sql)
-- — no client or visitor route ever queries this table directly, only
-- lib/premium-grants.ts via the service-role client.
ALTER TABLE premium_grants ENABLE ROW LEVEL SECURITY;

-- Belt-and-suspenders per the 0005 migration's lesson: tables created via
-- the Supabase SQL Editor don't always inherit the default service_role
-- grants, which otherwise surfaces as a Postgres 42501 permission-denied
-- error the first time the app queries this table.
GRANT ALL ON premium_grants TO service_role;

-- First comped account (project decision, 2026-08-15).
INSERT INTO premium_grants (email, note)
VALUES ('n.lehnhof01@gmail.com', 'Founder trial/comp account');
