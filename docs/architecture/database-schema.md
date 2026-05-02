# Schema de Banco de Dados — Modelo Relacional Completo

**Última atualização:** 2026-02-17
**Versão:** 1.4
**Documentação desdobrada do:** [architecture.md](../architecture.md) (§6) + schema real em `packages/database/src/schema/`

---

## 1. Visão Geral

A plataforma usa **PostgreSQL 16** via Supabase com **17 tabelas** organizadas em 4 domínios:

1. **Multi-tenant Core** (6 tabelas) — Tenant, Users, Courses, Chapters, Enrollments, Areas
2. **Learning Pipeline** (4 tabelas) — Questions, Sessions, Messages, Analyses
3. **Quality Assurance** (2 tabelas) — QA Reports, Question Generation Jobs
4. **Infrastructure & Audit** (5 tabelas) — User Areas, Content Ingestions, Learner Profiles, Platform Audit Log, (1 mais)

**Isolamento:** Todas as 17 tabelas têm coluna `tenant_id` com RLS policies via função helper `auth_tenant_id()`.

---

## 2. Diagrama ER (Entity Relationship)

```mermaid
erDiagram
    TENANTS ||--o{ USERS : "has (multi-tenant)"
    TENANTS ||--o{ COURSES : "has"
    TENANTS ||--o{ AREAS : "has"

    USERS ||--o{ COURSES : "creates (created_by)"
    USERS ||--o{ ENROLLMENTS : "enrolls"
    USERS ||--o{ SESSIONS : "participates"
    USERS ||--o{ USER_AREAS : "assigned_to"

    COURSES ||--o{ ENROLLMENTS : "has"
    COURSES ||--o{ CHAPTERS : "contains"
    COURSES ||--o{ QUESTION_GENERATION_JOBS : "triggers"

    CHAPTERS ||--o{ QUESTIONS : "has"
    CHAPTERS ||--o{ SESSIONS : "context"
    CHAPTERS ||--o{ CONTENT_INGESTIONS : "sources"

    QUESTIONS ||--o{ SESSIONS : "starts"
    QUESTIONS ||--o{ LEARNER_PROFILES : "influences"

    ENROLLMENTS ||--o{ LEARNER_PROFILES : "has"

    SESSIONS ||--o{ MESSAGES : "contains"

    MESSAGES ||--o| ANALYSES : "analyzed_by"
    MESSAGES ||--o| QA_REPORTS : "validated_by"

    AREAS ||--o{ USER_AREAS : "assigns"

    USERS ||--o{ PLATFORM_AUDIT_LOG : "audits"

    TENANTS : UUID id
    USERS : UUID id
    COURSES : UUID id
    CHAPTERS : UUID id
    QUESTIONS : UUID id
    ENROLLMENTS : UUID id
    SESSIONS : UUID id
    MESSAGES : UUID id
    ANALYSES : UUID id
    QA_REPORTS : UUID id
    AREAS : UUID id
    USER_AREAS : UUID id
    CONTENT_INGESTIONS : UUID id
    QUESTION_GENERATION_JOBS : UUID id
    LEARNER_PROFILES : UUID id
    PLATFORM_AUDIT_LOG : UUID id
```

---

## 3. Tabelas — Definição Completa

### 3.1 Core Multi-tenant

#### `tenants` (Domínios da plataforma)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | Primary key |
| `name` | TEXT | Nome (ex: "Acme Corp") |
| `slug` | TEXT | Slug único (ex: "acme-corp") |
| `branding` | JSONB | Logo, cores primária/secundária |
| `settings` | JSONB | `{"max_interactions_per_session": 3, ...}` |
| `plan` | TEXT | `essencial` \| `standard` \| `premium` |
| `created_at` | TIMESTAMPTZ | Auto-populated |
| `updated_at` | TIMESTAMPTZ | Auto-populated |

**Chaves:** PRIMARY KEY (id), UNIQUE (slug)

---

#### `users` (Usuários do sistema)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | FK → auth.users(id) |
| `tenant_id` | UUID | FK → tenants(id) [RLS] |
| `email` | TEXT | Email único por tenant |
| `full_name` | TEXT | Nome completo |
| `role` | TEXT | `student` \| `teacher` \| `admin` \| `manager` |
| `profile` | JSONB | Learning style, goals, sector |
| `onboarding_completed` | BOOLEAN | Flag completion |
| `created_at` | TIMESTAMPTZ | Auto |
| `updated_at` | TIMESTAMPTZ | Auto |

