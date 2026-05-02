# Epic 6: Simplificação & Segurança

**Version:** 1.0
**Created:** 2026-02-08
**Updated:** 2026-02-08
**Author:** Morgan (PM Agent)
**Status:** Draft
**PRD Reference:** `docs/prd.md` — FR1 (dual-mode), NFR4-5 (segurança, LGPD)
**Architecture Reference:** `docs/architecture.md` v1.3 — Section 14.3 (Rate Limiting), 14.6 (LGPD)
**Roadmap Reference:** `docs/stories/roadmap-consolidacao.md` — Sprint 1

---

## Epic Goal

Simplificar a plataforma removendo o dual-mode (universidade/corporativo) para foco exclusivamente corporativo, e fechar os dois gaps de segurança/compliance que bloqueiam produção: rate limiting nas APIs e endpoints de privacidade LGPD. Ao final deste épico, a plataforma estará livre de complexidade desnecessária e em conformidade legal e de segurança para deploy em produção.

## Epic Context

| Item | Detalhe |
|------|---------|
| **Stack** | Next.js 15 (App Router) + Supabase + Drizzle ORM + Tailwind CSS 4 + shadcn/ui |
| **Dual-Mode Atual** | `tenant.mode` ("university" \| "corporate") permeia ~35-40 arquivos em DB, types, UI, tests |
| **Rate Limiting** | Nenhum — APIs expostas sem proteção contra abuso |
| **LGPD** | Sem endpoints de privacidade — NFR5 não atendido |
| **Decisão Estratégica** | Foco 100% corporativo. Modo universidade poderá ser reintroduzido futuramente se necessário |
| **Sprint Reference** | `docs/stories/sprint-remove-dual-mode/sprint-overview.md` |

---

## Existing System Context

### Infrastructure Already in Place

| Component | Status | Reference |
|-----------|--------|-----------|
| Dual-mode types (`TenantMode`) | Implemented | `packages/shared/src/types/models.ts` |
| MODE_LABELS config | Implemented | `packages/shared/src/constants/mode-config.ts` |
| Mode-aware UI (8+ componentes) | Implemented | sidebar, dashboards, onboarding, course forms |
| Dual-mode tests (6+ arquivos) | Implemented | test files across shared + web |
| RLS policies (28 granular) | Implemented | architecture.md Section 10.3 |
| Middleware (auth + tenant) | Implemented | `apps/web/src/middleware.ts` |
| Database schema (`tenants.mode`, `courses.mode`) | Implemented | migration + Drizzle schemas |

### Current Vulnerability Assessment

| Threat | Current Protection | Gap |
|--------|-------------------|-----|
| API abuse (chat flooding) | None | Rate limiting P0 |
| Brute-force auth | None | Rate limiting P0 |
| LGPD data request (DSAR) | No endpoint | Legal compliance P0 |
| LGPD right to erasure | No endpoint | Legal compliance P0 |
| Prompt injection | Delimiter-based protection | Low residual risk |
| Cross-tenant access | RLS enforced | Addressed |

---

## Stories

---

### Story 6.1: Remover Dual-Mode do Backend

**As a** platform maintainer,
**I want** remover a infraestrutura de dual-mode (university/corporate) das camadas de dados e tipos,
**so that** a plataforma opere exclusivamente no modo corporativo sem complexidade condicional.

**PRD Reference:** FR1 (simplificado)
**Story Points:** 5
**Priority:** P0 (Blocker — precede Stories 6.2 e 6.3 para simplificar codebase)
**Risk:** MEDIUM — migration destrutiva (DROP COLUMN), referências em cadeia

#### Acceptance Criteria

- [ ] **AC1:** Nova migration remove coluna `mode` da tabela `tenants`
- [ ] **AC2:** Nova migration remove coluna `mode` da tabela `courses`
- [ ] **AC3:** Tipo `TenantMode` removido de `packages/shared/src/types/models.ts`
- [ ] **AC4:** Campo `mode` removido dos Drizzle schemas (`tenants.ts`, `courses.ts`)
- [ ] **AC5:** Validador Zod de courses (`packages/shared/src/validators/courses.ts`) sem campo `mode`
- [ ] **AC6:** `mode-config.ts` renomeado para `labels.ts`, exporta apenas labels corporativos como constantes fixas, todos os imports atualizados (QA L-1 FIX)
- [ ] **AC7:** Seed files (`seed.sql`, `seed-remote.ts`) sem referências a mode
- [ ] **AC8:** Server Actions (`admin/settings/actions.ts`, `courses/actions.ts`) sem campo mode
- [ ] **AC9:** API routes admin sem mode nos payloads
- [ ] **AC10:** `pnpm typecheck` passa sem erros em todos os packages
- [ ] **AC11:** `pnpm lint` passa sem erros

