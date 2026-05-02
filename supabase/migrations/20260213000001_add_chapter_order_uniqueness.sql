-- Migration: Add unique constraint on chapter ordering
-- Date: 2026-02-13
-- Purpose: Prevent race condition where concurrent approvals could assign same order to different chapters
-- Fixes QA issue REL-001: Race condition on chapter order

-- Add unique constraint to ensure each course has unique chapter ordering
ALTER TABLE chapters
ADD CONSTRAINT chapters_course_order_unique UNIQUE (course_id, "order");
-- Create index for optimal query performance on order calculation
CREATE INDEX IF NOT EXISTS idx_chapters_course_order
ON chapters(course_id, "order" DESC);
-- Comment for documentation
COMMENT ON CONSTRAINT chapters_course_order_unique ON chapters IS
'Ensures atomic ordering within a course — prevents duplicate order values from concurrent ingestion approvals';
