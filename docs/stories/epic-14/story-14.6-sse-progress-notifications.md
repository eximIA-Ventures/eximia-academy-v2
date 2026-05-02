# Story 14.6: SSE Progress e Notificacoes

**Epic:** [Epic 14 — AI Question Generation Pipeline](../../epics/epic-14-ai-question-generation-pipeline.md)
**Version:** 1.0
**Created:** 2026-02-10
**Updated:** 2026-02-10
**Author:** Morgan (PM)
**Status:** Done
**Story Points:** 5
**Priority:** P1 (polish e UX)
**Blocked By:** Story 14.4
**Blocks:** None
**Assigned To:** @dev

---

## User Story

**As a** manager,
**I want** to see real-time progress of question generation and receive notifications when complete,
**so that** I know when questions are ready for review without manually refreshing.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.4, Section 6.2 |
| **PRD Ref** | `docs/prd.md` — FR4, FR5 |
| **Stack** | SSE (Server-Sent Events), Next.js API Routes, React hooks |
| **DB Tables** | `question_generation_jobs` (read status/progress) |
| **QA Notes** | Testar SSE connection, reconnect, timeout |

---

## Acceptance Criteria

- [ ] **AC1:** API Route `GET /api/generation-jobs/[jobId]/status` (SSE)
  - Server-Sent Events stream
  - Polling do job a cada 2 segundos
  - Payload: `{ status, progress, questionsGenerated, errorMessage? }`
  - Stream fecha quando job atinge estado final (review, completed, failed)
  - Auth guard: manager/admin
- [ ] **AC2:** Componente `GenerationProgress` na tela de questions
  - Exibido quando job em andamento (status = processing)
  - Progress bar com porcentagem: `completed / total * 100`
  - Texto descritivo: "Gerando perguntas: Cap 3 de 8..."
  - Animacao de loading (pulse ou spinner)
  - Auto-refresh da lista quando job finaliza (router.refresh)
- [ ] **AC3:** Handling de erros parciais
  - Se progress.failed > 0: "N capitulos processados, M falharam"
  - Botao "Tentar novamente" para capitulos que falharam
  - Lista de capitulos com falha visivel
- [ ] **AC4:** Toast notification quando geracao completa
  - Toast automático: "Perguntas geradas! N perguntas prontas para revisao."
  - CTA no toast: "Ver perguntas" → link para tela de review
- [ ] **AC5:** Reconnect automatico
  - Se SSE connection cair, reconnect apos 3 segundos
  - Max 5 tentativas de reconnect
  - Apos 5 falhas, mostra botao "Atualizar manualmente"
- [ ] **AC6:** Badge na pagina do curso atualiza com SSE
  - QuestionGenerationBadge (Story 14.3) se mantem atualizado
  - Transicao: "Gerando..." → "N perguntas pendentes"

---

## CodeRabbit Integration

> CodeRabbit will review this story's PR for: SSE implementation, connection handling, memory leaks, cleanup.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Implementar SSE route
  - [ ] Criar `apps/web/src/app/api/generation-jobs/[jobId]/status/route.ts`
  - [ ] ReadableStream com polling interval
  - [ ] Auth guard
  - [ ] Auto-close em estados finais
  - [ ] Proper headers (text/event-stream)

- [ ] **Task 2** (AC: 2, 4) Criar GenerationProgress component
  - [ ] Criar `_components/generation-progress.tsx`
  - [ ] EventSource connection hook
  - [ ] ProgressBar de @eximia/ui
  - [ ] Texto descritivo com current_chapter
  - [ ] router.refresh quando finaliza
  - [ ] Toast notification

- [ ] **Task 3** (AC: 3) Handling de erros
  - [ ] Exibir falhas parciais
  - [ ] Lista de capitulos que falharam
  - [ ] Botao retry

- [ ] **Task 4** (AC: 5) Reconnect logic
  - [ ] Custom hook `useSSE(url, options)`
  - [ ] Auto-reconnect com backoff
  - [ ] Max retries com fallback manual
  - [ ] Cleanup on unmount

- [ ] **Task 5** (AC: 6) Integrar com badge
  - [ ] Badge consome mesmo SSE (se na mesma pagina)
  - [ ] Ou refresh automatico apos job finalizar

---

## Dev Notes

### SSE Route

```typescript
// apps/web/src/app/api/generation-jobs/[jobId]/status/route.ts
import { createClient } from "@/lib/supabase/server"

interface RouteContext {
  params: Promise<{ jobId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { jobId } = await context.params
  const supabase = await createClient()

  // Auth guard
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let attempts = 0
      const maxAttempts = 150 // 5 min max (2s * 150)

      const interval = setInterval(async () => {
        attempts++

        try {
          const { data: job } = await supabase
            .from("question_generation_jobs")
            .select("status, progress, questions_generated, error_message")
            .eq("id", jobId)
            .single()

          if (!job || attempts >= maxAttempts) {
            const finalEvent = `data: ${JSON.stringify({ status: "timeout", error: "Connection timeout" })}\n\n`
            controller.enqueue(encoder.encode(finalEvent))
            controller.close()
            clearInterval(interval)
            return
          }

          const event = `data: ${JSON.stringify({
            status: job.status,
            progress: job.progress,
            questionsGenerated: job.questions_generated,
            errorMessage: job.error_message,
          })}\n\n`

          controller.enqueue(encoder.encode(event))

          // Close on terminal states
          if (["review", "completed", "failed"].includes(job.status)) {
            controller.close()
            clearInterval(interval)
          }
        } catch (err) {
          console.error("SSE polling error:", err)
        }
      }, 2000)

      // Cleanup on abort
      request.signal.addEventListener("abort", () => {
        clearInterval(interval)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
```

