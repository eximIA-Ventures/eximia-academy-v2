-- Story 26.1: DB Migration — Quiz Tables
-- Epic 26: WS3 Quiz & Assessment Engine
--
-- Creates quiz engine foundation:
-- 1. quiz_sessions table (quiz configuration)
-- 2. quiz_attempts table (student attempts)
-- 3. RLS policies for tenant isolation and role-based access
-- 4. Performance indexes

BEGIN;

-- ============================================================
-- 1. Create quiz_sessions table
-- ============================================================

CREATE TABLE IF NOT EXISTS quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  quiz_type TEXT NOT NULL CHECK (quiz_type IN ('practice', 'exam', 'diagnostic')),
  time_limit_minutes INTEGER,
  passing_score NUMERIC(5,2) DEFAULT 70.00,
  max_attempts INTEGER DEFAULT 3,
  shuffle_questions BOOLEAN NOT NULL DEFAULT false,
  show_answers_after TEXT NOT NULL DEFAULT 'completion' CHECK (show_answers_after IN ('completion', 'never', 'always')),
  question_ids UUID[] NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE quiz_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Create quiz_attempts table
-- ============================================================

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_session_id UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  score NUMERIC(5,2),
  total_questions INTEGER NOT NULL DEFAULT 0,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'timed_out', 'abandoned')),
  answers JSONB NOT NULL DEFAULT '[]',
  feedback JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. RLS policies — quiz_sessions
-- ============================================================

-- Instructor/admin/manager can CRUD quiz_sessions in own tenant
CREATE POLICY "qs_content_role_all" ON quiz_sessions FOR ALL
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('instructor', 'manager', 'admin')
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('instructor', 'manager', 'admin')
  );

-- Student can SELECT quiz_sessions if enrolled in the course
CREATE POLICY "qs_student_select" ON quiz_sessions FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() = 'student'
    AND is_active = true
    AND EXISTS (
      SELECT 1 FROM enrollments
      WHERE enrollments.course_id = quiz_sessions.course_id
      AND enrollments.user_id = auth.uid()
      AND enrollments.status = 'active'
    )
  );

-- Super admin bypass
CREATE POLICY "qs_super_admin" ON quiz_sessions FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ============================================================
-- 4. RLS policies — quiz_attempts
-- ============================================================

-- Student can INSERT own quiz attempts (tenant match)
CREATE POLICY "qa_student_insert" ON quiz_attempts FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
    AND auth_user_role() = 'student'
  );

-- Student can SELECT own quiz attempts
CREATE POLICY "qa_student_select" ON quiz_attempts FOR SELECT
  USING (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
  );

-- Student can UPDATE own in-progress attempts
CREATE POLICY "qa_student_update" ON quiz_attempts FOR UPDATE
  USING (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
    AND status = 'in_progress'
  )
  WITH CHECK (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
  );

-- Instructor/manager/admin can SELECT all attempts in tenant
CREATE POLICY "qa_content_role_select" ON quiz_attempts FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('instructor', 'manager', 'admin')
  );

-- Super admin bypass
CREATE POLICY "qa_super_admin" ON quiz_attempts FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ============================================================
-- 5. Indexes
-- ============================================================

CREATE INDEX idx_quiz_attempts_session_student ON quiz_attempts(quiz_session_id, student_id);
CREATE INDEX idx_quiz_attempts_tenant_status ON quiz_attempts(tenant_id, status);
CREATE INDEX idx_quiz_sessions_course ON quiz_sessions(course_id);
CREATE INDEX idx_quiz_sessions_tenant ON quiz_sessions(tenant_id);

COMMIT;
