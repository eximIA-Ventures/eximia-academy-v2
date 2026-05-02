-- Epic 6 R-1: Fix NULL safety in session turn functions
-- After LGPD anonymization, sessions.student_id can be NULL.
-- Replace != with IS DISTINCT FROM to correctly handle NULL comparisons.

CREATE OR REPLACE FUNCTION claim_session_turn(
  p_session_id UUID,
  p_user_id UUID
) RETURNS TABLE (
  session_id UUID,
  chapter_id UUID,
  question_id UUID,
  tenant_id UUID,
  interactions_remaining INTEGER,
  turn_number INTEGER
) AS $$
DECLARE
  v_session RECORD;
  v_user_tenant UUID;
BEGIN
  SELECT u.tenant_id INTO v_user_tenant FROM users u WHERE u.id = p_user_id;

  SELECT s.* INTO v_session
  FROM sessions s
  WHERE s.id = p_session_id
  FOR UPDATE;

  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF v_session.student_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Session does not belong to user';
  END IF;

  IF v_session.status != 'active' THEN
    RAISE EXCEPTION 'Session is not active';
  END IF;

  IF v_session.tenant_id != v_user_tenant THEN
    RAISE EXCEPTION 'Cross-tenant access denied';
  END IF;

  IF v_session.interactions_remaining <= 0 THEN
    RAISE EXCEPTION 'No interactions remaining';
  END IF;

  UPDATE sessions s SET
    interactions_remaining = s.interactions_remaining - 1,
    turn_number = s.turn_number + 1,
    updated_at = now()
  WHERE s.id = p_session_id;

  RETURN QUERY
  SELECT
    v_session.id,
    v_session.chapter_id,
    v_session.question_id,
    v_session.tenant_id,
    v_session.interactions_remaining - 1,
    v_session.turn_number + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION release_session_turn(
  p_session_id UUID,
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_session RECORD;
  v_user_tenant UUID;
BEGIN
  SELECT u.tenant_id INTO v_user_tenant FROM users u WHERE u.id = p_user_id;

  SELECT s.* INTO v_session
  FROM sessions s
  WHERE s.id = p_session_id
  FOR UPDATE;

  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF v_session.student_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Session does not belong to user';
  END IF;

  IF v_session.tenant_id != v_user_tenant THEN
    RAISE EXCEPTION 'Cross-tenant access denied';
  END IF;

  UPDATE sessions s SET
    interactions_remaining = s.interactions_remaining + 1,
    turn_number = GREATEST(s.turn_number - 1, 0),
    updated_at = now()
  WHERE s.id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
