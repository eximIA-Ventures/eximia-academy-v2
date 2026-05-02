# Story 26.1: DB Migration — Quiz Tables

**Epic:** [Epic 26 — WS3: Quiz & Assessment Engine](../../epics/epic-26-ws3-quiz-assessment-engine.md)
**Version:** 1.0
**Created:** 2026-02-26
**Updated:** 2026-02-26
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 3
**Priority:** P0 (fundacao do quiz engine)
**Blocked By:** Story 25.1 (instructor role)
**Blocks:** Story 26.2, Story 26.3, Story 26.4, Story 26.5, Story 26.6, Story 26.7
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** database tables for quiz sessions and quiz attempts with proper RLS,
**so that** the quiz engine has a solid data foundation.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws3-platform-evolution-architecture.md`, Secao 5.3 |
| **Epic Ref** | `docs/epics/epic-26-ws3-quiz-assessment-engine.md` — Story 26.1 |
| **Stack** | Supabase SQL, Drizzle ORM |
| **Package** | `packages/database`, `supabase/migrations/` |
| **Existing Pattern** | `packages/database/src/schema/questions.ts` (table existente) |
| **Risk** | BAIXO — tabelas novas, sem impacto em existentes |

---

## Acceptance Criteria

- [ ] **AC1:** Tabela `quiz_sessions` criada com campos: id, tenant_id, course_id, chapter_id (nullable), title, quiz_type (practice/exam/diagnostic), time_limit_minutes, passing_score, max_attempts, shuffle_questions, show_answers_after, question_ids UUID[], created_by, is_active, timestamps
- [ ] **AC2:** Tabela `quiz_attempts` criada com campos: id, quiz_session_id, student_id, tenant_id, started_at, completed_at, score, total_questions, correct_answers, status (in_progress/completed/timed_out/abandoned), answers JSONB, feedback JSONB, created_at
- [ ] **AC3:** RLS: instructor/admin CRUD em quiz_sessions (own tenant)
- [ ] **AC4:** RLS: student read quiz_sessions se enrolled no curso
- [ ] **AC5:** RLS: student CRUD quiz_attempts (own records only)
- [ ] **AC6:** RLS: instructor/manager/admin read quiz_attempts (own tenant)
- [ ] **AC7:** Indices criados: (quiz_session_id, student_id), (tenant_id, status) em quiz_attempts
- [ ] **AC8:** Drizzle schemas criados e exportados
- [ ] **AC9:** Migration aplica sem erros

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 1) Criar tabela quiz_sessions
  - [x] Criar `supabase/migrations/20260228200000_quiz_tables.sql`
  - [x] `quiz_type TEXT NOT NULL CHECK (quiz_type IN ('practice', 'exam', 'diagnostic'))`
  - [x] `passing_score NUMERIC(5,2) DEFAULT 70.00`
  - [x] `question_ids UUID[] NOT NULL DEFAULT '{}'`
  - [x] Foreign keys: tenant_id → tenants, course_id → courses, chapter_id → chapters (nullable), created_by → users
  - [x] `ON DELETE CASCADE` para tenant_id e course_id

- [x] **Task 2** (AC: 2) Criar tabela quiz_attempts
  - [x] `status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'timed_out', 'abandoned'))`
  - [x] `answers JSONB NOT NULL DEFAULT '[]'`
  - [x] `feedback JSONB`
  - [x] `score NUMERIC(5,2)`
  - [x] Foreign keys: quiz_session_id → quiz_sessions, student_id → users, tenant_id → tenants
  - [x] `ON DELETE CASCADE` para quiz_session_id

- [x] **Task 3** (AC: 3, 4, 5, 6) RLS policies
  - [x] quiz_sessions SELECT: tenant match + (instructor/admin OR student enrolled)
  - [x] quiz_sessions INSERT/UPDATE/DELETE: instructor/admin + tenant match
  - [x] quiz_attempts SELECT: own records (student) OR tenant match (instructor/admin/manager)
  - [x] quiz_attempts INSERT: student + tenant match
  - [x] quiz_attempts UPDATE: own records only (student)
  - [x] Enable RLS em ambas as tabelas

- [x] **Task 4** (AC: 7) Criar indices
  - [x] `CREATE INDEX idx_quiz_attempts_session_student ON quiz_attempts(quiz_session_id, student_id)`
  - [x] `CREATE INDEX idx_quiz_attempts_tenant_status ON quiz_attempts(tenant_id, status)`
  - [x] `CREATE INDEX idx_quiz_sessions_course ON quiz_sessions(course_id)`
  - [x] `CREATE INDEX idx_quiz_sessions_tenant ON quiz_sessions(tenant_id)`

- [x] **Task 5** (AC: 8) Drizzle schemas
  - [x] Criar `packages/database/src/schema/quiz-sessions.ts`
  - [x] Criar `packages/database/src/schema/quiz-attempts.ts`
  - [x] Relations: quiz_sessions ↔ courses, quiz_attempts ↔ quiz_sessions, quiz_attempts ↔ users
  - [x] Actualizar `packages/database/src/schema/index.ts`

- [x] **Task 6** (AC: 9) Validacao
  - [x] `pnpm typecheck` passa — 6/6 packages OK
  - [x] Migration syntax verified

---

## Dev Notes

### Technical Notes

- `questions` table ja existe em `packages/database/src/schema/questions.ts` — quiz_sessions referencia questions via `question_ids UUID[]` (array de IDs)
- Pattern RLS: seguir mesmo pattern de courses (tenant match + role check)
- Student so pode ver quiz_sessions de cursos em que esta enrolled. Pode-se verificar via JOIN com enrollments ou via RLS sub-query
- `answers JSONB` format: `[{ questionId: uuid, answer: string, selectedOption?: string }]`
- `feedback JSONB` format: `[{ questionId: uuid, correct: boolean, studentAnswer: string, correctAnswer: string, explanation?: string }]`

### File Locations

| Ficheiro | Acao |
|----------|------|
| `supabase/migrations/20260228000000_quiz_tables.sql` | CRIAR |
| `packages/database/src/schema/quiz-sessions.ts` | CRIAR |
| `packages/database/src/schema/quiz-attempts.ts` | CRIAR |
| `packages/database/src/schema/index.ts` | MODIFICAR |

### Testing

- Migration aplica sem erros
- SQL test com role instructor: INSERT quiz_session → allowed
- SQL test com role student: SELECT quiz_session (enrolled) → allowed
- SQL test com role student: INSERT quiz_attempt → allowed
- `pnpm typecheck` passa

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-26 | 1.0 | Story criada a partir do Epic 26 | River (SM) |

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- Full monorepo typecheck: 6/6 packages passed
- Migration timestamp: 20260228200000 (after instructor_role migration)

### Completion Notes List
- quiz_sessions: 16 columns including quiz_type enum, passing_score, shuffle, show_answers_after
- quiz_attempts: 13 columns including JSONB answers/feedback, status enum, score
- RLS: 7 policies total — content roles CRUD sessions, students enrolled SELECT, students own attempts
- Student UPDATE restricted to in_progress attempts only
- 4 performance indexes on session_student, tenant_status, course, tenant
- Drizzle schemas with full typed columns and foreign key references

### File List
- `supabase/migrations/20260228200000_quiz_tables.sql` — NEW: quiz tables migration
- `packages/database/src/schema/quiz-sessions.ts` — NEW: Drizzle schema
- `packages/database/src/schema/quiz-attempts.ts` — NEW: Drizzle schema
- `packages/database/src/schema/index.ts` — MODIFIED: added quiz exports

---

## QA Results

**Reviewer:** Quinn (QA) | **Date:** 2026-02-28 | **Gate:** CONCERNS

### Findings

| ID | Severity | Issue |
|----|----------|-------|
| FIX-26.1-001 | CRITICAL | `quiz_attempts.status` CHECK constraint permite apenas `('in_progress','completed','timed_out','abandoned')` — faltam `'passed','failed','pending_review'` que o scoring tenta gravar. Todas as escritas de score/feedback falham silenciosamente. |

### Positives
- RLS policies bem construidas: 7 policies com tenant isolation + enrollment verification
- Indices de performance corretos (session_student, tenant_status, course, tenant)
- Drizzle schemas corretamente espelham a definicao SQL
- Migration wrapped em BEGIN/COMMIT

### Verdict
Implementacao solida, mas o CHECK constraint demasiado restritivo bloqueia o sistema de scoring (Story 26.4). Ver `docs/stories/epic-26/qa/QA_FIX_REQUEST.md` — FIX-26.1-001.
