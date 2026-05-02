# Story 13.6: Course Creation from Ingestion (Approval Flow)

**Epic:** [Epic 13 — AI Content Ingestion](../../epics/epic-13-ai-content-ingestion.md)
**Version:** 1.0
**Created:** 2026-02-10
**Updated:** 2026-02-10
**Author:** Morgan (PM)
**Status:** Pending
**Story Points:** 5
**Priority:** P0 (completes the flow)
**Blocked By:** Story 13.5
**Blocks:** Epic 14 (auto-trigger integration)
**Assigned To:** @dev

---

## User Story

**As a** manager,
**I want** to approve the AI-organized content and have the course automatically created,
**so that** the transition from preview to actual course is seamless and efficient.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.4, Section 4.1 |
| **PRD Ref** | `docs/prd.md` — FR2 (Course Management) |
| **Stack** | Next.js API Routes, Supabase, Server Actions |
| **DB Tables** | `content_ingestions` (update), `courses` (insert), `chapters` (insert) |
| **QA Notes** | Validar que curso criado e identico ao manual |

---

## Acceptance Criteria

- [ ] **AC1:** API Route `POST /api/ingestion/[id]/approve`
  - Valida que ingestion esta em status='review'
  - Cria Course com titulo e descricao do ai_output (editados pelo manager)
  - Cria Chapters em batch com conteudo organizado
  - Atualiza ingestion: course_id preenchido, status='approved'
  - Retorna `{ courseId, chaptersCreated }`
- [ ] **AC2:** API Route `POST /api/ingestion/[id]/process`
  - Aceita `{ instructions?: string }` para regeneracao
  - Re-executa Organizer Agent com instrucoes adicionais do manager
  - Atualiza ai_output no registro
  - Status volta para 'processing' → 'review'
- [ ] **AC3:** API Route `DELETE /api/ingestion/[id]`
  - Deleta registro e arquivo no Supabase Storage
  - Apenas se status != 'approved' (curso ja criado nao pode ser desfeito aqui)
  - Retorna 204 No Content
- [ ] **AC4:** API Route `GET /api/ingestion/[id]/status` (SSE)
  - Server-Sent Events stream
  - Emite mudancas de status em tempo real
  - Payload: `{ status, progress?, ai_output?, error? }`
  - Fecha stream quando status finaliza (review, approved, failed)
- [ ] **AC5:** UI Botao "Confirmar e Criar Curso"
  - Na tela de preview (Step 3 do wizard)
  - Envia ai_output editado pelo manager (nao o original)
  - Loading state durante criacao
  - Toast: "Curso criado com N capitulos!"
  - Redirect para `/courses/[courseId]`
- [ ] **AC6:** UI Botao "Regenerar"
  - Modal com textarea: "Instrucoes para a IA"
  - Placeholder: "Ex: Divida em mais capitulos, foque na parte pratica..."
  - Re-processa e atualiza preview
- [ ] **AC7:** UI Botao "Descartar"
  - Confirmacao: "Deseja descartar este conteudo?"
  - Deleta ingestion e redirect para /courses
- [ ] **AC8:** Integracao com Epic 14
  - Apos criar curso + chapters, trigger batch question generation
  - Fire-and-forget (nao bloqueia response)
  - Manager ve indicador "Gerando perguntas..." na pagina do curso

---

## CodeRabbit Integration

> CodeRabbit will review this story's PR for: Data integrity (course creation), error handling, cleanup patterns.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Implementar approve route
  - [ ] Criar `apps/web/src/app/api/ingestion/[id]/approve/route.ts`
  - [ ] Auth guard + validate status
  - [ ] Criar curso com Supabase insert
  - [ ] Criar chapters em batch
  - [ ] Atualizar ingestion com course_id
  - [ ] Trigger question generation (Epic 14)

- [ ] **Task 2** (AC: 2) Implementar process/regenerate route
  - [ ] Criar `apps/web/src/app/api/ingestion/[id]/process/route.ts`
  - [ ] Aceitar instrucoes adicionais
  - [ ] Re-executar Organizer Agent
  - [ ] Atualizar ai_output

- [ ] **Task 3** (AC: 3) Implementar delete route
  - [ ] Criar `apps/web/src/app/api/ingestion/[id]/route.ts` (DELETE method)
  - [ ] Deletar arquivo no Storage
  - [ ] Deletar registro no banco

