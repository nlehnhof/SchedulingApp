-- Backfills one booking_calendars row per existing client, using the SAME
-- id as the client's own row and copying its branding/slug/Google-calendar/
-- timezone fields. This is the single most important correctness detail in
-- the multi-calendar migration: it's what keeps every already-shared
-- /visit/[link] resolving with zero visitor-facing disruption once link
-- resolution moves from clients to booking_calendars
-- (lib/resolve-calendar-link.ts, replacing lib/resolve-client-link.ts) — a
-- premium client's existing custom slug, and every plain-UUID link built
-- from clients.id, both keep working completely unchanged after this ships.
--
-- Kept as its own migration file (separate from 0014's DDL) so the backfill
-- is easy to audit/re-run independently. Must run before 0016 (the FK move),
-- since 0016's `UPDATE x SET calendar_id = client_id` on rules/reasons/
-- appointments/error_log/csv_exports only produces valid foreign keys
-- because every client already has a same-id calendar row after this runs.
INSERT INTO booking_calendars (
  id, client_id, display_name, accent_color, logo_url, slug,
  google_calendar_id, timezone, created_at, updated_at
)
SELECT
  id, id, display_name, accent_color, logo_url, slug,
  google_calendar_id, timezone, created_at, updated_at
FROM clients
ON CONFLICT (id) DO NOTHING;
