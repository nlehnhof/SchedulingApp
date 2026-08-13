-- Conflict-checked appointment edit, for the dashboard's "Edit" action on an
-- appointment. Mirrors book_appointment (0002) — same locking approach, but
-- excludes the row being edited from its own conflict check, and always
-- resets status back to 'confirmed' (editing is how a client resolves a
-- red_flag: move it off the Google Calendar block, or just re-save it).

CREATE OR REPLACE FUNCTION update_appointment(
  p_appointment_id UUID,
  p_client_id UUID,
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
  WHERE id = p_reason_id AND client_id = p_client_id
  FOR UPDATE;

  IF v_duration_min IS NULL THEN
    RAISE EXCEPTION 'Invalid reason_id % for client %', p_reason_id, p_client_id;
  END IF;

  v_end_time := p_start_time + (v_duration_min || ' minutes')::INTERVAL;

  PERFORM 1
  FROM appointments
  WHERE client_id = p_client_id
    AND id <> p_appointment_id
    AND start_time < v_end_time
    AND end_time > p_start_time
    AND (expires_at IS NULL OR expires_at > NOW())
  FOR UPDATE;

  SELECT COUNT(*) INTO v_conflict_count
  FROM appointments
  WHERE client_id = p_client_id
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
  WHERE id = p_appointment_id AND client_id = p_client_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment % not found for client %', p_appointment_id, p_client_id;
  END IF;

  RETURN QUERY SELECT 'updated'::TEXT, p_appointment_id, p_start_time, v_end_time;
END;
$$ LANGUAGE plpgsql;