**Chaves:** PRIMARY KEY (id), FK (tenant_id), RLS policy

---

#### `courses` (Cursos do tenant)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK → tenants(id) [RLS] |
| `title` | TEXT | Nome do curso |
| `description` | TEXT | Descrição longa |
| `status` | TEXT | `draft` \| `published` \| `archived` |
| `created_by` | UUID | FK → users(id) [teacher] |
| `settings` | JSONB | `{max_interactions_per_session, require_completion_order, ...}` |
| `created_at` | TIMESTAMPTZ | Auto |
| `updated_at` | TIMESTAMPTZ | Auto |

**Chaves:** PRIMARY KEY (id), FK (tenant_id, created_by), RLS policy

---

#### `chapters` (Capítulos dentro de cursos)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | Primary key |
| `course_id` | UUID | FK → courses(id) ON DELETE CASCADE |
| `tenant_id` | UUID | FK → tenants(id) [RLS, auto-set via trigger] |
| `title` | TEXT | Título |
| `content` | TEXT | Conteúdo educacional (markdown/rich) |
| `learning_objective` | TEXT | Objetivo de aprendizado |
| `order` | INTEGER | Posição no curso |
| `status` | TEXT | `draft` \| `published` |
| `created_at` | TIMESTAMPTZ | Auto |
| `updated_at` | TIMESTAMPTZ | Auto |

**Chaves:** PRIMARY KEY (id), FK (course_id, tenant_id), RLS policy, TRIGGER denormaliza tenant_id

---

#### `areas` (Áreas de conhecimento/departamentos)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK → tenants(id) [RLS] |
| `name` | TEXT | Nome (ex: "Vendas", "Operações") |
| `description` | TEXT | Descrição |
| `created_at` | TIMESTAMPTZ | Auto |
| `updated_at` | TIMESTAMPTZ | Auto |

**Chaves:** PRIMARY KEY (id), FK (tenant_id), RLS policy

---

#### `enrollments` (Inscrições aluno → curso)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | Primary key |
| `student_id` | UUID | FK → users(id) |
| `course_id` | UUID | FK → courses(id) ON DELETE CASCADE |
| `tenant_id` | UUID | FK → tenants(id) [RLS] |
| `status` | TEXT | `active` \| `completed` \| `dropped` |
| `progress` | NUMERIC | 0-100% |
| `enrolled_at` | TIMESTAMPTZ | Auto |
| `completed_at` | TIMESTAMPTZ | Nullable |
| `updated_at` | TIMESTAMPTZ | Auto |

**Chaves:** PRIMARY KEY (id), FK (student_id, course_id, tenant_id), RLS policy, ADR-002 SECURITY DEFINER function

---

### 3.2 Learning Pipeline

#### `questions` (Perguntas geradas pelo Creator)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | Primary key |
| `chapter_id` | UUID | FK → chapters(id) ON DELETE CASCADE |
| `tenant_id` | UUID | FK → tenants(id) [RLS, auto-set] |
| `text` | TEXT | Enunciado da pergunta |
| `skill` | TEXT | `analise` \| `sintese` \| `aplicacao` \| `reflexao` |
| `intention` | TEXT | Objetivo pedagógico |
| `expected_depth` | TEXT | Resposta esperada (reference) |
| `common_shallow_answer` | TEXT | Armadilha comum |
| `followup_prompts` | TEXT[] | Perguntas de acompanhamento |
| `citations` | TEXT[] | Blocos do capítulo |
| `status` | TEXT | `pending` \| `active` \| `rejected` |
| `approved_by` | UUID | FK → users(id) [teacher, nullable] |
| `metadata` | JSONB | questions_generated, skills_covered, has_practical_scenario |
| `created_at` | TIMESTAMPTZ | Auto |
| `updated_at` | TIMESTAMPTZ | Auto |

**Chaves:** PRIMARY KEY (id), FK (chapter_id, tenant_id, approved_by), RLS policy, TRIGGER denormaliza tenant_id

---

#### `sessions` (Sessões de aprendizado aluno-tutor)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | Primary key |
| `student_id` | UUID | FK → users(id) |
| `chapter_id` | UUID | FK → chapters(id) |
| `question_id` | UUID | FK → questions(id) |
| `tenant_id` | UUID | FK → tenants(id) [RLS] |
| `status` | TEXT | `active` \| `completed` \| `abandoned` |
| `interactions_remaining` | INTEGER | Countdown (default: 3) |
| `started_at` | TIMESTAMPTZ | Auto |
| `completed_at` | TIMESTAMPTZ | Nullable |
| `updated_at` | TIMESTAMPTZ | Auto |