- [ ] **Task 4** (AC: 4) Implementar SSE status route
  - [ ] Criar `apps/web/src/app/api/ingestion/[id]/status/route.ts`
  - [ ] ReadableStream com polling a cada 2s
  - [ ] Emitir status changes
  - [ ] Fechar stream em estados finais

- [ ] **Task 5** (AC: 5, 6, 7) Conectar botoes na UI
  - [ ] Botao "Confirmar e Criar Curso" → chama approve API
  - [ ] Botao "Regenerar" → modal + chama process API
  - [ ] Botao "Descartar" → confirmacao + chama delete API
  - [ ] Loading states e toasts

---

## Dev Notes

### Approve Route

```typescript
// POST /api/ingestion/[id]/approve/route.ts
export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params
  const body = await request.json()
  // body contains potentially edited ai_output from manager

  const supabase = await createClient()
  // ... auth guard ...

  // Fetch ingestion
  const { data: ingestion } = await supabase
    .from("content_ingestions")
    .select("*")
    .eq("id", id)
    .single()

  if (!ingestion || ingestion.status !== "review") {
    return NextResponse.json({ error: "Ingestion nao esta em revisao" }, { status: 400 })
  }

  const aiOutput = body.ai_output ?? ingestion.ai_output

  // Create course
  const { data: course } = await supabase.from("courses").insert({
    title: aiOutput.suggested_title,
    description: aiOutput.suggested_description,
    tenant_id: ingestion.tenant_id,
    created_by: user.id,
    status: "draft",
  }).select().single()

  // Create chapters in batch
  const chaptersToInsert = aiOutput.chapters.map((ch: any) => ({
    course_id: course.id,
    tenant_id: ingestion.tenant_id,
    title: ch.title,
    content: ch.content,
    learning_objective: ch.learning_objective,
    order: ch.order,
    status: "draft",
  }))

  const { data: chapters } = await supabase
    .from("chapters")
    .insert(chaptersToInsert)
    .select()

  // Update ingestion
  await supabase
    .from("content_ingestions")
    .update({ course_id: course.id, status: "approved", updated_at: new Date().toISOString() })
    .eq("id", id)

  // Fire-and-forget: trigger question generation (Epic 14)
  // This will be implemented when Epic 14 is ready
  // fetch(`/api/courses/${course.id}/generate-questions`, { method: "POST" })

  return NextResponse.json({
    courseId: course.id,
    chaptersCreated: chapters?.length ?? 0,
  })
}
```

### SSE Status Route

```typescript
// GET /api/ingestion/[id]/status/route.ts
export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createClient()
  // ... auth guard ...

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const interval = setInterval(async () => {
        const { data } = await supabase
          .from("content_ingestions")
          .select("status, ai_output, error_message, processing_metadata")
          .eq("id", id)
          .single()

        if (!data) {
          controller.close()
          clearInterval(interval)
          return
        }

        const event = `data: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(event))

        if (["review", "approved", "failed"].includes(data.status)) {
          controller.close()
          clearInterval(interval)
        }
      }, 2000)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
```

### File Locations

```
apps/web/src/app/api/ingestion/
├── [id]/
│   ├── approve/route.ts        # NEW
│   ├── process/route.ts        # NEW
│   ├── status/route.ts         # NEW
│   └── route.ts                # NEW (DELETE handler)
```

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|-----------|---------|
| Pre-Commit | Lint, typecheck | Yes |
| Pre-PR | Fluxo E2E: upload → organize → approve → course exists in DB | Yes |

---

## Definition of Done

- [ ] Approve cria curso + chapters corretamente
- [ ] Regenerate re-processa com instrucoes
- [ ] Delete limpa arquivo + registro
- [ ] SSE stream funcional
- [ ] UI botoes conectados com loading states
- [ ] Curso criado via ingestion e identico ao criado manualmente
- [ ] `pnpm lint && pnpm typecheck` pass

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dev)** | Implementar API routes e integracao UI |
| **@qa (QA)** | Testar fluxo completo E2E |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Falha parcial na criacao (curso sem chapters) | High | Transacao atomica ou cleanup |
| SSE connection timeout | Low | Reconnect automático no client |
| Manager edita e perde dados | Medium | Salvar rascunho automaticamente |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-10 | 1.0 | Story criada | Morgan (PM) |

---

*Story criada por Morgan (PM) — eximIA Academy*

— Morgan, planejando o futuro 📊
