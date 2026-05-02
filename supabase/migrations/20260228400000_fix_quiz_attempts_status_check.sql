-- FIX-26.1-001: Expand quiz_attempts.status CHECK constraint
-- The scoring engine writes 'passed', 'failed', 'pending_review' statuses
-- but the original constraint only allowed 'in_progress', 'completed', 'timed_out', 'abandoned'

BEGIN;

ALTER TABLE quiz_attempts DROP CONSTRAINT IF EXISTS quiz_attempts_status_check;

ALTER TABLE quiz_attempts ADD CONSTRAINT quiz_attempts_status_check
  CHECK (status IN ('in_progress', 'completed', 'timed_out', 'abandoned', 'passed', 'failed', 'pending_review'));

COMMIT;
