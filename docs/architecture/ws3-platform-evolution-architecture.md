# WS3: Arquitetura — Evolução da Plataforma (Instructor, Trails, Assessments, Adaptive)

> Status: **v1.0** (Análise de gap + arquitectura inicial)
> Data: 2026-02-26
> Agente: @analyst (Atlas)
> Referências:
> - `docs/prd/evolucao-eximia-academy-workstreams.md` (brainstorming WS3)
> - `docs/architecture/ws1-motor-socratico-architecture.md` (padrão de referência)
> - `docs/architecture/ws2-course-creator-architecture.md` (padrão de referência)

---

## 1. Princípio Fundamental

**Plataforma corporativa completa.** A exímIA Academy já tem motor socrático (WS1), criação de cursos IA (WS2), API pública e webhooks. O WS3 fecha os gaps que impedem adoção empresarial: **role de instrutor**, **trilhas inteligentes por cargo**, **avaliação formal** e **aprendizado adaptativo**.

Três princípios guiam o design:

1. **"Instrutor é o coração da operação corporativa."** — Sem instrutor, managers fazem tudo. Com instrutor, a plataforma escala.
2. **"Trilhas por cargo são o produto visível para RH."** — O gestor compra trilhas, não cursos soltos.
3. **"Adaptação é invisível mas essencial."** — O aluno não sabe que o conteúdo se adapta; apenas sente que "funciona".

---

## 2. Análise de Gap (Estado Actual → Estado Alvo)

| Área | Actual | Alvo WS3 | Gap |
|------|--------|----------|-----|
| **Roles** | 4 roles (student, manager, admin, super_admin) | + instructor com permissões granulares | ~8-10 RLS policies + UI |
| **Avaliação** | `assessment_history` table (vazia), `blueprint_assessments` (schema only) | Quiz/exam engine completo com criação, execução, scoring, feedback | UI + scoring + analytics |
| **Trilhas** | Cursos soltos, sem sequência | Trails por cargo, skill framework, recomendação IA | Domínio inteiro novo |
| **Perfil Adaptativo** | `learner_profiles` (Kolb + engagement), 5 assessment types (sem UI) | Assessment UIs, adaptação de conteúdo, spaced repetition | Lógica de adaptação |
| **Feature Gates** | `tenants.settings.features` toggles (sem enforcement) | Enforcement real por plano, per-feature analytics | Middleware + enforcement |

---

## 3. Decisões Arquitecturais

| # | Decisão | Escolha | Justificativa |
|---|---------|---------|---------------|
| D1 | Role `instructor` | **Novo enum value** no role existente | Mínima disrupção. Instrutor herda permissões de manager para leitura + permissões específicas para criação de conteúdo |
| D2 | Instructor scope | **Por tenant** (não cross-tenant) | Consistente com isolamento multi-tenant existente |
| D3 | Permissões | **RBAC existente + scope check** no middleware | Não criar novo sistema de permissões — estender o padrão RLS com `auth_user_role() IN ('instructor', 'admin')` |
| D4 | Quiz engine | **Inline no monorepo** (não microservice) | Consistente com padrão existente. Server actions + API routes |
| D5 | Quiz storage | **Nova tabela `quiz_attempts`** + estender `questions` | Questions já existem no schema, adicionar tracking de respostas |
| D6 | Trilhas | **Novas tabelas `learning_trails` + `trail_courses`** | Sequência ordenada de cursos com pré-requisitos |
| D7 | Job roles | **Nova tabela `job_roles`** linked a `areas` | Job roles pertencem a areas/departamentos do tenant |
| D8 | Skill framework | **Adiado para v2** | Complexo demais para v1. Trilhas por cargo são suficientes |
| D9 | Assessment UIs | **Big Five + DISC primeiro** (2 de 5 tipos) | Maior valor de negócio. Enneagram, MI, Career Anchors em v2 |
| D10 | Adaptação | **Profile-hint no prompt do Mestre (WS1)** | Não mexer na lógica de sequenciamento. Injectar `adaptation_hints` no system prompt socrático |
| D11 | Spaced repetition | **Adiado para v2** | Requer notificação system + scheduling |
| D12 | Feature enforcement | **Middleware check** no pattern existente | `tenants.plan` → feature map → 403 se não autorizado |
| D13 | Plugin system | **Adiado para v2** | Feature flags por plano são suficientes para v1 |