**Chaves:** PRIMARY KEY (id), FK (student_id, chapter_id, question_id, tenant_id), RLS policy

**RPC Functions:**
- `claim_session_turn(p_session_id, p_user_id)` — Atomic claim (C2 FIX)
- `get_random_active_question(p_chapter_id, p_tenant_id)` — RPC (S3.1-H1)

---

#### `messages` (Mensagens no chat)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | Primary key |
| `session_id` | UUID | FK → sessions(id) ON DELETE CASCADE |
| `tenant_id` | UUID | FK → tenants(id) [RLS, auto-set] |
| `role` | TEXT | `student` \| `tutor` |
| `content` | TEXT | Texto da mensagem |
| `turn_number` | INTEGER | 1, 2, 3 (counting UP — H2 FIX) |
| `created_at` | TIMESTAMPTZ | Auto |

**Chaves:** PRIMARY KEY (id), FK (session_id, tenant_id), RLS policy, TRIGGER denormaliza tenant_id

---

#### `analyses` (Análise de mensagens pelo Analyst)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | Primary key |
| `message_id` | UUID | FK → messages(id) ON DELETE CASCADE |
| `session_id` | UUID | FK → sessions(id) |
| `tenant_id` | UUID | FK → tenants(id) [RLS, auto-set] |
| `ai_detection` | JSONB | `{probability, confidence, verdict, indicators, flag}` |
| `metrics` | JSONB | `{text: {chars, words, sentences, has_question}, time: {response_time_seconds}, quality: {topic_relevance, depth_of_thought}}` |
| `flags` | TEXT[] | Lista de flags detectadas |
| `observations` | TEXT[] | Notas do analisador |
| `created_at` | TIMESTAMPTZ | Auto |

**Chaves:** PRIMARY KEY (id), FK (message_id, session_id, tenant_id), RLS policy, TRIGGER denormaliza tenant_id

---

### 3.3 Quality Assurance

#### `qa_reports` (Relatórios do Guardião)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | Primary key |
| `session_id` | UUID | FK → sessions(id) |
| `message_id` | UUID | FK → messages(id) ON DELETE CASCADE |
| `tenant_id` | UUID | FK → tenants(id) [RLS, auto-set] |
| `verdict` | TEXT | `APPROVED` \| `REJECTED` |
| `score` | NUMERIC | 0.0–1.0 |
| `criteria_results` | JSONB | `{C1, C2, C3, C4, C5, C6: {passed, severity, notes}}` |
| `recommendation` | TEXT | Recomendação do validador |
| `created_at` | TIMESTAMPTZ | Auto |

**Chaves:** PRIMARY KEY (id), FK (session_id, message_id, tenant_id), RLS policy, TRIGGER denormaliza tenant_id

---

#### `question_generation_jobs` (Status de geração de questões)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | Primary key |
| `chapter_id` | UUID | FK → chapters(id) ON DELETE CASCADE |
| `tenant_id` | UUID | FK → tenants(id) [RLS] |
| `status` | TEXT | `pending` \| `in_progress` \| `completed` \| `failed` |
| `error_message` | TEXT | Nullable, se falhar |
| `questions_generated` | INTEGER | Contador |
| `started_at` | TIMESTAMPTZ | Auto |
| `completed_at` | TIMESTAMPTZ | Nullable |

**Chaves:** PRIMARY KEY (id), FK (chapter_id, tenant_id), RLS policy

---

### 3.4 Infrastructure & Audit

#### `user_areas` (Associação many-to-many)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → users(id) ON DELETE CASCADE |
| `area_id` | UUID | FK → areas(id) ON DELETE CASCADE |
| `tenant_id` | UUID | FK → tenants(id) [RLS] |
| `assigned_at` | TIMESTAMPTZ | Auto |

**Chaves:** PRIMARY KEY (id), FK (user_id, area_id, tenant_id), UNIQUE (user_id, area_id), RLS policy

---

#### `content_ingestions` (Rastreamento de uploads)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | Primary key |
| `chapter_id` | UUID | FK → chapters(id) ON DELETE CASCADE |
| `tenant_id` | UUID | FK → tenants(id) [RLS] |
| `file_path` | TEXT | Caminho no Storage |
| `file_type` | TEXT | `docx` \| `pdf` \| `pptx` \| `txt` |
| `ingestion_status` | TEXT | `pending` \| `processing` \| `completed` \| `failed` |
| `extracted_text` | TEXT | Nullable, texto extraído |
| `ingested_at` | TIMESTAMPTZ | Auto |

