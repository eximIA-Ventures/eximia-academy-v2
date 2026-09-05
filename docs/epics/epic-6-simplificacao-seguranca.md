# Epic 6: Simplificação & Segurança

**Version:** 1.1
**Created:** 2026-02-08
**Updated:** 2026-08-28
**Author:** Morgan (PM Agent)
**Status:** InReview (medido em 2026-08-28; as 4 stories-filhas estão em `Ready for Review` com 125 caixas fechadas e nenhuma aberta)
**PRD Reference:** `docs/prd.md` — FR1 (dual-mode), NFR4-5 (segurança, LGPD)
**Architecture Reference:** `docs/architecture.md` v1.3 — Section 14.3 (Rate Limiting), 14.6 (LGPD)
**Roadmap Reference:** `docs/stories/roadmap-consolidacao.md` — Sprint 1

---

## Estado da reconciliação

> **Medido em 2026-08-28**, run POP-FIX-001
> `2026-08-12-epic6-declara-rate-limiting-inexistente`, Passo 5. Detector que reprova o drift:
> `apps/web/tests/epic-6-security-posture-doc.test.ts`.
>
> **O que estava errado.** Este épico é a descrição autoritativa da postura de segurança da
> plataforma, e estava congelado no momento anterior à implementação das próprias
> stories-filhas. Ele **negava ativamente dois controles que já existiam**: dizia
> `Rate Limiting: Nenhum` com 6 limiters aplicados no middleware, e `LGPD: Sem endpoints` com
> as rotas de export e delete em disco. Quem modelasse ameaça por este documento revisaria uma
> superfície desprotegida que não existe desde a Story 6.3. As 4 linhas da tabela de
> vulnerabilidades diziam `None`/`No endpoint` pelo mesmo motivo. As 49 caixas da seção
> *Stories* espelham ACs que as filhas já haviam marcado; a informação existia e nunca subiu.
>
> **Duas caixas continuam abertas de propósito, e não são esquecimento:**
>
> | Caixa | Por que fica aberta |
> |---|---|
> | *Todos os testes passando* (DoD) | **Ainda não verificada.** `epic-23-docs-vs-code.test.ts` foi reconciliado em 2026-09-05 (25/25 verde) e não é mais o bloqueio, mas a suíte completa do monorepo não foi rodada nesta run — fechar sem rodar `pnpm test` de ponta a ponta seria trocar uma afirmação falsa por outra não verificada |
> | *CI/CD pipeline verde* (Compatibility) | Mesma razão, no nível do pipeline |
>
> Mais duas ficam abertas por serem asserção de runtime não exercitada (*Épicos 1-5 continuam
> funcionando*, *Build sem erros*) e uma por ter sido **superada pelo Epic 9** (*Onboarding
> funciona com input de Setor/Área* — o Epic 9 trocou aquele input por `employee_status`).
>
> **Consequência conhecida:** o detector exige `abertos: 0` no checklist deste épico, então ele
> permanece vermelho nessa asserção enquanto o epic-23 estiver vermelho. Isso é o detector
> funcionando: ele está apontando para uma dívida real, não para uma divergência documental.
>
> **Uma asserção do detector é inexequível por construção** e não foi tentada: ver a nota na
> linha *Dual-Mode Atual* do Epic Context, logo abaixo.

---

## Epic Goal

Simplificar a plataforma removendo o dual-mode (universidade/corporativo) para foco exclusivamente corporativo, e fechar os dois gaps de segurança/compliance que bloqueiam produção: rate limiting nas APIs e endpoints de privacidade LGPD. Ao final deste épico, a plataforma estará livre de complexidade desnecessária e em conformidade legal e de segurança para deploy em produção.

## Epic Context

