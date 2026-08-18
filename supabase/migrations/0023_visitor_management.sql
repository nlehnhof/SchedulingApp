-- L7 launch phase: visitor-facing cancel/reschedule. Some clients don't want
-- visitors changing bookings freely (see app/dashboard/calendar/page.tsx for
-- the sibling per-calendar settings this joins) — default true so every
-- existing calendar keeps the new self-service behavior without an opt-in
-- step, matching how every other new booking_calendars column in this app
-- has defaulted to "on" unless there's a specific reason not to.
ALTER TABLE booking_calendars ADD COLUMN allow_visitor_management BOOLEAN NOT NULL DEFAULT true;
