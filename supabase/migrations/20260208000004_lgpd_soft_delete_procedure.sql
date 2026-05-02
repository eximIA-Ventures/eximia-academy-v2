-- Epic 6 R-3: Atomic LGPD soft delete via stored procedure
-- Executes all anonymization steps in a single transaction for data consistency.

CREATE OR REPLACE FUNCTION lgpd_soft_delete_user(p_user_id UUID)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
BEGIN
  -- 1. Anonymize sessions — set student_id to NULL
  UPDATE sessions SET student_id = NULL WHERE student_id = p_user_id;

  -- 2. Soft delete enrollments
  UPDATE enrollments SET deleted_at = v_now WHERE student_id = p_user_id AND deleted_at IS NULL;

  -- 3. Soft delete user
  UPDATE users SET deleted_at = v_now WHERE id = p_user_id AND deleted_at IS NULL;

  RETURN v_now;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
