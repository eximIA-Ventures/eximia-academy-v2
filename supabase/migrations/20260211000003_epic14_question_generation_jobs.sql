-- Epic 14: AI Question Generation Pipeline
-- Story 14.1: Schema, Migration & RLS for Question Generation Jobs

-- New table: question_generation_jobs
CREATE TABLE question_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  triggered_by UUID NOT NULL REFERENCES auth.users(id),
  scope TEXT NOT NULL DEFAULT 'course'
    CHECK (scope IN ('course', 'chapter')),
  chapter_ids UUID[],
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'review', 'completed', 'failed')),
  progress JSONB DEFAULT '{}',
  questions_generated INTEGER DEFAULT 0,
  questions_approved INTEGER DEFAULT 0,
  questions_rejected INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_qg_jobs_tenant ON question_generation_jobs(tenant_id);
CREATE INDEX idx_qg_jobs_course ON question_generation_jobs(course_id);
CREATE INDEX idx_qg_jobs_status ON question_generation_jobs(status);
CREATE INDEX idx_qg_jobs_course_status ON question_generation_jobs(course_id, status);

-- Add job_id to existing questions table (nullable, backward-compatible)
ALTER TABLE questions ADD COLUMN job_id UUID
  REFERENCES question_generation_jobs(id) ON DELETE SET NULL;

CREATE INDEX idx_questions_job ON questions(job_id) WHERE job_id IS NOT NULL;

-- RLS for question_generation_jobs
ALTER TABLE question_generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qg_jobs_select" ON question_generation_jobs FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager', 'admin'));

CREATE POLICY "qg_jobs_insert" ON question_generation_jobs FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager', 'admin'));

CREATE POLICY "qg_jobs_update" ON question_generation_jobs FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager', 'admin'));

CREATE POLICY "qg_jobs_delete" ON question_generation_jobs FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin');

-- Super admin bypass policies
CREATE POLICY "qg_jobs_super_admin_select" ON question_generation_jobs FOR SELECT
  USING (auth_user_role() = 'super_admin');

CREATE POLICY "qg_jobs_super_admin_all" ON question_generation_jobs FOR ALL
  USING (auth_user_role() = 'super_admin');