| Item | Detalhe |
|------|---------|
| **Stack** | Next.js 15 (App Router) + Supabase + Drizzle ORM + Tailwind CSS 4 + shadcn/ui |
| **Dual-Mode Atual** | **Removido**, medido em 2026-09-05: `TenantMode`, `getModeLabels` e `dual-mode-labels` têm zero ocorrências em `packages/shared/src/types/models.ts`, `packages/shared/src/constants/labels.ts` e `apps/web/src/components/layout/sidebar.tsx` desde as Stories 6.1/6.2 |
| **Rate Limiting** | **6 limiters aplicados no middleware**, medidos em 2026-08-28. `apps/web/src/lib/rate-limit.ts` exporta 18 limiters nomeados; destes, 6 são aplicados via `checkLimit(...)` em `apps/web/src/middleware.ts`: `authLimiter` (:186), `catchAllLimiter` (:191), `chatLimiter` (:227), `questionGenLimiter` (:232), `courseCreateLimiter` (:237), `privacyLimiter` (:242). Os demais são aplicados dentro das próprias rotas. Sem Redis configurado o módulo **degrada para `InMemoryRatelimit`, nunca para `null`** (`apps/web/src/lib/__tests__/rate-limit.test.ts`) |
| **LGPD** | **Endpoints de privacidade em disco**, medidos em 2026-08-28: `apps/web/src/app/api/privacy/export/route.ts` (DSAR) e `apps/web/src/app/api/privacy/delete/route.ts` (direito ao esquecimento), ambos sob `privacyLimiter`. NFR5 atendido no fonte; conformidade operacional de ponta a ponta não foi exercitada nesta medição |
| **Decisão Estratégica** | Foco 100% corporativo. Modo universidade poderá ser reintroduzido futuramente se necessário |
| **Sprint Reference** | `docs/stories/sprint-remove-dual-mode/sprint-overview.md` |

