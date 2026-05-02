# Story 7.1: Error Monitoring com Sentry

**Epic:** [Epic 7 — Observabilidade & Qualidade](../../epics/epic-7-observabilidade-qualidade.md)
**Version:** 1.1 (PO validation fixes applied)
**Created:** 2026-02-08
**Author:** River (Scrum Master)
**Status:** Ready for Review
**Story Points:** 3
**Priority:** P1
**Blocked By:** None (Epic 6 recommended but not blocking)
**Blocks:** None
**Assigned To:** @dev (Dex)

---

## User Story

**As a** platform operator,
**I want** monitoramento de erros em tempo real com stack traces e context,
**so that** eu identifique e resolva problemas antes que afetem muitos usuarios.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.3 — Section 3 (Tech Stack: Sentry), Section 18 (Monitoring), Section 17 (Error Handling), Section 19 (Error Boundaries) |
| **PRD Ref** | `docs/prd.md` — NFR3 (99.5% uptime requer visibilidade) |
| **Epic Ref** | `docs/epics/epic-7-observabilidade-qualidade.md` — Story 7.1 |
| **Stack** | Next.js 15 (App Router) + Supabase + Vercel + `@sentry/nextjs` |
| **Existing Error Handling** | `packages/agents/src/errors.ts` (AgentTimeoutError), `packages/shared/src/types/errors.ts` (ApiError format) |
| **Pipeline Agents** | `packages/agents/src/orchestrator.ts` — Socrates, Editor, Tester (3 LLM calls sequenciais); Analyst roda separadamente via `packages/agents/src/analyst.ts` chamado pela API route |
| **CI/CD** | `.github/workflows/ci.yml` — lint → typecheck → test → build |
| **Env vars pattern** | `.env.local` already has `SENTRY_DSN=` placeholder [Source: architecture.md Section 12.4] |

---

## Acceptance Criteria

- [ ] **AC1:** Sentry SDK configurado para client e server (`sentry.client.config.ts`, `sentry.server.config.ts`)

- [ ] **AC2:** Source maps enviados automaticamente no build (Sentry Webpack plugin via `@sentry/nextjs`)

- [ ] **AC3:** Error boundaries em paginas criticas: `/dashboard`, `/courses/[courseId]/chapters/[chapterId]/session` (chat socratico)

- [ ] **AC4:** Erros de API routes capturados automaticamente com context (user_id, tenant_id, route)

- [ ] **AC5:** Performance monitoring ativo (Web Vitals: LCP, FID, CLS)

- [ ] **AC6:** Env vars configurados: `NEXT_PUBLIC_SENTRY_DSN` (client), `SENTRY_DSN` (server), `SENTRY_AUTH_TOKEN` (build), `SENTRY_ORG`, `SENTRY_PROJECT`

- [ ] **AC7:** Erros de sessao socratica (pipeline failures) capturados com context do pipeline (agent, step, retry_count)

- [ ] **AC8:** Environment tags: development, staging, production

- [ ] **AC9:** Release tracking vinculado ao git commit SHA

- [ ] **AC10:** Dados sensiveis (tokens, passwords) nao enviados ao Sentry (scrubbing ativo)

- [ ] **AC11:** Vercel Analytics e Vercel Speed Insights habilitados no projeto (`@vercel/analytics`, `@vercel/speed-insights`)

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.
> To enable, set `coderabbit_integration.enabled: true` in core-config.yaml

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 1, 6, 8, 9) Instalar e configurar `@sentry/nextjs`
  - [x] `pnpm --filter=web add @sentry/nextjs`
  - [x] Rodar `npx @sentry/wizard@latest -i nextjs` ou configurar manualmente
  - [x] Criar `apps/web/sentry.client.config.ts`:
    ```typescript
    import * as Sentry from "@sentry/nextjs"
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.01,
      replaysOnErrorSampleRate: 1.0,
      environment: process.env.NODE_ENV,
      release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    })
    ```
  - [x] Criar `apps/web/sentry.server.config.ts` (similar, com `SENTRY_DSN`)
  - [x] Criar `apps/web/sentry.edge.config.ts` para Edge Runtime
  - [x] Atualizar `apps/web/next.config.ts` com `withSentryConfig()` wrapper
  - [x] Configurar `sentry.properties` ou env vars para org/project

- [x] **Task 2** (AC: 2) Configurar source maps
  - [x] Verificar que `withSentryConfig()` em `next.config.ts` inclui:
    ```typescript
    { silent: true, hideSourceMaps: true }
    ```
  - [x] Source maps enviados no build mas nao expostos ao publico
  - [x] Env var `SENTRY_AUTH_TOKEN` necessario apenas no build (CI/Vercel)

- [x] **Task 3** (AC: 3) Criar error boundaries para paginas criticas
  - [x] Criar `apps/web/src/components/error-boundary.tsx` usando `Sentry.ErrorBoundary`
  - [x] Criar `apps/web/src/app/(platform)/dashboard/error.tsx` (Next.js error boundary)
  - [x] Criar `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/session/error.tsx`
  - [x] Error boundaries devem exibir UI de fallback amigavel com opcao de retry
  - [x] Integrar com `Sentry.captureException` automaticamente

