-- Moves slot fill direction from a per-calendar setting to a per-rule one.
-- Previously every available_hours/specific_dates window on a calendar
-- shared one `booking_calendars.slot_fill_direction` value (0020); now each
-- such rule picks its own direction independently via its own
-- `config.fill_direction` — see lib/availability.ts's ruleFillDirection()
-- and components/RuleEditor.tsx's "Fill direction" field.
--
-- Best-effort carry-forward: any calendar that had opted into 'backward'
-- gets that value copied onto its existing available_hours/specific_dates
-- rules' config, so behavior doesn't silently change for a client who
-- deliberately chose it. Calendars already on the default 'forward' need no
-- copy — 'forward' is still the implicit default when config.fill_direction
-- is absent (see ruleFillDirection()).
UPDATE rules r
SET config = COALESCE(r.config, '{}'::jsonb) || '{"fill_direction": "backward"}'::jsonb
FROM booking_calendars bc
WHERE r.calendar_id = bc.id
  AND bc.slot_fill_direction = 'backward'
  AND r.rule_type IN ('available_hours', 'specific_dates');

ALTER TABLE booking_calendars DROP COLUMN slot_fill_direction;
