# Story 1.2: Setup do Supabase e Schema Inicial

**Epic:** [Epic 1 — Foundation & Auth](../epics/epic-1-foundation-auth.md)
**Version:** 1.0
**Created:** 2026-02-07
**Author:** Morgan (PM Agent)
**Status:** Ready for Review
**Story Points:** 8
**Priority:** P0 (Blocker)
**Blocked By:** 1.1
**Blocks:** 1.3, 1.4
**Assigned To:** @dev (Dex), @architect (Aria) review, @qa (Quinn) RLS audit

---

## User Story

**As a** developer,
**I want** Supabase configurado com schema base e RLS policies,
**so that** tenho banco de dados pronto para multi-tenant.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.2 — Section 10.3 |
| **Security Ref** | `docs/architecture.md` v1.2 — SEC-1 (granular RLS) |
| **Stack** | Supabase (PostgreSQL 16) + Drizzle ORM |
| **Multi-tenant** | RLS on PostgreSQL, `tenant_id` in all tables |
| **Critical** | RLS policies MUST be granular per-operation, per-role (NOT `FOR ALL`) |

---

## Acceptance Criteria

- [ ] **AC1:** Projeto Supabase inicializado com `supabase init`
  - `supabase/config.toml` configurado
  - `supabase start` roda localmente sem erros

- [ ] **AC2:** Tabelas criadas via migration (10 tabelas total: 1 root `tenants` + 9 com `tenant_id` para RLS):

  | # | Tabela | Descricao | Colunas Chave |
  |---|--------|-----------|---------------|
  | 1 | `tenants` | Multi-tenant root | id, name, slug, mode, branding (JSONB), settings (JSONB), plan |
  | 2 | `users` | Auth + Profile | tenant_id, email, full_name, role, profile (JSONB), onboarding_completed |
  | 3 | `courses` | Cursos | tenant_id, title, description, mode, status, created_by, settings (JSONB) |
  | 4 | `chapters` | Capitulos | course_id, tenant_id (auto), title, content, learning_objective, order, status |
  | 5 | `questions` | Creator Agent output | chapter_id, tenant_id (auto), text, skill, intention, expected_depth, status |
  | 6 | `enrollments` | Student-course | student_id, course_id, tenant_id, status, progress, UNIQUE(student_id, course_id) |
  | 7 | `sessions` | Socratic sessions | student_id, chapter_id, question_id, tenant_id, status, interactions_remaining |
  | 8 | `messages` | Chat messages | session_id, tenant_id (auto), role, content, turn_number |
  | 9 | `analyses` | Analyst Agent output | message_id, session_id, tenant_id (auto), ai_detection, metrics, flags |
  | 10 | `qa_reports` | Tester Agent output | session_id, message_id, tenant_id (auto), verdict, score, criteria_results |

- [ ] **AC3:** Indexes criados (19 indexes conforme architecture.md Section 10.3):
  ```sql
  idx_users_tenant, idx_courses_tenant
  idx_chapters_course, idx_chapters_tenant
  idx_questions_chapter, idx_questions_tenant, idx_questions_active (WHERE status = 'active')
  idx_enrollments_student, idx_enrollments_tenant
  idx_sessions_student, idx_sessions_tenant, idx_sessions_active (WHERE status = 'active')
  idx_messages_session, idx_messages_tenant
  idx_analyses_session, idx_analyses_tenant
  idx_qa_reports_session, idx_qa_reports_tenant
  ```

- [ ] **AC4:** RLS habilitado em todas as tabelas com granular per-role policies (28 policies)
  - Zero `FOR ALL USING` — cada tabela tem policies separadas para SELECT, INSERT, UPDATE, DELETE
  - Cada policy inclui `tenant_id = auth_tenant_id()` como filtro base
  - Roles: student ve apenas seus dados, teacher ve dados dos seus cursos, admin/manager ve tudo no tenant

