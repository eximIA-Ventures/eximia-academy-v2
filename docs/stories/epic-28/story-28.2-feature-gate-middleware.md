# Story 28.2: Feature Gate Middleware

**Epic:** [Epic 28 — WS3: Feature Enforcement & Plan Gating](../../epics/epic-28-ws3-feature-enforcement-plan-gating.md)
**Version:** 1.0
**Created:** 2026-02-26
**Updated:** 2026-02-26
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 5
**Priority:** P0
**Blocked By:** Story 28.1
**Blocks:** Story 28.3, Story 28.5
**Assigned To:** @dev

---

## User Story

**As a** platform,
**I want** middleware that checks feature access before processing requests,
**so that** tenants on lower plans cannot access premium features.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws3-platform-evolution-architecture.md`, Secao 5.4 (Enforcement Flow) |
| **Epic Ref** | `docs/epics/epic-28-ws3-feature-enforcement-plan-gating.md` — Story 28.2 |
| **Stack** | Next.js 15, TypeScript, Supabase |
| **Package** | `apps/web` |
| **Existing Pattern** | `apps/web/src/lib/rate-limit.ts` (caching pattern) |
| **Risk** | MEDIO — middleware incorrecto bloqueia features legitimas |

---

## Acceptance Criteria

- [ ] **AC1:** Helper `checkFeature(tenantId, featureKey)` retorna `{ allowed, quota, used }`
- [ ] **AC2:** Helper `requireFeature(featureKey)` para API routes — retorna 403 se bloqueado
- [ ] **AC3:** Helper `requireFeatureAction(featureKey)` para server actions — throws Error
- [ ] **AC4:** Cache de plan_features por 5 minutos (in-memory)
- [ ] **AC5:** Response 403 inclui: `{ error, feature, current_plan, required_plan }`
- [ ] **AC6:** Quota check funcional (ex: essencial com max 5 cursos)
- [ ] **AC7:** Integrado em rotas: course_designer (POST), webhooks (POST), api_keys (POST)

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1, 4) Criar checkFeature
  - [ ] Criar `apps/web/src/lib/feature-gate.ts`
  - [ ] `checkFeature(tenantId: string, featureKey: string): Promise<FeatureCheckResult>`
  - [ ] Buscar plano do tenant (com cache 5min)
  - [ ] Lookup em plan_features: `WHERE plan = ? AND feature_key = ?`
  - [ ] Se is_enabled = false: `{ allowed: false, ... }`
  - [ ] Se quota != null: contar uso actual e comparar
  - [ ] Cache: Map<tenantId, { plan, features, expiry }>

- [ ] **Task 2** (AC: 6) Quota counting
  - [ ] Funcao `countFeatureUsage(tenantId, featureKey)`:
    - courses: `SELECT COUNT(*) FROM courses WHERE tenant_id = ?`
    - webhooks: `SELECT COUNT(*) FROM webhooks WHERE tenant_id = ?`
    - trails: `SELECT COUNT(*) FROM learning_trails WHERE tenant_id = ?`
    - quizzes: `SELECT COUNT(*) FROM quiz_sessions WHERE tenant_id = ?`
  - [ ] Retornar count actual

- [ ] **Task 3** (AC: 2, 5) Criar requireFeature para API routes
  - [ ] `requireFeature(featureKey: string, request: NextRequest): Promise<NextResponse | null>`
  - [ ] Se bloqueado: retorna `NextResponse.json({ error: "feature_not_available", feature, current_plan, required_plan }, { status: 403 })`
  - [ ] Se permitido: retorna null (continua)
  - [ ] `required_plan`: determinar menor plano que tem a feature

- [ ] **Task 4** (AC: 3) Criar requireFeatureAction para server actions
  - [ ] `requireFeatureAction(tenantId: string, featureKey: string): Promise<void>`
  - [ ] Se bloqueado: `throw new FeatureNotAvailableError(feature, currentPlan, requiredPlan)`

- [ ] **Task 5** (AC: 7) Integrar em rotas existentes
  - [ ] Course designer POST: `requireFeature('course_designer', request)`
  - [ ] Webhooks POST: `requireFeature('webhooks', request)`
  - [ ] API keys POST: `requireFeature('api_access', request)`
  - [ ] Verificar rotas existentes e adicionar check no inicio

---

## Dev Notes

### Technical Notes

- Cache simples com Map + TTL (nao precisa Redis para isto — volume baixo)
- `required_plan`: logica simples — se feature off em essencial mas on em standard: required = 'standard'
- Quota counting usa service client (bypassa RLS) para contar por tenant
- Feature keys devem ser type-safe: criar enum/union type em shared package
- Invalidacao de cache: quando admin actualiza plan_features, invalidar cache (pode ser via TTL apenas)

### File Locations

| Ficheiro | Acao |
|----------|------|
| `apps/web/src/lib/feature-gate.ts` | CRIAR |
| `apps/web/src/app/api/course-designer/generate/route.ts` | MODIFICAR |
| `apps/web/src/app/api/admin/webhooks/route.ts` | MODIFICAR |
| `apps/web/src/app/api/admin/api-keys/route.ts` | MODIFICAR |

### Testing

- Tenant essencial → course_designer bloqueado (403)
- Tenant standard → course_designer permitido
- Tenant essencial com 5 cursos → 6o curso bloqueado
- Cache funciona (2a chamada nao faz query)
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
