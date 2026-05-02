-- =============================================================================
-- eximIA Academy v2 — Schema Inicial
-- =============================================================================
-- Arquitetura:
--   tenant isolation via RLS (sem tenant no path URL)
--   operational_units como entidade first-class
--   users com tenant_id + unit_id + role
-- =============================================================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE user_role AS ENUM (
  'student',
  'instructor',
  'manager',
  'admin',
  'super_admin'
);

CREATE TYPE tenant_plan AS ENUM (
  'essencial',
  'standard',
  'premium'
);

CREATE TYPE course_status AS ENUM (
  'draft',
  'published',
  'archived'
);

CREATE TYPE chapter_status AS ENUM (
  'draft',
  'published'
);

CREATE TYPE session_status AS ENUM (
  'active',
  'completed',
  'abandoned'
);

CREATE TYPE enrollment_status AS ENUM (
  'active',
  'completed',
  'dropped'
);

-- =============================================================================
-- TABELA: tenants
-- Root da hierarquia — sem tenant_id (é a própria âncora)
-- =============================================================================

CREATE TABLE tenants (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              text NOT NULL,
  slug              text NOT NULL UNIQUE,
  plan              tenant_plan NOT NULL DEFAULT 'essencial',
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),

  -- Branding
  logo_url          text,
  primary_color     text,                  -- OKLCh string
  whitelabel_enabled boolean NOT NULL DEFAULT false,
  custom_domain     text,

  -- Limites do plano
  max_users         integer NOT NULL DEFAULT 50,
  max_courses       integer NOT NULL DEFAULT 20,
  max_storage_gb    integer NOT NULL DEFAULT 10,

  -- Configurações
  settings          jsonb NOT NULL DEFAULT '{}',

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- TABELA: operational_units
-- Subdivisões dentro do tenant (first-class entity na v2)
-- Ex: "Comercial", "Operações", "TI", "Filial SP"
-- =============================================================================

CREATE TABLE operational_units (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  code        text,                        -- Código opcional (ex: "BU-01")
  parent_id   uuid REFERENCES operational_units(id) ON DELETE SET NULL, -- hierarquia opcional
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  metadata    jsonb NOT NULL DEFAULT '{}',

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, name)
);

-- =============================================================================
-- TABELA: users
-- Extends auth.users do Supabase
-- =============================================================================

CREATE TABLE users (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  unit_id     uuid REFERENCES operational_units(id) ON DELETE SET NULL,

  -- Identificação
  email       text NOT NULL,
  full_name   text,
  avatar_url  text,

  -- Role e permissões
  role        user_role NOT NULL DEFAULT 'student',
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),

  -- Metadados de aprendizado
  job_title   text,
  department  text,

  -- LGPD
  deleted_at  timestamptz,

  -- Gamificação
  streak_days       integer NOT NULL DEFAULT 0,
  streak_last_date  date,
  total_xp          integer NOT NULL DEFAULT 0,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- TABELA: courses
-- =============================================================================

