# Story 28.1: DB Migration — Plan Features

**Epic:** [Epic 28 — WS3: Feature Enforcement & Plan Gating](../../epics/epic-28-ws3-feature-enforcement-plan-gating.md)
**Version:** 1.0
**Created:** 2026-02-26
**Updated:** 2026-02-26
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 2
**Priority:** P0
**Blocked By:** None
**Blocks:** Story 28.2, Story 28.3, Story 28.4, Story 28.5, Story 28.6
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** a `plan_features` table with seed data mapping features to tenant plans,
**so that** the feature enforcement system has a data foundation.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws3-platform-evolution-architecture.md`, Secao 5.4 |
| **Epic Ref** | `docs/epics/epic-28-ws3-feature-enforcement-plan-gating.md` — Story 28.1 |
| **Stack** | Supabase SQL, Drizzle ORM |
| **Package** | `packages/database`, `supabase/migrations/` |
| **Existing Pattern** | `tenants.plan` column (essencial/standard/premium) |
| **Risk** | BAIXO — tabela nova, sem impacto em existentes |

---

## Acceptance Criteria

- [ ] **AC1:** Tabela `plan_features` criada: id, plan (essencial/standard/premium), feature_key, is_enabled, quota (nullable = unlimited), timestamps
- [ ] **AC2:** Unique constraint `(plan, feature_key)`
- [ ] **AC3:** Seed data: 21 rows (3 planos x 7 features: courses, course_designer, quizzes, trails, assessments, webhooks, api_access)
- [ ] **AC4:** RLS: super_admin CRUD, admin read (own tenant plan features)
- [ ] **AC5:** Drizzle schema criado e exportado
- [ ] **AC6:** Migration aplica sem erros

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1, 2) Criar tabela plan_features
  - [ ] Criar `supabase/migrations/20260227100000_plan_features.sql`
  - [ ] `plan TEXT NOT NULL CHECK (plan IN ('essencial', 'standard', 'premium'))`
  - [ ] `feature_key TEXT NOT NULL`
  - [ ] `is_enabled BOOLEAN DEFAULT true`
  - [ ] `quota INTEGER` (NULL = unlimited)
  - [ ] `UNIQUE(plan, feature_key)`

- [ ] **Task 2** (AC: 3) Seed data
  - [ ] INSERT 21 rows conforme matrix:
    - essencial: courses(5), course_designer(off), quizzes(10), trails(off), assessments(off), webhooks(off), api_access(off)
    - standard: courses(50), course_designer(on), quizzes(unlimited), trails(10), assessments(on), webhooks(5), api_access(on)
    - premium: tudo on, tudo unlimited

- [ ] **Task 3** (AC: 4) RLS policies
  - [ ] super_admin: full CRUD
  - [ ] admin: SELECT WHERE plan = (SELECT plan FROM tenants WHERE id = auth_tenant_id())
  - [ ] Outros: sem acesso directo
  - [ ] Enable RLS

- [ ] **Task 4** (AC: 5) Drizzle schema
  - [ ] Criar `packages/database/src/schema/plan-features.ts`
  - [ ] Actualizar `packages/database/src/schema/index.ts`

- [ ] **Task 5** (AC: 6) Validacao
  - [ ] `pnpm typecheck` passa
  - [ ] Migration aplica sem erros
  - [ ] `SELECT COUNT(*) FROM plan_features` = 21

---

## Dev Notes

### Technical Notes

- `tenants.plan` ja tem valores: essencial, standard, premium (migration `20260217000000_tenant_plan_migration.sql`)
- plan_features e uma lookup table — nao tem tenant_id proprio, e global
- Admin ve features do seu plano via JOIN com tenants: `SELECT pf.* FROM plan_features pf JOIN tenants t ON t.plan = pf.plan WHERE t.id = auth_tenant_id()`

### File Locations

| Ficheiro | Acao |
|----------|------|
| `supabase/migrations/20260227100000_plan_features.sql` | CRIAR |
| `packages/database/src/schema/plan-features.ts` | CRIAR |
| `packages/database/src/schema/index.ts` | MODIFICAR |

### Testing

- Migration aplica sem erros
- 21 rows inseridas
- super_admin pode CRUD
- admin pode SELECT (filtrado pelo plano do tenant)
- `pnpm typecheck` passa

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-26 | 1.0 | Story criada a partir do Epic 28 | River (SM) |

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