- [x] **Task 4** (AC: 4) Instrumentar API routes com context
  - [x] Criar helper `apps/web/src/lib/sentry.ts` com funcao `withSentryContext()`:
    ```typescript
    import * as Sentry from "@sentry/nextjs"
    export function setSentryContext(userId: string, tenantId: string, route: string) {
      Sentry.setUser({ id: userId })
      Sentry.setTag("tenant_id", tenantId)
      Sentry.setTag("route", route)
    }
    ```
  - [x] Aplicar em API routes criticas: `/api/sessions/*/messages`, `/api/generate-questions`
  - [x] Erros em API routes ja capturados pelo Sentry SDK automaticamente (instrumentation)

- [x] **Task 5** (AC: 5, 11) Configurar performance monitoring e Vercel integracoes
  - [x] `tracesSampleRate: 0.1` ja definido no client config (10% em producao)
  - [x] `pnpm --filter=web add @vercel/analytics @vercel/speed-insights`
  - [x] Adicionar `<Analytics />` e `<SpeedInsights />` no root layout `apps/web/src/app/layout.tsx`
  - [x] Web Vitals (LCP, FID, CLS) reportados automaticamente pelo Sentry + Vercel

- [x] **Task 6** (AC: 7) Instrumentar pipeline de agentes
  - [x] No `packages/agents/src/orchestrator.ts`, envolver `runSocrates()`, `runEditor()`, `runTester()` com `Sentry.startSpan()`:
    ```typescript
    import * as Sentry from "@sentry/nextjs"
    // Wrap each specific agent call:
    const socratesResult = await Sentry.startSpan(
      { name: "agent.Socrates", op: "ai.pipeline" },
      async (span) => {
        span.setAttribute("agent.name", "Socrates")
        span.setAttribute("agent.step", 1)
        span.setAttribute("agent.retry_count", attempt)
        return await runSocrates(input, fullConfig, testerFeedback)
      }
    )
    // Repeat for runEditor() (step 2) and runTester() (step 3)
    ```
  - [x] **IMPORTANTE:** Analyst roda separadamente em `packages/agents/src/analyst.ts`, chamado pela API route (nao pelo orchestrator). Spans do Analyst devem ser adicionados na API route `/api/sessions/[id]/messages` que chama `runAnalyst()`.
  - [x] Capturar erros especificos: `AgentTimeoutError` com context completo (agent name, step, retry count)
  - [x] Tags: `agent.name`, `pipeline.step`, `retry_count`, `session_id`

- [x] **Task 7** (AC: 10) Configurar data scrubbing
  - [x] No client config, adicionar `beforeSend`:
    ```typescript
    beforeSend(event) {
      // Remove tokens, passwords, message content
      if (event.request?.headers) {
        delete event.request.headers['authorization']
        delete event.request.headers['cookie']
      }
      return event
    }
    ```
  - [x] Configurar `denyUrls` para excluir third-party scripts
  - [x] Nao enviar `event.user.email` — apenas `event.user.id`

- [x] **Task 8** Testes
  - [x] Test: Sentry SDK inicializa sem erros (client e server)
  - [x] Test: Error boundary renderiza fallback UI e captura exception
  - [x] Test: `setSentryContext()` define tags corretamente
  - [x] Test: `beforeSend` remove headers sensiveis
  - [x] Test: Build completa com Sentry plugin (source maps gerados)
  - [x] Test: Pipeline spans criados com atributos corretos
  - [x] Verificar: `pnpm lint && pnpm typecheck` passam

---

## Dev Notes

### Error Handling Types [Source: architecture.md v1.3, Section 17]

```typescript
// packages/shared/src/types/errors.ts
interface ApiError {
  error: {
    code: string              // 'SESSION_NOT_ACTIVE', 'AGENT_TIMEOUT', etc.
    message: string           // Mensagem human-readable (PT-BR)
    details?: Record<string, unknown>
    timestamp: string
    requestId: string
  }
}

type AgentErrorCode =
  | 'AGENT_TIMEOUT'           // LLM demorou > 30s
  | 'AGENT_REJECTED'          // Tester rejeitou apos max retries
  | 'AGENT_INVALID_OUTPUT'    // Output nao matched schema
  | 'AGENT_RATE_LIMITED'      // Anthropic rate limit
  | 'SESSION_EXPIRED'         // Sessao inativa > 30 min
  | 'SESSION_COMPLETE'        // Tentou enviar msg em sessao completa
```

### Orchestrator Pipeline [Source: architecture.md v1.3, Section 5 + packages/agents/src/orchestrator.ts]

Pipeline no `orchestrator.ts` — **3 chamadas LLM sequenciais** por turno:
1. **Socrates** (`runSocrates()`) — Gera resposta socratica
2. **Editor** (`runEditor()`) — Refina resposta
3. **Tester** (`runTester()`) — Valida qualidade (retry loop: max 2)