**Chaves:** PRIMARY KEY (id), FK (chapter_id, tenant_id), RLS policy

---

#### `learner_profiles` (Perfis cognitivos progressivos)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | Primary key |
| `enrollment_id` | UUID | FK → enrollments(id) ON DELETE CASCADE |
| `tenant_id` | UUID | FK → tenants(id) [RLS] |
| `big_five` | JSONB | `{openness, conscientiousness, extraversion, agreeableness, neuroticism}` (0-5 scale) |
| `enneagram` | JSONB | `{type: 1-9, wing, level}` |
| `disc` | JSONB | `{profile: D/I/S/C, percentages}` |
| `learning_preferences` | JSONB | `{modality: visual/auditory/kinesthetic, pace: slow/normal/fast}` |
| `updated_at` | TIMESTAMPTZ | Auto |

**Chaves:** PRIMARY KEY (id), FK (enrollment_id, tenant_id), RLS policy

---

#### `platform_audit_log` (Auditoria de ações)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK → tenants(id) [RLS] |
| `actor_id` | UUID | FK → users(id) [user que fez ação] |
| `action` | TEXT | `CREATE_COURSE`, `PUBLISH_COURSE`, `UPDATE_USER_ROLE`, etc. |
| `resource_type` | TEXT | `course`, `chapter`, `question`, `user` |
| `resource_id` | UUID | ID do recurso alterado |
| `changes` | JSONB | Before/after values |
| `ip_address` | INET | IP da requisição |
| `user_agent` | TEXT | User-Agent |
| `created_at` | TIMESTAMPTZ | Auto |

**Chaves:** PRIMARY KEY (id), FK (tenant_id, actor_id), RLS policy

---

## 4. Multi-tenant Isolation — RLS

### 4.1 Helper Function

**Arquivo:** `supabase/migrations/001-rls-helper.sql`

```sql
CREATE OR REPLACE FUNCTION auth_tenant_id() RETURNS UUID AS $$
  SELECT tenant_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION auth_tenant_id() IS
  'Returns tenant_id of currently authenticated user. Used in all RLS policies.';
```

### 4.2 RLS Policies (Pattern)

**Exemplo: `users` table**

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy 1: Tenant isolation (todos os roles)
CREATE POLICY tenant_isolation ON users
  FOR ALL
  USING (tenant_id = auth_tenant_id());

-- Policy 2: Students can read their own profile
CREATE POLICY students_read_self ON users
  FOR SELECT
  USING (auth.uid() = id AND role = 'student');

-- Policy 3: Teachers/Admins read all users in tenant
CREATE POLICY staff_read_all ON users
  FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND (SELECT role FROM users WHERE id = auth.uid()) IN ('teacher', 'admin', 'manager')
  );

