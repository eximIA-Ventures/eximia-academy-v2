-- Migration: Rename tenant plan values (free/pro/enterprise → essencial/standard/premium)
-- Story 16.5 — Tenant Plan alignment with Model Router pricing tiers

-- 1. Drop old constraint first (allows any value during transition)
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_plan_check;
-- 2. Map existing plan values to new naming
UPDATE tenants SET plan = CASE
  WHEN plan = 'free' THEN 'essencial'
  WHEN plan = 'pro' THEN 'standard'
  WHEN plan = 'enterprise' THEN 'premium'
  WHEN plan IN ('essencial', 'standard', 'premium') THEN plan
  ELSE 'standard'
END;
-- 3. Set NOT NULL and default
ALTER TABLE tenants ALTER COLUMN plan SET NOT NULL;
ALTER TABLE tenants ALTER COLUMN plan SET DEFAULT 'standard';
-- 4. Add new constraint with allowed values
ALTER TABLE tenants ADD CONSTRAINT tenants_plan_check
  CHECK (plan IN ('essencial', 'standard', 'premium'));
