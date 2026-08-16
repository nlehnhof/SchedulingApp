-- Re-keys book_appointment (last redefined in 0008_visitor_email.sql) and
-- update_appointment (0006_update_appointment_function.sql) from
-- client_id/p_client_id to calendar_id/p_calendar_id, matching 0016's FK
-- move. This is a PURE RENAME of the scoping column — the locking/
-- conflict-detection algorithm itself (FOR UPDATE row locks on the reason
-- and on overlapping non-expired appointments, then a COUNT(*) conflict
-- check, then the actual write) is byte-for-byte unchanged from the
-- current live definitions. That's deliberate: this function is the
-- anti-double-booking guarantee for the whole app, and the goal here is
-- confidence that re-scoping it didn't also change its behavior — see
-- tests/integration/booking-concurrency.test.ts for the concurrency
-- regression test this migration must pass before Phase C starts.
--
-- CREATE OR REPLACE FUNCTION cannot rename an existing parameter (Postgres
-- error 42P13 — "cannot change name of input parameter") — only add new
-- ones or change the body, so the old p_client_id-keyed signatures have to
-- be dropped first before recreating under the new parameter names.
DROP FUNCTION IF EXISTS book_appointment(UUID, VARCHAR, VARCHAR, UUID, TIMESTAMP, TEXT, VARCHAR);
DROP FUNCTION IF EXISTS update_appointment(UUID, UUID, VARCHAR, VARCHAR, UUID, TIMESTAMP, TEXT);

CREATE FUNCTION book_appointment(
  p_calendar_id UUID,
  p_visitor_name VARCHAR,
  p_visitor_phone VARCHAR,
  p_reason_id UUID,
  p_start_time TIMESTAMP,
  p_notes TEXT DEFAULT NULL,
  p_visitor_email VARCHAR DEFAULT NULL
) RETURNS TABLE (
  result_status TEXT,
  appointment_id UUID,
  result_start TIMESTAMP,
  result_end TIMESTAMP
) AS $$
DECLARE
  v_duration_min INT;
  v_end_time TIMESTAMP;
  v_conflict_count INT;
  v_new_id UUID;
BEGIN
  -- Validate + lock the reason row.
  SELECT duration_min INTO v_duration_min
  FROM appointment_reasons
  WHERE id = p_reason_id AND calendar_id = p_calendar_id
  FOR UPDATE;

  IF v_duration_min IS NULL THEN
    RAISE EXCEPTION 'Invalid reason_id % for calendar %', p_reason_id, p_calendar_id;
  END IF;

  v_end_time := p_start_time + (v_duration_min || ' minutes')::INTERVAL;

  -- Lock overlapping, non-expired appointments so a concurrent call on the
  -- same slot blocks here instead of racing past the check below.
  PERFORM 1
  FROM appointments
  WHERE calendar_id = p_calendar_id
    AND start_time < v_end_time
    AND end_time > p_start_time
    AND (expires_at IS NULL OR expires_at > NOW())
  FOR UPDATE;

  SELECT COUNT(*) INTO v_conflict_count
  FROM appointments
  WHERE calendar_id = p_calendar_id
    AND start_time < v_end_time
    AND end_time > p_start_time
    AND (expires_at IS NULL OR expires_at > NOW());

  IF v_conflict_count > 0 THEN
    RETURN QUERY SELECT 'conflict'::TEXT, NULL::UUID, NULL::TIMESTAMP, NULL::TIMESTAMP;
    RETURN;
  END IF;

  INSERT INTO appointments (
    calendar_id, visitor_name, visitor_phone, visitor_email, reason_id, start_time, end_time, notes, expires_at
  ) VALUES (
    p_calendar_id, p_visitor_name, p_visitor_phone, p_visitor_email, p_reason_id, p_start_time, v_end_time,
    p_notes, NOW() + INTERVAL '30 days'
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT 'booked'::TEXT, v_new_id, p_start_time, v_end_time;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION update_appointment(
  p_appointment_id UUID,
  p_calendar_id UUID,
  p_visitor_name VARCHAR,
  p_visitor_phone VARCHAR,
  p_reason_id UUID,
  p_start_time TIMESTAMP,
  p_notes TEXT DEFAULT NULL
) RETURNS TABLE (
  result_status TEXT,
  appointment_id UUID,
  result_start TIMESTAMP,
  result_end TIMESTAMP
) AS $$
DECLARE
  v_duration_min INT;
  v_end_time TIMESTAMP;
  v_conflict_count INT;
BEGIN
  SELECT duration_min INTO v_duration_min
  FROM appointment_reasons
  WHERE id = p_reason_id AND calendar_id = p_calendar_id
  FOR UPDATE;

  IF v_duration_min IS NULL THEN
    RAISE EXCEPTION 'Invalid reason_id % for calendar %', p_reason_id, p_calendar_id;
  END IF;

  v_end_time := p_start_time + (v_duration_min || ' minutes')::INTERVAL;

  PERFORM 1
  FROM appointments
  WHERE calendar_id = p_calendar_id
    AND id <> p_appointment_id
    AND start_time < v_end_time
    AND end_time > p_start_time
    AND (expires_at IS NULL OR expires_at > NOW())
  FOR UPDATE;

  SELECT COUNT(*) INTO v_conflict_count
  FROM appointments
  WHERE calendar_id = p_calendar_id
    AND id <> p_appointment_id
    AND start_time < v_end_time
    AND end_time > p_start_time
    AND (expires_at IS NULL OR expires_at > NOW());

  IF v_conflict_count > 0 THEN
    RETURN QUERY SELECT 'conflict'::TEXT, NULL::UUID, NULL::TIMESTAMP, NULL::TIMESTAMP;
    RETURN;
  END IF;

  UPDATE appointments
  SET visitor_name = p_visitor_name,
      visitor_phone = p_visitor_phone,
      reason_id = p_reason_id,
      start_time = p_start_time,
      end_time = v_end_time,
      notes = p_notes,
      status = 'confirmed'
  WHERE id = p_appointment_id AND calendar_id = p_calendar_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment % not found for calendar %', p_appointment_id, p_calendar_id;
  END IF;

  RETURN QUERY SELECT 'updated'::TEXT, p_appointment_id, p_start_time, v_end_time;
END;
$$ LANGUAGE plpgsql;