-- Policy 4: Admins can update users in their tenant
CREATE POLICY admin_update ON users
  FOR UPDATE
  USING (
    tenant_id = auth_tenant_id()
    AND (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );
```

### 4.3 Tabelas com RLS (17 tabelas)

| # | Tabela | RLS Ativada | Tenant Isolation | Role-Based |
|---|--------|-------------|------------------|------------|
| 1 | tenants | ❌ | N/A | N/A |
| 2 | users | ✅ | Sim | Sim (student vs staff) |
| 3 | courses | ✅ | Sim | Sim (teacher vs student) |
| 4 | chapters | ✅ | Sim | Sim |
| 5 | questions | ✅ | Sim | Sim |
| 6 | enrollments | ✅ | Sim | Sim (ADR-001, ADR-002) |
| 7 | sessions | ✅ | Sim | Sim (own sessions only) |
| 8 | messages | ✅ | Sim | Sim |
| 9 | analyses | ✅ | Sim | Sim |
| 10 | qa_reports | ✅ | Sim | Sim |
| 11 | areas | ✅ | Sim | Sim |
| 12 | user_areas | ✅ | Sim | Sim |
| 13 | content_ingestions | ✅ | Sim | Sim |
| 14 | question_generation_jobs | ✅ | Sim | Sim |
| 15 | learner_profiles | ✅ | Sim | Sim |
| 16 | platform_audit_log | ✅ | Sim | Sim (append-only) |
| 17 | (reservado) | - | - | - |

> **Nota:** `tenants` não tem RLS porque é lido via metadata, não via PostgREST.

---

## 5. Triggers para Denormalização

**Propósito:** Auto-popula `tenant_id` em tabelas filhas (chapters, questions, messages, etc.) para garantir RLS correto sem erro de aplicação.

**Implementação (exemplo para `chapters`):**

```sql
CREATE OR REPLACE FUNCTION set_tenant_id_chapter()
RETURNS TRIGGER AS $$
BEGIN
  NEW.tenant_id := (
    SELECT tenant_id FROM courses WHERE id = NEW.course_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chapters_set_tenant_before_insert
  BEFORE INSERT ON chapters
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_chapter();
```

**Tabelas com trigger:**
- chapters (copia tenant_id de courses)
- questions (copia tenant_id de chapters)
- messages (copia tenant_id de sessions)
- analyses (copia tenant_id de sessions)
- qa_reports (copia tenant_id de sessions)

---

## 6. RPC Functions (Server-Side Logic)

### 6.1 Claim Session Turn (Atomic)

**Arquivo:** `supabase/migrations/XXX-claim-session-turn.sql`

```sql
CREATE OR REPLACE FUNCTION claim_session_turn(
  p_session_id UUID,
  p_user_id UUID
)
RETURNS TABLE (
  session_id UUID,
  turn_number INTEGER,
  interactions_remaining INTEGER
) AS $$
BEGIN
  RETURN QUERY
  UPDATE sessions
  SET
    interactions_remaining = interactions_remaining - 1,
    status = CASE
      WHEN interactions_remaining - 1 <= 0 THEN 'completed'
      ELSE status
    END,
    updated_at = NOW()
  WHERE
    id = p_session_id
    AND student_id = p_user_id
    AND status = 'active'
    AND interactions_remaining > 0
  RETURNING
    id,
    (SELECT COUNT(*)::INTEGER + 1 FROM messages WHERE session_id = p_session_id AND role = 'student'),
    interactions_remaining;
END;
$$ LANGUAGE plpgsql;
```

**Uso:** `POST /api/sessions/{id}/messages` linha 993

### 6.2 Get Random Active Question

**Arquivo:** `supabase/migrations/XXX-get-random-question.sql`

```sql
CREATE OR REPLACE FUNCTION get_random_active_question(p_chapter_id UUID, p_tenant_id UUID)
RETURNS TABLE (id UUID, text TEXT, skill TEXT)
AS $$
BEGIN
  RETURN QUERY
  SELECT q.id, q.text, q.skill
  FROM questions q
  WHERE
    q.chapter_id = p_chapter_id
    AND q.tenant_id = p_tenant_id
    AND q.status = 'active'
  ORDER BY RANDOM()
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;
```

**Razão:** PostgREST não suporta `ORDER BY RANDOM()` — precisa RPC.

---

## 7. Migrations

**Diretório:** `supabase/migrations/`

| # | Data | Descrição |
|---|------|-----------|
| 001 | 2024-01-01 | RLS helper function |
| 002 | 2024-01-01 | Base schema (tenants, users, courses, chapters) |
| 003 | 2024-01-01 | Learning tables (questions, sessions, messages, analyses, qa_reports) |
| 004 | 2024-01-01 | Infrastructure (areas, user_areas, audit_log) |
| 005 | 2024-01-01 | RLS policies (all tables) |
| 006 | 2024-01-01 | Triggers (denormalize tenant_id) |
| ... | ... | ... |
| 028+ | 2026-02-17 | Latest updates (see `supabase/migrations/*.sql`) |

**Executar:**
```bash
supabase migration up
```

---

## 8. Índices de Performance

**Índices críticos** (exemplo):

```sql
-- Lookup rápido de sessões por aluno
CREATE INDEX idx_sessions_student_id ON sessions(student_id);

-- RLS filter + lookup
CREATE INDEX idx_messages_session_id ON messages(session_id, tenant_id);

-- Analytics queries
CREATE INDEX idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX idx_questions_chapter_id ON questions(chapter_id, status);

-- Audit log (time-series)
CREATE INDEX idx_platform_audit_log_created ON platform_audit_log(created_at DESC);
```

---

## 9. Documentação Relacionada

- **[system-overview.md](system-overview.md)** — Infraestrutura, multi-tenant strategy
- **[ai-pipeline.md](ai-pipeline.md)** — Agentes que escrevem em questions, analyses, qa_reports
- **[decisions/README.md](decisions/README.md)** — ADR-001, ADR-002 (enrollment + RLS)
- **[../../README.md](../../README.md)** — Data models (raiz)

---

**Última atualização:** 2026-02-17 | **Versão:** 1.4
