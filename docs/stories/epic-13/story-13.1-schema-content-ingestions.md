# Story 13.1: Schema, Migration e RLS para Content Ingestions

**Epic:** [Epic 13 — AI Content Ingestion](../../epics/epic-13-ai-content-ingestion.md)
**Version:** 1.0
**Created:** 2026-02-10
**Updated:** 2026-02-10
**Author:** Morgan (PM)
**Status:** Pending
**Story Points:** 3
**Priority:** P0 (foundation for all other stories)
**Blocked By:** None
**Blocks:** Story 13.2, Story 13.3, Story 13.4
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** a `content_ingestions` table with proper RLS policies,
**so that** the ingestion pipeline has persistent state tracking with multi-tenant isolation.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.4, Section 3.2 |
| **PRD Ref** | `docs/prd.md` — FR2 (Course Management) |
| **Stack** | Drizzle ORM, PostgreSQL 16 (Supabase), SQL migrations |
| **DB Tables** | `content_ingestions` (NEW) |
| **QA Notes** | Seguir padrao de RLS das tabelas existentes (tenants, courses, chapters) |

---

## Acceptance Criteria

- [ ] **AC1:** Tabela `content_ingestions` criada com todas as colunas
  - id (UUID PK), tenant_id (FK tenants), course_id (FK courses, nullable)
  - created_by (FK auth.users), source_type (enum), source_url, source_filename, source_size_bytes
  - raw_text (TEXT), ai_output (JSONB), status (enum), error_message
  - processing_metadata (JSONB), created_at, updated_at
- [ ] **AC2:** Status enum: uploading, extracting, processing, review, approved, failed
- [ ] **AC3:** Source type enum: pdf, docx, txt, audio, video_url, paste
- [ ] **AC4:** RLS policies implementadas
  - SELECT: managers/admins do mesmo tenant
  - INSERT: managers/admins do mesmo tenant
  - UPDATE: managers/admins do mesmo tenant (own records only via created_by)
  - DELETE: admins do mesmo tenant
- [ ] **AC5:** Drizzle schema em `packages/database/src/schema/content-ingestions.ts`
- [ ] **AC6:** Export adicionado em `packages/database/src/schema/index.ts`
- [ ] **AC7:** Migration SQL funcional via `supabase db push`
- [ ] **AC8:** TypeScript types exportados de `@eximia/database`

---

## CodeRabbit Integration

> CodeRabbit will review this story's PR for: RLS policy correctness, FK constraints, enum validation, multi-tenant isolation patterns.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 5, 6, 8) Criar Drizzle schema
  - [ ] Criar `packages/database/src/schema/content-ingestions.ts`
  - [ ] Definir todas colunas com tipos corretos
  - [ ] Adicionar FK references com onDelete behavior
  - [ ] Exportar no `packages/database/src/schema/index.ts`
  - [ ] Verificar `pnpm typecheck` passa

- [ ] **Task 2** (AC: 1, 2, 3, 4, 7) Criar migration SQL
  - [ ] Criar `supabase/migrations/20260211000001_content_ingestion.sql`
  - [ ] CREATE TABLE com CHECK constraints para enums
  - [ ] ENABLE ROW LEVEL SECURITY
  - [ ] Criar 4 RLS policies (select, insert, update, delete)
  - [ ] Usar funcoes helper existentes: `auth_tenant_id()`, `auth_user_role()`, `auth.uid()`
  - [ ] Testar migration com `supabase db push`

- [ ] **Task 3** (AC: 4) Validar RLS isolation
  - [ ] Testar: manager do tenant A nao ve ingestions do tenant B
  - [ ] Testar: student nao consegue SELECT
  - [ ] Testar: manager so edita proprios registros
  - [ ] Testar: admin pode deletar

---

## Dev Notes

### Drizzle Schema

```typescript
// packages/database/src/schema/content-ingestions.ts
import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { courses } from "./courses"
import { tenants } from "./tenants"
import { users } from "./users"

export const contentIngestions = pgTable("content_ingestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  courseId: uuid("course_id")
    .references(() => courses.id, { onDelete: "set null" }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sourceType: text("source_type", {
    enum: ["pdf", "docx", "txt", "audio", "video_url", "paste"],
  }).notNull(),
  sourceUrl: text("source_url"),
  sourceFilename: text("source_filename"),
  sourceSizeBytes: integer("source_size_bytes"),
  rawText: text("raw_text"),
  aiOutput: jsonb("ai_output"),
  status: text("status", {
    enum: ["uploading", "extracting", "processing", "review", "approved", "failed"],
  })
    .notNull()
    .default("uploading"),
  errorMessage: text("error_message"),
  processingMetadata: jsonb("processing_metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})
```

### Migration SQL

```sql
-- 20260211000001_content_ingestion.sql
CREATE TABLE content_ingestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL
    CHECK (source_type IN ('pdf','docx','txt','audio','video_url','paste')),
  source_url TEXT,
  source_filename TEXT,
  source_size_bytes INTEGER,
  raw_text TEXT,
  ai_output JSONB,
  status TEXT NOT NULL DEFAULT 'uploading'
    CHECK (status IN ('uploading','extracting','processing','review','approved','failed')),
  error_message TEXT,
  processing_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE content_ingestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ingestions_select" ON content_ingestions FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager','admin'));

CREATE POLICY "ingestions_insert" ON content_ingestions FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager','admin'));

CREATE POLICY "ingestions_update" ON content_ingestions FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND created_by = auth.uid())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "ingestions_delete" ON content_ingestions FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin');
```

### File Locations

```
packages/database/src/schema/
├── content-ingestions.ts        # NEW
└── index.ts                     # UPDATED: add export

supabase/migrations/
└── 20260211000001_content_ingestion.sql  # NEW
```

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa, Drizzle schema compila | Yes |
| Pre-PR | Migration aplica sem erro, RLS policies testadas manualmente | Yes |

---

## Definition of Done

- [ ] Drizzle schema compila sem erros
- [ ] Migration aplica com sucesso
- [ ] RLS policies testadas (4 cenarios)
- [ ] Types exportados de `@eximia/database`
- [ ] `pnpm lint && pnpm typecheck` pass

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dev)** | Criar schema, migration, testar RLS |
| **@qa (QA)** | Validar isolation multi-tenant |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Migration conflita com existentes | Low | Usar timestamp sequencial, testar localmente |
| RLS helper functions nao existem | Low | Ja implementadas em epics anteriores |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-10 | 1.0 | Story criada | Morgan (PM) |

---

## QA Results

*(To be filled by @qa after review)*

---

## Dev Agent Record

### Agent Model Used
*(To be filled by @dev)*

### Debug Log References
*(To be filled by @dev)*

### Completion Notes
*(To be filled by @dev)*

### File List
*(To be filled by @dev)*

---

*Story criada por Morgan (PM) — eximIA Academy*

— Morgan, planejando o futuro 📊
