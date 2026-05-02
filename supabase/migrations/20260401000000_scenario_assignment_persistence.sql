-- Scenario & Assignment Persistence: student scenario attempts and assignment submissions
-- Supports interactive case-study scenarios and written assignments per chapter

BEGIN;
-- =============================================================
-- 1. Create scenario_attempts table
-- =============================================================

CREATE TABLE scenario_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  scenario_title TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  overall_score NUMERIC(5,2),
  step_responses JSONB DEFAULT '[]',
  evaluation JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One attempt per student per chapter
  UNIQUE(student_id, chapter_id)
);
-- =============================================================
-- 2. Create assignment_submissions table
-- =============================================================

CREATE TABLE assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'evaluated')),
  evaluation JSONB,
  overall_score NUMERIC(5,2),
  grade TEXT,
  submitted_at TIMESTAMPTZ,
  evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One submission per student per chapter
  UNIQUE(student_id, chapter_id)
);
-- =============================================================
-- 3. Indexes — scenario_attempts
-- =============================================================

CREATE INDEX idx_scenario_attempts_student ON scenario_attempts(student_id);
CREATE INDEX idx_scenario_attempts_chapter ON scenario_attempts(chapter_id);
CREATE INDEX idx_scenario_attempts_tenant ON scenario_attempts(tenant_id);
CREATE INDEX idx_scenario_attempts_student_tenant ON scenario_attempts(student_id, tenant_id);
-- =============================================================
-- 4. Indexes — assignment_submissions
-- =============================================================

CREATE INDEX idx_assignment_submissions_student ON assignment_submissions(student_id);
CREATE INDEX idx_assignment_submissions_chapter ON assignment_submissions(chapter_id);
CREATE INDEX idx_assignment_submissions_tenant ON assignment_submissions(tenant_id);
CREATE INDEX idx_assignment_submissions_student_tenant ON assignment_submissions(student_id, tenant_id);
-- =============================================================
-- 5. RLS — scenario_attempts
-- =============================================================

ALTER TABLE scenario_attempts ENABLE ROW LEVEL SECURITY;
-- Students can read their own attempts
CREATE POLICY "sa_student_select" ON scenario_attempts FOR SELECT
  USING (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
  );
-- Students can insert their own attempts
CREATE POLICY "sa_student_insert" ON scenario_attempts FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
    AND auth_user_role() = 'student'
  );
-- Students can update their own attempts
CREATE POLICY "sa_student_update" ON scenario_attempts FOR UPDATE
  USING (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
  )
  WITH CHECK (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
  );
-- Students can delete their own attempts
CREATE POLICY "sa_student_delete" ON scenario_attempts FOR DELETE
  USING (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
  );
-- Instructors, managers, and admins can read all attempts in their tenant
CREATE POLICY "sa_content_role_select" ON scenario_attempts FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('instructor', 'manager', 'admin')
  );
-- Super admin bypass
CREATE POLICY "sa_super_admin" ON scenario_attempts FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
-- =============================================================
-- 6. RLS — assignment_submissions
-- =============================================================

ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;
-- Students can read their own submissions
CREATE POLICY "as_student_select" ON assignment_submissions FOR SELECT
  USING (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
  );
-- Students can insert their own submissions
CREATE POLICY "as_student_insert" ON assignment_submissions FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
    AND auth_user_role() = 'student'
  );
-- Students can update their own submissions
CREATE POLICY "as_student_update" ON assignment_submissions FOR UPDATE
  USING (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
  )
  WITH CHECK (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
  );
-- Students can delete their own submissions
CREATE POLICY "as_student_delete" ON assignment_submissions FOR DELETE
  USING (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
  );
-- Instructors, managers, and admins can read all submissions in their tenant
CREATE POLICY "as_content_role_select" ON assignment_submissions FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('instructor', 'manager', 'admin')
  );
-- Super admin bypass
CREATE POLICY "as_super_admin" ON assignment_submissions FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
-- =============================================================
-- 7. Updated_at trigger — assignment_submissions
-- =============================================================

CREATE OR REPLACE FUNCTION set_assignment_submissions_updated_at_fn()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER set_assignment_submissions_updated_at
  BEFORE UPDATE ON assignment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION set_assignment_submissions_updated_at_fn();
COMMIT;
