-- Blueprint Generation Tables
-- For exímIA Academy - FASE 2 Integration

-- 1. Course Blueprints - Store generated blueprints
CREATE TABLE IF NOT EXISTS course_blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  blueprint_data JSONB NOT NULL,
  framework TEXT NOT NULL,
  total_objectives INTEGER NOT NULL,
  total_assessments INTEGER NOT NULL,
  bloom_progression TEXT[],
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'applied', 'archived')),
  generated_at TIMESTAMPTZ DEFAULT now(),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  applied_to_course BOOLEAN DEFAULT false,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Blueprint Objectives - Denormalized objectives for quick queries
CREATE TABLE IF NOT EXISTS blueprint_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES course_blueprints(id) ON DELETE CASCADE,
  objective_id TEXT NOT NULL,
  module_number INTEGER NOT NULL,
  bloom_level TEXT NOT NULL,
  behavior TEXT NOT NULL,
  condition TEXT NOT NULL,
  degree TEXT NOT NULL,
  objective_statement TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Blueprint Assessments - Denormalized assessments for quick queries
CREATE TABLE IF NOT EXISTS blueprint_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES course_blueprints(id) ON DELETE CASCADE,
  objective_id TEXT NOT NULL,
  assessment_type TEXT NOT NULL,
  timing TEXT NOT NULL,
  format TEXT,
  rubric_required BOOLEAN DEFAULT false,
  estimated_duration_min INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Blueprint Generation Jobs - Track async generation jobs
CREATE TABLE IF NOT EXISTS blueprint_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  progress JSONB DEFAULT '{}',
  blueprint_id UUID REFERENCES course_blueprints(id) ON DELETE SET NULL,
  error_message TEXT,
  requested_by UUID NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_course_blueprints_course_id ON course_blueprints(course_id);
CREATE INDEX idx_course_blueprints_tenant_id ON course_blueprints(tenant_id);
CREATE INDEX idx_course_blueprints_status ON course_blueprints(status);
CREATE INDEX idx_blueprint_objectives_blueprint_id ON blueprint_objectives(blueprint_id);
CREATE INDEX idx_blueprint_assessments_blueprint_id ON blueprint_assessments(blueprint_id);
CREATE INDEX idx_blueprint_jobs_course_id ON blueprint_generation_jobs(course_id);
CREATE INDEX idx_blueprint_jobs_tenant_id ON blueprint_generation_jobs(tenant_id);
CREATE INDEX idx_blueprint_jobs_status ON blueprint_generation_jobs(status);

-- RLS Policies
ALTER TABLE course_blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE blueprint_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE blueprint_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE blueprint_generation_jobs ENABLE ROW LEVEL SECURITY;

-- Allow managers/admins of a tenant to view blueprints
CREATE POLICY "blueprints_select_by_tenant"
  ON course_blueprints FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM users WHERE tenant_id = course_blueprints.tenant_id
      AND role IN ('manager', 'admin')
    )
  );

CREATE POLICY "blueprints_insert_by_tenant"
  ON course_blueprints FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM users WHERE tenant_id = course_blueprints.tenant_id
      AND role IN ('manager', 'admin')
    )
  );

CREATE POLICY "blueprints_update_by_tenant"
  ON course_blueprints FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM users WHERE tenant_id = course_blueprints.tenant_id
      AND role IN ('manager', 'admin')
    )
  );

-- Similar policies for objectives and assessments
CREATE POLICY "objectives_select_by_blueprint"
  ON blueprint_objectives FOR SELECT
  USING (
    blueprint_id IN (
      SELECT id FROM course_blueprints WHERE tenant_id IN (
        SELECT tenant_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "assessments_select_by_blueprint"
  ON blueprint_assessments FOR SELECT
  USING (
    blueprint_id IN (
      SELECT id FROM course_blueprints WHERE tenant_id IN (
        SELECT tenant_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Jobs visible to tenant members
CREATE POLICY "jobs_select_by_tenant"
  ON blueprint_generation_jobs FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "jobs_insert_by_tenant"
  ON blueprint_generation_jobs FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
      AND role IN ('manager', 'admin')
    )
  );
