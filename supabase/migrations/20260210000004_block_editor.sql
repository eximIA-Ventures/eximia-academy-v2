-- =============================================================
-- Block Editor: Add JSONB content_blocks column to chapters
-- Stores Plate.js editor JSON alongside markdown fallback
-- =============================================================

ALTER TABLE chapters ADD COLUMN content_blocks JSONB;
