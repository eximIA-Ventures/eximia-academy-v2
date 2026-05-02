# Story 14.1: Schema, Migration e RLS para Question Generation Jobs

**Epic:** [Epic 14 — AI Question Generation Pipeline](../../epics/epic-14-ai-question-generation-pipeline.md)
**Version:** 1.0
**Created:** 2026-02-10
**Updated:** 2026-02-10
**Author:** Morgan (PM)
**Status:** Done
**Story Points:** 3
**Priority:** P0 (foundation)
**Blocked By:** None
**Blocks:** Story 14.2, Story 14.3, Story 14.4
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** a `question_generation_jobs` table and a `job_id` column on `questions`,
**so that** batch generation can be tracked and linked to individual questions.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.4, Section 3.2 |
| **PRD Ref** | `docs/prd.md` — FR4 (Socratic Questions) |
| **Stack** | Drizzle ORM, PostgreSQL 16 (Supabase), SQL migrations |
| **DB Tables** | `question_generation_jobs` (NEW), `questions` (ALTER — add job_id) |
| **QA Notes** | Garantir que questions existentes nao sao afetadas |

---

## Acceptance Criteria

- [x] **AC1:** Tabela `question_generation_jobs` criada
  - id (UUID PK), tenant_id (FK), course_id (FK), triggered_by (FK)
  - scope (enum: 'course', 'chapter'), chapter_ids (UUID array)
  - status (enum: pending, processing, review, completed, failed)
  - progress (JSONB), questions_generated, questions_approved, questions_rejected
  - error_message, created_at, updated_at
- [x] **AC2:** Coluna `job_id` adicionada na tabela `questions`
  - FK para question_generation_jobs(id), nullable, ON DELETE SET NULL
  - Questions existentes (sem job_id) continuam funcionando normalmente
- [x] **AC3:** RLS policies para question_generation_jobs
  - SELECT: managers/admins do mesmo tenant
  - INSERT: managers/admins do mesmo tenant
  - UPDATE: managers/admins do mesmo tenant
  - DELETE: admins only
- [x] **AC4:** Drizzle schema em `packages/database/src/schema/question-generation-jobs.ts`
- [x] **AC5:** Schema `questions.ts` atualizado com campo job_id
- [x] **AC6:** Export no index.ts
- [x] **AC7:** Migration SQL funcional
- [x] **AC8:** Backward-compatible — zero impacto em queries existentes

---

## CodeRabbit Integration

> CodeRabbit will review this story's PR for: FK constraints, RLS correctness, backward compatibility.

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 4, 6) Criar Drizzle schema do job
  - [x] Criar `packages/database/src/schema/question-generation-jobs.ts`
  - [x] Exportar no index.ts
  - [x] Typecheck

- [x] **Task 2** (AC: 5) Atualizar schema de questions
  - [x] Adicionar campo `jobId` em `packages/database/src/schema/questions.ts`
  - [x] FK reference para questionGenerationJobs
  - [x] Manter nullable (backward compatible)

- [x] **Task 3** (AC: 1, 2, 3, 7) Criar migration SQL
  - [x] CREATE TABLE question_generation_jobs
  - [x] ALTER TABLE questions ADD COLUMN job_id
  - [x] RLS policies (4 policies + super_admin bypass)
  - [x] Testar migration

- [x] **Task 4** (AC: 8) Validar backward compatibility
  - [x] Queries existentes de questions continuam funcionando
  - [x] Generate questions existente (por chapter) nao afetado
  - [x] Question review UI existente nao quebrada

---

## Dev Notes

### Drizzle Schema

```typescript
// packages/database/src/schema/question-generation-jobs.ts
import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { courses } from "./courses"
import { tenants } from "./tenants"
import { users } from "./users"

export const questionGenerationJobs = pgTable("question_generation_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  triggeredBy: uuid("triggered_by")
    .notNull()
    .references(() => users.id),
  scope: text("scope", { enum: ["course", "chapter"] })
    .notNull()
    .default("course"),
  chapterIds: text("chapter_ids").array(),
  status: text("status", {
    enum: ["pending", "processing", "review", "completed", "failed"],
  })
    .notNull()
    .default("pending"),
  progress: jsonb("progress").default({}),
  questionsGenerated: integer("questions_generated").default(0),
  questionsApproved: integer("questions_approved").default(0),
  questionsRejected: integer("questions_rejected").default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})
```

### Questions Schema Update

```typescript
// packages/database/src/schema/questions.ts — ADD:
import { questionGenerationJobs } from "./question-generation-jobs"

// Add to pgTable columns:
jobId: uuid("job_id").references(() => questionGenerationJobs.id, { onDelete: "set null" }),
```

### Migration SQL

```sql
-- 20260211000002_question_generation_jobs.sql

CREATE TABLE question_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  triggered_by UUID NOT NULL REFERENCES auth.users(id),
  scope TEXT NOT NULL DEFAULT 'course'
    CHECK (scope IN ('course', 'chapter')),
  chapter_ids UUID[],
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','review','completed','failed')),
  progress JSONB DEFAULT '{}',
  questions_generated INTEGER DEFAULT 0,
  questions_approved INTEGER DEFAULT 0,
  questions_rejected INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add job_id to existing questions table
ALTER TABLE questions ADD COLUMN job_id UUID
  REFERENCES question_generation_jobs(id) ON DELETE SET NULL;

-- RLS for question_generation_jobs
ALTER TABLE question_generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qg_jobs_select" ON question_generation_jobs FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager','admin'));

CREATE POLICY "qg_jobs_insert" ON question_generation_jobs FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager','admin'));

CREATE POLICY "qg_jobs_update" ON question_generation_jobs FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager','admin'));

CREATE POLICY "qg_jobs_delete" ON question_generation_jobs FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin');
```

### File Locations

```
packages/database/src/schema/
├── question-generation-jobs.ts   # NEW
├── questions.ts                  # UPDATED: add jobId
└── index.ts                      # UPDATED: add export

supabase/migrations/
└── 20260211000002_question_generation_jobs.sql  # NEW
```

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Migration aplica, questions existentes intactas | Yes |

---

## Definition of Done

- [ ] Nova tabela criada com RLS
- [ ] Questions.job_id adicionado (nullable)
- [ ] Migration funcional
- [ ] Zero impacto em funcionalidade existente
- [ ] `pnpm lint && pnpm typecheck` pass

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dev)** | Schema, migration, validacao |
| **@qa (QA)** | Testar backward compatibility |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-10 | 1.0 | Story criada | Morgan (PM) |

---

*Story criada por Morgan (PM) — eximIA Academy*

— Morgan, planejando o futuro 📊
