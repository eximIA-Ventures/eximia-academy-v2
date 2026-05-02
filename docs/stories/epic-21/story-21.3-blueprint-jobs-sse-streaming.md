# Story 21.3: Blueprint Jobs & SSE Streaming

**Epic:** [Epic 21 — WS2: Orchestrator, API & Database](../../epics/epic-21-ws2-orchestrator-api-database.md)
**Version:** 1.0
**Created:** 2026-02-16
**Updated:** 2026-02-16
**Author:** River (SM)
**Status:** Ready
**Story Points:** 5
**Priority:** P0 (core)
**Blocked By:** Story 21.2
**Blocks:** None (within Epic 21)
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** SSE streaming do progresso do pipeline com fallback DB para reconexao,
**so that** o instrutor veja progresso real-time e possa sair/voltar.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws2-course-creator-architecture.md`, Secao 10.1 |
| **PRD Ref** | `Benchmarks/07_Course_Designer/PRD-Course-Designer-v1.0.md` — WS2: Course Creator |
| **Stack** | Next.js 15, TypeScript, SSE (Server-Sent Events), Supabase, Drizzle ORM |
| **Package** | `apps/web` (API routes) |
| **Existing Pattern** | Next.js 15 App Router API routes in `apps/web/src/app/api/` |
| **Risk** | MEDIUM — SSE em Next.js requer tratamento de conexao |

---

## Acceptance Criteria

- [ ] **AC1:** `POST /api/course-designer/generate` em `apps/web/src/app/api/course-designer/generate/route.ts`
  - Inicia pipeline assincronamente
  - Retorna SSE stream com progresso
  - Events: `{ phase: 1-5, status: "running"|"completed"|"failed", progress_pct: 0-100 }`
  - Event final: `{ status: "completed", blueprint_id: "uuid" }` ou `{ status: "failed", error: "..." }`
- [ ] **AC2:** `GET /api/course-designer/jobs/[jobId]` — DB fallback
  - Retorna status atual do job: current_phase, status, phase_results (se completed)
  - Se completed: inclui blueprint_id
  - Se failed: inclui error_message
- [ ] **AC3:** SSE connection handling
  - Heartbeat a cada 15s para manter conexao
  - Reconexao graceful: client pode reconectar e receber estado atual
  - Cleanup on disconnect: job continua processando (nao cancela)
- [ ] **AC4:** Auth + RLS: apenas manager/admin do tenant correto
- [ ] **AC5:** Rate limiting: max 3 jobs concorrentes por tenant

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Implementar POST /api/course-designer/generate com SSE
  - [ ] Criar `apps/web/src/app/api/course-designer/generate/route.ts`
  - [ ] Validar input (CourseDesignerInput) com Zod
  - [ ] Criar ReadableStream para SSE
  - [ ] Integrar com `designCourse` orchestrator (Story 21.2) via `onProgress` callback
  - [ ] Emitir events SSE: `{ phase: 1-5, status: "running"|"completed"|"failed", progress_pct: 0-100 }`
  - [ ] Emitir event final: `{ status: "completed", blueprint_id: "uuid" }` ou `{ status: "failed", error: "..." }`
  - [ ] Retornar Response com headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`

- [ ] **Task 2** (AC: 2) Implementar GET /api/course-designer/jobs/[jobId]
  - [ ] Criar `apps/web/src/app/api/course-designer/jobs/[jobId]/route.ts`
  - [ ] Query `blueprint_generation_jobs` pelo jobId
  - [ ] Retornar: current_phase, status, phase_results (se completed), blueprint_id (se completed), error_message (se failed)
  - [ ] Validar que job pertence ao tenant do usuario autenticado

- [ ] **Task 3** (AC: 3) Implementar SSE connection handling
  - [ ] Heartbeat a cada 15s para manter conexao ativa
  - [ ] Reconexao graceful: client reconecta e recebe estado atual do DB
  - [ ] Cleanup on disconnect: job continua processando (nao cancela)

- [ ] **Task 4** (AC: 4) Implementar Auth + RLS
  - [ ] Verificar autenticacao em ambos os endpoints
  - [ ] Verificar role manager ou admin
  - [ ] RLS via `auth_tenant_id()` nas queries

- [ ] **Task 5** (AC: 5) Implementar rate limiting
  - [ ] Contar jobs concorrentes (status `processing`) por tenant
  - [ ] Bloquear se >= 3 jobs concorrentes
  - [ ] Retornar 429 Too Many Requests com mensagem descritiva

- [ ] **Task 6** (AC: 1-5) Validar typecheck
  - [ ] Rodar `pnpm typecheck` — deve passar sem erros

---

## Dev Notes

### Technical Notes

```typescript
// SSE pattern para Next.js 15 App Router
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      send({ phase: 1, status: 'running', progress_pct: 0 })
      const analysis = await runAnalyzer(input)
      send({ phase: 1, status: 'completed', progress_pct: 20 })
      // ... continua para cada fase
    }
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
  })
}
```

### File Locations

```
apps/web/src/app/api/course-designer/
├── generate/route.ts                # NOVO
├── jobs/[jobId]/route.ts            # NOVO
```

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-16 | 1.0 | Story creation | River (SM) |
| 2026-02-16 | 1.1 | PO validation: GO — Status Draft → Ready | Pax (PO) |

---

## Dev Agent Record

### Agent Model Used
_To be filled by @dev_

### Debug Log References
_To be filled by @dev_

### Completion Notes List
_To be filled by @dev_

### File List
_To be filled by @dev_

---

## QA Results
_To be filled by @qa_
