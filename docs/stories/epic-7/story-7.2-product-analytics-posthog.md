# Story 7.2: Product Analytics com PostHog

**Epic:** [Epic 7 — Observabilidade & Qualidade](../../epics/epic-7-observabilidade-qualidade.md)
**Version:** 1.1 (PO validation fixes applied)
**Created:** 2026-02-08
**Author:** River (Scrum Master)
**Status:** Ready for Review
**Story Points:** 3
**Priority:** P1
**Blocked By:** None (independent)
**Blocks:** None
**Assigned To:** @dev (Dex)

---

## User Story

**As a** product manager,
**I want** tracking de eventos-chave de produto,
**so that** eu meca adocao, engagement e identifique friction points.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.3 — Section 3 (Tech Stack: PostHog), Section 5 (Event-Driven Analytics pattern), Section 18 (Monitoring) |
| **PRD Ref** | `docs/prd.md` — NFR11 (custo LLM monitoravel requer tracking de sessoes) |
| **Epic Ref** | `docs/epics/epic-7-observabilidade-qualidade.md` — Story 7.2 |
| **Stack** | Next.js 15 (App Router) + Supabase + `posthog-js` + `posthog-node` |
| **Auth System** | Supabase Auth — user has `id`, `role`, `tenant_id` via profile |
| **Platform Layout** | `apps/web/src/app/(platform)/layout.tsx` — RSC with TenantProvider |
| **Root Layout** | `apps/web/src/app/layout.tsx` — wraps all pages |
| **Env vars pattern** | `.env.local` already has `NEXT_PUBLIC_POSTHOG_KEY=` placeholder [Source: architecture.md Section 12.4] |
| **LGPD** | No PII in events. Respect DNT. Use opaque user IDs [Source: architecture.md Section 14.6] |

---

## Acceptance Criteria

- [ ] **AC1:** PostHog provider configurado no layout raiz da aplicacao

- [ ] **AC2:** Identificacao automatica de usuario (`posthog.identify()`) apos login com properties: role, tenant_id

- [ ] **AC3:** Pageview tracking automatico

- [ ] **AC4:** Eventos customizados implementados para fluxos-chave:
  - `course_enrolled` — aluno se inscreve em trilha
  - `session_started` — aluno inicia sessao socratica
  - `session_completed` — aluno completa sessao (com `interactions_count`, `duration_ms`)
  - `question_generated` — professor gera perguntas via Creator Agent (com `chapter_id`, `question_count`)
  - `csv_exported` — gestor exporta CSV (com `row_count`)
  - `user_invited` — admin convida usuario
  - `pipeline_completed` — pipeline socratico completo (com `total_input_tokens`, `total_output_tokens`, `model`, `retry_count`, `estimated_cost_usd`)

- [ ] **AC5:** Feature flags do PostHog acessiveis (preparacao para future rollouts)

- [ ] **AC6:** Env vars configurados: `NEXT_PUBLIC_POSTHOG_KEY` (client), `NEXT_PUBLIC_POSTHOG_HOST` (client), `POSTHOG_API_KEY` (server-side tracking)

- [ ] **AC7:** Respeito a Do Not Track (DNT) e opt-out de cookies

- [ ] **AC8:** Dados pessoais (email, nome) nao enviados como event properties — apenas IDs

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.
> To enable, set `coderabbit_integration.enabled: true` in core-config.yaml

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 1, 3, 6, 7) Instalar e configurar PostHog provider
  - [x] `pnpm --filter=web add posthog-js`
  - [ ] Criar `apps/web/src/components/providers/posthog-provider.tsx`:
    ```typescript
    'use client'
    import posthog from 'posthog-js'
    import { PostHogProvider as PHProvider } from 'posthog-js/react'
    import { useEffect } from 'react'

    export function PostHogProvider({ children }: { children: React.ReactNode }) {
      useEffect(() => {
        posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
          api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
          capture_pageview: true,
          capture_pageleave: true,
          respect_dnt: true,
          persistence: 'localStorage+cookie',
          opt_out_capturing_by_default: false,
        })
      }, [])
      return <PHProvider client={posthog}>{children}</PHProvider>
    }
    ```
  - [x] Adicionar `<PostHogProvider>` no `apps/web/src/app/layout.tsx` (root layout)
  - [x] Garantir que provider nao bloqueia SSR (client component com `'use client'`)

