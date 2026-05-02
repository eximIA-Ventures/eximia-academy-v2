# Story 28.6: Tests — Feature Enforcement

**Epic:** [Epic 28 — WS3: Feature Enforcement & Plan Gating](../../epics/epic-28-ws3-feature-enforcement-plan-gating.md)
**Version:** 1.0
**Created:** 2026-02-26
**Updated:** 2026-02-26
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 2
**Priority:** P1
**Blocked By:** Story 28.2, Story 28.3
**Blocks:** None
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** comprehensive tests for feature enforcement,
**so that** plan gating works correctly and doesn't block legitimate access.

---

## Acceptance Criteria

- [ ] **AC1:** Unit test: `checkFeature()` — enabled, disabled, quota ok, quota exceeded
- [ ] **AC2:** Unit test: `requireFeature()` retorna 403 com body correcto
- [ ] **AC3:** Unit test: cache invalidation
- [ ] **AC4:** E2E: tenant essencial → course_designer bloqueado
- [ ] **AC5:** E2E: tenant standard → course_designer permitido
- [ ] **AC6:** E2E: tenant essencial com quota 5 → 6o curso bloqueado
- [ ] **AC7:** Regression: features existentes continuam para premium
- [ ] **AC8:** Todos os testes passam

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Unit tests checkFeature
  - [ ] Criar `apps/web/tests/lib/feature-gate.test.ts`
  - [ ] Test: feature enabled, no quota → allowed
  - [ ] Test: feature disabled → not allowed
  - [ ] Test: feature enabled, quota 5, used 3 → allowed (quota: 5, used: 3)
  - [ ] Test: feature enabled, quota 5, used 5 → not allowed
  - [ ] Test: feature key inexistente → not allowed (safe default)
  - [ ] Test: tenant sem plano → not allowed

- [ ] **Task 2** (AC: 2) Unit tests requireFeature
  - [ ] Test: blocked → 403 com body `{ error, feature, current_plan, required_plan }`
  - [ ] Test: allowed → null (continua)

- [ ] **Task 3** (AC: 3) Unit tests cache
  - [ ] Test: 2a chamada nao faz query DB (cache hit)
  - [ ] Test: apos TTL, cache expira e faz query

- [ ] **Task 4** (AC: 4, 5, 6) E2E tests
  - [ ] Criar `tests/e2e/feature-enforcement.spec.ts`
  - [ ] Setup: tenant essencial e tenant standard
  - [ ] Test: essencial tenta course_designer → bloqueado (403 ou UI gate)
  - [ ] Test: standard acede course_designer → permitido
  - [ ] Test: essencial com 5 cursos → 6o bloqueado

- [ ] **Task 5** (AC: 7, 8) Regression
  - [ ] Verificar tenant premium tem acesso a tudo
  - [ ] `pnpm test && pnpm test:e2e && pnpm typecheck`

---

## Dev Notes

### Technical Notes

- Para unit tests: mockar query DB com vi.mock ou injectar service
- Para E2E: pode ser necessario seed data com tenants de planos diferentes
- Cache test: manipular timestamp ou TTL para forcar expiracao

### File Locations

| Ficheiro | Acao |
|----------|------|
| `apps/web/tests/lib/feature-gate.test.ts` | CRIAR |
| `tests/e2e/feature-enforcement.spec.ts` | CRIAR |

### Testing

- Todos os testes passam
- Edge cases cobertos
- `pnpm test && pnpm test:e2e && pnpm typecheck`

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