**Analyst** roda **separadamente** via `packages/agents/src/analyst.ts`, chamado pela API route (nao pelo orchestrator). Instrumentar Analyst spans na API route, nao no orchestrator.

Cada agente usa `withTimeout()` com `config.timeoutMs` (default 30s). `AgentTimeoutError` thrown se timeout.

### Monitoring Architecture [Source: architecture.md v1.3, Section 18]

| Servico | Proposito | Metricas |
|---------|-----------|----------|
| Vercel Analytics | Frontend performance | Core Web Vitals, page views |
| Vercel Speed Insights | Real user monitoring | LCP, FID, CLS |
| Sentry | Error tracking (front + back) | Errors, traces, replays |

### Environment Variables [Source: architecture.md v1.3, Section 12.4]

```bash
# Already in .env.local template:
SENTRY_DSN=

# New vars needed:
NEXT_PUBLIC_SENTRY_DSN=     # Client-side DSN
SENTRY_AUTH_TOKEN=          # Build-time only (source maps upload)
SENTRY_ORG=                 # Sentry organization slug
SENTRY_PROJECT=             # Sentry project slug
```

### Coding Standards [Source: architecture.md v1.3, Section 19]

- "Error Boundaries: Toda page tem error boundary; chat tem retry automatico"
- Server Components First: `'use client'` only where needed
- Sentry configs are top-level files in `apps/web/`

### File Locations

```
apps/web/
├── sentry.client.config.ts          # NEW: Client Sentry init
├── sentry.server.config.ts          # NEW: Server Sentry init
├── sentry.edge.config.ts            # NEW: Edge Sentry init
├── next.config.ts                   # UPDATED: withSentryConfig() wrapper
├── src/
│   ├── app/
│   │   ├── layout.tsx               # UPDATED: Add <Analytics /> + <SpeedInsights />
│   │   └── (platform)/
│   │       ├── dashboard/
│   │       │   └── error.tsx         # NEW: Error boundary
│   │       └── courses/[courseId]/chapters/[chapterId]/session/
│   │           └── error.tsx         # NEW: Error boundary
│   ├── components/
│   │   └── error-boundary.tsx        # NEW: Reusable Sentry error boundary
│   └── lib/
│       └── sentry.ts                 # NEW: Context helpers

packages/agents/src/
└── orchestrator.ts                   # UPDATED: Add Sentry spans
```

### Merge Conflict Warning

> **Story 7.2 (PostHog) also modifies `apps/web/src/app/layout.tsx`** (adds `<PostHogProvider>`).
> If 7.1 and 7.2 are developed in parallel, coordinate root layout changes to avoid merge conflict.
> Story 7.2 also instruments `packages/agents/src/orchestrator.ts` (token tracking). Coordinate.

### Performance Impact

- `tracesSampleRate: 0.1` = 10% sampling em producao (conservador)
- `replaysSessionSampleRate: 0.01` = 1% session replay
- `replaysOnErrorSampleRate: 1.0` = 100% replay em erros
- Source maps hidden from public (`hideSourceMaps: true`)

---

## Quality Gates

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. Build sem erros com Sentry plugin | Yes |
| Pre-PR | Erro intencional capturado no Sentry dashboard. Web Vitals reportados. Source maps funcionam (stack trace legivel) | Yes |

---

## Predicted Agents

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Configuracao Sentry, error boundaries, pipeline instrumentation |
| **@devops (Gage)** | Setup de environment variables no Vercel |

---

## Risk Mitigation

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Sentry SDK aumenta bundle size | LOW | Tree-shaking automatico. Lazy load do replay SDK |
| Source maps expostos publicamente | LOW | `hideSourceMaps: true` no config |
| Dados sensiveis no Sentry | MEDIUM | `beforeSend` scrubbing + no PII in user context |

---

*Story drafted by River (Scrum Master) — exímIA Academy*

— River, removendo obstaculos 🌊

---

## QA Results

### Review Date: 2026-02-08 | Re-review: 2026-02-09

### Reviewed By: Quinn (Test Architect)

**Scope:** Full code review of all 12 implementation files + 4 test files.

**Validation Results:**
- Typecheck: PASS (agents + web)
- Unit Tests: 189 tests, 38 files — all pass
- Lint: PASS on Epic 7 files (pre-existing warnings only)

**AC Compliance:** 11/11 full pass

**Findings (all resolved):**
1. ~~SEC-001 (medium): Edge config missing `beforeSend`~~ → FIXED: `beforeSend` added to `sentry.edge.config.ts`
2. ~~SEC-002 (low): Replay missing `maskAllText`/`blockAllMedia`~~ → FIXED: Added to `replayIntegration()`
3. MNT-001 (low): Error boundary uses hardcoded colors — non-blocking cosmetic
4. TEST-001 (low): Test coverage limited to happy paths — non-blocking

### Gate Status

Gate: PASS → docs/qa/gates/7.1-error-monitoring-sentry.yml
