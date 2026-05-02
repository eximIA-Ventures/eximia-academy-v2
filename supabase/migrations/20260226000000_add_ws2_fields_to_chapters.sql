-- Epic 23, Story 23.3: Add WS2 optional fields to chapters for WS1 integration (D13)
-- These fields are nullable for backward compatibility — WS1 works without them.

ALTER TABLE chapters
  ADD COLUMN IF NOT EXISTS interaction_type text
    CHECK (interaction_type IN ('socratic_dialogue', 'quiz', 'scenario', 'assignment')),
  ADD COLUMN IF NOT EXISTS bloom_target text
    CHECK (bloom_target IN ('remembering', 'understanding', 'applying', 'analyzing', 'evaluating', 'creating'));
COMMENT ON COLUMN chapters.interaction_type IS 'WS2: Interaction type from blueprint module. NULL = default (socratic_dialogue)';
COMMENT ON COLUMN chapters.bloom_target IS 'WS2: Bloom taxonomy target level. NULL = use default depth';
