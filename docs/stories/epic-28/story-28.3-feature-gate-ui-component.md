# Story 28.3: Feature Gate UI Component

**Epic:** [Epic 28 — WS3: Feature Enforcement & Plan Gating](../../epics/epic-28-ws3-feature-enforcement-plan-gating.md)
**Version:** 1.0
**Created:** 2026-02-26
**Updated:** 2026-02-26
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 3
**Priority:** P0
**Blocked By:** Story 28.2
**Blocks:** None
**Assigned To:** @dev

---

## User Story

**As a** user on a lower-tier plan,
**I want** to see a clear upgrade prompt when accessing blocked features,
**so that** I understand what's available on higher plans.

---

## Acceptance Criteria

- [ ] **AC1:** Componente `<FeatureGate feature="trails">` esconde children se bloqueado
- [ ] **AC2:** Fallback default: Card com icone lock, "Disponivel no plano {plan}", botao "Ver planos"
- [ ] **AC3:** Props: `feature`, `children`, `fallback?` (custom)
- [ ] **AC4:** Hook `useFeatureAccess(featureKey)` retorna `{ allowed, quota, used, loading }`
- [ ] **AC5:** Server-side helper `getFeatureAccess(tenantId, featureKey)` para SSR
- [ ] **AC6:** Aplicado nas paginas: course-designer, trails, webhooks, api-keys

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1, 2, 3) Componente FeatureGate
  - [ ] Criar `apps/web/src/components/feature-gate.tsx`
  - [ ] Se allowed: render children
  - [ ] Se blocked: render fallback ou default upgrade CTA
  - [ ] Default CTA: Card com Lock icon, texto, botao
  - [ ] Usar Card, Button do @eximia/ui
  - [ ] Tokens de tema (bg-bg-card, etc.)

- [ ] **Task 2** (AC: 4) Hook useFeatureAccess
  - [ ] Criar `apps/web/src/hooks/use-feature-access.ts`
  - [ ] Fetch feature status via API ou server action
  - [ ] Retornar `{ allowed, quota, used, loading }`
  - [ ] Cache resultado no client (SWR ou similar)

- [ ] **Task 3** (AC: 5) Server-side helper
  - [ ] `getFeatureAccess(tenantId, featureKey)` em `apps/web/src/lib/feature-gate.ts`
  - [ ] Reusar logica de `checkFeature` (Story 28.2)

- [ ] **Task 4** (AC: 6) Aplicar nas paginas
  - [ ] Wrap course-designer page content com `<FeatureGate feature="course_designer">`
  - [ ] Wrap trails page com `<FeatureGate feature="trails">`
  - [ ] Wrap webhooks admin page com `<FeatureGate feature="webhooks">`
  - [ ] Wrap api-keys admin page com `<FeatureGate feature="api_access">`

---

## Dev Notes

### Technical Notes

- FeatureGate pode funcionar tanto server-side (SSR com getFeatureAccess) quanto client-side (hook)
- Preferir server-side para paginas inteiras (evita flash de conteudo)
- Hook para componentes menores dentro de paginas
- Upgrade CTA: por agora link para pagina de planos (pode ser modal no futuro)

### File Locations

| Ficheiro | Acao |
|----------|------|
| `apps/web/src/components/feature-gate.tsx` | CRIAR |
| `apps/web/src/hooks/use-feature-access.ts` | CRIAR |
| `apps/web/src/lib/feature-gate.ts` | MODIFICAR (add getFeatureAccess) |

### Testing

- Feature bloqueada mostra upgrade CTA
- Feature permitida renderiza normalmente
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