---

## 4. Arquitectura do Sistema

### 4.1 Novo Domínio: Trilhas & Job Roles

```
┌──────────────────────────────────────────────────────────────────┐
│                        TENANT                                     │
│                                                                   │
│  ┌─────────────┐     ┌──────────────┐     ┌──────────────────┐  │
│  │   AREAS     │────▶│  JOB ROLES   │────▶│ LEARNING TRAILS  │  │
│  │ (Depto)     │     │ (Cargos)     │     │ (Trilhas)        │  │
│  └─────────────┘     └──────────────┘     └────────┬─────────┘  │
│                                                     │            │
│                                              ┌──────▼───────┐   │
│                                              │ TRAIL_COURSES │   │
│                                              │ (Sequência)   │   │
│                                              └──────┬────────┘   │
│                                                     │            │
│                              ┌───────────────┬──────┴──────┐    │
│                              ▼               ▼              ▼    │
│                         [Curso A]       [Curso B]      [Curso C] │
│                                                                   │
│  ┌─────────────┐     ┌──────────────┐                            │
│  │   USERS     │────▶│ ENROLLMENTS  │  (auto-enroll via trail)   │
│  │ + instructor│     │ + trail_id   │                            │
│  └─────────────┘     └──────────────┘                            │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Quiz/Assessment Engine

```
┌──────────────────────────────────────────────────────┐
│                  QUIZ ENGINE                          │
│                                                       │
│  Instrutor/Admin                    Aluno             │
│  ──────────────                     ─────             │
│  Criar quiz (questions pool)   →    Receber quiz      │
│  Definir rubric/scoring        →    Responder         │
│  Review respostas              ←    Submeter          │
│  Ver analytics                 ←    Ver feedback      │
│                                                       │
│  ┌─────────┐   ┌─────────────┐   ┌───────────────┐  │
│  │questions │──▶│quiz_sessions│──▶│ quiz_attempts  │  │
│  │(existem) │   │  (nova)     │   │   (nova)       │  │
│  └─────────┘   └─────────────┘   └───────────────┘  │
│                                                       │
│  Scoring: Auto (múltipla escolha) + IA (dissertativa) │
└──────────────────────────────────────────────────────┘
```

### 4.3 Adaptive Profile Flow

```
┌─────────────────────────────────────────────────────────┐
│              ADAPTIVE PROFILE SYSTEM                     │
│                                                          │
│  ┌──────────────┐         ┌────────────────┐            │
│  │  Explicit     │         │  Implicit       │            │
│  │  (Testes)     │         │  (Detecção WS1) │            │
│  │              │         │                │            │
│  │  Big Five    │         │  Kolb styles    │            │
│  │  DISC        │         │  Engagement     │            │
│  │              │         │  Reasoning      │            │
│  └──────┬───────┘         └───────┬────────┘            │
│         │                         │                      │
│         └──────────┬──────────────┘                      │
│                    ▼                                     │
│         ┌──────────────────┐                             │
│         │  LEARNER PROFILE  │  (tabela já existe)        │
│         │  + assessment     │                             │
│         │    _history       │                             │
│         └────────┬─────────┘                             │
│                  │                                       │
│         ┌────────▼─────────┐                             │
│         │ ADAPTATION HINTS  │  → Mestre (WS1 prompt)     │
│         │ + recommendation  │  → Trail suggestion        │
│         │   engine          │  → Quiz difficulty          │
│         └──────────────────┘                             │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Schema Changes (Novas Tabelas)

### 5.1 Instructor Role (Migration)

```sql
-- Extend role enum
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('student', 'manager', 'admin', 'super_admin', 'instructor'));

-- Instructor-specific permissions table (optional, for fine-grained)
CREATE TABLE instructor_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  can_create_courses BOOLEAN DEFAULT true,
  can_create_quizzes BOOLEAN DEFAULT true,
  can_manage_trails BOOLEAN DEFAULT false,
  can_view_analytics BOOLEAN DEFAULT true,
  can_manage_enrollments BOOLEAN DEFAULT true,
  assigned_area_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);
```

