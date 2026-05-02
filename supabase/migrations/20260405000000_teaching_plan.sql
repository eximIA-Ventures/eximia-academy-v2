-- Teaching Plan: deadline_days on courses, estimated_duration_minutes on chapters

-- Course: number of days student has to complete after enrollment
ALTER TABLE courses ADD COLUMN IF NOT EXISTS deadline_days INTEGER;

-- Chapter: estimated duration in minutes (instructor sets)
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER;

-- Index for efficient enrollment deadline queries
CREATE INDEX IF NOT EXISTS idx_enrollments_deadline_lookup
  ON enrollments (tenant_id, status, course_id, created_at);

COMMENT ON COLUMN courses.deadline_days IS 'Number of days from enrollment to expected completion. NULL = no deadline.';
COMMENT ON COLUMN chapters.estimated_duration_minutes IS 'Estimated time to complete chapter in minutes. NULL = auto-estimate from content.';
