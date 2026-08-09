-- Remove test video URLs from chapters
-- These were added during development/testing and should not be visible to students
-- Only clears video_url on Cory Alimentos tenant chapters
UPDATE chapters
SET video_url = NULL, updated_at = now()
WHERE video_url IS NOT NULL
  AND tenant_id = 'a9d56b85-ee0e-4295-8db2-5fbcb3fd7a32';

COMMENT ON TABLE chapters IS 'Test video URLs cleaned on 2026-05-17';
