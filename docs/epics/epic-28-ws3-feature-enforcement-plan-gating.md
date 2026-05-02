# Epic 28: WS3 — Feature Enforcement & Plan Gating

**Version:** 1.0
**Created:** 2026-02-26
**Updated:** 2026-02-26
**Author:** Atlas (Analyst) com arquitectura de WS3 v1.0
**Status:** Draft
**Architecture Reference:** `docs/architecture/ws3-platform-evolution-architecture.md` — Seções 5.4, 6
**Workstream:** WS3 (Platform Evolution — independente)

---

## Epic Goal

Implementar enforcement real de features por plano do tenant. Hoje o campo `tenants.settings.features` existe como toggles mas sem enforcement — qualquer tenant acede qualquer feature. Este epic cria a infra de gating: tabela `plan_features`, middleware de enforcement, componente UI de gate, e analytics de feature adoption.

## Epic Context

| Item | Detalhe |
|------|---------|
| **Stack** | Next.js 15, Supabase, @eximia/ui |
| **DB Tables** | `plan_features` (NOVO) |
| **Roles Impactados** | super_admin (configura), admin (vê plano), todos (enforcement) |
| **Package** | `apps/web`, `packages/database`, `packages/shared` |
| **Story Points** | 18 SP |
| **Depende de** | Nenhum (independente — pode paralelizar com Epics 25-27) |

---

## Existing System Context

### Infrastructure Already in Place

| Component | Status | Reference |
|-----------|--------|-----------|
| `tenants.plan` column (essencial/standard/premium) | Implementado | `packages/database/src/schema/tenants.ts` |
| `tenants.settings.features` JSONB toggles | Implementado | Sem enforcement |
| Middleware auth com role check | Implementado | `apps/web/src/middleware.ts` |
| Rate limiting (Upstash Redis) | Implementado | `apps/web/src/lib/rate-limit.ts` |
| API key auth com scopes | Implementado | `apps/web/src/lib/api-auth/` |

### What This Epic Changes

```
ANTES:
  tenants.plan existe → nenhum enforcement
  Qualquer tenant acede qualquer feature
  Sem tracking de uso por feature
  Sem upsell path visível para o user

DEPOIS:
  plan_features define matrix feature×plano
  Middleware bloqueia features não autorizadas (403)
  UI esconde features + mostra upgrade CTA
  Analytics mostram adoption por plano
  Super admin configura matrix feature×plano
```

---

## Enhancement Details

### Feature Keys

| Feature Key | Essencial | Standard | Premium |
|-------------|-----------|----------|---------|
| `courses` | ✅ (max 5) | ✅ (max 50) | ✅ (∞) |
| `course_designer` | ❌ | ✅ | ✅ |
| `quizzes` | ✅ (max 10) | ✅ (∞) | ✅ (∞) |
| `trails` | ❌ | ✅ (max 10) | ✅ (∞) |
| `assessments` | ❌ | ✅ | ✅ |
| `webhooks` | ❌ | ✅ (max 5) | ✅ (∞) |
| `api_access` | ❌ | ✅ | ✅ |

### Enforcement Flow

```
Request → Middleware → checkFeature(tenantId, featureKey)
                            ↓
                    plan_features lookup (cache 5min)
                            ↓
                    ┌───────────────────┐
                    │ Enabled + Quota OK │ → Continue
                    │ Enabled + Quota 0  │ → 403 + "Limite atingido"
                    │ Disabled           │ → 403 + "Upgrade para {next_plan}"
                    └───────────────────┘
```

---

## Stories

### Story 28.1: DB Migration — Plan Features

**SP:** 2 | **Priority:** P0

**Descrição:** Criar tabela `plan_features` com seed data para os 3 planos e 7 feature keys.

**Tasks:**

- [ ] Criar migration SQL: `plan_features` (id, plan, feature_key, is_enabled, quota, created_at, updated_at)
- [ ] Constraint: plan IN ('essencial', 'standard', 'premium')
- [ ] Unique constraint: (plan, feature_key)
- [ ] Seed data: 21 rows (3 planos × 7 features) conforme tabela acima
- [ ] RLS: super_admin CRUD, admin read (own tenant plan), demais sem acesso directo
- [ ] Criar Drizzle schema: `packages/database/src/schema/plan-features.ts`
- [ ] Actualizar exports em `packages/database/src/schema/index.ts`

**Acceptance Criteria:**

- [ ] Migration aplica sem erros
- [ ] Seed data inserido correctamente
- [ ] Super admin pode CRUD, admin pode read
- [ ] Query `SELECT * FROM plan_features WHERE plan = 'essencial'` retorna 7 rows

---

### Story 28.2: Feature Gate Middleware

**SP:** 5 | **Priority:** P0

**Descrição:** Middleware/helper que verifica se o tenant tem acesso a uma feature antes de processar o request.

**Tasks:**

- [ ] Criar helper `checkFeature(tenantId, featureKey)` em `apps/web/src/lib/feature-gate.ts`
- [ ] Buscar plano do tenant → lookup em plan_features → retorna `{ allowed: boolean, quota: number | null, used: number }`
- [ ] Cache plan_features por 5 minutos (in-memory ou Redis)
- [ ] Criar helper `requireFeature(featureKey)` para uso em API routes — retorna `NextResponse(403)` se bloqueado
- [ ] Criar helper `requireFeatureAction(featureKey)` para uso em server actions — throws Error se bloqueado
- [ ] Response body para 403: `{ error: "feature_not_available", feature: "course_designer", current_plan: "essencial", required_plan: "standard" }`
- [ ] Quota check: contar uso actual (ex: `SELECT COUNT(*) FROM courses WHERE tenant_id = ?`) vs quota
- [ ] Integrar em rotas existentes: course_designer (POST), webhooks (POST), api_keys (POST)

