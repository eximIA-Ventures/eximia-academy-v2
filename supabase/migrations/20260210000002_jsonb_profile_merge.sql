-- Atomic JSONB profile merge function to prevent read-modify-write race conditions
-- Used by saveAssessmentResult, saveAssessmentProgress, generateLearningRecommendations
CREATE OR REPLACE FUNCTION jsonb_profile_merge(
  p_user_id UUID,
  p_set_key TEXT,
  p_set_value TEXT,
  p_remove_key TEXT DEFAULT ''
) RETURNS VOID AS $$
BEGIN
  IF p_remove_key != '' THEN
    UPDATE users
    SET profile = (COALESCE(profile, '{}'::jsonb) || jsonb_build_object(p_set_key, p_set_value::jsonb)) - p_remove_key,
        updated_at = now()
    WHERE id = p_user_id;
  ELSE
    UPDATE users
    SET profile = COALESCE(profile, '{}'::jsonb) || jsonb_build_object(p_set_key, p_set_value::jsonb),
        updated_at = now()
    WHERE id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
