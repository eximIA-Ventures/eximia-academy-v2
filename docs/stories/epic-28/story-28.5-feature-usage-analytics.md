# Story 28.5: Feature Usage Analytics

**Epic:** [Epic 28 — WS3: Feature Enforcement & Plan Gating](../../epics/epic-28-ws3-feature-enforcement-plan-gating.md)
**Version:** 1.0
**Created:** 2026-02-26
**Updated:** 2026-02-26
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 3
**Priority:** P1
**Blocked By:** Story 28.2, Story 28.4
**Blocks:** None
**Assigned To:** @dev

---

## User Story

**As a** super admin,
**I want** analytics showing feature adoption by plan,
**so that** I can identify upsell opportunities and popular features.

---

## Acceptance Criteria

- [ ] **AC1:** Dashboard super admin: feature adoption rate por plano
- [ ] **AC2:** Identifica tenants "batendo no teto" (>80% quota usado)
- [ ] **AC3:** Card: adoption rate por feature (% de tenants usando)
- [ ] **AC4:** Card: quota utilization (tenants com uso alto)
- [ ] **AC5:** Filtros: por plano, por feature, por periodo
- [ ] **AC6:** Server action `getFeatureUsageStats(filters)` funcional

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1, 3) Adoption rate
  - [ ] Criar page ou secao em `/admin/plans` (tab "Analytics")
  - [ ] Para cada feature: contar tenants que usam vs total tenants por plano
  - [ ] Mostrar como % com barra de progresso

- [ ] **Task 2** (AC: 2, 4) Quota utilization
  - [ ] Para features com quota: calcular usage/quota por tenant
  - [ ] Listar tenants com >80% uso (upsell candidates)
  - [ ] Usar Table do @eximia/ui

- [ ] **Task 3** (AC: 5) Filtros
  - [ ] Select: plano
  - [ ] Select: feature
  - [ ] Date range: periodo

- [ ] **Task 4** (AC: 6) Server action
  - [ ] `getFeatureUsageStats(filters)` em actions
  - [ ] Queries aggregadas por plano, feature, tenant
  - [ ] Performance: usar COUNT/GROUP BY, nao full table scan

---

## Dev Notes

### Technical Notes

- Adoption: usar mesma logica de quota counting (Story 28.2) agregada por tenant
- "Usando" = tenant tem pelo menos 1 record (curso, webhook, etc.)
- Nao precisa de tabela nova — agregar de tabelas existentes
- Performance: indices existentes devem ser suficientes

### File Locations

| Ficheiro | Acao |
|----------|------|
| `apps/web/src/app/(platform)/admin/plans/page.tsx` | MODIFICAR (add analytics tab) |

### Testing

- Analytics mostra dados reais
- Filtros funcionam
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