- [ ] **AC5:** Drizzle ORM configurado em `packages/database` com schema tipado
  ```typescript
  // packages/database/src/schema/tenants.ts
  export const tenants = pgTable('tenants', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    mode: text('mode', { enum: ['university', 'corporate'] }).notNull(),
    branding: jsonb('branding').default({}),
    settings: jsonb('settings').default({}),
    plan: text('plan', { enum: ['free', 'pro', 'enterprise'] }).default('free'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  })
  ```

- [ ] **AC6:** Tipos gerados automaticamente via `supabase gen types typescript`
  - Output em `packages/database/src/types/supabase.ts`
  - Script npm: `"gen:types": "supabase gen types typescript --local > src/types/supabase.ts"`

- [ ] **AC7:** Seed data com dados para testes:

  | Entidade | Dados |
  |----------|-------|
  | Tenant | "Demo" (slug: demo, mode: university) |
  | Users | 4 users — 1 por role (student, teacher, admin, manager) |
  | Course | 1 curso "Introducao a IA" (status: published, created_by: teacher) |
  | Chapter | 1 capitulo "Fundamentos de Machine Learning" (order: 1) |

  Credenciais seed:
  ```
  admin@demo.test / admin123
  manager@demo.test / manager123
  teacher@demo.test / teacher123
  student@demo.test / student123
  ```

- [ ] **AC8:** `supabase db push` aplica migrations sem erros
  - `supabase db reset` tambem funciona (reset + seed)

- [ ] **AC9:** Functions criadas:

  | Function | Proposito | Security |
  |----------|-----------|----------|
  | `auth_tenant_id()` | Retorna tenant_id do usuario autenticado | SECURITY DEFINER, STABLE |
  | `auth_user_role()` | Retorna role do usuario autenticado | SECURITY DEFINER, STABLE |
  | `claim_session_turn(p_session_id, p_user_id)` | Atomic claim de turno | SECURITY DEFINER, cross-tenant check (SEC-5) |
  | `release_session_turn(p_session_id, p_user_id)` | Compensacao para pipeline failure | SECURITY DEFINER |

  **`claim_session_turn` DEVE:**
  - Validar session ativa + pertence ao user
  - Cross-tenant check: `session.tenant_id = user.tenant_id` (SEC-5)
  - Decrementar `interactions_remaining` atomicamente
  - Retornar: session_id, chapter_id, question_id, tenant_id, interactions_remaining, turn_number

  **`release_session_turn` DEVE:**
  - Restaurar `interactions_remaining` se pipeline falhar pos-claim
  - Validar ownership antes de restaurar

- [ ] **AC10:** Auto-populate triggers para `tenant_id` em child tables:

  | Trigger | Tabela | Logica |
  |---------|--------|--------|
  | `set_chapter_tenant_id` | chapters | `tenant_id = (SELECT tenant_id FROM courses WHERE id = NEW.course_id)` |
  | `set_question_tenant_id` | questions | `tenant_id = (SELECT tenant_id FROM chapters WHERE id = NEW.chapter_id)` |
  | `set_child_tenant_from_session` | messages, analyses, qa_reports | `tenant_id = (SELECT tenant_id FROM sessions WHERE id = NEW.session_id)` |

---

## Technical Implementation Guide

### Migration Structure

Criar uma unica migration inicial:

```
supabase/migrations/
└── 20260207000000_initial_schema.sql
```

**Ordem de criacao na migration:**
1. Enable extensions (`uuid-ossp`, `pgcrypto`)
2. Tabela `tenants`
3. Tabela `users` (FK → tenants)
4. Tabela `courses` (FK → tenants, users)
5. Tabela `chapters` (FK → courses) + trigger
6. Tabela `questions` (FK → chapters) + trigger
7. Tabela `enrollments` (FK → users, courses)
8. Tabela `sessions` (FK → users, chapters, questions)
9. Tabela `messages` (FK → sessions) + trigger
10. Tabela `analyses` (FK → messages, sessions) + trigger
11. Tabela `qa_reports` (FK → sessions, messages) + trigger
12. Indexes (19)
13. Functions (`auth_tenant_id`, `auth_user_role`, `claim_session_turn`, `release_session_turn`)
14. RLS enable + policies (28)