- [x] **Task 2** (AC: 2, 8) Implementar identificacao de usuario
  - [ ] Criar `apps/web/src/hooks/use-posthog-identify.ts`:
    ```typescript
    'use client'
    import { useEffect } from 'react'
    import posthog from 'posthog-js'

    export function usePostHogIdentify(user: { id: string; role: string; tenantId: string } | null) {
      useEffect(() => {
        if (user) {
          posthog.identify(user.id, {
            role: user.role,
            tenant_id: user.tenantId,
          })
        }
      }, [user])
    }
    ```
  - [x] Integrar no `apps/web/src/app/(platform)/layout.tsx` via client wrapper component
  - [x] Apenas `id`, `role`, `tenant_id` enviados — NUNCA email, nome (LGPD)

- [x] **Task 3** (AC: 4) Implementar eventos client-side
  - [ ] Criar `apps/web/src/lib/analytics.ts` com funcoes tipadas:
    ```typescript
    import posthog from 'posthog-js'

    export const analytics = {
      courseEnrolled: (courseId: string) =>
        posthog.capture('course_enrolled', { course_id: courseId }),

      sessionStarted: (sessionId: string, courseId: string, chapterId: string) =>
        posthog.capture('session_started', { session_id: sessionId, course_id: courseId, chapter_id: chapterId }),

      sessionCompleted: (sessionId: string, interactionsCount: number, durationMs: number) =>
        posthog.capture('session_completed', { session_id: sessionId, interactions_count: interactionsCount, duration_ms: durationMs }),

      csvExported: (rowCount: number) =>
        posthog.capture('csv_exported', { row_count: rowCount }),

      userInvited: (role: string) =>
        posthog.capture('user_invited', { invited_role: role }),
    }
    ```
  - [x] Integrar `analytics.courseEnrolled()` no enrollment action
  - [x] Integrar `analytics.sessionStarted()` no inicio de sessao socratica
  - [x] Integrar `analytics.sessionCompleted()` no fim de sessao
  - [x] Integrar `analytics.csvExported()` no export CSV do dashboard gestor
  - [x] Integrar `analytics.userInvited()` no convite de usuario

- [x] **Task 4** (AC: 4, 6) Implementar eventos server-side
  - [x] `pnpm --filter=web add posthog-node`
  - [ ] Criar `apps/web/src/lib/analytics-server.ts`:
    ```typescript
    import { PostHog } from 'posthog-node'

    let posthogServer: PostHog | null = null

    function getPostHogServer() {
      if (!posthogServer && process.env.POSTHOG_API_KEY) {
        posthogServer = new PostHog(process.env.POSTHOG_API_KEY, {
          host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        })
      }
      return posthogServer
    }

    export const analyticsServer = {
      questionGenerated: (userId: string, chapterId: string, questionCount: number) => {
        getPostHogServer()?.capture({
          distinctId: userId,
          event: 'question_generated',
          properties: { chapter_id: chapterId, question_count: questionCount },
        })
      },

      pipelineCompleted: (userId: string, props: {
        total_input_tokens: number
        total_output_tokens: number
        model: string
        retry_count: number
        estimated_cost_usd: number
      }) => {
        getPostHogServer()?.capture({
          distinctId: userId,
          event: 'pipeline_completed',
          properties: props,
        })
      },
    }
    ```
  - [x] Integrar `analyticsServer.questionGenerated()` na API route `/api/generate-questions`
  - [x] Integrar `analyticsServer.pipelineCompleted()` na **API route** `/api/sessions/[id]/messages` (que chama `orchestrateSocraticDialogue()`), NAO no orchestrator diretamente. O orchestrator e um package compartilhado (`packages/agents`) e nao deve depender de `posthog-node`.
  - [x] **IMPORTANTE:** Token usage vem de `result.usage` do Vercel AI SDK (`generateObject()`). O `PipelineResult` atual NAO inclui token data. Necessario:
    1. Estender `PipelineResult` em `packages/agents/src/types.ts` com campo `usage?: { inputTokens: number, outputTokens: number }`
    2. Agregar `result.usage` de cada chamada `generateObject()` no orchestrator
    3. Na API route, calcular `estimated_cost_usd` baseado nos tokens e modelo
  - [x] Chamar `posthogServer.shutdown()` em graceful shutdown (ou use `flush()`)

