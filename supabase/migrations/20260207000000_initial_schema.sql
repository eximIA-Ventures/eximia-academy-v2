-- =============================================================
-- exímIA Academy — Initial Schema Migration
-- Story 1.2: 10 tables, 19 indexes, 28 RLS policies
-- =============================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- =============================================================
-- 2. Tables
-- =============================================================

-- 2.1 tenants (root table — no tenant_id)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  mode TEXT NOT NULL CHECK (mode IN ('university', 'corporate')),
  branding JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- 2.2 users
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin', 'manager')),
  profile JSONB DEFAULT '{}',
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- 2.3 courses
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('university', 'corporate')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- 2.4 chapters
CREATE TABLE chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  learning_objective TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- 2.5 questions
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  skill TEXT,
  intention TEXT,
  expected_depth TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- 2.6 enrollments
CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped')),
  progress JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_id, course_id)
);
-- 2.7 sessions
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  interactions_remaining INTEGER NOT NULL DEFAULT 20,
  turn_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- 2.8 messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  turn_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- 2.9 analyses
CREATE TABLE analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ai_detection JSONB DEFAULT '{}',
  metrics JSONB DEFAULT '{}',
  flags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);
-- 2.10 qa_reports
CREATE TABLE qa_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  verdict TEXT,
  score NUMERIC,
  criteria_results JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
-- =============================================================
-- 3. Indexes (19)
-- =============================================================

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_courses_tenant ON courses(tenant_id);
CREATE INDEX idx_chapters_course ON chapters(course_id);
CREATE INDEX idx_chapters_tenant ON chapters(tenant_id);
CREATE INDEX idx_questions_chapter ON questions(chapter_id);
CREATE INDEX idx_questions_tenant ON questions(tenant_id);
CREATE INDEX idx_questions_active ON questions(chapter_id) WHERE status = 'active';
CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_tenant ON enrollments(tenant_id);
CREATE INDEX idx_sessions_student ON sessions(student_id);
CREATE INDEX idx_sessions_tenant ON sessions(tenant_id);
CREATE INDEX idx_sessions_active ON sessions(student_id) WHERE status = 'active';
CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_messages_tenant ON messages(tenant_id);
CREATE INDEX idx_analyses_session ON analyses(session_id);
CREATE INDEX idx_analyses_tenant ON analyses(tenant_id);
CREATE INDEX idx_qa_reports_session ON qa_reports(session_id);
CREATE INDEX idx_qa_reports_tenant ON qa_reports(tenant_id);
-- 19th index: composite for enrollments lookup
CREATE INDEX idx_enrollments_course ON enrollments(course_id);
-- =============================================================
-- 4. Helper Functions
-- =============================================================

-- auth_tenant_id(): Returns the tenant_id of the authenticated user
CREATE OR REPLACE FUNCTION auth_tenant_id() RETURNS UUID AS $$
  SELECT tenant_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;
-- auth_user_role(): Returns the role of the authenticated user
CREATE OR REPLACE FUNCTION auth_user_role() RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = auth.uid() AND tenant_id = auth_tenant_id();
$$ LANGUAGE sql SECURITY DEFINER STABLE;
-- =============================================================
-- 5. Session Turn Functions (SEC-5)
-- =============================================================

-- claim_session_turn: Atomic claim of a turn
CREATE OR REPLACE FUNCTION claim_session_turn(
  p_session_id UUID,
  p_user_id UUID
) RETURNS TABLE (
  session_id UUID,
  chapter_id UUID,
  question_id UUID,
  tenant_id UUID,
  interactions_remaining INTEGER,
  turn_number INTEGER
) AS $$
DECLARE
  v_session RECORD;
  v_user_tenant UUID;
BEGIN
  -- Get user's tenant
  SELECT u.tenant_id INTO v_user_tenant FROM users u WHERE u.id = p_user_id;

  -- Lock and validate session
  SELECT s.* INTO v_session
  FROM sessions s
  WHERE s.id = p_session_id
  FOR UPDATE;

  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF v_session.student_id != p_user_id THEN
    RAISE EXCEPTION 'Session does not belong to user';
  END IF;

  IF v_session.status != 'active' THEN
    RAISE EXCEPTION 'Session is not active';
  END IF;

  -- SEC-5: Cross-tenant check
  IF v_session.tenant_id != v_user_tenant THEN
    RAISE EXCEPTION 'Cross-tenant access denied';
  END IF;

  IF v_session.interactions_remaining <= 0 THEN
    RAISE EXCEPTION 'No interactions remaining';
  END IF;

  -- Atomic decrement
  UPDATE sessions s SET
    interactions_remaining = s.interactions_remaining - 1,
    turn_number = s.turn_number + 1,
    updated_at = now()
  WHERE s.id = p_session_id;

  RETURN QUERY
  SELECT
    v_session.id,
    v_session.chapter_id,
    v_session.question_id,
    v_session.tenant_id,
    v_session.interactions_remaining - 1,
    v_session.turn_number + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- release_session_turn: Compensate for pipeline failure
