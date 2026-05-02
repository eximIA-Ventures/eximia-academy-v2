# Story 28.4: Admin — Plan Management UI

**Epic:** [Epic 28 — WS3: Feature Enforcement & Plan Gating](../../epics/epic-28-ws3-feature-enforcement-plan-gating.md)
**Version:** 1.0
**Created:** 2026-02-26
**Updated:** 2026-02-26
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 3
**Priority:** P1
**Blocked By:** Story 28.1, Story 28.2
**Blocks:** None
**Assigned To:** @dev

---

## User Story

**As a** super admin,
**I want** to configure which features are available on each plan,
**so that** I can manage the feature matrix without code changes.

---

## Acceptance Criteria

- [ ] **AC1:** Page `/admin/plans` (super_admin only) com matrix editavel
- [ ] **AC2:** Matrix: linhas = features, colunas = planos. Toggle on/off + quota input
- [ ] **AC3:** Server action `updatePlanFeature(plan, featureKey, isEnabled, quota)`
- [ ] **AC4:** Validador Zod `updatePlanFeatureSchema`
- [ ] **AC5:** Para admin do tenant: Card "Seu Plano" mostrando features incluidas vs bloqueadas
- [ ] **AC6:** Botao "Solicitar Upgrade" com modal de comparacao de planos
- [ ] **AC7:** Alteracoes tem efeito imediato (cache invalidado)

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1, 2) Pagina super admin
  - [ ] Criar `apps/web/src/app/(platform)/admin/plans/page.tsx`
  - [ ] Role check: super_admin only
  - [ ] Grid/table: 7 linhas (features) x 3 colunas (planos)
  - [ ] Cada celula: toggle (enabled) + input (quota, se aplicavel)

- [ ] **Task 2** (AC: 3, 4, 7) Server action
  - [ ] `updatePlanFeature(plan, featureKey, isEnabled, quota)` em actions
  - [ ] UPDATE plan_features SET is_enabled, quota WHERE plan AND feature_key
  - [ ] Invalidar cache de feature-gate (TTL reset ou explicit clear)
  - [ ] Validador Zod em `packages/shared/src/validators/plan-features.ts`

- [ ] **Task 3** (AC: 5) Card "Seu Plano" para admin
  - [ ] No dashboard admin: Card mostrando plano actual
  - [ ] Lista de features: check (incluida) ou X (nao incluida)
  - [ ] Quota actual vs limite (se aplicavel)

- [ ] **Task 4** (AC: 6) Upgrade CTA
  - [ ] Modal comparacao: 3 colunas (essencial/standard/premium)
  - [ ] Features listadas com check/X por plano
  - [ ] Botao "Solicitar Upgrade" (por agora mailto ou link externo)

---

## Dev Notes

### Technical Notes

- Rota `/admin/plans` e correcta — super_admin usa mesmo prefixo `/admin/` (ver `navigation.ts` linhas 56-64). Nao existe rota `/super-admin/` no projecto
- Matrix editavel: pode ser uma Table com inputs em cada celula, ou form grid
- Cache invalidation: a forma mais simples e resetar o TTL do cache quando super_admin faz update
- Admin do tenant ve features do SEU plano — nao pode editar

### File Locations

| Ficheiro | Acao |
|----------|------|
| `apps/web/src/app/(platform)/admin/plans/page.tsx` | CRIAR |
| `packages/shared/src/validators/plan-features.ts` | CRIAR |

### Testing

- Super admin edita matrix → feature toggle funciona
- Admin ve plano actual correctamente
- Cache invalidado apos update
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