### 5.2 Job Roles & Trails

```sql
CREATE TABLE job_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  seniority_level TEXT CHECK (seniority_level IN ('junior', 'mid', 'senior', 'lead', 'manager')),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

CREATE TABLE learning_trails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_job_role_id UUID REFERENCES job_roles(id) ON DELETE SET NULL,
  estimated_hours INTEGER,
  is_mandatory BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE trail_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id UUID NOT NULL REFERENCES learning_trails(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  "order" INTEGER NOT NULL,
  is_required BOOLEAN DEFAULT true,
  estimated_hours INTEGER,
  UNIQUE(trail_id, course_id)
);

-- Extend enrollments with trail tracking
ALTER TABLE enrollments ADD COLUMN trail_id UUID REFERENCES learning_trails(id) ON DELETE SET NULL;
ALTER TABLE enrollments ADD COLUMN trail_course_order INTEGER;
```

### 5.3 Quiz Engine

```sql
CREATE TABLE quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  quiz_type TEXT NOT NULL CHECK (quiz_type IN ('practice', 'exam', 'diagnostic')),
  time_limit_minutes INTEGER,
  passing_score NUMERIC(5,2) DEFAULT 70.00,
  max_attempts INTEGER DEFAULT 1,
  shuffle_questions BOOLEAN DEFAULT true,
  show_answers_after BOOLEAN DEFAULT true,
  question_ids UUID[] NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_session_id UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  score NUMERIC(5,2),
  total_questions INTEGER NOT NULL,
  correct_answers INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'timed_out', 'abandoned')),
  answers JSONB NOT NULL DEFAULT '[]',
  feedback JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 5.4 Feature Enforcement

```sql
-- Plan-feature mapping (configurable)
CREATE TABLE plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan TEXT NOT NULL CHECK (plan IN ('essencial', 'standard', 'premium')),
  feature_key TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  quota INTEGER, -- NULL = unlimited
  UNIQUE(plan, feature_key)
);

-- Seed initial feature map
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
  ('premium', 'api_access', true, NULL);
```

---

## 6. Epics & Stories

### Grafo de Dependências

```
Epic 25 (Instructor Role) ← independente
    ↓
    ├── Epic 26 (Quiz/Assessment Engine) ← depende de 25 (instructor cria quizzes)
    │
    ├── Epic 27 (Trails & Job Roles) ← depende de 25 (instructor gerencia trails)
    │       ↓
    │       Epic 29 (Adaptive Learning) ← depende de 26 + 27 (perfil + trilhas)
    │
    └── Epic 28 (Feature Enforcement) ← independente (pode paralelizar com 26/27)
