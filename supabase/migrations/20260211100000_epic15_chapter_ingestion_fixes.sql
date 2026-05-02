-- =============================================================
-- Epic 15: Chapter Ingestion Fixes
-- Adds created_by, key_concepts, estimated_reading_time_min
-- =============================================================

-- 1. Add created_by (nullable for backward compatibility)
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- 2. Add AI metadata columns
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS key_concepts TEXT[];
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS estimated_reading_time_min INTEGER;

-- 3. Backfill created_by from course creator for existing chapters
UPDATE chapters c
SET created_by = co.created_by
FROM courses co
WHERE c.course_id = co.id
AND c.created_by IS NULL;
