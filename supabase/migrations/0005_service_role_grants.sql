-- Belt-and-suspenders fix for a common Supabase gotcha: tables created via the
-- SQL Editor don't always pick up the default grants Supabase normally wires
-- up for `service_role` automatically. Without this, every query from the
-- app (which always uses the service role key — see lib/supabase.ts
-- createServiceClient) fails with "permission denied for table X" (Postgres
-- 42501), even though service_role bypasses RLS and 0003_rls.sql is correct.
--
-- Safe to run even if grants already exist (GRANT is idempotent).

GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Covers any table/sequence/function added by a future migration too.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;
