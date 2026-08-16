-- Elite feature: multiple independently-configured "booking calendars" per
-- client account (hard-capped at 5, enforced in
-- app/api/client/calendars/route.ts — not in the database). Each calendar
-- gets its own branding, slug, Google Calendar selection, and timezone;
-- `clients` stays the login/billing identity, and can now own many
-- `booking_calendars` rows. See gather-elite-proposal.md and the approved
-- plan for the full feature design.
--
-- Naming note: `google_calendar_id` here is GOOGLE's own calendar id string
-- (see lib/google-calendar.ts), unrelated to this table's own `id` column,
-- which is the new `calendar_id` FK that rules/appointment_reasons/
-- appointments/error_log/csv_exports will point at (0016).
CREATE TABLE booking_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  display_name VARCHAR(255),
  accent_color VARCHAR(20),
  logo_url TEXT,
  slug VARCHAR(30),
  google_calendar_id TEXT NOT NULL DEFAULT 'primary',
  timezone VARCHAR(50) DEFAULT 'UTC',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Same partial-unique-index shape as clients.slug had (0007) — multiple
-- calendars can keep slug = NULL.
CREATE UNIQUE INDEX idx_booking_calendars_slug ON booking_calendars(slug) WHERE slug IS NOT NULL;
CREATE INDEX idx_booking_calendars_client_id ON booking_calendars(client_id);

ALTER TABLE booking_calendars ENABLE ROW LEVEL SECURITY;
-- Belt-and-suspenders per the 0005/0010 lesson: 0005's ALTER DEFAULT
-- PRIVILEGES already covers future tables, but every table added since has
-- still added this explicit grant too.
GRANT ALL ON booking_calendars TO service_role;
