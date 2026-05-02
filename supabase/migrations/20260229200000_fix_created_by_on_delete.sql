-- Fix: created_by FK without ON DELETE behavior
-- QA Fix FIX-E27-003: Add ON DELETE SET NULL to prevent FK errors when users are deleted

BEGIN;
-- job_roles.created_by → SET NULL
ALTER TABLE job_roles ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE job_roles DROP CONSTRAINT IF EXISTS job_roles_created_by_fkey;
ALTER TABLE job_roles
  ADD CONSTRAINT job_roles_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
-- learning_trails.created_by → SET NULL
ALTER TABLE learning_trails ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE learning_trails DROP CONSTRAINT IF EXISTS learning_trails_created_by_fkey;
ALTER TABLE learning_trails
  ADD CONSTRAINT learning_trails_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
COMMIT;
