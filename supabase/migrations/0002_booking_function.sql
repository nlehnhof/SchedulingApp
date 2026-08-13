-- Transactional booking function: "first access wins".
--
-- Postgres functions execute inside an implicit transaction. The FOR UPDATE
-- lock on any overlapping, non-expired appointment rows serializes concurrent
-- calls that target overlapping slots — the second caller blocks until the
-- first commits, then re-reads and correctly sees the conflict. This closes
-- the check-then-insert race that a plain SELECT + INSERT would have.
--
-- The UNIQUE(client_id, start_time, end_time) constraint on `appointments`
-- (see 0001_init.sql) is a second line of defense for exact-slot collisions.

CREATE OR REPLACE FUNCTION book_appointment(
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
  v_new_id UUID;
BEGIN
  -- Validate + lock the reason row.
  SELECT duration_min INTO v_duration_min
  FROM appointment_reasons
  WHERE id = p_reason_id AND client_id = p_client_id
  FOR UPDATE;

  IF v_duration_min IS NULL THEN
    RAISE EXCEPTION 'Invalid reason_id % for client %', p_reason_id, p_client_id;
  END IF;

  v_end_time := p_start_time + (v_duration_min || ' minutes')::INTERVAL;

  -- Lock overlapping, non-expired appointments so a concurrent call on the
  -- same slot blocks here instead of racing past the check below.
  PERFORM 1
  FROM appointments
  WHERE client_id = p_client_id
    AND start_time < v_end_time
    AND end_time > p_start_time
    AND (expires_at IS NULL OR expires_at > NOW())
  FOR UPDATE;

  SELECT COUNT(*) INTO v_conflict_count
  FROM appointments
  WHERE client_id = p_client_id
    AND start_time < v_end_time
    AND end_time > p_start_time
    AND (expires_at IS NULL OR expires_at > NOW());

  IF v_conflict_count > 0 THEN
    RETURN QUERY SELECT 'conflict'::TEXT, NULL::UUID, NULL::TIMESTAMP, NULL::TIMESTAMP;
    RETURN;
  END IF;

  INSERT INTO appointments (
    client_id, visitor_name, visitor_phone, reason_id, start_time, end_time, notes, expires_at
  ) VALUES (
    p_client_id, p_visitor_name, p_visitor_phone, p_reason_id, p_start_time, v_end_time,
    p_notes, NOW() + INTERVAL '30 days'
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT 'booked'::TEXT, v_new_id, p_start_time, v_end_time;
END;
$$ LANGUAGE plpgsql;
