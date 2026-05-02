-- Associate enrollments with units (areas) for scoped reporting
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES areas(id) ON DELETE SET NULL;

-- Index for efficient unit-scoped queries
CREATE INDEX IF NOT EXISTS idx_enrollments_area ON enrollments (area_id) WHERE area_id IS NOT NULL;

-- Auto-populate area_id from the student's primary area on enrollment
CREATE OR REPLACE FUNCTION set_enrollment_area() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.area_id IS NULL THEN
    SELECT ua.area_id INTO NEW.area_id
    FROM user_areas ua
    WHERE ua.user_id = NEW.student_id
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enrollment_area ON enrollments;
CREATE TRIGGER trg_enrollment_area
  BEFORE INSERT ON enrollments
  FOR EACH ROW
  EXECUTE FUNCTION set_enrollment_area();

-- Add CHECK constraints for teaching plan fields
ALTER TABLE courses ADD CONSTRAINT chk_deadline_days CHECK (deadline_days IS NULL OR deadline_days > 0);
ALTER TABLE chapters ADD CONSTRAINT chk_estimated_duration CHECK (estimated_duration_minutes IS NULL OR estimated_duration_minutes > 0);

COMMENT ON COLUMN enrollments.area_id IS 'Unit/area the student belongs to at enrollment time. Auto-populated from user_areas.';
