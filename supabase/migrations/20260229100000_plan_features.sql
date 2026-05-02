-- Epic 28: Feature Enforcement & Plan Gating
-- Story 28.1: DB Migration — Plan Features

BEGIN;
-- ============================================================
-- 1. plan_features lookup table (global, no tenant_id)
-- ============================================================
CREATE TABLE plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan TEXT NOT NULL CHECK (plan IN ('essencial', 'standard', 'premium')),
  feature_key TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  quota INTEGER, -- NULL = unlimited
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plan, feature_key)
);
ALTER TABLE plan_features ENABLE ROW LEVEL SECURITY;
-- Super admin full CRUD
CREATE POLICY "pf_super_admin_all" ON plan_features FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());
-- Authenticated users can read plan features (public lookup table)
CREATE POLICY "pf_authenticated_select" ON plan_features FOR SELECT
  TO authenticated
  USING (true);
-- ============================================================
-- 2. Seed data: 3 plans x 7 features = 21 rows
-- ============================================================

-- Essencial plan
INSERT INTO plan_features (plan, feature_key, is_enabled, quota) VALUES
  ('essencial', 'courses', true, 5),
  ('essencial', 'course_designer', false, NULL),
  ('essencial', 'quizzes', true, 10),
  ('essencial', 'trails', false, NULL),
  ('essencial', 'assessments', false, NULL),
  ('essencial', 'webhooks', false, NULL),
  ('essencial', 'api_access', false, NULL),
  ('standard', 'courses', true, 50),
  ('standard', 'course_designer', true, NULL),
  ('standard', 'quizzes', true, NULL),
  ('standard', 'trails', true, 10),
  ('standard', 'assessments', true, NULL),
  ('standard', 'webhooks', true, 5),
  ('standard', 'api_access', true, NULL),
  ('premium', 'courses', true, NULL),
  ('premium', 'course_designer', true, NULL),
  ('premium', 'quizzes', true, NULL),
  ('premium', 'trails', true, NULL),
  ('premium', 'assessments', true, NULL),
  ('premium', 'webhooks', true, NULL),
  ('premium', 'api_access', true, NULL)
ON CONFLICT (plan, feature_key) DO NOTHING;
COMMIT;
