# Story 21.1: Database Migration — Extend Blueprints + New Tables

**Epic:** [Epic 21 — WS2: Orchestrator, API & Database](../../epics/epic-21-ws2-orchestrator-api-database.md)
**Version:** 1.0
**Created:** 2026-02-16
**Updated:** 2026-02-16
**Author:** River (SM)
**Status:** Ready
**Story Points:** 5
**Priority:** P0 (fundacao — todas as API routes dependem disto)
**Blocked By:** None
**Blocks:** Story 21.2, Story 21.3, Story 21.4, Story 21.5
**Assigned To:** @data-engineer

---

## User Story

**As a** developer,
**I want** migrations SQL para estender `course_blueprints` e criar `blueprint_modules` e `blueprint_generation_jobs`,
**so that** o Course Creator tenha persistencia completa.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws2-course-creator-architecture.md`, Secao 15 |
| **PRD Ref** | `Benchmarks/07_Course_Designer/PRD-Course-Designer-v1.0.md` — WS2: Course Creator |
| **Stack** | SQL, Supabase, Drizzle ORM, TypeScript |
| **Package** | `packages/database`, `supabase/migrations` |
| **Existing Pattern** | `packages/database/src/schema/` and existing migration files |
| **Risk** | MEDIUM — altera tabelas existentes, requer backward compatibility |

---

## Acceptance Criteria

- [ ] **AC1:** Migration `YYYYMMDD_extend_blueprints_for_ws2.sql`
  - `course_blueprints` ADD COLUMN: `primary_framework`, `complementary_frameworks[]`, `quality_score`, `neuroscience_score`, `quality_verdict`, `audience_profile` (JSONB), `evaluation_plan` (JSONB), `interaction_strategy` (default `bloom_mapped`), `source_course_id`, `version` (default `3.0`)
  - Todos os novos campos sao nullable (backward-compatible)
- [ ] **AC2:** `blueprint_modules` table criada
  - Columns: id, blueprint_id (FK), tenant_id (FK), order, title, description, duration_minutes, spiral_level, interaction_type (CHECK), framework_stages (JSONB), problema_motor (JSONB), cognitive_load (JSONB), chunks (JSONB), rubrics (JSONB), created_at
  - UNIQUE constraint: (blueprint_id, order)
  - RLS enabled: tenant isolation via `auth_tenant_id()` + manager/admin access
  - Index: `idx_blueprint_modules_blueprint` on blueprint_id
- [ ] **AC3:** `blueprint_generation_jobs` table criada
  - Columns: id, blueprint_id (FK), tenant_id (FK), status (CHECK: pending/processing/completed/failed), current_phase (1-5), phase_results (JSONB), error_message, started_at, completed_at, created_at
  - RLS enabled
- [ ] **AC4:** `blueprint_objectives` extended: ADD `module_id` (FK to blueprint_modules), `abcd` (JSONB)
- [ ] **AC5:** `blueprint_assessments` extended: ADD `module_id` (FK), `kirkpatrick_level`, `rubrics` (JSONB)
- [ ] **AC6:** Drizzle schema files atualizados em `packages/database/src/schema/`
- [ ] **AC7:** Migration aplica sem downtime — todos os ADD COLUMN sao nullable
- [ ] **AC8:** `pnpm typecheck` passa

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Criar migration SQL para estender `course_blueprints`
  - [ ] Criar `supabase/migrations/YYYYMMDD_extend_blueprints_for_ws2.sql`
  - [ ] ADD COLUMN `primary_framework` (TEXT, nullable)
  - [ ] ADD COLUMN `complementary_frameworks` (TEXT[], nullable)
  - [ ] ADD COLUMN `quality_score` (NUMERIC, nullable)
  - [ ] ADD COLUMN `neuroscience_score` (NUMERIC, nullable)
  - [ ] ADD COLUMN `quality_verdict` (TEXT, nullable)
  - [ ] ADD COLUMN `audience_profile` (JSONB, nullable)
  - [ ] ADD COLUMN `evaluation_plan` (JSONB, nullable)
  - [ ] ADD COLUMN `interaction_strategy` (TEXT, default `bloom_mapped`, nullable)
  - [ ] ADD COLUMN `source_course_id` (UUID, nullable)
  - [ ] ADD COLUMN `version` (TEXT, default `3.0`, nullable)
  - [ ] Verificar que todos os campos sao nullable para backward compatibility

- [ ] **Task 2** (AC: 2) Criar tabela `blueprint_modules`
  - [ ] CREATE TABLE com todas as colunas: id (UUID PK), blueprint_id (FK), tenant_id (FK), order (INT), title (TEXT), description (TEXT), duration_minutes (INT), spiral_level (TEXT), interaction_type (TEXT CHECK), framework_stages (JSONB), problema_motor (JSONB), cognitive_load (JSONB), chunks (JSONB), rubrics (JSONB), created_at (TIMESTAMPTZ)
  - [ ] ADD UNIQUE constraint (blueprint_id, order)
  - [ ] CREATE INDEX `idx_blueprint_modules_blueprint` ON blueprint_id
  - [ ] ENABLE ROW LEVEL SECURITY
  - [ ] CREATE POLICY tenant isolation via `auth_tenant_id()`
  - [ ] CREATE POLICY manager/admin access via `auth_user_role()`

- [ ] **Task 3** (AC: 3) Criar tabela `blueprint_generation_jobs`
  - [ ] CREATE TABLE com todas as colunas: id (UUID PK), blueprint_id (FK), tenant_id (FK), status (TEXT CHECK: pending/processing/completed/failed), current_phase (INT 1-5), phase_results (JSONB), error_message (TEXT), started_at (TIMESTAMPTZ), completed_at (TIMESTAMPTZ), created_at (TIMESTAMPTZ)
  - [ ] ENABLE ROW LEVEL SECURITY
  - [ ] CREATE POLICY tenant isolation via `auth_tenant_id()`
  - [ ] CREATE POLICY manager/admin access via `auth_user_role()`

- [ ] **Task 4** (AC: 4) Estender `blueprint_objectives`
  - [ ] ADD COLUMN `module_id` (UUID FK to blueprint_modules, nullable)
  - [ ] ADD COLUMN `abcd` (JSONB, nullable)

- [ ] **Task 5** (AC: 5) Estender `blueprint_assessments`
  - [ ] ADD COLUMN `module_id` (UUID FK to blueprint_modules, nullable)
  - [ ] ADD COLUMN `kirkpatrick_level` (TEXT, nullable)
  - [ ] ADD COLUMN `rubrics` (JSONB, nullable)

- [ ] **Task 6** (AC: 6) Atualizar Drizzle schema files
  - [ ] Criar `packages/database/src/schema/blueprint-modules.ts`
  - [ ] Criar `packages/database/src/schema/blueprint-generation-jobs.ts`
  - [ ] Atualizar `packages/database/src/schema/course-blueprints.ts` com novas colunas
  - [ ] Atualizar `packages/database/src/schema/blueprint-objectives.ts` com module_id e abcd
  - [ ] Atualizar `packages/database/src/schema/blueprint-assessments.ts` com module_id, kirkpatrick_level e rubrics

- [ ] **Task 7** (AC: 7, 8) Validar migration e typecheck
  - [ ] Aplicar migration localmente e verificar zero downtime
  - [ ] Rodar `pnpm typecheck` — deve passar sem erros

---

## Dev Notes

### Technical Notes

RLS example SQL:

```sql
-- Exemplo: RLS para blueprint_modules
ALTER TABLE blueprint_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON blueprint_modules
  FOR ALL USING (tenant_id = auth_tenant_id());
CREATE POLICY "Manager/Admin access" ON blueprint_modules
  FOR ALL USING (auth_user_role() IN ('manager', 'admin'));
```

IMPORTANTE: `courses.tenant_id` e `courses.created_by` sao NOT NULL sem auto-trigger. Garantir que `blueprint_modules.tenant_id` e preenchido explicitamente.

### File Locations

```
supabase/migrations/
└── YYYYMMDD_extend_blueprints_for_ws2.sql  # NOVO

packages/database/src/schema/
├── blueprint-modules.ts             # NOVO
├── blueprint-generation-jobs.ts     # NOVO
├── course-blueprints.ts             # ATUALIZAR
├── blueprint-objectives.ts          # ATUALIZAR
└── blueprint-assessments.ts         # ATUALIZAR
```

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-16 | 1.0 | Story creation | River (SM) |
| 2026-02-16 | 1.1 | PO validation: GO — Assigned To corrigido para @data-engineer; Status Draft → Ready | Pax (PO) |

---

## Dev Agent Record

### Agent Model Used
_To be filled by @dev_

### Debug Log References
_To be filled by @dev_

### Completion Notes List
_To be filled by @dev_

### File List
_To be filled by @dev_

---

## QA Results
_To be filled by @qa_
