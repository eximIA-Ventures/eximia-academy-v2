-- Make question_id nullable on sessions table
-- Needed for manual chapter completion (markChapterComplete) when chapters
-- have no active questions (e.g., slide-only or content-only chapters)
ALTER TABLE sessions ALTER COLUMN question_id DROP NOT NULL;
