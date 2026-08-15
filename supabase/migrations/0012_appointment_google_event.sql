-- Tracks the Google Calendar event id created when an appointment is
-- written back to the client's calendar (lib/google-calendar.ts), so a
-- later edit/cancellation can update/delete the same event instead of
-- creating a duplicate, and so the sync poll (syncGoogleCalendarForClient)
-- can recognize its own written-back events and skip them rather than
-- red-flagging every appointment as conflicting with itself.
ALTER TABLE appointments ADD COLUMN google_event_id TEXT;