#### Technical Notes

- **Migration (QA H-3 FIX):** Criar `supabase/migrations/20260208000001_remove_dual_mode.sql` com `ALTER TABLE tenants DROP COLUMN mode; ALTER TABLE courses DROP COLUMN mode;`. Story 6.4 usa timestamp `20260208000002` para garantir ordering correto.
- **Labels corporativos fixos:**
  ```typescript
  // packages/shared/src/constants/labels.ts (renomear de mode-config.ts)
  export const PLATFORM_LABELS = {
    courses: 'Trilhas',
    dashboard_metrics: ['Competências', 'ROI'],
    hierarchy: ['Gestor T&D', 'Líder', 'Colaborador'],
    onboarding_sector: { label: 'Setor/Área', type: 'text' },
    engagementRate: 'Competências Ativas',
    completionRate: 'ROI de Treinamento',
  } as const
  ```
- **Risco de migration:** Irreversível. Backup do banco antes de executar.
- **Discrepância atual:** Validator Zod aceita `"both"` mas DB não — será corrigido pela remoção completa

**Predicted Agents:**
| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Migration, schemas, types, validators, actions |
| **@data-engineer** | Validação de migration e integridade do schema |

**Quality Gates:**
| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass across all packages | Yes |
| Pre-PR | Migration executa sem erros. Nenhuma referência a `TenantMode` ou `"university"` no código backend | Yes |

---

### Story 6.2: Remover Dual-Mode do Frontend

**As a** platform maintainer,
**I want** remover toda lógica condicional de dual-mode da UI,
**so that** os componentes exibam terminologia corporativa fixa sem complexidade desnecessária.

**Story Points:** 5
**Priority:** P0
**Blocked By:** Story 6.1
**Risk:** MEDIUM — toca 12 componentes em layers distintas

#### Acceptance Criteria

- [ ] **AC1:** Seletor de modo removido de `tenant-settings-form.tsx`
- [ ] **AC2:** Dropdown de modo removido de `course-form-dialog.tsx`
- [ ] **AC3:** Sidebar exibe "Trilhas" fixo (sem getModeLabels)
- [ ] **AC4:** Student dashboard exibe "Trilhas" fixo
- [ ] **AC5:** Teacher dashboard exibe "Trilhas" fixo
- [ ] **AC6:** Manager dashboard exibe "Competências Ativas" e "ROI de Treinamento" fixo
- [ ] **AC7:** Onboarding step-sector unificado para input corporativo (Setor/Área)
- [ ] **AC8:** `mode` removido do TenantProvider context
- [ ] **AC9:** Arquivo `dual-mode-labels.ts` deletado
- [ ] **AC10:** Course card, course table e course detail sem mode badge/column
- [ ] **AC11:** Todos os testes de dual-mode atualizados ou removidos (6+ arquivos)
- [ ] **AC12:** Build do Next.js sem erros
- [ ] **AC13:** `architecture.md` atualizado — remover Section 8.3, atualizar Sections 1 e 6.1, remover todas referências a mode (QA M-3 FIX)

#### Technical Notes

- **Componentes afetados (12):**
  - `tenant-settings-form.tsx` — remover seção modo
  - `course-form-dialog.tsx` — remover select modo
  - `sidebar.tsx` — hardcodar "Trilhas"
  - `student-dashboard.tsx` — hardcodar "Trilhas"
  - `teacher-dashboard.tsx` — hardcodar "Trilhas"
  - `manager-dashboard.tsx` — hardcodar labels
  - `step-sector.tsx` — unificar input
  - `tenant-provider.tsx` — remover mode do context
  - `dual-mode-labels.ts` — deletar
  - `course-detail-client.tsx` — remover mode display
  - `course-card.tsx` — remover mode badge
  - `course-table.tsx` — remover mode column