### useSSE Hook

```typescript
// apps/web/src/hooks/use-sse.ts
import { useCallback, useEffect, useRef, useState } from "react"

interface UseSSEOptions {
  onMessage: (data: any) => void
  onComplete?: () => void
  onError?: (error: Event) => void
  maxRetries?: number
}

export function useSSE(url: string | null, options: UseSSEOptions) {
  const { onMessage, onComplete, onError, maxRetries = 5 } = options
  const [isConnected, setIsConnected] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const eventSourceRef = useRef<EventSource | null>(null)

  const connect = useCallback(() => {
    if (!url) return

    const es = new EventSource(url)
    eventSourceRef.current = es

    es.onopen = () => {
      setIsConnected(true)
      setRetryCount(0)
    }

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessage(data)

        if (["review", "completed", "failed", "timeout"].includes(data.status)) {
          es.close()
          setIsConnected(false)
          onComplete?.()
        }
      } catch (err) {
        console.error("SSE parse error:", err)
      }
    }

    es.onerror = (error) => {
      es.close()
      setIsConnected(false)

      if (retryCount < maxRetries) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1)
          connect()
        }, 3000)
      } else {
        onError?.(error)
      }
    }
  }, [url, onMessage, onComplete, onError, retryCount, maxRetries])

  useEffect(() => {
    connect()
    return () => {
      eventSourceRef.current?.close()
    }
  }, [connect])

  return { isConnected, retryCount, maxRetries }
}
```

### GenerationProgress Component

```typescript
// _components/generation-progress.tsx
"use client"

import { useSSE } from "@/hooks/use-sse"
import { ProgressBar, useToast } from "@eximia/ui"
import { useRouter } from "next/navigation"
import { useState } from "react"

interface GenerationProgressProps {
  jobId: string
  courseId: string
}

export function GenerationProgress({ jobId, courseId }: GenerationProgressProps) {
  const [progress, setProgress] = useState({ total: 0, completed: 0, failed: 0, current_chapter: "" })
  const [status, setStatus] = useState("processing")
  const { toast } = useToast()
  const router = useRouter()

  useSSE(`/api/generation-jobs/${jobId}/status`, {
    onMessage: (data) => {
      setStatus(data.status)
      if (data.progress) setProgress(data.progress)
    },
    onComplete: () => {
      toast({
        variant: "success",
        title: `Perguntas geradas!`,
        description: "Prontas para revisao.",
      })
      router.refresh()
    },
  })

  if (status !== "processing") return null

  const percent = progress.total > 0
    ? Math.round((progress.completed / progress.total) * 100)
    : 0

  return (
    <div className="rounded-md border border-border-medium bg-bg-card p-4 space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-text-primary font-medium">Gerando perguntas...</span>
        <span className="text-text-secondary">{percent}%</span>
      </div>
      <ProgressBar value={percent} />
      <p className="text-xs text-text-muted">
        Capitulo {progress.completed + 1} de {progress.total}
        {progress.current_chapter && `: ${progress.current_chapter}`}
      </p>
      {progress.failed > 0 && (
        <p className="text-xs text-semantic-warning">
          {progress.failed} capitulo(s) com erro
        </p>
      )}
    </div>
  )
}
```

### File Locations

```
apps/web/src/
├── app/api/generation-jobs/[jobId]/
│   └── status/route.ts                  # NEW: SSE stream
├── app/(platform)/courses/[courseId]/questions/_components/
│   └── generation-progress.tsx           # NEW: progress UI
└── hooks/
    └── use-sse.ts                        # NEW: reusable SSE hook
```

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|-----------|---------|
| Pre-Commit | Lint, typecheck | Yes |
| Pre-PR | SSE funcional, progress atualiza, reconnect testado | Yes |

---

## Definition of Done

- [ ] SSE stream funcional com polling a 2s
- [ ] Progress bar com porcentagem em tempo real
- [ ] Toast notification quando completo
- [ ] Reconnect automatico (max 5 tentativas)
- [ ] Erros parciais exibidos
- [ ] Auto-refresh da lista apos finalizacao
- [ ] Cleanup correto no unmount
- [ ] `pnpm lint && pnpm typecheck` pass

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dev)** | Implementar SSE route, hook, progress component |
| **@qa (QA)** | Testar SSE em tempo real, connection drops, edge cases |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-10 | 1.0 | Story criada | Morgan (PM) |

---

*Story criada por Morgan (PM) — eximIA Academy*

— Morgan, planejando o futuro 📊
