-- Migration: Extend questions table for quiz scoring (Story 26.4)
-- Adds question_type, correct_answer, explanation, and options fields
-- needed by the Quiz & Assessment Engine (Epic 26)

-- Add question_type: determines how the question is rendered and scored
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS question_type TEXT NOT NULL DEFAULT 'open_ended'
    CHECK (question_type IN ('multiple_choice', 'true_false', 'open_ended'));
-- Add correct_answer: the expected answer for auto-scoring
-- For multiple_choice: the label/text of the correct option (e.g., "option_a")
-- For true_false: "true" or "false"
-- For open_ended: NULL (manual review)
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS correct_answer TEXT;
-- Add explanation: shown to students after quiz submission
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS explanation TEXT;
-- Add options: JSONB array of answer choices for multiple_choice questions
-- Format: ["Option A text", "Option B text", "Option C text", "Option D text"]
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS options JSONB;
-- Index for filtering questions by type
CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(question_type);
