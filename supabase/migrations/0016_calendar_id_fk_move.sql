-- Moves the ownership FK on rules, appointment_reasons, appointments,
-- error_log, and csv_exports from client_id (a client can now own many
-- booking_calendars — see 0014/0015) to calendar_id, pointing at
-- booking_calendars instead of clients directly. Requires 0015's backfill
-- to have already run: every calendar_id value below is copied straight
-- from client_id, which only resolves to a real booking_calendars row
-- because 0015 gave every existing client a same-id calendar row.
--
-- Each table follows the same shape: add a nullable calendar_id, backfill
-- it from client_id, make it NOT NULL + FK, then drop client_id. Postgres
-- automatically drops every constraint/index that involves a column when
-- that column is dropped (documented ALTER TABLE ... DROP COLUMN behavior)
-- — so dropping client_id also drops its own FK to clients and any
-- UNIQUE constraint/index built on it, with no need to look up or guess
-- those constraints' auto-generated names first. This is written out
-- explicitly per table rather than via a generic helper, since this is the
-- highest-risk migration in the whole Elite build and needs to be
-- readable/auditable before running against production data, not clever.

-- ── rules ────────────────────────────────────────────────────────────────
ALTER TABLE rules ADD COLUMN calendar_id UUID REFERENCES booking_calendars(id) ON DELETE CASCADE;
UPDATE rules SET calendar_id = client_id;
ALTER TABLE rules ALTER COLUMN calendar_id SET NOT NULL;
ALTER TABLE rules DROP COLUMN client_id;

-- ── appointment_reasons ─────────────────────────────────────────────────
-- Drops UNIQUE(client_id, name) along with the column; re-added below keyed
-- on calendar_id instead.
ALTER TABLE appointment_reasons ADD COLUMN calendar_id UUID REFERENCES booking_calendars(id) ON DELETE CASCADE;
UPDATE appointment_reasons SET calendar_id = client_id;
ALTER TABLE appointment_reasons ALTER COLUMN calendar_id SET NOT NULL;
ALTER TABLE appointment_reasons DROP COLUMN client_id;
ALTER TABLE appointment_reasons ADD CONSTRAINT appointment_reasons_calendar_id_name_key UNIQUE (calendar_id, name);

-- ── appointments ─────────────────────────────────────────────────────────
-- Drops UNIQUE(client_id, start_time, end_time) and idx_appointments_client_start
-- along with the column; both re-added below keyed on calendar_id. This
-- UNIQUE constraint is the second line of defense against double-booking
-- (see 0002_booking_function.sql's header comment) — re-adding it here,
-- not skipping it, keeps that guarantee intact under the new key.
ALTER TABLE appointments ADD COLUMN calendar_id UUID REFERENCES booking_calendars(id) ON DELETE CASCADE;
UPDATE appointments SET calendar_id = client_id;
ALTER TABLE appointments ALTER COLUMN calendar_id SET NOT NULL;
ALTER TABLE appointments DROP COLUMN client_id;
ALTER TABLE appointments ADD CONSTRAINT appointments_calendar_id_start_time_end_time_key UNIQUE (calendar_id, start_time, end_time);
CREATE INDEX idx_appointments_calendar_start ON appointments(calendar_id, start_time);

-- ── error_log ────────────────────────────────────────────────────────────
-- Drops idx_error_log_client_unacked (0004) along with the column; re-added
-- below keyed on calendar_id.
ALTER TABLE error_log ADD COLUMN calendar_id UUID REFERENCES booking_calendars(id) ON DELETE CASCADE;
UPDATE error_log SET calendar_id = client_id;
ALTER TABLE error_log ALTER COLUMN calendar_id SET NOT NULL;
ALTER TABLE error_log DROP COLUMN client_id;
CREATE INDEX idx_error_log_calendar_unacked ON error_log(calendar_id) WHERE NOT acknowledged;

-- ── csv_exports ──────────────────────────────────────────────────────────
-- Drops UNIQUE(client_id, month) along with the column; re-added below
-- keyed on calendar_id. lib/csv-export.ts's `onConflict: 'client_id,month'`
-- string must be updated to 'calendar_id,month' to match (see the
-- accompanying application-code changes).
ALTER TABLE csv_exports ADD COLUMN calendar_id UUID REFERENCES booking_calendars(id) ON DELETE CASCADE;
UPDATE csv_exports SET calendar_id = client_id;
ALTER TABLE csv_exports ALTER COLUMN calendar_id SET NOT NULL;
ALTER TABLE csv_exports DROP COLUMN client_id;
ALTER TABLE csv_exports ADD CONSTRAINT csv_exports_calendar_id_month_key UNIQUE (calendar_id, month);

-- ── clients ──────────────────────────────────────────────────────────────
-- Branding, slug, Google-calendar-selection, and timezone all moved to
-- booking_calendars (0014) and were copied there by 0015's backfill —
-- clients keeps only login/billing identity from here on
-- (id/email/google_id/google_refresh_token/tier/sms_reminders_enabled/
-- tutorial_completed_at). Dropping idx_clients_slug along with the column
-- (same auto-cascade behavior as above).
ALTER TABLE clients DROP COLUMN display_name;
ALTER TABLE clients DROP COLUMN accent_color;
ALTER TABLE clients DROP COLUMN logo_url;
ALTER TABLE clients DROP COLUMN slug;
ALTER TABLE clients DROP COLUMN google_calendar_id;
ALTER TABLE clients DROP COLUMN timezone;