- [x] **Task 5** (AC: 5) Configurar feature flags
  - [x] Verificar que `posthog.isFeatureEnabled('feature-name')` funciona client-side
  - [ ] Criar helper `apps/web/src/lib/feature-flags.ts`:
    ```typescript
    import posthog from 'posthog-js'

    export function isFeatureEnabled(flag: string): boolean {
      return posthog.isFeatureEnabled(flag) ?? false
    }
    ```
  - [x] Documentar feature flag naming convention: `kebab-case`

- [x] **Task 6** (AC: 7) Implementar DNT e opt-out
  - [x] `respect_dnt: true` ja configurado no provider (Task 1)
  - [x] Verificar que quando DNT esta ativo, nenhum evento e capturado
  - [x] Adicionar `posthog.opt_out_capturing()` / `posthog.opt_in_capturing()` API disponivel

- [x] **Task 7** Testes
  - [x] Test: PostHog provider inicializa sem quebrar SSR
  - [x] Test: `posthog.identify()` chamado com properties corretos (id, role, tenant_id)
  - [x] Test: `posthog.identify()` NAO inclui email ou nome
  - [x] Test: Eventos client-side (`analytics.*`) capturam com properties corretos
  - [x] Test: Eventos server-side (`analyticsServer.*`) capturam com properties corretos
  - [x] Test: DNT header respeitado (nenhum evento capturado)
  - [x] Test: Feature flags retornam boolean
  - [x] Verificar: `pnpm lint && pnpm typecheck` passam

---

## Dev Notes

### Event-Driven Analytics Pattern [Source: architecture.md v1.3, Section 5]

"Eventos de interacao aluno-IA capturados e processados assincronamente. Analytics nao pode bloquear a UX; eventos permitem processamento posterior."

### LGPD Compliance [Source: architecture.md v1.3, Section 14.6]

- No PII in event properties: never send email, full_name
- Use opaque user IDs only (Supabase Auth UUID)
- Respect DNT header
- Dados agregados de analytics sao mantidos (sem PII)

### Environment Variables [Source: architecture.md v1.3, Section 12.4]

```bash
# Already in .env.local template:
NEXT_PUBLIC_POSTHOG_KEY=

# New/updated vars needed:
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com   # or eu.i.posthog.com
POSTHOG_API_KEY=                                      # Server-side API key
```

### Key Metrics to Track [Source: architecture.md v1.3, Section 18]

**Platform:**
- MAU, DAU por tenant
- Taxa de conclusao de cursos
- Sessoes socratica por dia

**Agent Pipeline:**
- Latencia media do pipeline completo
- Taxa de aprovacao do Tester (target: 70-85%)
- Distribuicao de retries (0, 1, 2)
- Custo LLM por sessao (via `pipeline_completed` event)

### Provider Hierarchy [Source: apps/web/src/app/(platform)/layout.tsx]

Root layout providers (order matters):
```
<html>
  <body>
    <PostHogProvider>           ← NEW (root layout)
      ... app content ...
    </PostHogProvider>
  </body>
</html>
```

Platform layout providers:
```
<QueryProvider>
  <TenantProvider>
    <PostHogIdentify />         ← NEW (client wrapper)
    ... platform content ...
  </TenantProvider>
</QueryProvider>
```

### Integration Points