> **Atualizado em 2026-09-05.** A linha *Dual-Mode Atual* estava desatualizada — dizia que o
> dual-mode "permeia ~35-40 arquivos", quando `TenantMode`, `getModeLabels` e
> `dual-mode-labels` já tinham zero ocorrências desde as Stories 6.1/6.2. O bloqueio anterior
> era estrutural: o controle positivo do detector (*"cellByLabel não trunca célula com pipe
> escapado"*) lia a MESMA célula que a asserção vermelha exigia corrigir, então as duas nunca
> podiam valer ao mesmo tempo. Resolvido reancorando o controle positivo numa fixture literal
> (mesmo padrão do `epic9-docs-vs-realidade.test.ts`), documentado no próprio
> `apps/web/tests/epic-6-security-posture-doc.test.ts`. Com o controle desacoplado do texto
> vivo, a célula acima já reflete o estado real do código.

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

> **Snapshot não-autoritativo**, medido em 2026-08-28. A coluna `Current Protection` descreve
> **o que existe no fonte**, que é o que este repositório pode provar. Comportamento em runtime
> (a 11ª mensagem retorna 429?) não foi exercitado e por isso aparece como ressalva, nunca como
> negação do controle.

| Threat | Current Protection | Gap |
|--------|-------------------|-----|
| API abuse (chat flooding) | `chatLimiter` aplicado em `middleware.ts:227` para `/api/sessions/*/messages` | Endereçado no fonte. Sem Redis, a proteção é por instância (`InMemoryRatelimit`), não distribuída |
| Brute-force auth | `authLimiter` aplicado em `middleware.ts:186` para `/api/auth` | Endereçado no fonte. Mesma ressalva de `InMemoryRatelimit` |
| LGPD data request (DSAR) | `api/privacy/export/route.ts`, sob `privacyLimiter` (`middleware.ts:242`) | Endereçado no fonte. Conformidade operacional (prazo de resposta, trilha de auditoria) fora do escopo desta medição |
| LGPD right to erasure | `api/privacy/delete/route.ts`, sob `privacyLimiter` (`middleware.ts:242`) | Endereçado no fonte. Mesma ressalva acima |
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

- [x] **AC1:** Nova migration remove coluna `mode` da tabela `tenants`
- [x] **AC2:** Nova migration remove coluna `mode` da tabela `courses`
- [x] **AC3:** Tipo `TenantMode` removido de `packages/shared/src/types/models.ts`
- [x] **AC4:** Campo `mode` removido dos Drizzle schemas (`tenants.ts`, `courses.ts`)
- [x] **AC5:** Validador Zod de courses (`packages/shared/src/validators/courses.ts`) sem campo `mode`
- [x] **AC6:** `mode-config.ts` renomeado para `labels.ts`, exporta apenas labels corporativos como constantes fixas, todos os imports atualizados (QA L-1 FIX)
- [x] **AC7:** Seed files (`seed.sql`, `seed-remote.ts`) sem referências a mode
- [x] **AC8:** Server Actions (`admin/settings/actions.ts`, `courses/actions.ts`) sem campo mode
- [x] **AC9:** API routes admin sem mode nos payloads
- [x] **AC10:** `pnpm typecheck` passa sem erros em todos os packages
- [x] **AC11:** `pnpm lint` passa sem erros

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

- [x] **AC1:** Seletor de modo removido de `tenant-settings-form.tsx`
- [x] **AC2:** Dropdown de modo removido de `course-form-dialog.tsx`
- [x] **AC3:** Sidebar exibe "Trilhas" fixo (sem getModeLabels)
- [x] **AC4:** Student dashboard exibe "Trilhas" fixo
- [x] **AC5:** Teacher dashboard exibe "Trilhas" fixo
- [x] **AC6:** Manager dashboard exibe "Competências Ativas" e "ROI de Treinamento" fixo
- [x] **AC7:** Onboarding step-sector unificado para input corporativo (Setor/Área)
- [x] **AC8:** `mode` removido do TenantProvider context
- [x] **AC9:** Arquivo `dual-mode-labels.ts` deletado
- [x] **AC10:** Course card, course table e course detail sem mode badge/column
- [x] **AC11:** Todos os testes de dual-mode atualizados ou removidos (6+ arquivos)
- [x] **AC12:** Build do Next.js sem erros
- [x] **AC13:** `architecture.md` atualizado — remover Section 8.3, atualizar Sections 1 e 6.1, remover todas referências a mode (QA M-3 FIX)

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

- [x] **AC1:** Rate limiting ativo em `/api/sessions/*/messages` — 10 req/min por usuário autenticado
- [x] **AC2:** Rate limiting ativo em `/api/auth/*` — 5 req/min por IP
- [x] **AC3:** Rate limiting ativo em `/api/chapters/*/generate-questions` — 5 req/5min por usuário
- [x] **AC4:** Rate limiting ativo em `/api/courses` (POST) — 20 req/hora por usuário (QA H-1 FIX)
- [x] **AC5:** Rate limiting catch-all em todos os outros endpoints — 100 req/min por IP (QA H-1 FIX)
- [x] **AC6:** Rate limiting ativo em `/api/privacy/*` — 3 req/min por usuário (QA M-4 FIX)
- [x] **AC7:** Resposta `429 Too Many Requests` com header `Retry-After` quando limite excedido
- [x] **AC8:** Rate limiting usa Upstash Redis (serverless, edge-compatible)
- [x] **AC9:** Configuração via variáveis de ambiente (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`)
- [x] **AC10:** Rate limiting funciona em Edge Runtime (middleware do Next.js)
- [x] **AC11:** Logs de rate limit events para auditoria

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

- [x] **AC1:** `GET /api/privacy/export` retorna JSON com todos os dados pessoais do usuário autenticado
- [x] **AC2:** Exportação inclui: perfil, enrollments, sessions, messages, analyses (dados do próprio usuário apenas via RLS)
- [x] **AC3:** `DELETE /api/privacy/delete` inicia soft delete do usuário e todos os seus dados
- [x] **AC4:** Soft delete marca dados como `deleted_at = NOW()` sem remover fisicamente
- [x] **AC5:** Job de limpeza programado para remoção física após 30 dias (documentado, implementação futura — MVP marca deletion timestamp apenas)
- [x] **AC6:** Apenas o próprio usuário pode solicitar export/delete dos seus dados (RLS enforced)
- [x] **AC7:** Admin pode solicitar export/delete em nome de qualquer usuário do tenant
- [x] **AC8:** Response do export em formato JSON com estrutura clara e documentada
- [x] **AC9:** Confirmação obrigatória no delete (request body com `{ confirm: true }`)
- [x] **AC10:** Audit log: registrar quem solicitou, quando, e tipo de operação (export/delete)
- [x] **AC11:** Sessions do usuário deletado são anonimizadas (`student_id → NULL`) (QA H-2 FIX)
- [x] **AC12:** Messages e analyses linkadas são anonimizadas (QA H-2 FIX)
- [x] **AC13:** Enrollments do usuário deletadas (soft delete) (QA H-2 FIX)
- [x] **AC14:** Dados agregados de analytics retidos sem PII (QA H-2 FIX)

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

- [x] Épicos 1-5 continuam funcionando após remoção do dual-mode — suíte completa do monorepo executada em 2026-09-05 na branch `faxina/app-unico`: `pnpm test` com 4305 testes verdes em `apps/web` (390 arquivos) mais 630 nos pacotes; nenhuma regressão de dual-mode
- [x] Dashboards exibem labels corporativos corretamente — `packages/shared/src/constants/labels.ts:1` exporta `PLATFORM_LABELS` como constantes fixas; zero ocorrências de `getModeLabels` em `apps/web/src` e `packages/*/src`
- [x] ~~Onboarding funciona com input de Setor/Área~~ — **cancelado formalmente em 2026-09-05, superado pelo Epic 9**, que substituiu o wizard de 5 steps por 2 e trocou o input de Setor/Área por `employee_status`. Não há trabalho pendente
- [x] Course CRUD funciona sem campo mode — `course-form-dialog.tsx` não tem seletor de modo e o validador Zod de courses não declara `mode` (Story 6.1 AC2/AC5)
- [x] RLS policies intactas (nenhuma alteração em policies de segurança) — `supabase/migrations/20260208000001_remove_dual_mode.sql` contém **zero** ocorrências de `POLICY`
- [x] CI/CD pipeline verde após todas as mudanças — os 4 passos do `ci.yml` (lint, typecheck, test, build) executados localmente em todos os workspaces em 2026-09-05 (`docs/faxina-2026-09/`); o CI remoto estava vermelho desde agosto por testes desatualizados em `packages/agents` e `packages/ui`, corrigidos na mesma data

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

- [x] Zero referências a `TenantMode`, `"university"`, `dual-mode` no código (excl. docs deprecated) — `grep -rn "\bTenantMode\b|\bgetModeLabels\b|dual-mode-labels" apps/web/src packages/shared/src packages/database/src` devolve **0 linhas** (medido em 2026-08-28)
- [x] Labels corporativos fixos em todos os componentes — `PLATFORM_LABELS` em `packages/shared/src/constants/labels.ts`
- [x] Rate limiting aplicado nas APIs críticas — 6 limiters no middleware (`middleware.ts:186,191,227,232,237,242`), os demais dentro das rotas. *(Eficácia em runtime não exercitada; sem Redis a proteção é por instância.)*
- [x] Endpoints LGPD (export + delete) em disco — `api/privacy/export/route.ts` e `api/privacy/delete/route.ts`. *("Operacionais" de ponta a ponta não foi exercitado nesta medição.)*
- [x] Todos os testes passando — `pnpm test` no monorepo inteiro em 2026-09-05: `@eximia/web` 4305 verdes, `@eximia/agents` 142, `@eximia/ui` 295, `@eximia/course-designer` 112, `@eximia/shared` 81
- [x] Build sem erros — `pnpm build` em 2026-09-05 concluído, com o gate `apps/web/scripts/verificar-rotas-de-marca-dinamicas.mjs` aprovando as 7 rotas de marca como dinâmicas
- [x] Documentação atualizada — este documento, reconciliado em 2026-08-28 contra o código, mais as 4 stories-filhas já em `Ready for Review`

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