- **Testes a atualizar:**
  - `mode-config.test.ts` — adaptar para labels fixos
  - `dual-mode-labels.test.ts` — deletar
  - `student-dashboard.test.tsx` — remover assertions de mode
  - `teacher-dashboard.test.tsx` — remover testes dual-mode
  - `manager-dashboard.test.tsx` — remover testes mode labels
  - `step-sector.test.tsx` — simplificar

**Predicted Agents:**
| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Refactor UI, atualizar testes |
| **@qa (Quinn)** | Validação visual: labels corretos, nenhuma referência restante |

**Quality Gates:**
| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. Build sem erros | Yes |
| Pre-PR | Grep por `"university"`, `TenantMode`, `getModeLabels`, `dual-mode` retorna 0 resultados no código (excl. docs deprecated). Todos os testes passam | Yes |

---

### Story 6.3: Rate Limiting nas APIs

**As a** platform operator,
**I want** rate limiting em todas as APIs críticas,
**so that** a plataforma esteja protegida contra abuso, brute-force e custos excessivos de LLM.

**PRD Reference:** NFR4 (segurança)
**Architecture Reference:** architecture.md Section 14.3
**Story Points:** 3
**Priority:** P0 (Blocker de produção)
**Risk:** LOW — implementação isolada no middleware

#### Acceptance Criteria