### RLS Policy Pattern

```sql
-- Helper functions
CREATE OR REPLACE FUNCTION auth_tenant_id() RETURNS UUID AS $$
  SELECT tenant_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth_user_role() RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = auth.uid() AND tenant_id = auth_tenant_id();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Example: courses policies (granular, NOT FOR ALL)
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
```

### Drizzle Setup

```typescript
// packages/database/drizzle.config.ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

### Seed Data

```sql
-- supabase/seed.sql
INSERT INTO tenants (id, name, slug, mode, plan) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Demo', 'demo', 'university', 'pro');

-- Users are created via Supabase Auth, then linked to our users table
-- Seed script should use supabase.auth.admin.createUser() for proper auth integration
```

**Nota:** Seed de users requer `supabase.auth.admin.createUser()` para criar no auth schema tambem. Usar um script TypeScript em `supabase/seed.ts` alem do `seed.sql`.

---

## Tasks

- [x] 1. `supabase init` no root do monorepo
- [x] 2. Criar migration com todas as 10 tabelas (schema architecture.md Section 10.3)
- [x] 3. Criar indexes (19 indexes)
- [x] 4. Criar functions: `auth_tenant_id()`, `auth_user_role()`
- [x] 5. Criar function: `claim_session_turn()` com validacao tenant_id (SEC-5)
- [x] 6. Criar function: `release_session_turn()` (compensacao)
- [x] 7. Criar auto-populate triggers (chapters, questions, messages, analyses, qa_reports)
- [x] 8. Implementar RLS policies granulares (28 policies — zero `FOR ALL`)
- [x] 9. Configurar Drizzle ORM em `packages/database` (schema, config, client)
- [ ] 10. Gerar tipos: `supabase gen types typescript` (requires running Supabase)
- [x] 11. Criar seed: tenant Demo + 4 users + 1 curso + 1 capitulo
- [ ] 12. Testar: `supabase db push && supabase db reset` (requires Docker)
- [ ] 13. Verificar RLS: student A nao ve sessions do student B (requires Docker)

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementacao das migrations e Drizzle setup |
| **@architect (Aria)** | Review do schema vs architecture.md |
| **@qa (Quinn)** | Validacao RLS: testar que student NAO acessa dados de outro student |

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|----------|---------|
| Pre-Commit | `supabase db push` sem erros, tipos gerados | Yes |
| Pre-PR | RLS audit — policies sao granulares (zero FOR ALL), schema matches architecture.md | Yes |
| Security | Isolamento: student A nao ve sessions do student B no mesmo tenant | Yes |
| Architect Review | Schema matches `docs/architecture.md` v1.2 Section 10.3 | Yes |

---

## Definition of Done

- [ ] Todos os ACs passam
- [ ] Migration aplica sem erros (`supabase db push`)
- [ ] `supabase db reset` funciona (reset + seed)
- [ ] RLS policies sao granulares (zero `FOR ALL`)
- [ ] Seed data criado com sucesso (tenant + 4 users + course + chapter)
- [ ] Drizzle types match Supabase schema
- [ ] PR aprovada com security review

---

## Risk Assessment

| Risco | Impacto | Mitigacao | Rollback |
|-------|---------|-----------|----------|
| RLS policies incorretas permitem data leak | CRITICAL | QA audit obrigatorio (Quinn) antes de merge | Reverter migration |
| Circular dependency em triggers | MEDIUM | Testar `supabase db reset` repetidamente | Fix trigger order |
| claim_session_turn race condition | HIGH | Testar com requests concorrentes | Fix atomic logic |

---

*Story criada por Morgan (PM Agent) — eximIA Academy*
