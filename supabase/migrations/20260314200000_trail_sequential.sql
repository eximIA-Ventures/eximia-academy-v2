-- Add is_sequential flag to learning_trails
-- When true, students must complete courses in order
ALTER TABLE learning_trails ADD COLUMN IF NOT EXISTS is_sequential BOOLEAN NOT NULL DEFAULT false;
