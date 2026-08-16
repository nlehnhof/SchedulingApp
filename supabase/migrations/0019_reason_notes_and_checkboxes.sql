-- Adds client-authored, visitor-facing content to appointment_reasons:
-- info_note (free text shown to the visitor while booking) and
-- required_checkboxes (a JSONB array of label strings the visitor must all
-- tick before they can submit a booking for that reason). Additive only —
-- info_note is nullable and required_checkboxes defaults to an empty array,
-- so existing rows/reasons are unaffected until a client opts in.
--
-- Distinct from appointments.notes, which is the visitor's own free-text
-- note to the client entered at booking time — the opposite direction.

ALTER TABLE appointment_reasons ADD COLUMN info_note TEXT;
ALTER TABLE appointment_reasons ADD COLUMN required_checkboxes JSONB NOT NULL DEFAULT '[]'::jsonb;
