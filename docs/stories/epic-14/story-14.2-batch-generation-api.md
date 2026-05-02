# Story 14.2: Batch Generation API (Course-Level Trigger)

**Epic:** [Epic 14 — AI Question Generation Pipeline](../../epics/epic-14-ai-question-generation-pipeline.md)
**Version:** 1.0
**Created:** 2026-02-10
**Updated:** 2026-02-10
**Author:** Morgan (PM)
**Status:** Done
**Story Points:** 5
**Priority:** P0 (core pipeline)
**Blocked By:** Story 14.1
**Blocks:** Story 14.3, Story 14.4
**Assigned To:** @dev

---

## User Story

**As a** manager,
**I want** to generate questions for all chapters of a course in a single action,
**so that** I don't need to manually trigger generation for each chapter.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.4, Section 5.3 |
| **PRD Ref** | `docs/prd.md` — FR4 (Socratic Questions) |
| **Stack** | Next.js API Routes, Vercel AI SDK, Creator Agent, Supabase |
| **DB Tables** | `question_generation_jobs` (insert/update), `questions` (insert), `chapters` (read) |
| **QA Notes** | Testar com cursos de 1, 5, 10+ capitulos |

---

## Acceptance Criteria

- [x] **AC1:** API Route `POST /api/courses/[courseId]/generate-questions`
  - Auth guard: managers/admins
  - Busca todos chapters publicados do curso
  - Filtra chapters que ja tem perguntas ativas (skip)
  - Cria job com status='processing'
  - Retorna `{ jobId, chaptersToProcess }` imediatamente
- [x] **AC2:** Processamento sequencial por capitulo
  - Para cada chapter sem perguntas ativas:
    - Valida conteudo (min 100 chars)
    - Chama `generateQuestions()` do Creator Agent existente
    - Salva perguntas com status='pending' e job_id
    - Atualiza progress: `{ total, completed, failed, current_chapter }`
  - Se falhar em 1 capitulo: registra erro, continua proximos
- [x] **AC3:** Finalizacao do job
  - Todos OK: status='review', questionsGenerated atualizado
  - Parcial: status='review' com progress.failed > 0
  - Todos falharam: status='failed' com error_message
- [x] **AC4:** Rate limiting: 1 job por curso a cada 5 minutos
- [x] **AC5:** Skip de capitulos com perguntas ativas existentes
  - Retorna mensagem se todos capitulos ja tem perguntas
- [x] **AC6:** API Route `GET /api/courses/[courseId]/generation-jobs`
  - Lista jobs do curso ordenados por created_at DESC
  - Inclui status, progress, contadores
- [x] **AC7:** Nao duplica perguntas (mesmo capitulo no mesmo job)

---

## CodeRabbit Integration

> CodeRabbit will review this story's PR for: Async processing patterns, error handling, rate limiting, data integrity.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1, 4) Implementar batch generation route
  - [ ] Criar `apps/web/src/app/api/courses/[courseId]/generate-questions/route.ts`
  - [ ] Auth guard (manager/admin)
  - [ ] Fetch chapters publicados
  - [ ] Filter chapters sem perguntas ativas
  - [ ] Criar job
  - [ ] Rate limiting (1/5min por curso)
  - [ ] Retornar jobId

- [ ] **Task 2** (AC: 2, 3, 5, 7) Implementar processamento sequencial
  - [ ] Funcao `processChaptersSequentially()`
  - [ ] Loop por capitulos com try/catch individual
  - [ ] Chamar generateQuestions() existente
  - [ ] Salvar perguntas com job_id
  - [ ] Atualizar progress a cada capitulo
  - [ ] Finalizar job com status correto

- [ ] **Task 3** (AC: 6) Implementar list jobs route
  - [ ] Criar `apps/web/src/app/api/courses/[courseId]/generation-jobs/route.ts`
  - [ ] Auth guard
  - [ ] Query com order by created_at DESC

---

## Dev Notes

### Batch Generation Route

