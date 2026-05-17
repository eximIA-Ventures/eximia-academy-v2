-- Extend questions to support multiple-choice format
ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_type TEXT NOT NULL DEFAULT 'open_ended'
  CHECK (question_type IN ('open_ended', 'multiple_choice'));

-- Multiple-choice options (when question_type = 'multiple_choice')
ALTER TABLE questions ADD COLUMN IF NOT EXISTS options JSONB;
-- Format: [{"id": "a", "text": "Option A"}, {"id": "b", "text": "Option B"}, ...]

ALTER TABLE questions ADD COLUMN IF NOT EXISTS correct_option_id TEXT;
-- For multiple_choice: the id of the correct option

-- Index for filtering by type
CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(question_type);

COMMENT ON COLUMN questions.question_type IS 'open_ended = AI-evaluated free text, multiple_choice = auto-graded with correct_option_id';
COMMENT ON COLUMN questions.options IS 'JSON array of {id, text} objects for MC questions. null for open_ended.';
COMMENT ON COLUMN questions.correct_option_id IS 'The option.id that is correct. null for open_ended questions.';
