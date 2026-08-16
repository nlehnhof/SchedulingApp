-- Lets a client choose whether appointment slots within an available-hours
-- window are generated starting from start_time and moving later
-- ('forward', the existing/default behavior) or starting from end_time and
-- moving earlier ('backward') — see lib/availability.ts's
-- computeSlotIntervals(). Direction only matters when duration_min doesn't
-- evenly divide the window: it decides which end absorbs the leftover.
-- Additive, defaulted — existing calendars keep today's forward behavior
-- unchanged.

ALTER TABLE booking_calendars
  ADD COLUMN slot_fill_direction VARCHAR(10) NOT NULL DEFAULT 'forward'
  CHECK (slot_fill_direction IN ('forward', 'backward'));