```typescript
// apps/web/src/app/api/courses/[courseId]/generate-questions/route.ts
import { createClient } from "@/lib/supabase/server"
import { generateQuestions, creatorInputSchema } from "@eximia/agents"
import { NextResponse } from "next/server"

interface RouteContext {
  params: Promise<{ courseId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { courseId } = await context.params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })

  // Role guard
  const { data: profile } = await supabase
    .from("users").select("role, tenant_id").eq("id", user.id).single()
  if (!profile || !["manager", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Permissao negada" }, { status: 403 })
  }

  // Fetch published chapters
  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, title, content, learning_objective, tenant_id")
    .eq("course_id", courseId)
    .eq("status", "published")
    .order("order", { ascending: true })

  if (!chapters?.length) {
    return NextResponse.json({
      error: "Nenhum capitulo publicado neste curso"
    }, { status: 400 })
  }

  // Filter chapters with existing active questions
  const { data: activeQuestions } = await supabase
    .from("questions")
    .select("chapter_id")
    .eq("status", "active")
    .in("chapter_id", chapters.map(c => c.id))

  const withActive = new Set(activeQuestions?.map(q => q.chapter_id))
  const toProcess = chapters.filter(c => !withActive.has(c.id))

  if (toProcess.length === 0) {
    return NextResponse.json({
      message: "Todos os capitulos ja possuem perguntas ativas",
      jobId: null,
    })
  }

  // Create job
  const { data: job, error: jobError } = await supabase
    .from("question_generation_jobs")
    .insert({
      course_id: courseId,
      tenant_id: profile.tenant_id,
      triggered_by: user.id,
      scope: "course",
      status: "processing",
      progress: { total: toProcess.length, completed: 0, failed: 0 },
    })
    .select()
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: "Erro ao criar job" }, { status: 500 })
  }

  // Process in background (non-blocking)
  processChaptersSequentially(toProcess, job.id, supabase, profile.tenant_id)
    .catch(err => console.error("Batch generation error:", err))

  return NextResponse.json({
    jobId: job.id,
    chaptersToProcess: toProcess.length,
    message: `Gerando perguntas para ${toProcess.length} capitulos...`,
  }, { status: 202 })
}

async function processChaptersSequentially(
  chapters: any[],
  jobId: string,
  supabase: any,
  tenantId: string
) {
  let completed = 0
  let failed = 0
  let totalGenerated = 0

  for (const chapter of chapters) {
    try {
      // Update progress
      await supabase.from("question_generation_jobs").update({
        progress: {
          total: chapters.length,
          completed,
          failed,
          current_chapter: chapter.title,
        },
        updated_at: new Date().toISOString(),
      }).eq("id", jobId)

      // Validate content
      const input = creatorInputSchema.parse({
        chapter_content: chapter.content,
        chapter_title: chapter.title,
        learning_objective: chapter.learning_objective ?? undefined,
        max_questions: 3,
      })

      // Generate with retry
      let output
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          output = await generateQuestions(input)
          break
        } catch (err) {
          if (attempt === 1) throw err
        }
      }

      if (!output) throw new Error("Failed to generate")

      // Save questions
      const questionsToInsert = output.questions.map(q => ({
        chapter_id: chapter.id,
        tenant_id: tenantId,
        text: q.text,
        skill: q.skill,
        intention: q.intention,
        expected_depth: q.expected_depth,
        status: "pending",
        job_id: jobId,
      }))

      await supabase.from("questions").insert(questionsToInsert)
      totalGenerated += questionsToInsert.length
      completed++
    } catch (err) {
      console.error(`Failed for chapter ${chapter.id}:`, err)
      failed++
    }
  }

  // Finalize job
  const finalStatus = failed === chapters.length ? "failed" : "review"
  await supabase.from("question_generation_jobs").update({
    status: finalStatus,
    progress: { total: chapters.length, completed, failed },
    questions_generated: totalGenerated,
    error_message: failed > 0 ? `${failed} capitulo(s) falharam` : null,
    updated_at: new Date().toISOString(),
  }).eq("id", jobId)
}
```

### File Locations

```
apps/web/src/app/api/
├── courses/[courseId]/
│   ├── generate-questions/route.ts   # NEW
│   └── generation-jobs/route.ts       # NEW
```

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|-----------|---------|
| Pre-Commit | Lint, typecheck | Yes |
| Pre-PR | Gera perguntas para curso com 5+ capitulos, job finaliza corretamente | Yes |

---

## Definition of Done

- [ ] Batch generation funcional para 1-15 capitulos
- [ ] Job tracking com progress atualizado
- [ ] Skip de capitulos com perguntas ativas
- [ ] Falha parcial nao bloqueia o restante
- [ ] Rate limiting ativo
- [ ] List jobs funcional
- [ ] `pnpm lint && pnpm typecheck` pass

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dev)** | Implementar batch API e processamento |
| **@qa (QA)** | Testar com cursos de diferentes tamanhos |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-10 | 1.0 | Story criada | Morgan (PM) |

---

*Story criada por Morgan (PM) — eximIA Academy*

— Morgan, planejando o futuro 📊
