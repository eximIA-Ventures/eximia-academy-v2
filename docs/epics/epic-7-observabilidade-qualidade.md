# Epic 7: Observabilidade & Qualidade

**Version:** 1.0
**Created:** 2026-02-08
**Updated:** 2026-02-08
**Author:** Morgan (PM Agent)
**Status:** Draft
**PRD Reference:** `docs/prd.md` — NFR1-3 (performance, uptime), NFR11 (custo LLM)
**Architecture Reference:** `docs/architecture.md` v1.3 — Section 3 (Tech Stack), Section 18 (Monitoring)
**Roadmap Reference:** `docs/stories/roadmap-consolidacao.md` — Sprints 2 e 3

---

## Epic Goal

Dotar a plataforma de visibilidade operacional completa (erros, performance, comportamento de usuário) e proteção contra regressão via testes end-to-end. Ao final deste épico, a equipe terá dashboards de Sentry para erros em produção, PostHog para analytics de produto, e Playwright para os 3 fluxos críticos — garantindo operação confiável e decisões baseadas em dados.

## Epic Context

| Item | Detalhe |
|------|---------|
| **Stack** | Next.js 15 (App Router) + Supabase + Vercel |
| **Error Monitoring** | Nenhum — zero visibilidade de erros em produção |
| **Product Analytics** | Nenhum — zero dados de comportamento de usuário |
| **E2E Tests** | Nenhum — sem proteção contra regressão nos fluxos críticos |
| **Unit Tests** | 282 test files existentes (UI components + validators) |
| **PRD Flows** | 3 fluxos críticos definidos: student journey, teacher creation, manager dashboard |
| **Blocked By** | Epic 6 (recomendado — codebase simplificado facilita setup) |

---

## Existing System Context

### What Exists

| Component | Status | Notes |
|-----------|--------|-------|
| Unit tests (Vitest) | Implemented | 282 test files em packages/ui + shared |
| CI/CD (GitHub Actions) | Implemented | lint → typecheck → test → build |
| Performance targets (NFRs) | Documented | LCP < 2s, AI TTFB < 3s, API < 200ms |
| Error boundaries | Not implemented | Erros propagam sem captura |
| Analytics events | Not implemented | Nenhum tracking |
| E2E test framework | Not configured | Nem Playwright instalado |

### What's Missing

| Gap | Impact | Priority |
|-----|--------|----------|
| Sentry | Erros invisíveis em produção. Debugging reativo | P1 |
| PostHog | Sem métricas de adoção, engagement, churn | P1 |
| Playwright | Sem proteção contra regressão nos fluxos de negócio | P1 |

---

## Stories

---

### Story 7.1: Error Monitoring com Sentry

**As a** platform operator,
**I want** monitoramento de erros em tempo real com stack traces e context,
**so that** eu identifique e resolva problemas antes que afetem muitos usuários.

**PRD Reference:** NFR3 (99.5% uptime requer visibilidade)
**Story Points:** 3
**Priority:** P1
**Risk:** LOW — integração padrão do Sentry com Next.js

#### Acceptance Criteria

- [ ] **AC1:** Sentry SDK configurado para client e server (`sentry.client.config.ts`, `sentry.server.config.ts`)
- [ ] **AC2:** Source maps enviados automaticamente no build (Sentry Webpack plugin)
- [ ] **AC3:** Error boundaries em páginas críticas: `/dashboard`, `/courses/[courseId]/chapters/[chapterId]/session` (chat socrático)
- [ ] **AC4:** Erros de API routes capturados automaticamente com context (user_id, tenant_id, route)
- [ ] **AC5:** Performance monitoring ativo (Web Vitals: LCP, FID, CLS)
- [ ] **AC6:** Env vars configurados: `NEXT_PUBLIC_SENTRY_DSN` (client), `SENTRY_DSN` (server), `SENTRY_AUTH_TOKEN` (build), `SENTRY_ORG`, `SENTRY_PROJECT` (QA M-1 FIX)
- [ ] **AC7:** Erros de sessão socrática (pipeline failures) capturados com context do pipeline (agent, step, retry_count)
- [ ] **AC8:** Environment tags: development, staging, production
- [ ] **AC9:** Release tracking vinculado ao git commit SHA
- [ ] **AC10:** Dados sensíveis (tokens, passwords) não enviados ao Sentry (scrubbing ativo)
- [ ] **AC11:** Vercel Analytics e Vercel Speed Insights habilitados no projeto Vercel (QA H-1 FIX)

