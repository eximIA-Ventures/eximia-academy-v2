-- WS2 Course Creator: Extend blueprint tables + Create blueprint_modules
-- Story 21.1 — Epic 21

-- ============================================================
-- SECTION 1: ALTER course_blueprints (AC1)
-- ============================================================

-- 1a. Drop NOT NULL on course_id (WS2 creates blueprint before course)
ALTER TABLE course_blueprints ALTER COLUMN course_id DROP NOT NULL;
-- 1b. Extend status CHECK to include 'generating'
-- PostgreSQL auto-names constraint as course_blueprints_status_check
ALTER TABLE course_blueprints DROP CONSTRAINT IF EXISTS course_blueprints_status_check;
ALTER TABLE course_blueprints ADD CONSTRAINT course_blueprints_status_check
  CHECK (status IN ('generating', 'draft', 'approved', 'applied', 'archived'));
-- 1c. Add WS2 columns (all nullable for backward compatibility)
ALTER TABLE course_blueprints
  ADD COLUMN IF NOT EXISTS primary_framework TEXT,
  ADD COLUMN IF NOT EXISTS complementary_frameworks TEXT[],
  ADD COLUMN IF NOT EXISTS quality_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS neuroscience_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS quality_verdict TEXT,
  ADD COLUMN IF NOT EXISTS audience_profile JSONB,
  ADD COLUMN IF NOT EXISTS evaluation_plan JSONB,
  ADD COLUMN IF NOT EXISTS interaction_strategy TEXT DEFAULT 'bloom_mapped',
  ADD COLUMN IF NOT EXISTS source_course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version TEXT DEFAULT '3.0';
-- 1d. quality_verdict CHECK
ALTER TABLE course_blueprints ADD CONSTRAINT course_blueprints_quality_verdict_check
  CHECK (quality_verdict IS NULL OR quality_verdict IN ('approved', 'needs_review', 'rejected'));
-- ============================================================
-- SECTION 2: CREATE blueprint_modules (AC2)
-- ============================================================

CREATE TABLE IF NOT EXISTS blueprint_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES course_blueprints(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  "order" INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  spiral_level INTEGER,
  interaction_type TEXT CHECK (interaction_type IS NULL OR interaction_type IN (
    'socratic_dialogue', 'guided_practice', 'case_study',
    'problem_based', 'collaborative', 'self_directed'
  )),
  framework_stages JSONB NOT NULL DEFAULT '[]',
  problema_motor JSONB,
  cognitive_load JSONB,
  chunks JSONB,
  rubrics JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- Unique constraint: one order per blueprint
ALTER TABLE blueprint_modules
  ADD CONSTRAINT uq_blueprint_modules_blueprint_order UNIQUE (blueprint_id, "order");
-- Indexes
CREATE INDEX IF NOT EXISTS idx_blueprint_modules_blueprint_id ON blueprint_modules(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_blueprint_modules_tenant_id ON blueprint_modules(tenant_id);
-- ============================================================
-- SECTION 3: ALTER blueprint_generation_jobs (AC3)
-- ============================================================

-- 3a. Extend status CHECK to include 'pending' (keep 'queued' for WS1 backward compat)
ALTER TABLE blueprint_generation_jobs DROP CONSTRAINT IF EXISTS blueprint_generation_jobs_status_check;
ALTER TABLE blueprint_generation_jobs ADD CONSTRAINT blueprint_generation_jobs_status_check
  CHECK (status IN ('pending', 'queued', 'processing', 'completed', 'failed'));
-- 3b. Add WS2 columns
ALTER TABLE blueprint_generation_jobs
  ADD COLUMN IF NOT EXISTS current_phase INTEGER,
  ADD COLUMN IF NOT EXISTS phase_results JSONB DEFAULT '{}';
-- 3c. Drop NOT NULL on course_id (WS2 creates job before course)
ALTER TABLE blueprint_generation_jobs ALTER COLUMN course_id DROP NOT NULL;
-- ============================================================
-- SECTION 4: ALTER blueprint_objectives (AC4)
-- ============================================================

ALTER TABLE blueprint_objectives
  ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES blueprint_modules(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS abcd JSONB;
-- Index for module lookups
CREATE INDEX IF NOT EXISTS idx_blueprint_objectives_module_id ON blueprint_objectives(module_id);
-- ============================================================
-- SECTION 5: ALTER blueprint_assessments (AC5)
-- ============================================================

ALTER TABLE blueprint_assessments
  ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES blueprint_modules(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS kirkpatrick_level INTEGER,
  ADD COLUMN IF NOT EXISTS rubrics JSONB;
-- Index for module lookups
CREATE INDEX IF NOT EXISTS idx_blueprint_assessments_module_id ON blueprint_assessments(module_id);
-- ============================================================
-- SECTION 6: RLS for blueprint_modules
-- ============================================================

ALTER TABLE blueprint_modules ENABLE ROW LEVEL SECURITY;
-- Manager/Admin: SELECT
CREATE POLICY "bp_modules_select" ON blueprint_modules FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager', 'admin'));
-- Manager/Admin: INSERT
CREATE POLICY "bp_modules_insert" ON blueprint_modules FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager', 'admin'));
-- Manager/Admin: UPDATE
CREATE POLICY "bp_modules_update" ON blueprint_modules FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager', 'admin'));
-- Admin only: DELETE
CREATE POLICY "bp_modules_delete" ON blueprint_modules FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin');
-- Super Admin: full access
CREATE POLICY "bp_modules_super_admin" ON blueprint_modules FOR ALL
  USING (auth_user_role() = 'super_admin');