- [ ] **AC1:** Rate limiting ativo em `/api/sessions/*/messages` — 10 req/min por usuário autenticado
- [ ] **AC2:** Rate limiting ativo em `/api/auth/*` — 5 req/min por IP
- [ ] **AC3:** Rate limiting ativo em `/api/chapters/*/generate-questions` — 5 req/5min por usuário
- [ ] **AC4:** Rate limiting ativo em `/api/courses` (POST) — 20 req/hora por usuário (QA H-1 FIX)
- [ ] **AC5:** Rate limiting catch-all em todos os outros endpoints — 100 req/min por IP (QA H-1 FIX)
- [ ] **AC6:** Rate limiting ativo em `/api/privacy/*` — 3 req/min por usuário (QA M-4 FIX)
- [ ] **AC7:** Resposta `429 Too Many Requests` com header `Retry-After` quando limite excedido
- [ ] **AC8:** Rate limiting usa Upstash Redis (serverless, edge-compatible)
- [ ] **AC9:** Configuração via variáveis de ambiente (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`)
- [ ] **AC10:** Rate limiting funciona em Edge Runtime (middleware do Next.js)
- [ ] **AC11:** Logs de rate limit events para auditoria

#### Technical Notes

- **Dependência:** `@upstash/ratelimit` + `@upstash/redis`
- **Implementação no middleware:** Atualizar `apps/web/src/middleware.ts` com rate limit checks antes da autenticação
- **Sliding window algorithm:** Usar `Ratelimit.slidingWindow()` para distribuição uniforme
- **Fallback:** Se Redis indisponível, permitir request (fail-open) com log de warning
- **Custo Upstash:** Free tier suficiente para MVP (10k req/dia)
  ```typescript
  import { Ratelimit } from "@upstash/ratelimit"
  import { Redis } from "@upstash/redis"

  const redis = Redis.fromEnv()
  const chatLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    analytics: true,
  })
  ```

**Predicted Agents:**
| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementação do middleware com rate limiting |
| **@architect (Aria)** | Review de pattern e fail-open strategy |

**Quality Gates:**
| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass | Yes |
| Pre-PR | Rate limit retorna 429 após exceder threshold. Headers `Retry-After` presentes. Fail-open funciona se Redis down | Yes |

---

### Story 6.4: Endpoints LGPD (Privacidade)

**As a** tenant admin,
**I want** exportar e deletar dados pessoais de usuários,
**so that** a plataforma esteja em conformidade com a LGPD (Art. 18).

**PRD Reference:** NFR5
**Architecture Reference:** architecture.md Section 14.6
**Story Points:** 5
**Priority:** P0 (Blocker legal)
**Risk:** MEDIUM — envolve múltiplas tabelas com FKs, soft delete com retenção

#### Acceptance Criteria

- [ ] **AC1:** `GET /api/privacy/export` retorna JSON com todos os dados pessoais do usuário autenticado
- [ ] **AC2:** Exportação inclui: perfil, enrollments, sessions, messages, analyses (dados do próprio usuário apenas via RLS)
- [ ] **AC3:** `DELETE /api/privacy/delete` inicia soft delete do usuário e todos os seus dados
- [ ] **AC4:** Soft delete marca dados como `deleted_at = NOW()` sem remover fisicamente
- [ ] **AC5:** Job de limpeza programado para remoção física após 30 dias (documentado, implementação futura — MVP marca deletion timestamp apenas)
- [ ] **AC6:** Apenas o próprio usuário pode solicitar export/delete dos seus dados (RLS enforced)
- [ ] **AC7:** Admin pode solicitar export/delete em nome de qualquer usuário do tenant
- [ ] **AC8:** Response do export em formato JSON com estrutura clara e documentada
- [ ] **AC9:** Confirmação obrigatória no delete (request body com `{ confirm: true }`)
- [ ] **AC10:** Audit log: registrar quem solicitou, quando, e tipo de operação (export/delete)
- [ ] **AC11:** Sessions do usuário deletado são anonimizadas (`student_id → NULL`) (QA H-2 FIX)
- [ ] **AC12:** Messages e analyses linkadas são anonimizadas (QA H-2 FIX)
- [ ] **AC13:** Enrollments do usuário deletadas (soft delete) (QA H-2 FIX)
- [ ] **AC14:** Dados agregados de analytics retidos sem PII (QA H-2 FIX)

> **Scope Note (QA M-2 FIX):** Bulk tenant deletion e DPA management são post-MVP. Esta story cobre apenas direitos individuais de dados pessoais (LGPD Art. 18).

#### Technical Notes

- **Export query:** Usar Drizzle ORM com JOINs respeitando RLS — `users` + `enrollments` + `sessions` + `messages` + `analyses` WHERE `user_id = auth.uid()`
- **Admin on-behalf-of (QA M-1 FIX):** Endpoints aceitam query param opcional `?userId=xxx`. Se presente, validar que o caller é admin E que o userId pertence ao mesmo tenant. Exemplo: `GET /api/privacy/export?userId=abc123` (admin only). Sem `userId`, opera sobre o próprio usuário autenticado.
- **Soft delete:** Adicionar coluna `deleted_at TIMESTAMPTZ` na tabela `users`. RLS policies existentes já filtram por tenant — adicionar `AND deleted_at IS NULL` nos policies de SELECT
- **Anonymization cascade (QA H-2 FIX):** Ao soft-deletar um usuário, executar em transaction: `UPDATE sessions SET student_id = NULL WHERE student_id = userId; UPDATE enrollments SET deleted_at = NOW() WHERE student_id = userId;`. Messages e analyses são linkadas via session — com student_id NULL na session, a PII linkage é quebrada.
- **Migration (QA H-3 FIX):** Criar `supabase/migrations/20260208000002_add_user_soft_delete.sql` com `ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL`. Timestamp sequencial após Story 6.1 migration.
- **Formato do export:**
  ```json
  {
    "exported_at": "ISO-8601",
    "user": { "id", "email", "full_name", "role", "profile", "created_at" },
    "enrollments": [...],
    "sessions": [...],
    "messages": [...],
    "analyses": [...]
  }
  ```
- **Rate limit:** Export e delete devem respeitar rate limiting (Story 6.3)
- **Supabase Auth:** Ao soft-deletar, desabilitar o usuário no Supabase Auth (`auth.admin.updateUserById(id, { banned: true })`)

**Predicted Agents:**
| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementação dos endpoints, migration, soft delete |
| **@architect (Aria)** | Review de estratégia de soft delete e impacto no schema |
| **@qa (Quinn)** | Validação: RLS enforcement, export completo, delete respeita 30 dias |

**Quality Gates:**
| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. Migration executa | Yes |
| Pre-PR | Export retorna dados corretos (apenas do próprio usuário). Delete marca `deleted_at`. Usuário banido no Supabase Auth. Admin pode operar em nome de usuário do tenant. Audit log registrado | Yes |

---

## Dependency Graph

```
Story 6.1 (Backend dual-mode) ──→ Story 6.2 (Frontend dual-mode + docs)

Story 6.3 (Rate Limiting)        [independente]

