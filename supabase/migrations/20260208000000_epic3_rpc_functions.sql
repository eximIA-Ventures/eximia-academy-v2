-- =============================================================
-- exímIA Academy — Epic 3: Socratic Learning Engine RPCs
-- Stories 3.1, 3.4, 3.5 dependencies
-- =============================================================

-- 1. Add missing columns to sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
-- 2. Add missing columns to qa_reports and analyses
ALTER TABLE qa_reports ADD COLUMN IF NOT EXISTS recommendation TEXT;
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS observations JSONB DEFAULT '[]';
-- 3. get_random_active_question(p_chapter_id)
-- Returns one random active question for a chapter
-- PostgREST does not support ORDER BY random(), so we use RPC
CREATE OR REPLACE FUNCTION get_random_active_question(p_chapter_id UUID)
RETURNS TABLE (
  id UUID,
  text TEXT,
  skill TEXT,
  intention TEXT,
  expected_depth TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT q.id, q.text, q.skill, q.intention, q.expected_depth
  FROM questions q
  WHERE q.chapter_id = p_chapter_id
    AND q.status = 'active'
  ORDER BY random()
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 4. Update claim_session_turn to auto-complete session
-- When interactions_remaining reaches 0, set status = 'completed' and completed_at
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
  v_new_remaining INTEGER;
  v_new_turn INTEGER;
BEGIN
  -- Get user's tenant
  SELECT u.tenant_id INTO v_user_tenant FROM users u WHERE u.id = p_user_id;

  -- Lock and validate session
  SELECT s.* INTO v_session
  FROM sessions s
  WHERE s.id = p_session_id
  FOR UPDATE;

  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF v_session.student_id != p_user_id THEN
    RAISE EXCEPTION 'Session does not belong to user';
  END IF;

  IF v_session.status != 'active' THEN
    RAISE EXCEPTION 'Session is not active';
  END IF;

  -- SEC-5: Cross-tenant check
  IF v_session.tenant_id != v_user_tenant THEN
    RAISE EXCEPTION 'Cross-tenant access denied';
  END IF;

  IF v_session.interactions_remaining <= 0 THEN
    RAISE EXCEPTION 'No interactions remaining';
  END IF;

  v_new_remaining := v_session.interactions_remaining - 1;
  v_new_turn := v_session.turn_number + 1;

  -- Atomic decrement + auto-complete
  IF v_new_remaining = 0 THEN
    UPDATE sessions s SET
      interactions_remaining = v_new_remaining,
      turn_number = v_new_turn,
      status = 'completed',
      completed_at = now(),
      updated_at = now()
    WHERE s.id = p_session_id;
  ELSE
    UPDATE sessions s SET
      interactions_remaining = v_new_remaining,
      turn_number = v_new_turn,
      updated_at = now()
    WHERE s.id = p_session_id;
  END IF;

  RETURN QUERY
  SELECT
    v_session.id,
    v_session.chapter_id,
    v_session.question_id,
    v_session.tenant_id,
    v_new_remaining,
    v_new_turn;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 5. update_enrollment_progress(p_student_id, p_course_id)
-- SECURITY DEFINER: calculates progress atomically
-- Progress = (chapters with completed session) / (total published chapters) * 100
CREATE OR REPLACE FUNCTION update_enrollment_progress(
  p_student_id UUID,
  p_course_id UUID
) RETURNS TABLE (
  enrollment_id UUID,
  new_progress INTEGER,
  new_status TEXT
) AS $$
DECLARE
  v_enrollment RECORD;
  v_total_chapters INTEGER;
  v_completed_chapters INTEGER;
  v_progress INTEGER;
  v_status TEXT;
  v_user_tenant UUID;
BEGIN
  -- Get user tenant
  SELECT u.tenant_id INTO v_user_tenant FROM users u WHERE u.id = p_student_id;

  -- Get enrollment
  SELECT e.* INTO v_enrollment
  FROM enrollments e
  WHERE e.student_id = p_student_id
    AND e.course_id = p_course_id
    AND e.tenant_id = v_user_tenant
  FOR UPDATE;

  IF v_enrollment IS NULL THEN
    RAISE EXCEPTION 'Enrollment not found';
  END IF;

  -- Count total published chapters
  SELECT COUNT(*) INTO v_total_chapters
  FROM chapters c
  WHERE c.course_id = p_course_id
    AND c.status = 'published';

  IF v_total_chapters = 0 THEN
    v_progress := 0;
  ELSE
    -- Count chapters with at least one completed session
    SELECT COUNT(DISTINCT s.chapter_id) INTO v_completed_chapters
    FROM sessions s
    JOIN chapters c ON c.id = s.chapter_id
    WHERE s.student_id = p_student_id
      AND c.course_id = p_course_id
      AND s.status = 'completed';

    v_progress := ROUND((v_completed_chapters::NUMERIC / v_total_chapters) * 100);
  END IF;

  -- Determine status
  IF v_progress >= 100 THEN
    v_status := 'completed';
  ELSE
    v_status := 'active';
  END IF;

  -- Update enrollment
  UPDATE enrollments e SET
    progress = jsonb_build_object('percentage', v_progress, 'completed_chapters', v_completed_chapters, 'total_chapters', v_total_chapters),
    status = v_status,
    updated_at = now()
  WHERE e.id = v_enrollment.id;

  RETURN QUERY SELECT v_enrollment.id, v_progress, v_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