> **Scope Note (QA H-1 FIX):** Custom Dashboard para pipeline health é post-MVP. Sentry distributed tracing (AC7) cobre parcialmente via span attributes nos agentes. Vercel Analytics/Speed Insights são habilitados via dashboard Vercel + `@vercel/analytics` package.

#### Technical Notes

- **Pacote:** `@sentry/nextjs` (suporta App Router + Server Components + Edge Runtime)
- **Configuração:**
  ```typescript
  // sentry.client.config.ts
  import * as Sentry from "@sentry/nextjs"
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1, // 10% das transactions em produção
    replaysSessionSampleRate: 0.01,
    environment: process.env.NODE_ENV,
  })
  ```
- **Error boundary:** Criar `apps/web/src/components/error-boundary.tsx` usando `Sentry.ErrorBoundary`
- **Pipeline context:** No orchestrator, envolver chamadas LLM com `Sentry.startSpan()` para trace distribuído
- **Data scrubbing:** Usar `beforeSend` para remover tokens, passwords, conteúdo de mensagens

**Predicted Agents:**
| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Configuração Sentry, error boundaries, pipeline instrumentation |
| **@devops (Gage)** | Setup de environment variables no Vercel |

**Quality Gates:**
| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. Build sem erros com Sentry plugin | Yes |
| Pre-PR | Erro intencional capturado no Sentry dashboard. Web Vitals reportados. Source maps funcionam (stack trace legível) | Yes |

---

### Story 7.2: Product Analytics com PostHog

**As a** product manager,
**I want** tracking de eventos-chave de produto,
**so that** eu meça adoção, engagement e identifique friction points.

**PRD Reference:** NFR11 (custo LLM monitorável requer tracking de sessões)
**Story Points:** 3
**Priority:** P1
**Risk:** LOW — integração padrão do PostHog com Next.js

#### Acceptance Criteria

- [ ] **AC1:** PostHog provider configurado no layout raiz da aplicação
- [ ] **AC2:** Identificação automática de usuário (`posthog.identify()`) após login com properties: role, tenant_id
- [ ] **AC3:** Pageview tracking automático
- [ ] **AC4:** Eventos customizados implementados para fluxos-chave:
  - `course_enrolled` — aluno se inscreve em trilha
  - `session_started` — aluno inicia sessão socrática
  - `session_completed` — aluno completa sessão (com `interactions_count`, `duration_ms`)
  - `question_generated` — professor gera perguntas via Creator Agent (com `chapter_id`, `question_count`)
  - `csv_exported` — gestor exporta CSV (com `row_count`)
  - `user_invited` — admin convida usuário
  - `pipeline_completed` — pipeline socrático completo (com `total_input_tokens`, `total_output_tokens`, `model`, `retry_count`, `estimated_cost_usd`) (QA H-3 FIX — NFR11)
- [ ] **AC5:** Feature flags do PostHog acessíveis (preparação para future rollouts)
- [ ] **AC6:** Env vars configurados: `NEXT_PUBLIC_POSTHOG_KEY` (client), `NEXT_PUBLIC_POSTHOG_HOST` (client), `POSTHOG_API_KEY` (server-side tracking) (QA M-3 FIX)
- [ ] **AC7:** Respeito a Do Not Track (DNT) e opt-out de cookies
- [ ] **AC8:** Dados pessoais (email, nome) não enviados como event properties — apenas IDs

#### Technical Notes

- **Pacote:** `posthog-js` + `posthog-node` (server-side)
- **Provider:**
  ```typescript
  // apps/web/src/providers/posthog-provider.tsx
  'use client'
  import posthog from 'posthog-js'
  import { PostHogProvider } from 'posthog-js/react'

  if (typeof window !== 'undefined') {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      capture_pageview: true,
      capture_pageleave: true,
      respect_dnt: true,
    })
  }
  ```