Story 6.4 (LGPD)                 [independente, migration após 6.1]
```

> **QA L-2 FIX:** Stories 6.3 e 6.4 são independentes entre si e de 6.1/6.2. Única restrição: migration de 6.4 usa timestamp posterior a 6.1.

**Execution Order:**
1. **Story 6.1** primeiro (backend limpo antes do frontend)
2. **Story 6.2** após 6.1 (depende dos tipos/schemas limpos)
3. **Stories 6.3 + 6.4** em paralelo (independentes, sem dependência do dual-mode)

---

## Compatibility Requirements

- [ ] Épicos 1-5 continuam funcionando após remoção do dual-mode
- [ ] Dashboards exibem labels corporativos corretamente
- [ ] Onboarding funciona com input de Setor/Área
- [ ] Course CRUD funciona sem campo mode
- [ ] RLS policies intactas (nenhuma alteração em policies de segurança)
- [ ] CI/CD pipeline verde após todas as mudanças

---

## Risk Mitigation

| Risco | Impacto | Mitigação | Rollback |
|-------|---------|-----------|----------|
| Migration DROP COLUMN irreversível | HIGH | Backup completo antes. Testar em staging primeiro | Restore do backup |
| Referências esquecidas a dual-mode | MEDIUM | Grep extensivo pós-implementação. CI type-check captura maioria | Hotfix individual |
| Rate limiting bloqueia usuários legítimos | LOW | Limites generosos para MVP. Fail-open se Redis down | Desabilitar via env var |
| LGPD soft delete quebra queries existentes | MEDIUM | Adicionar `deleted_at IS NULL` apenas nos SELECTs. Testar todas as queries | Remover coluna deleted_at |
| Upstash Redis indisponível | LOW | Fail-open strategy — requests passam sem rate limit | Rate limiting desabilitado gracefully |

---

## Quality Assurance Strategy

**Validation por story:**
- **6.1 + 6.2:** Grep pós-implementação garante zero referências a dual-mode
- **6.3:** Load testing básico para validar thresholds
- **6.4:** RLS testing para garantir isolamento de dados pessoais

**Regression Prevention:**
- Todos os testes existentes devem passar após mudanças
- Build do Next.js deve completar sem erros
- Typecheck deve passar em todos os packages

---

## Definition of Done (Epic Level)

- [ ] Zero referências a `TenantMode`, `"university"`, `dual-mode` no código (excl. docs deprecated)
- [ ] Labels corporativos fixos em todos os componentes
- [ ] Rate limiting ativo em todas as APIs críticas
- [ ] Endpoints LGPD (export + delete) operacionais
- [ ] Todos os testes passando
- [ ] Build sem erros
- [ ] Documentação atualizada (architecture.md, stories deprecated)

---

## Total Story Points: 18

| Story | Points | Priority | Dependencies |
|-------|--------|----------|-------------|
| 6.1 Backend Dual-Mode Removal | 5 | P0 | Nenhuma |
| 6.2 Frontend Dual-Mode Removal | 5 | P0 | Story 6.1 |
| 6.3 Rate Limiting | 3 | P0 | Nenhuma |
| 6.4 LGPD Endpoints | 5 | P0 | Nenhuma |

---

## SM Handoff

"Please develop detailed user stories for this consolidation epic. Key considerations:

- Story 6.1 DEVE ser executada antes da 6.2 (tipos e schemas limpos primeiro)
- Stories 6.3 e 6.4 podem ser executadas em paralelo com 6.1/6.2
- A remoção do dual-mode é uma decisão de produto — não é refactoring técnico
- Rate limiting é P0 de segurança — sem isso, APIs estão expostas
- LGPD é P0 legal — sem isso, plataforma não pode operar comercialmente no Brasil
- Story 6.4 requer nova migration (coluna `deleted_at`) — coordenar com Story 6.1 migration
- Grep extensivo pós-Story 6.2 é obrigatório para garantir remoção completa
- Design tokens corporativos: 'Trilhas', 'Competências Ativas', 'ROI de Treinamento', 'Gestor T&D', 'Líder', 'Colaborador'"

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-08 | 1.0 | Epic criado para consolidação P0 | Morgan (PM) |

---

*Epic criado por Morgan (PM Agent) — exímIA Academy v1.0*

— Morgan, planejando o futuro 📊
