-- Story 17.2: Session Analytics e Learner Profiles
-- Epic 17 — Shadow Analysis Pipeline

-- =============================================================
-- 1. Add analytics JSONB to sessions
-- =============================================================
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS analytics JSONB DEFAULT '{}';

-- =============================================================
-- 2. Create learner_profiles table
-- =============================================================
CREATE TABLE IF NOT EXISTS learner_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  engagement_style TEXT,
  detail_orientation TEXT,
  reasoning_style TEXT,
  avg_depth_achieved NUMERIC(3,1),
  avg_qa_score NUMERIC(3,2),
  confidence NUMERIC(3,2),
  kolb_grasping_axis NUMERIC(4,2),
  kolb_transforming_axis NUMERIC(4,2),
  kolb_dominant_style TEXT,
  kolb_style_confidence NUMERIC(3,2),
  strengths TEXT[] DEFAULT '{}',
  growth_areas TEXT[] DEFAULT '{}',
  adaptation_hints TEXT[] DEFAULT '{}',
  preferred_question_types TEXT[] DEFAULT '{}',
  comprehension_trend TEXT,
  summary TEXT,
  session_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, tenant_id)
);

-- =============================================================
-- 3. Index for lookups
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_learner_profiles_student_tenant
  ON learner_profiles(student_id, tenant_id);

-- =============================================================
-- 4. RLS
-- =============================================================
ALTER TABLE learner_profiles ENABLE ROW LEVEL SECURITY;

-- Managers/admins can read profiles in their tenant
CREATE POLICY "lp_select_manager" ON learner_profiles FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager', 'admin'));

-- Students can read their own profile
CREATE POLICY "lp_select_own" ON learner_profiles FOR SELECT
  USING (tenant_id = auth_tenant_id() AND student_id = auth.uid());
