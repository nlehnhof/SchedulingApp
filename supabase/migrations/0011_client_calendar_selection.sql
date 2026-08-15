-- Lets a client pick which of their own Google calendars the app polls for
-- conflicts (lib/google-calendar.ts), instead of always assuming the
-- account's "primary" calendar. Available to every tier — this is a core
-- Phase 1 feature (Google Calendar sync), not a premium one.
--
-- Defaulted to 'primary' rather than left NULL so every existing client row
-- keeps today's exact behavior with no migration-time backfill needed:
-- lib/google-calendar.ts already hardcoded 'primary' before this column
-- existed.
ALTER TABLE clients ADD COLUMN google_calendar_id TEXT NOT NULL DEFAULT 'primary';