```

---

### Epic 25: Instructor Role & RBAC (~21 SP)

**Objetivo**: Adicionar role `instructor` com permissões específicas para criação de conteúdo e gestão de alunos.

| # | Story | SP | Descrição |
|---|-------|---:|-----------|
| 25.1 | DB Migration: instructor role | 3 | Extend role enum, create `instructor_permissions`, update RLS policies (~8-10 policies) |
| 25.2 | Backend: instructor auth & middleware | 5 | Update middleware role checks, navigation por role, server action permissions |
| 25.3 | Admin UI: manage instructors | 5 | UI para promover user a instructor, definir permissões, atribuir áreas |
| 25.4 | Instructor dashboard | 5 | Dashboard específico: meus cursos, meus alunos, quizzes pendentes, analytics resumido |
| 25.5 | Tests: instructor RBAC | 3 | Unit tests RLS, E2E create/login instructor, verify permissions |

**Acceptance Criteria**:
- [ ] Instructor pode criar cursos e chapters (sem precisar ser admin)
- [ ] Instructor vê apenas cursos que criou + cursos das áreas atribuídas
- [ ] Admin pode promover/demover instructors
- [ ] RLS policies impedem instructor de ver dados de outros tenants
- [ ] Dashboard mostra métricas relevantes para o instructor

---

### Epic 26: Quiz & Assessment Engine (~34 SP)

**Objetivo**: Sistema completo de avaliação formal (quizzes, exames, diagnósticos) com criação, execução, scoring e analytics.

| # | Story | SP | Descrição |
|---|-------|---:|-----------|
| 26.1 | DB Migration: quiz tables | 3 | Create `quiz_sessions`, `quiz_attempts` + RLS |
| 26.2 | Quiz creation UI | 8 | Instructor cria quiz: seleciona questions do pool, define regras (tempo, tentativas, nota mínima) |
| 26.3 | Quiz taking UI (student) | 8 | Aluno responde quiz: timer, navegação entre questions, submit. Suporta múltipla escolha e dissertativa |
| 26.4 | Auto-scoring & feedback | 5 | Scoring automático (múltipla escolha) + IA scoring (dissertativa via LLM). Feedback imediato |
| 26.5 | Quiz analytics dashboard | 5 | Taxa de aprovação, questões mais erradas, distribuição de notas, tempo médio por questão |
| 26.6 | Quiz retry & remediation | 3 | Se reprovado: identifica capítulos fracos → sugere revisão → permite nova tentativa |
| 26.7 | Tests: quiz engine | 2 | Unit tests scoring, E2E quiz flow completo |

**Acceptance Criteria**:
- [ ] Instructor cria quiz com pool de questões existentes
- [ ] Aluno completa quiz com timer e feedback imediato
- [ ] Scoring automático para múltipla escolha, IA para dissertativa
- [ ] Analytics mostram desempenho por questão, capítulo e aluno
- [ ] Retry inteligente sugere conteúdo de reforço

---

### Epic 27: Learning Trails & Job Roles (~29 SP)

**Objetivo**: Trilhas de aprendizado sequenciais vinculadas a cargos, com recomendação e auto-enrollment.

| # | Story | SP | Descrição |
|---|-------|---:|-----------|
| 27.1 | DB Migration: trails + job roles | 3 | Create `job_roles`, `learning_trails`, `trail_courses`, extend `enrollments` |
| 27.2 | Job roles CRUD | 5 | Admin/instructor cria cargos por área: nome, senioridade, descrição |
| 27.3 | Trail builder UI | 8 | Drag-and-drop de cursos numa trilha: definir ordem, obrigatoriedade, horas estimadas |
| 27.4 | Trail enrollment & progress | 5 | Auto-enroll alunos em trail por cargo. Track progresso cross-cursos. Notificação de próximo curso |
| 27.5 | Trail dashboard (manager) | 5 | Manager vê: quem está em qual trilha, % completo por cargo, gaps |
| 27.6 | Trail recommendation engine | 3 | IA sugere trilhas baseado em área/cargo do aluno. Usa learner_profile para refinar |

**Acceptance Criteria**:
- [ ] Admin cria cargos vinculados a áreas
- [ ] Instructor monta trilha com cursos ordenados
- [ ] Aluno é auto-enrolled em trilha do seu cargo
- [ ] Dashboard mostra progresso da equipe por trilha
- [ ] Recomendação sugere trilhas relevantes

---

### Epic 28: Feature Enforcement & Plan Gating (~18 SP)

**Objetivo**: Enforcement real de features por plano do tenant + analytics de uso.

| # | Story | SP | Descrição |
|---|-------|---:|-----------|
| 28.1 | DB Migration: plan_features | 2 | Create `plan_features` table + seed data |
| 28.2 | Feature gate middleware | 5 | Middleware check: `requireFeature('course_designer')` → 403 se plano não permite. Funciona em API routes e server actions |
| 28.3 | Feature gate UI | 3 | Componente `<FeatureGate feature="trails">` que esconde UI + mostra upgrade CTA |
| 28.4 | Admin: plan management | 3 | Super admin configura features por plano. Admin do tenant vê quais features tem |
| 28.5 | Feature usage analytics | 3 | Track qual feature é mais usada, por tenant e plano. Dashboard para super admin |
| 28.6 | Tests: feature enforcement | 2 | E2E: tenant essencial bloqueado de usar course_designer. Standard tem acesso |

**Acceptance Criteria**:
- [ ] Tenant no plano "essencial" não acessa course designer
- [ ] UI mostra "Upgrade para Standard" quando feature bloqueada
- [ ] Super admin configura matrix feature×plano
- [ ] Analytics mostram feature adoption por plano

---

### Epic 29: Adaptive Learning & Assessments (~26 SP)

**Objetivo**: Assessment UIs para perfil explícito (Big Five, DISC) + adaptação de conteúdo baseada no perfil.

**Depende de**: Epic 26 (quiz engine para assessment delivery) + WS1 (motor socrático para adaptação)

| # | Story | SP | Descrição |
|---|-------|---:|-----------|
| 29.1 | Big Five assessment UI | 5 | Formulário 44-item NEO-PI-R simplificado. Scoring automático. Salva em `assessment_history` |
| 29.2 | DISC assessment UI | 5 | Formulário DISC 28-item. Scoring automático. Visualização radar chart |
| 29.3 | Profile dashboard (student) | 5 | "Meu perfil de aprendizado": Kolb (implícito) + Big Five + DISC. Insights em linguagem simples |
| 29.4 | Team profile view (manager) | 3 | Manager vê perfil agregado da equipe: distribuição DISC, pontos fortes/fracos coletivos |
| 29.5 | Adaptation hints injection | 5 | Integração com WS1: injectar `adaptation_hints` + DISC/Big Five no system prompt do Mestre socrático |
| 29.6 | Trail recommendation by profile | 3 | Refinar recomendação de trilhas com base no perfil (ex: alto "Openness" → trilhas de inovação) |

**Acceptance Criteria**:
- [ ] Aluno completa Big Five e DISC com UX amigável (não parecer "teste")
- [ ] Dashboard mostra perfil unificado (implícito + explícito)
- [ ] Manager vê composição da equipe
- [ ] Motor socrático adapta linguagem ao perfil
- [ ] Recomendações de trilha consideram perfil

---

## 7. Resumo de Scope

| Epic | Título | SP | Prioridade | Depende de |
|------|--------|---:|-----------|-----------|
| 25 | Instructor Role & RBAC | 21 | **P0** | Nenhum |
| 26 | Quiz & Assessment Engine | 34 | **P0** | Epic 25 |
| 27 | Learning Trails & Job Roles | 29 | **P1** | Epic 25 |
| 28 | Feature Enforcement & Plan Gating | 18 | **P1** | Nenhum |
| 29 | Adaptive Learning & Assessments | 26 | **P2** | Epics 26, 27, WS1 |
| **Total** | | **128 SP** | | |

### Ordem de Execução Recomendada

```
Sprint 1: Epic 25 (Instructor) + Epic 28 (Feature Gates)  ← paralelos
          ↓