- **Server-side tracking:** Para `session_completed` e `question_generated` que acontecem em Server Actions/API routes, usar `posthog-node`:
  ```typescript
  import { PostHog } from 'posthog-node'
  const posthogServer = new PostHog(process.env.POSTHOG_API_KEY!)
  posthogServer.capture({ distinctId: userId, event: 'session_completed', properties: {...} })
  ```
- **LGPD compliance:** Não enviar PII. Usar user IDs opacos. Respeitar DNT header.

**Predicted Agents:**
| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Provider setup, event tracking em actions e routes |
| **@devops (Gage)** | Setup de environment variables |

**Quality Gates:**
| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. PostHog provider não quebra SSR | Yes |
| Pre-PR | Eventos capturados no PostHog dashboard. Identify funciona. Nenhum PII nos eventos. DNT respeitado | Yes |

---

### Story 7.3: E2E Tests com Playwright

**As a** developer,
**I want** testes end-to-end para os 3 fluxos críticos de negócio,
**so that** eu tenha confiança para deployar sem regressão.

**PRD Reference:** Section 16 (Testing Strategy)
**Story Points:** 8
**Priority:** P1
**Risk:** MEDIUM — setup de test environment com Supabase + seeding

#### Acceptance Criteria

- [ ] **AC1:** Playwright configurado com `playwright.config.ts` na raiz do monorepo
- [ ] **AC2:** Script de seed para test environment (`supabase/seed-test.ts`) com dados mínimos necessários
- [ ] **AC3:** Fluxo 1 — Student Journey:
  - Login como student → Dashboard → Clicar em curso → Ver capítulo → Iniciar sessão → Enviar 3 mensagens → Ver resumo de sessão completa
- [ ] **AC4:** Fluxo 2 — Teacher Course Creation:
  - Login como teacher → Criar curso (título, descrição) → Criar capítulo (título, conteúdo) → Gerar perguntas → Publicar curso
- [ ] **AC5:** Fluxo 3 — Manager Dashboard:
  - Login como manager → Dashboard com métricas → Alterar filtro de período → Exportar CSV → Verificar download
- [ ] **AC6:** Tests rodam no CI (GitHub Actions) com Supabase local via Docker
- [ ] **AC7:** Timeout configurado adequadamente para chamadas LLM (30s para chat)
- [ ] **AC8:** Screenshots em caso de falha para debugging
- [ ] **AC9:** Testes podem ser executados localmente com `pnpm test:e2e`
- [ ] **AC10:** Testes são determinísticos — Anthropic API mockado via MSW com fixtures pré-gravadas para cada agente (Analyst, Socrates, Editor, Tester) em `tests/e2e/fixtures/` (QA M-2 FIX)
- [ ] **AC11:** E2E tests passam em Chromium, Firefox e WebKit (QA H-2 FIX — PRD NFR12)

#### Technical Notes

- **Playwright config:**
  ```typescript
  // playwright.config.ts
  import { defineConfig, devices } from '@playwright/test'
  export default defineConfig({
    testDir: './tests/e2e',
    timeout: 60_000,
    retries: process.env.CI ? 2 : 0,
    use: {
      baseURL: 'http://localhost:3000',
      screenshot: 'only-on-failure',
      trace: 'on-first-retry',
    },
    projects: [
      { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
      { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
      { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    ], // QA H-2 FIX: PRD NFR12 requires Chrome, Firefox, Safari (Edge = Chromium)
    webServer: {
      command: 'pnpm dev',
      port: 3000,
      reuseExistingServer: !process.env.CI,
    },
  })
  ```
- **Supabase local para CI:** Usar `supabase start` no GitHub Action. Seed com `seed-test.ts`
- **Mock de LLM:** Para Fluxo 1 (chat), considerar mock do Anthropic API para determinismo e velocidade. Alternativa: usar test fixtures com respostas pré-definidas
- **Auth helper:** Criar `tests/e2e/helpers/auth.ts` com `loginAs(role)` que faz login via Supabase client
- **Estrutura de arquivos:**
  ```
  tests/e2e/
  ├── helpers/
  │   ├── auth.ts          # Login helpers
  │   └── seed.ts          # Test data seeding
  ├── student-journey.spec.ts
  ├── teacher-course-creation.spec.ts
  └── manager-dashboard.spec.ts
  ```

