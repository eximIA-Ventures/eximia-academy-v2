-- Migration: Add type column to courses table
-- Backward compatible: all existing courses get 'regular' by default

ALTER TABLE courses ADD COLUMN type TEXT NOT NULL DEFAULT 'regular'
  CHECK (type IN ('regular', 'onboarding'));
-- Unique partial index: max 1 active onboarding per tenant
CREATE UNIQUE INDEX courses_unique_onboarding_per_tenant
  ON courses (tenant_id)
  WHERE type = 'onboarding' AND status = 'published';
