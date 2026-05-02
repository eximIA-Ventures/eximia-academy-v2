# Story 27.1: DB Migration — Trails & Job Roles

**Epic:** [Epic 27 — WS3: Learning Trails & Job Roles](../../epics/epic-27-ws3-learning-trails-job-roles.md)
**Version:** 1.0
**Created:** 2026-02-26
**Updated:** 2026-02-26
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 3
**Priority:** P0
**Blocked By:** Story 25.1 (instructor role)
**Blocks:** Story 27.2, Story 27.3, Story 27.4, Story 27.5, Story 27.6
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** database tables for job roles, learning trails, and trail courses,
**so that** the trail system has proper data structures with RLS.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws3-platform-evolution-architecture.md`, Secoes 4.1, 5.2 |
| **Epic Ref** | `docs/epics/epic-27-ws3-learning-trails-job-roles.md` — Story 27.1 |
| **Stack** | Supabase SQL, Drizzle ORM |
| **Package** | `packages/database`, `supabase/migrations/` |
| **Existing Pattern** | `packages/database/src/schema/areas.ts`, `packages/database/src/schema/enrollments.ts` |
| **Risk** | BAIXO — tabelas novas + ALTER em enrollments |

---

## Acceptance Criteria

- [ ] **AC1:** Tabela `job_roles` criada: id, tenant_id, area_id (nullable FK → areas), name, slug, description, seniority_level (junior/mid/senior/lead/manager), created_by, timestamps
- [ ] **AC2:** Unique constraint `(tenant_id, slug)` em job_roles
- [ ] **AC3:** Tabela `learning_trails` criada: id, tenant_id, title, description, target_job_role_id (nullable FK → job_roles), estimated_hours, is_mandatory, status (draft/active/archived), created_by, timestamps
- [ ] **AC4:** Tabela `trail_courses` criada: id, trail_id (FK → learning_trails), course_id (FK → courses), order, is_required, estimated_hours
- [ ] **AC5:** Unique constraint `(trail_id, course_id)` em trail_courses
- [ ] **AC6:** Enrollments extendido: `trail_id UUID REFERENCES learning_trails(id)` + `trail_course_order INTEGER`
- [ ] **AC7:** RLS: instructor/admin CRUD em job_roles, learning_trails, trail_courses
- [ ] **AC8:** RLS: manager read em todas as tabelas (own tenant)
- [ ] **AC9:** RLS: student read learning_trails e trail_courses se enrolled
- [ ] **AC10:** Drizzle schemas criados e exportados
- [ ] **AC11:** Migration aplica sem erros

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1, 2) Criar tabela job_roles
  - [ ] Criar `supabase/migrations/20260229000000_trails_job_roles.sql`
  - [ ] `seniority_level TEXT CHECK (seniority_level IN ('junior', 'mid', 'senior', 'lead', 'manager'))`
  - [ ] Foreign keys: tenant_id → tenants, area_id → areas (ON DELETE SET NULL), created_by → users
  - [ ] `UNIQUE(tenant_id, slug)`

- [ ] **Task 2** (AC: 3) Criar tabela learning_trails
  - [ ] `status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived'))`
  - [ ] Foreign keys: tenant_id → tenants, target_job_role_id → job_roles (ON DELETE SET NULL), created_by → users
  - [ ] `is_mandatory BOOLEAN DEFAULT false`

- [ ] **Task 3** (AC: 4, 5) Criar tabela trail_courses
  - [ ] `"order" INTEGER NOT NULL`
  - [ ] Foreign keys: trail_id → learning_trails (ON DELETE CASCADE), course_id → courses (ON DELETE CASCADE)
  - [ ] `UNIQUE(trail_id, course_id)`
  - [ ] `is_required BOOLEAN DEFAULT true`

- [ ] **Task 4** (AC: 6) Estender enrollments
  - [ ] `ALTER TABLE enrollments ADD COLUMN trail_id UUID REFERENCES learning_trails(id) ON DELETE SET NULL`
  - [ ] `ALTER TABLE enrollments ADD COLUMN trail_course_order INTEGER`

- [ ] **Task 5** (AC: 7, 8, 9) RLS policies
  - [ ] job_roles: instructor/admin INSERT/UPDATE/DELETE + tenant match; manager/student SELECT + tenant match
  - [ ] learning_trails: instructor/admin CRUD + tenant match; manager SELECT + tenant match; student SELECT se enrolled
  - [ ] trail_courses: instructor/admin CRUD; manager/student SELECT
  - [ ] Enable RLS em todas as tabelas

- [ ] **Task 6** (AC: 10) Drizzle schemas
  - [ ] Criar `packages/database/src/schema/job-roles.ts`
  - [ ] Criar `packages/database/src/schema/learning-trails.ts`
  - [ ] Criar `packages/database/src/schema/trail-courses.ts`
  - [ ] Relations: job_roles ↔ areas, learning_trails ↔ job_roles, trail_courses ↔ learning_trails + courses
  - [ ] Actualizar `packages/database/src/schema/index.ts`

- [ ] **Task 7** (AC: 11) Validacao
  - [ ] `pnpm typecheck` passa
  - [ ] Migration aplica sem erros

---

## Dev Notes

### Technical Notes

- `areas` table ja existe: `packages/database/src/schema/areas.ts`
- `enrollments` table ja existe: sera extendida com trail_id e trail_course_order
- `trail_course_order` em enrollments permite saber a posicao do curso na trilha para aquele enrollment
- Pattern RLS: seguir mesmo pattern de courses/areas (tenant match + role check)
- Slug de job_roles: gerar automaticamente do nome (kebab-case)

### File Locations

| Ficheiro | Acao |
|----------|------|
| `supabase/migrations/20260229000000_trails_job_roles.sql` | CRIAR |
| `packages/database/src/schema/job-roles.ts` | CRIAR |
| `packages/database/src/schema/learning-trails.ts` | CRIAR |
| `packages/database/src/schema/trail-courses.ts` | CRIAR |
| `packages/database/src/schema/index.ts` | MODIFICAR |

### Testing

- Migration aplica sem erros
- Constraints de unicidade funcionam
- RLS permite/bloqueia conforme role
- `pnpm typecheck` passa

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-26 | 1.0 | Story criada a partir do Epic 27 | River (SM) |

---

## Dev Agent Record

### Agent Model Used
_(preenchido pelo dev agent)_

### Debug Log References
_(preenchido pelo dev agent)_

### Completion Notes List
_(preenchido pelo dev agent)_

### File List
_(preenchido pelo dev agent)_

---

## QA Results
_(preenchido pelo QA agent)_