CREATE TABLE courses (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  unit_id               uuid REFERENCES operational_units(id) ON DELETE SET NULL,
  created_by            uuid REFERENCES users(id) ON DELETE SET NULL,

  -- Conteúdo
  title                 text NOT NULL,
  description           text,
  cover_image_url       text,
  learning_objective    text,
  target_audience       text,

  -- Config
  status                course_status NOT NULL DEFAULT 'draft',
  estimated_hours       numeric(5,1),
  interactions_per_session integer NOT NULL DEFAULT 5,

  -- Ordenação e categorização
  category              text,
  tags                  text[] NOT NULL DEFAULT '{}',

  -- Stats (desnormalizados para performance)
  enrolled_count        integer NOT NULL DEFAULT 0,
  completion_rate       numeric(5,2) NOT NULL DEFAULT 0,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- TABELA: chapters
-- =============================================================================

CREATE TABLE chapters (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id           uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Conteúdo
  title               text NOT NULL,
  description         text,
  content             text,                -- Rich text / Markdown
  content_blocks      jsonb,              -- Block editor (Plate.js)
  learning_objective  text,

  -- Mídia
  video_url           text,
  audio_url           text,

  -- Ordenação
  order               integer NOT NULL DEFAULT 0,
  status              chapter_status NOT NULL DEFAULT 'draft',

  -- Configuração da sessão socrática
  questions_count     integer NOT NULL DEFAULT 0,  -- cache
  socratic_enabled    boolean NOT NULL DEFAULT true,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- TABELA: questions
-- Perguntas socrática por capítulo
-- =============================================================================

CREATE TABLE questions (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id  uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  text        text NOT NULL,
  type        text NOT NULL DEFAULT 'socratic' CHECK (type IN ('socratic', 'reflection', 'scenario')),
  difficulty  text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),

  -- Metadados pedagógicos
  bloom_level text,         -- remember, understand, apply, analyze, evaluate, create
  tags        text[] NOT NULL DEFAULT '{}',

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- TABELA: enrollments
-- Inscrição de alunos em cursos
-- =============================================================================

CREATE TABLE enrollments (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id   uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  status            enrollment_status NOT NULL DEFAULT 'active',
  enrolled_at       timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz,
  deadline_at       timestamptz,

  -- Progress cache (atualizado por trigger)
  progress_percent  numeric(5,2) NOT NULL DEFAULT 0,
  chapters_completed integer NOT NULL DEFAULT 0,
  last_accessed_at  timestamptz,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (student_id, course_id)
);

-- =============================================================================
-- TABELA: progress
-- Progresso por capítulo (granular)
-- =============================================================================

CREATE TABLE progress (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_id  uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  course_id   uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  status            text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  sessions_count    integer NOT NULL DEFAULT 0,
  last_session_at   timestamptz,
  completed_at      timestamptz,

  -- Métricas de aprendizado acumuladas
  avg_depth         numeric(4,2),
  total_messages    integer NOT NULL DEFAULT 0,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (student_id, chapter_id)
);

-- =============================================================================
-- TABELA: sessions
-- Sessão socrática (atômica por capítulo + questão)
-- =============================================================================

CREATE TABLE sessions (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_id            uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  question_id           uuid REFERENCES questions(id) ON DELETE SET NULL,
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  status                session_status NOT NULL DEFAULT 'active',
  interactions_remaining integer NOT NULL DEFAULT 5,
  turn_number           integer NOT NULL DEFAULT 0,

  -- Timestamps
  started_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz,
  last_activity_at      timestamptz NOT NULL DEFAULT now(),

  -- Análise agregada (populada ao fechar sessão)
  analytics             jsonb,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- TABELA: messages
-- Mensagens da sessão socrática
-- =============================================================================

CREATE TABLE messages (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  role        text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content     text NOT NULL,
  turn_number integer NOT NULL DEFAULT 0,

  -- Análise por mensagem (populada pelo Analyst agent)
  analysis    jsonb,  -- { depth_reached, ai_detection, cognitive_patterns, kolb_vector, ... }

  created_at  timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- TABELA: learner_profiles
-- Perfil de aprendizado acumulado
-- =============================================================================

CREATE TABLE learner_profiles (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Estilo de aprendizado
  kolb_style          text,   -- accommodating, diverging, assimilating, converging
  engagement_style    text,   -- reflective, impulsive, balanced
  reasoning_style     text,   -- analytical, creative, systematic, intuitive

  -- Métricas acumuladas
  avg_depth_achieved  numeric(4,2) NOT NULL DEFAULT 0,
  total_sessions      integer NOT NULL DEFAULT 0,
  comprehension_trend text DEFAULT 'stable',  -- improving, stable, declining

  -- Arrays de padrões
  strengths           text[] NOT NULL DEFAULT '{}',
  growth_areas        text[] NOT NULL DEFAULT '{}',
  preferred_question_types text[] NOT NULL DEFAULT '{}',

  -- Dados brutos
  raw_profile         jsonb NOT NULL DEFAULT '{}',

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (student_id, tenant_id)
);

-- =============================================================================
-- ÍNDICES
-- =============================================================================

-- Tenants
CREATE INDEX idx_tenants_slug ON tenants(slug);

-- Operational Units
CREATE INDEX idx_operational_units_tenant ON operational_units(tenant_id);
CREATE INDEX idx_operational_units_parent ON operational_units(parent_id);

-- Users
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_unit ON users(unit_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(tenant_id) WHERE deleted_at IS NULL;

-- Courses
CREATE INDEX idx_courses_tenant ON courses(tenant_id);
CREATE INDEX idx_courses_unit ON courses(unit_id);
CREATE INDEX idx_courses_status ON courses(tenant_id, status);

-- Chapters
CREATE INDEX idx_chapters_course ON chapters(course_id);
CREATE INDEX idx_chapters_tenant ON chapters(tenant_id);
CREATE INDEX idx_chapters_order ON chapters(course_id, "order");

-- Questions
CREATE INDEX idx_questions_chapter ON questions(chapter_id);
CREATE INDEX idx_questions_active ON questions(chapter_id) WHERE status = 'active';

-- Enrollments
CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_course ON enrollments(course_id);
CREATE INDEX idx_enrollments_tenant ON enrollments(tenant_id);
CREATE INDEX idx_enrollments_student_course ON enrollments(student_id, course_id);

-- Progress
CREATE INDEX idx_progress_student ON progress(student_id);
CREATE INDEX idx_progress_chapter ON progress(chapter_id);
CREATE INDEX idx_progress_course ON progress(course_id);
CREATE INDEX idx_progress_tenant ON progress(tenant_id);

-- Sessions
CREATE INDEX idx_sessions_student ON sessions(student_id);
CREATE INDEX idx_sessions_chapter ON sessions(chapter_id);
CREATE INDEX idx_sessions_tenant ON sessions(tenant_id);
CREATE INDEX idx_sessions_active ON sessions(student_id) WHERE status = 'active';

-- Messages
CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_messages_tenant ON messages(tenant_id);

-- Learner Profiles
CREATE INDEX idx_learner_profiles_student ON learner_profiles(student_id);
CREATE INDEX idx_learner_profiles_tenant ON learner_profiles(tenant_id);

-- =============================================================================
-- TRIGGER: updated_at automático
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON operational_units
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON chapters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON progress
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON learner_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- FUNÇÕES HELPER — RLS
-- =============================================================================

-- Retorna o tenant_id do usuário autenticado
CREATE OR REPLACE FUNCTION auth_tenant_id()
RETURNS uuid AS $$
  SELECT tenant_id FROM public.users
  WHERE id = auth.uid() AND deleted_at IS NULL
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Retorna o role do usuário autenticado
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS text AS $$
  SELECT role::text FROM public.users
  WHERE id = auth.uid() AND deleted_at IS NULL
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Verifica se é super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role = 'super_admin'
      AND deleted_at IS NULL
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Verifica se tem role de admin ou superior no tenant
CREATE OR REPLACE FUNCTION is_tenant_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
      AND deleted_at IS NULL
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Claim de turn da sessão (atômico — evita race conditions)
CREATE OR REPLACE FUNCTION claim_session_turn(p_session_id uuid, p_user_id uuid)
RETURNS TABLE (
  session_id             uuid,
  chapter_id             uuid,
  question_id            uuid,
  tenant_id              uuid,
  interactions_remaining integer,
  turn_number            integer
) AS $$
DECLARE
  v_session sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session
  FROM sessions
  WHERE id = p_session_id
    AND student_id = p_user_id
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão não encontrada ou não pertence ao usuário';
  END IF;

  IF v_session.interactions_remaining <= 0 THEN
    RAISE EXCEPTION 'Sem interações disponíveis nesta sessão';
  END IF;

  UPDATE sessions SET
    interactions_remaining = interactions_remaining - 1,
    turn_number = turn_number + 1,
    last_activity_at = now()
  WHERE id = p_session_id;

  RETURN QUERY SELECT
    v_session.id,
    v_session.chapter_id,
    v_session.question_id,
    v_session.tenant_id,
    v_session.interactions_remaining - 1,
    v_session.turn_number + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seleciona questão ativa aleatória do capítulo
CREATE OR REPLACE FUNCTION get_random_active_question(p_chapter_id uuid)
RETURNS uuid AS $$
  SELECT id FROM questions
  WHERE chapter_id = p_chapter_id AND status = 'active'
  ORDER BY RANDOM()
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Soft delete de usuário (LGPD)
CREATE OR REPLACE FUNCTION soft_delete_user(p_user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE users SET
    deleted_at = now(),
    status = 'inactive',
    full_name = 'Usuário Removido',
    avatar_url = null,
    job_title = null,
    department = null
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- RLS — ATIVAR E CRIAR POLÍTICAS
-- =============================================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE learner_profiles ENABLE ROW LEVEL SECURITY;

-- ---- TENANTS ----

CREATE POLICY "super_admin_all_tenants" ON tenants
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "users_read_own_tenant" ON tenants
  FOR SELECT USING (id = auth_tenant_id());

-- ---- OPERATIONAL UNITS ----

CREATE POLICY "super_admin_all_units" ON operational_units
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_manage_units" ON operational_units
  FOR ALL USING (tenant_id = auth_tenant_id() AND is_tenant_admin())
  WITH CHECK (tenant_id = auth_tenant_id() AND is_tenant_admin());

CREATE POLICY "users_read_units" ON operational_units
  FOR SELECT USING (tenant_id = auth_tenant_id());

-- ---- USERS ----

CREATE POLICY "super_admin_all_users" ON users
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_manage_tenant_users" ON users
  FOR ALL USING (tenant_id = auth_tenant_id() AND is_tenant_admin())
  WITH CHECK (tenant_id = auth_tenant_id() AND is_tenant_admin());

CREATE POLICY "users_read_own_tenant_users" ON users
  FOR SELECT USING (tenant_id = auth_tenant_id() AND deleted_at IS NULL);

CREATE POLICY "users_update_own_profile" ON users
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND tenant_id = auth_tenant_id());

-- ---- COURSES ----

CREATE POLICY "super_admin_all_courses" ON courses
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_instructor_manage_courses" ON courses
  FOR ALL USING (
    tenant_id = auth_tenant_id() AND
    auth_user_role() IN ('admin', 'manager', 'instructor')
  )
  WITH CHECK (
    tenant_id = auth_tenant_id() AND
    auth_user_role() IN ('admin', 'manager', 'instructor')
  );

CREATE POLICY "students_read_published_courses" ON courses
  FOR SELECT USING (
    tenant_id = auth_tenant_id() AND
    (status = 'published' OR auth_user_role() IN ('admin', 'manager', 'instructor'))
  );

-- ---- CHAPTERS ----

CREATE POLICY "super_admin_all_chapters" ON chapters
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_instructor_manage_chapters" ON chapters
  FOR ALL USING (
    tenant_id = auth_tenant_id() AND
    auth_user_role() IN ('admin', 'manager', 'instructor')
  )
  WITH CHECK (
    tenant_id = auth_tenant_id() AND
    auth_user_role() IN ('admin', 'manager', 'instructor')
  );

CREATE POLICY "students_read_published_chapters" ON chapters
  FOR SELECT USING (
    tenant_id = auth_tenant_id() AND
    (status = 'published' OR auth_user_role() IN ('admin', 'manager', 'instructor'))
  );

-- ---- QUESTIONS ----

CREATE POLICY "super_admin_all_questions" ON questions
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_instructor_manage_questions" ON questions
  FOR ALL USING (
    tenant_id = auth_tenant_id() AND
    auth_user_role() IN ('admin', 'manager', 'instructor')
  )
  WITH CHECK (
    tenant_id = auth_tenant_id() AND
    auth_user_role() IN ('admin', 'manager', 'instructor')
  );

CREATE POLICY "students_read_active_questions" ON questions
  FOR SELECT USING (
    tenant_id = auth_tenant_id() AND status = 'active'
  );

-- ---- ENROLLMENTS ----

CREATE POLICY "super_admin_all_enrollments" ON enrollments
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_manage_enrollments" ON enrollments
  FOR ALL USING (tenant_id = auth_tenant_id() AND is_tenant_admin())
  WITH CHECK (tenant_id = auth_tenant_id() AND is_tenant_admin());

CREATE POLICY "students_read_own_enrollments" ON enrollments
  FOR SELECT USING (student_id = auth.uid() AND tenant_id = auth_tenant_id());

-- ---- PROGRESS ----

CREATE POLICY "super_admin_all_progress" ON progress
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_read_tenant_progress" ON progress
  FOR SELECT USING (tenant_id = auth_tenant_id() AND is_tenant_admin());

CREATE POLICY "students_manage_own_progress" ON progress
  FOR ALL USING (student_id = auth.uid() AND tenant_id = auth_tenant_id())
  WITH CHECK (student_id = auth.uid() AND tenant_id = auth_tenant_id());

-- ---- SESSIONS ----

CREATE POLICY "super_admin_all_sessions" ON sessions
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_read_tenant_sessions" ON sessions
  FOR SELECT USING (tenant_id = auth_tenant_id() AND is_tenant_admin());

CREATE POLICY "students_manage_own_sessions" ON sessions
  FOR ALL USING (student_id = auth.uid() AND tenant_id = auth_tenant_id())
  WITH CHECK (student_id = auth.uid() AND tenant_id = auth_tenant_id());

-- ---- MESSAGES ----

CREATE POLICY "super_admin_all_messages" ON messages
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_read_tenant_messages" ON messages
  FOR SELECT USING (tenant_id = auth_tenant_id() AND is_tenant_admin());

CREATE POLICY "students_manage_own_messages" ON messages
  FOR ALL USING (
    tenant_id = auth_tenant_id() AND
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = messages.session_id AND s.student_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id = auth_tenant_id() AND
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = messages.session_id AND s.student_id = auth.uid()
    )
  );

-- ---- LEARNER PROFILES ----

CREATE POLICY "super_admin_all_profiles" ON learner_profiles
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admin_read_tenant_profiles" ON learner_profiles
  FOR SELECT USING (tenant_id = auth_tenant_id() AND is_tenant_admin());

CREATE POLICY "students_manage_own_profile" ON learner_profiles
  FOR ALL USING (student_id = auth.uid() AND tenant_id = auth_tenant_id())
  WITH CHECK (student_id = auth.uid() AND tenant_id = auth_tenant_id());