CREATE OR REPLACE FUNCTION release_session_turn(
  p_session_id UUID,
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_session RECORD;
  v_user_tenant UUID;
BEGIN
  SELECT u.tenant_id INTO v_user_tenant FROM users u WHERE u.id = p_user_id;

  SELECT s.* INTO v_session
  FROM sessions s
  WHERE s.id = p_session_id
  FOR UPDATE;

  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF v_session.student_id != p_user_id THEN
    RAISE EXCEPTION 'Session does not belong to user';
  END IF;

  IF v_session.tenant_id != v_user_tenant THEN
    RAISE EXCEPTION 'Cross-tenant access denied';
  END IF;

  UPDATE sessions s SET
    interactions_remaining = s.interactions_remaining + 1,
    turn_number = GREATEST(s.turn_number - 1, 0),
    updated_at = now()
  WHERE s.id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- =============================================================
-- 6. Auto-populate Triggers
-- =============================================================

-- Trigger function: set tenant_id from parent course
CREATE OR REPLACE FUNCTION set_chapter_tenant_id() RETURNS TRIGGER AS $$
BEGIN
  NEW.tenant_id := (SELECT tenant_id FROM courses WHERE id = NEW.course_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_set_chapter_tenant_id
  BEFORE INSERT ON chapters
  FOR EACH ROW EXECUTE FUNCTION set_chapter_tenant_id();
-- Trigger function: set tenant_id from parent chapter
CREATE OR REPLACE FUNCTION set_question_tenant_id() RETURNS TRIGGER AS $$
BEGIN
  NEW.tenant_id := (SELECT tenant_id FROM chapters WHERE id = NEW.chapter_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_set_question_tenant_id
  BEFORE INSERT ON questions
  FOR EACH ROW EXECUTE FUNCTION set_question_tenant_id();
-- Trigger function: set tenant_id from parent session (for messages, analyses, qa_reports)
CREATE OR REPLACE FUNCTION set_child_tenant_from_session() RETURNS TRIGGER AS $$
BEGIN
  NEW.tenant_id := (SELECT tenant_id FROM sessions WHERE id = NEW.session_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_set_message_tenant_id
  BEFORE INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION set_child_tenant_from_session();
CREATE TRIGGER trg_set_analysis_tenant_id
  BEFORE INSERT ON analyses
  FOR EACH ROW EXECUTE FUNCTION set_child_tenant_from_session();
CREATE TRIGGER trg_set_qa_report_tenant_id
  BEFORE INSERT ON qa_reports
  FOR EACH ROW EXECUTE FUNCTION set_child_tenant_from_session();
-- =============================================================
-- 7. RLS Enable + Granular Policies (28 policies)
-- =============================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_reports ENABLE ROW LEVEL SECURITY;
-- ---- tenants (2 policies) ----
CREATE POLICY tenants_select ON tenants FOR SELECT
  USING (id = auth_tenant_id());
CREATE POLICY tenants_update ON tenants FOR UPDATE
  USING (id = auth_tenant_id() AND auth_user_role() = 'admin');
-- ---- users (3 policies) ----
CREATE POLICY users_select ON users FOR SELECT
  USING (tenant_id = auth_tenant_id());
CREATE POLICY users_update ON users FOR UPDATE
  USING (
    tenant_id = auth_tenant_id()
    AND (id = auth.uid() OR auth_user_role() IN ('admin', 'manager'))
  );
CREATE POLICY users_delete ON users FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin');
-- ---- courses (4 policies) ----
CREATE POLICY courses_select ON courses FOR SELECT
  USING (tenant_id = auth_tenant_id());
CREATE POLICY courses_insert ON courses FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('teacher', 'admin')
  );
CREATE POLICY courses_update ON courses FOR UPDATE
  USING (
    tenant_id = auth_tenant_id()
    AND (created_by = auth.uid() OR auth_user_role() IN ('admin', 'manager'))
  );
CREATE POLICY courses_delete ON courses FOR DELETE
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() = 'admin'
  );
-- ---- chapters (3 policies) ----
CREATE POLICY chapters_select ON chapters FOR SELECT
  USING (tenant_id = auth_tenant_id());
CREATE POLICY chapters_insert ON chapters FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('teacher', 'admin')
  );
CREATE POLICY chapters_update ON chapters FOR UPDATE
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('teacher', 'admin')
  );
-- ---- questions (3 policies) ----
CREATE POLICY questions_select ON questions FOR SELECT
  USING (tenant_id = auth_tenant_id());
CREATE POLICY questions_insert ON questions FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('teacher', 'admin')
  );
CREATE POLICY questions_update ON questions FOR UPDATE
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('teacher', 'admin')
  );
-- ---- enrollments (3 policies) ----
CREATE POLICY enrollments_select ON enrollments FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND (student_id = auth.uid() OR auth_user_role() IN ('teacher', 'admin', 'manager'))
  );
CREATE POLICY enrollments_insert ON enrollments FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('teacher', 'admin')
  );
CREATE POLICY enrollments_update ON enrollments FOR UPDATE
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('teacher', 'admin')
  );
-- ---- sessions (3 policies) ----
CREATE POLICY sessions_select ON sessions FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND (student_id = auth.uid() OR auth_user_role() IN ('teacher', 'admin', 'manager'))
  );
CREATE POLICY sessions_insert ON sessions FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND student_id = auth.uid()
  );
CREATE POLICY sessions_update ON sessions FOR UPDATE
  USING (
    tenant_id = auth_tenant_id()
    AND (student_id = auth.uid() OR auth_user_role() IN ('admin'))
  );
-- ---- messages (2 policies) ----
CREATE POLICY messages_select ON messages FOR SELECT
  USING (tenant_id = auth_tenant_id());
CREATE POLICY messages_insert ON messages FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id());
-- ---- analyses (2 policies) ----
CREATE POLICY analyses_select ON analyses FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('teacher', 'admin', 'manager')
  );
CREATE POLICY analyses_insert ON analyses FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id());
-- ---- qa_reports (2 policies) ----
CREATE POLICY qa_reports_select ON qa_reports FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('teacher', 'admin', 'manager')
  );
CREATE POLICY qa_reports_insert ON qa_reports FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id());
