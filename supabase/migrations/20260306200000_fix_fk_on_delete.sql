-- Fix missing ON DELETE behavior for FK constraints
-- question_generation_jobs.triggered_by and blueprint_generation_jobs.requested_by
-- would block user deletion without this fix

BEGIN;
-- Fix question_generation_jobs.triggered_by
ALTER TABLE question_generation_jobs
  DROP CONSTRAINT IF EXISTS question_generation_jobs_triggered_by_fkey;
ALTER TABLE question_generation_jobs
  ADD CONSTRAINT question_generation_jobs_triggered_by_fkey
  FOREIGN KEY (triggered_by) REFERENCES users(id) ON DELETE SET NULL;
-- Fix blueprint_generation_jobs.requested_by
ALTER TABLE blueprint_generation_jobs
  DROP CONSTRAINT IF EXISTS blueprint_generation_jobs_requested_by_fkey;
ALTER TABLE blueprint_generation_jobs
  ADD CONSTRAINT blueprint_generation_jobs_requested_by_fkey
  FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL;
COMMIT;