**Acceptance Criteria:**

- [ ] Tenant essencial bloqueado de usar course_designer (403)
- [ ] Tenant standard acede course_designer
- [ ] Tenant essencial com 5 cursos bloqueado de criar 6º
- [ ] Cache funciona (não faz query a cada request)
- [ ] Error response inclui plano necessário para upgrade

---

### Story 28.3: Feature Gate UI Component

**SP:** 3 | **Priority:** P0

**Descrição:** Componente React que esconde features bloqueadas e mostra CTA de upgrade.

**Tasks:**

- [ ] Criar componente `FeatureGate` em `apps/web/src/components/feature-gate.tsx`
- [ ] Props: `feature: string`, `children: ReactNode`, `fallback?: ReactNode`
- [ ] Se feature permitida: render children normalmente
- [ ] Se feature bloqueada: render fallback (ou default upgrade CTA)
- [ ] Default fallback: Card com ícone de lock, texto "Disponível no plano {required_plan}", botão "Ver planos"
- [ ] Hook `useFeatureAccess(featureKey)` que retorna `{ allowed, quota, used, loading }`
- [ ] Server-side: helper `getFeatureAccess(tenantId, featureKey)` para SSR
- [ ] Aplicar `<FeatureGate>` nas páginas: course-designer, trails, webhooks, api-keys

**Acceptance Criteria:**

- [ ] Feature bloqueada mostra upgrade CTA com design consistente
- [ ] Feature permitida renderiza normalmente (sem overhead visual)
- [ ] Hook funciona tanto client quanto server-side
- [ ] CTA mostra nome do plano necessário

---

### Story 28.4: Admin — Plan Management UI

**SP:** 3 | **Priority:** P1

**Descrição:** Interface para super admin configurar matrix feature×plano e para admin do tenant ver quais features tem.

**Tasks:**

- [ ] Criar page `apps/web/src/app/(platform)/admin/plans/page.tsx` (super_admin only)
- [ ] Matrix editável: linhas = features, colunas = planos. Toggle on/off + quota input
- [ ] Server action `updatePlanFeature(plan, featureKey, isEnabled, quota)`
- [ ] Validador Zod: `updatePlanFeatureSchema`
- [ ] Para admin do tenant: Card "Seu Plano" no dashboard mostrando features incluídas vs bloqueadas
- [ ] Botão "Solicitar Upgrade" que abre modal com comparação de planos
- [ ] Navigation entry: "Planos" no menu super_admin

**Acceptance Criteria:**

- [ ] Super admin edita matrix feature×plano
- [ ] Alterações têm efeito imediato (cache invalidado)
- [ ] Admin do tenant vê seu plano com features listadas
- [ ] Upgrade CTA funciona

---

### Story 28.5: Feature Usage Analytics

**SP:** 3 | **Priority:** P1

**Descrição:** Tracking e dashboard de uso de features por tenant e plano. Permite super admin ver adoption e identificar upsell opportunities.

**Tasks:**

- [ ] Criar tabela `feature_usage_log` (feature_key, tenant_id, action, count, period) ou usar aggregation em tabelas existentes
- [ ] Server action `getFeatureUsageStats(filters)` — aggregar dados por plano, feature, tenant
- [ ] Dashboard super admin: quais features são mais usadas por plano
- [ ] Identificar tenants "batendo no teto" (usage próximo do quota) — upsell opportunities
- [ ] Card: Adoption rate por feature (% de tenants usando cada feature)
- [ ] Card: Quota utilization — tenants com >80% de quota usado
- [ ] Filtros: por plano, por feature, por período

**Acceptance Criteria:**

- [ ] Dashboard mostra adoption real por feature e plano
- [ ] Identifica tenants candidatos a upgrade
- [ ] Dados filtrados correctamente
- [ ] Performance adequada (não faz full table scan)

---

### Story 28.6: Tests — Feature Enforcement

**SP:** 2 | **Priority:** P1

**Descrição:** Testes unitários e E2E para garantir que feature enforcement funciona correctamente.

**Tasks:**

- [ ] Unit test: `checkFeature()` com cenários (feature enabled, disabled, quota ok, quota exceeded)
- [ ] Unit test: `requireFeature()` retorna 403 com body correcto
- [ ] Unit test: Cache invalidation após update de plan_features
- [ ] E2E: Tenant essencial tenta aceder course_designer → bloqueado
- [ ] E2E: Tenant standard acede course_designer → permitido
- [ ] E2E: Tenant essencial com quota 5 cursos → cria 5 ok, 6º bloqueado
- [ ] Regression: Features existentes continuam funcionando para tenants premium

**Acceptance Criteria:**

- [ ] Todos os testes passam
- [ ] Edge cases cobertos (tenant sem plano, feature key inexistente)
- [ ] Zero regressão em funcionalidades existentes

---

## Dependencies

| Dependency | Type | Status |
|-----------|------|--------|
| `tenants.plan` column | Interna | Implementado |
| Middleware auth pattern | Interna | Implementado |
| @eximia/ui components | Interna | Implementado |

## Risks

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Cache de plan_features fica stale | Baixo | TTL curto (5min) + invalidação explícita no update |
| Quota counting lento para tabelas grandes | Médio | Usar COUNT com WHERE indexado. Eventual consistency aceitável |
| Feature key typo causa false positive | Médio | Enum de feature keys em shared package. Type safety |

---

*Epic 28 — WS3 Feature Enforcement & Plan Gating v1.0*