Sprint 2: Epic 26 (Quiz Engine)
          ↓
Sprint 3: Epic 27 (Trails & Job Roles)
          ↓
Sprint 4: Epic 29 (Adaptive Learning) ← requer WS1 para adaptação socrática
```

---

## 8. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| `instructor` role quebra RLS existentes | Alto | Testar todas as 30+ policies com o novo role antes de deploy |
| Quiz engine overscoped | Médio | v1 apenas múltipla escolha. Dissertativa com IA na v2 |
| Trail builder UX complexa | Médio | Drag-and-drop simples, sem branching na v1 |
| DISC/Big Five licensing | Baixo | Usar versões open-source (IPIP-NEO, DISC simplificado) |
| Dependência de WS1 para Epic 29 | Médio | Epic 29 pode entregar assessments sem adaptação. Adaptação é incremental |

---

## 9. Adiado para v2+

| Feature | Justificativa |
|---------|---------------|
| Skill/competency framework completo | Complexo. Trilhas por cargo são suficientes para v1 |
| Spaced repetition scheduling | Requer notification system + cron jobs |
| Plugin marketplace | Feature flags por plano são suficientes |
| Enneagram, MI, Career Anchors UIs | Big Five + DISC cobrem 80% do valor |
| Quiz proctoring | Não necessário para contexto corporativo interno |
| Custom roles | RBAC fixo com 5 roles cobre os casos de uso |
| Content difficulty adjustment | Requer mais dados. Profile hints no prompt são suficientes |
| Learning path branching | Trilhas lineares na v1. Branching é v2 |

---

*WS3 Architecture v1.0 — Evolução da Plataforma*
*exímIA Academy — 2026*
*— Atlas, investigando a verdade 🔎*
