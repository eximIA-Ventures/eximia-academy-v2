-- Add interaction_config JSONB column to chapters
-- Stores scenario, assignment, and other interaction-specific config
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS interaction_config JSONB DEFAULT '{}'::jsonb;
