-- =============================================================
-- Add PPTX to content_ingestions source_type CHECK constraint
-- =============================================================

ALTER TABLE content_ingestions
  DROP CONSTRAINT content_ingestions_source_type_check;

ALTER TABLE content_ingestions
  ADD CONSTRAINT content_ingestions_source_type_check
    CHECK (source_type IN ('pdf', 'docx', 'pptx', 'txt', 'audio', 'video_url', 'paste'));
