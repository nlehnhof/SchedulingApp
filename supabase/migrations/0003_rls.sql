-- Enable Row Level Security on every table. All application access goes
-- through the Next.js API routes using the Supabase *service role* key
-- (lib/supabase.ts createServiceClient), which bypasses RLS by design.
-- Enabling RLS with no policies means the anon/authenticated keys — which
-- must never be used server-side-only here, but could leak into a client
-- bundle by mistake — get zero access instead of full-table access.

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE csv_exports ENABLE ROW LEVEL SECURITY;

-- No policies are added: with RLS enabled and no policy, only the service
-- role (which bypasses RLS) can read/write. If a future feature needs the
-- browser to query Supabase directly with the anon key, add narrow
-- policies here scoped by client_id rather than disabling RLS.
