-- Epic 14: Add "pending" status to questions table
-- Required for AI-generated questions that need manager review before becoming active

-- Drop existing constraint and recreate with "pending" included
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_status_check;
ALTER TABLE questions ADD CONSTRAINT questions_status_check
  CHECK (status IN ('draft', 'pending', 'active', 'archived'));
