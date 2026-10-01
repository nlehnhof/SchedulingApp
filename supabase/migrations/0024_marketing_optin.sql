-- L10 launch phase: marketing opt-in collection. Additive only: no drops,
-- renames, type changes, or backfills. Every existing booking_calendars row
-- gets collect_marketing_optin = false, and every existing appointment gets
-- email_marketing_optin = false / _at = NULL. Consent is never inferred from a
-- stored visitor_email. Gather only collects; the client does any sending.
ALTER TABLE booking_calendars ADD COLUMN collect_marketing_optin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE appointments ADD COLUMN email_marketing_optin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE appointments ADD COLUMN email_marketing_optin_at TIMESTAMPTZ NULL;

-- Explicit service_role grants (see 0005). Idempotent; RLS posture unchanged.
GRANT ALL ON booking_calendars TO service_role;
GRANT ALL ON appointments TO service_role;