**Predicted Agents:**
| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Setup Playwright, escrever testes, helpers de auth |
| **@devops (Gage)** | Configurar Supabase local no CI, GitHub Actions workflow |
| **@qa (Quinn)** | Review dos cenários de teste, edge cases |

**Quality Gates:**
| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint` pass. Playwright installed | Yes |
| Pre-PR | 3 fluxos E2E passam localmente. CI workflow configurado. Screenshots de falha funcionam | Yes |

---

## Dependency Graph

```
Story 7.1 (Sentry)    ──────┐
[independente]                │
                              │  [todas independentes entre si]
Story 7.2 (PostHog)   ──────┤
[independente]                │
                              │
Story 7.3 (Playwright) ─────┘
[independente]
```

**Execution Order:**
1. **Stories 7.1 + 7.2** em paralelo (setup de providers, independentes)
2. **Story 7.3** após 7.1/7.2 (pode integrar assertions de analytics nos E2E tests)

Alternativa: todas em paralelo se devs disponíveis.

---

## Compatibility Requirements

- [ ] Sentry não impacta performance (tracesSampleRate conservador)
- [ ] PostHog não impacta LCP (lazy load, async init)
- [ ] E2E tests não modificam banco de produção (test environment isolado)
- [ ] CI pipeline existente não quebra (E2E adicionado como step opcional)
- [ ] Nenhuma mudança em funcionalidades existentes

---

## Risk Mitigation

| Risco | Impacto | Mitigação | Rollback |
|-------|---------|-----------|----------|
| Sentry SDK aumenta bundle size | LOW | Tree-shaking automático. Lazy load do replay SDK | Remover replay, manter apenas error capture |
| PostHog impacta LCP | LOW | Async init. Não bloqueia render | Lazy load ou server-only tracking |
| E2E tests flaky por LLM latency | MEDIUM | Mock do Anthropic API para testes. Timeout generoso (60s) | Usar fixtures ao invés de LLM real |
| Supabase local no CI é lento | LOW | Cache Docker image. Parallelize com unit tests | Usar Supabase remoto para E2E (staging) |
| PostHog tracking viola LGPD | LOW | Respeitar DNT. Não enviar PII. Usar IDs opacos | Desabilitar tracking via feature flag |

---

## Definition of Done (Epic Level)

- [ ] Sentry capturando erros em produção com stack traces legíveis
- [ ] PostHog tracking 6 eventos-chave de produto
- [ ] 3 fluxos E2E passando no CI
- [ ] Performance: nenhum impacto mensurável no LCP (< 100ms de overhead)
- [ ] LGPD: nenhum PII enviado a serviços externos
- [ ] Documentação de setup para novos desenvolvedores

---

## Total Story Points: 14

| Story | Points | Priority | Dependencies |
|-------|--------|----------|-------------|
| 7.1 Sentry | 3 | P1 | Nenhuma |
| 7.2 PostHog | 3 | P1 | Nenhuma |
| 7.3 Playwright E2E | 8 | P1 | Recomendado: após 7.1/7.2 |

---

## SM Handoff

"Please develop detailed user stories for this observability epic. Key considerations:

- Todas as 3 stories são independentes e podem ser paralelizadas
- Story 7.3 (E2E) é a mais complexa — requer setup de test environment com Supabase local
- Para E2E, considerar mock do Anthropic API para determinismo (chat socrático usa LLM real)
- PostHog e Sentry devem respeitar LGPD — nenhum PII enviado
- Sentry deve instrumentar o pipeline socrático (4 agents) com distributed tracing
- PostHog events devem cobrir os KPIs do produto (adoção, engagement, completion)
- CI workflow precisa suportar Supabase local via Docker para E2E
- Existing unit tests (282 files) devem continuar passando"

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-08 | 1.0 | Epic criado para observabilidade e qualidade | Morgan (PM) |

---

*Epic criado por Morgan (PM Agent) — exímIA Academy v1.0*

— Morgan, planejando o futuro 📊
