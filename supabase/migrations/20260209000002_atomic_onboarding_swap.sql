-- Atomic swap for onboarding courses
-- Ensures demote + publish happen in a single transaction
CREATE OR REPLACE FUNCTION swap_onboarding_course(
  p_new_course_id UUID,
  p_tenant_id UUID
) RETURNS VOID AS $$
BEGIN
  -- Demote existing onboarding course(s) to regular
  UPDATE courses
  SET type = 'regular', updated_at = NOW()
  WHERE tenant_id = p_tenant_id
    AND type = 'onboarding'
    AND status = 'published'
    AND id != p_new_course_id;

  -- Publish new course
  UPDATE courses
  SET status = 'published', updated_at = NOW()
  WHERE id = p_new_course_id
    AND tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