| Event | Where | Type |
|-------|-------|------|
| `course_enrolled` | Enrollment Server Action / API | Client |
| `session_started` | Session start page/action | Client |
| `session_completed` | Session completion handler | Client |
| `question_generated` | `/api/generate-questions` route | Server |
| `csv_exported` | Manager dashboard CSV button | Client |
| `user_invited` | Admin user invite action | Client |
| `pipeline_completed` | API route `/api/sessions/[id]/messages` (calls orchestrator) | Server |

### File Locations

```
apps/web/src/
├── app/
│   └── layout.tsx                           # UPDATED: Add PostHogProvider
├── components/providers/
│   └── posthog-provider.tsx                 # NEW: PostHog client provider
├── hooks/
│   └── use-posthog-identify.ts              # NEW: User identification hook
└── lib/
    ├── analytics.ts                         # NEW: Client-side event tracking
    ├── analytics-server.ts                  # NEW: Server-side event tracking
    └── feature-flags.ts                     # NEW: Feature flag helpers
```

### Token Usage Gap [Source: packages/agents/src/types.ts, packages/agents/src/orchestrator.ts]

Current `PipelineResult` type does NOT include token usage. The Vercel AI SDK's `generateObject()` returns `result.usage` with `{ promptTokens, completionTokens, totalTokens }`. To support the `pipeline_completed` event:

```typescript
// Required extension to PipelineResult in packages/agents/src/types.ts:
export interface PipelineResult {
  response: string
  qaReport: { ... }
  retryCount: number
  warning: boolean
  usage?: {                    // NEW: aggregate token usage
    inputTokens: number
    outputTokens: number
  }
}
```

In the orchestrator, aggregate `result.usage` from each `generateObject()` call and include in the return value. The API route then calculates `estimated_cost_usd` based on model pricing.

### Merge Conflict Warning

> **Story 7.1 (Sentry) also modifies `apps/web/src/app/layout.tsx`** (adds `<Analytics />` + `<SpeedInsights />`).
> If 7.1 and 7.2 are developed in parallel, coordinate root layout changes to avoid merge conflict.

### Performance Impact

- PostHog JS SDK loaded async — does NOT block render
- `capture_pageview: true` = automatic pageview tracking
- Server-side events are fire-and-forget — no latency added to API responses
- No session replay enabled (can enable later via PostHog dashboard)

---

## Quality Gates

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. PostHog provider nao quebra SSR | Yes |
| Pre-PR | Eventos capturados no PostHog dashboard. Identify funciona. Nenhum PII nos eventos. DNT respeitado | Yes |

---

## Predicted Agents

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Provider setup, event tracking em actions e routes |
| **@devops (Gage)** | Setup de environment variables no Vercel |

---

## Risk Mitigation

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| PostHog impacta LCP | LOW | Async init. Nao bloqueia render |
| PII enviado acidentalmente | MEDIUM | Typed analytics functions. Code review. Never pass email/name |
| PostHog tracking viola LGPD | LOW | Respeitar DNT. Nao enviar PII. Usar IDs opacos |

---

*Story drafted by River (Scrum Master) — exímIA Academy*

— River, removendo obstaculos 🌊

---

## QA Results

### Review Date: 2026-02-08 | Re-review: 2026-02-09

### Reviewed By: Quinn (Test Architect)

**Scope:** Full code review of all 13 implementation files + 3 test files.

**Validation Results:**
- Typecheck: PASS (agents + web)
- Unit Tests: 189 tests, 38 files — all pass
- Lint: PASS on Epic 7 files
- LGPD: respect_dnt: true, no PII in events (only IDs)

**AC Compliance:** 8/8 full pass

**Findings (all resolved):**
1. ~~REQ-001 (high): sessionStarted("pending")~~ → FIXED: Moved to `socratic-chat.tsx` with real sessionId from DB
2. ~~REL-001 (medium): analyticsServer silently drops events~~ → FIXED: Added `console.warn` logging
3. SEC-001 (low): Persistence not conditional on consent — accepted for MVP with `respect_dnt: true`

### Gate Status

Gate: PASS → docs/qa/gates/7.2-product-analytics-posthog.yml
