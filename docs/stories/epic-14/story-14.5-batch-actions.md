# Story 14.5: Batch Actions (Approve/Reject Selected)

**Epic:** [Epic 14 — AI Question Generation Pipeline](../../epics/epic-14-ai-question-generation-pipeline.md)
**Version:** 1.0
**Created:** 2026-02-10
**Updated:** 2026-02-10
**Author:** Morgan (PM)
**Status:** Done
**Story Points:** 5
**Priority:** P0 (core review functionality)
**Blocked By:** Story 14.4
**Blocks:** None
**Assigned To:** @dev

---

## User Story

**As a** manager,
**I want** to approve or reject multiple questions at once,
**so that** the review process is fast and efficient for courses with many questions.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.4, Section 4.1 |
| **PRD Ref** | `docs/prd.md` — FR5 (Question Review) |
| **Stack** | Next.js Server Actions, Supabase |
| **DB Tables** | `questions` (update status), `question_generation_jobs` (update counters) |
| **QA Notes** | Testar com 10+ perguntas selecionadas |

---

## Acceptance Criteria

- [ ] **AC1:** Server Action `batchApproveQuestions(questionIds[], courseId)`
  - Auth guard: manager/admin
  - Atualiza status de todas perguntas para 'active' em uma query
  - Retorna `{ success: true, count: N }` ou `{ error: string }`
- [ ] **AC2:** Server Action `batchRejectQuestions(questionIds[], courseId)`
  - Auth guard
  - Atualiza status para 'archived'
  - Retorna `{ success: true, count: N }` ou `{ error: string }`
- [ ] **AC3:** Server Action `approveAllPending(courseId)`
  - Busca todas perguntas pendentes do curso
  - Atualiza todas para 'active'
  - Usa Modal de confirmacao na UI
- [ ] **AC4:** Atualizacao de counters no job
  - Quando perguntas sao aprovadas/rejeitadas, atualiza questions_approved/questions_rejected
  - Se todas perguntas do job foram revisadas → job.status = 'completed'
- [ ] **AC5:** Feedback visual
  - Toast de sucesso: "N perguntas aprovadas" / "N perguntas rejeitadas"
  - Cards atualizam status visualmente (revalidatePath)
  - Selecao limpa apos acao
- [ ] **AC6:** Sticky bar desaparece apos acao (selecao vazia)
- [ ] **AC7:** Validacao: nao permite aprovar perguntas ja ativas ou rejeitar ja arquivadas

---

## CodeRabbit Integration

> CodeRabbit will review this story's PR for: Batch SQL operations, data integrity, error handling.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1, 7) Implementar batchApproveQuestions
  - [ ] Criar `apps/web/src/app/(platform)/courses/[courseId]/questions/actions.ts`
  - [ ] Auth guard
  - [ ] Validar que todas IDs pertencem ao curso
  - [ ] Filtrar apenas status='pending'
  - [ ] Update em batch com .in()
  - [ ] revalidatePath

- [ ] **Task 2** (AC: 2, 7) Implementar batchRejectQuestions
  - [ ] Similar ao approve, status → 'archived'
  - [ ] Filtrar apenas status='pending'

- [ ] **Task 3** (AC: 3) Implementar approveAllPending
  - [ ] Buscar todos pending do curso
  - [ ] Chamar batchApproveQuestions com os IDs

- [ ] **Task 4** (AC: 4) Atualizar counters do job
  - [ ] Funcao helper `updateJobCounters()`
  - [ ] Buscar job_id das perguntas afetadas
  - [ ] Recalcular approved/rejected counts
  - [ ] Verificar se todos revisados → status='completed'

- [ ] **Task 5** (AC: 5, 6) Integrar na UI
  - [ ] Conectar sticky bar buttons com server actions
  - [ ] Conectar botao "Aprovar todas" com modal + action
  - [ ] Toast notifications
  - [ ] Limpar selecao apos acao
  - [ ] router.refresh()

---

## Dev Notes

### Server Actions

```typescript
// apps/web/src/app/(platform)/courses/[courseId]/questions/actions.ts
"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function batchApproveQuestions(
  questionIds: string[],
  courseId: string,
) {
  if (questionIds.length === 0) return { error: "Nenhuma pergunta selecionada" }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Nao autorizado" }

  const { data: profile } = await supabase
    .from("users").select("role").eq("id", user.id).single()
  if (!profile || !["manager", "admin"].includes(profile.role)) {
    return { error: "Permissao negada" }
  }

  // Only update pending questions
  const { data: updated, error } = await supabase
    .from("questions")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .in("id", questionIds)
    .eq("status", "pending")
    .select("id, job_id")

  if (error) return { error: `Erro ao aprovar: ${error.message}` }

  // Update job counters
  const jobIds = [...new Set(updated?.map(q => q.job_id).filter(Boolean))]
  for (const jobId of jobIds) {
    await recalculateJobCounters(jobId as string, supabase)
  }

  revalidatePath(`/courses/${courseId}/questions`)
  return { success: true, count: updated?.length ?? 0 }
}

export async function batchRejectQuestions(
  questionIds: string[],
  courseId: string,
) {
  if (questionIds.length === 0) return { error: "Nenhuma pergunta selecionada" }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Nao autorizado" }

  const { data: profile } = await supabase
    .from("users").select("role").eq("id", user.id).single()
  if (!profile || !["manager", "admin"].includes(profile.role)) {
    return { error: "Permissao negada" }
  }

  const { data: updated, error } = await supabase
    .from("questions")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .in("id", questionIds)
    .eq("status", "pending")
    .select("id, job_id")

  if (error) return { error: `Erro ao rejeitar: ${error.message}` }

  const jobIds = [...new Set(updated?.map(q => q.job_id).filter(Boolean))]
  for (const jobId of jobIds) {
    await recalculateJobCounters(jobId as string, supabase)
  }

  revalidatePath(`/courses/${courseId}/questions`)
  return { success: true, count: updated?.length ?? 0 }
}

export async function approveAllPending(courseId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Nao autorizado" }

  // Get all chapter IDs for this course
  const { data: chapters } = await supabase
    .from("chapters").select("id").eq("course_id", courseId)

  if (!chapters?.length) return { error: "Curso sem capitulos" }

  // Get all pending question IDs
  const { data: pending } = await supabase
    .from("questions")
    .select("id")
    .in("chapter_id", chapters.map(c => c.id))
    .eq("status", "pending")

  if (!pending?.length) return { error: "Nenhuma pergunta pendente" }

  return batchApproveQuestions(pending.map(q => q.id), courseId)
}

async function recalculateJobCounters(jobId: string, supabase: any) {
  const { data: questions } = await supabase
    .from("questions")
    .select("status")
    .eq("job_id", jobId)

  if (!questions) return

  const approved = questions.filter((q: any) => q.status === "active").length
  const rejected = questions.filter((q: any) => q.status === "archived").length
  const pending = questions.filter((q: any) => q.status === "pending").length

  const status = pending === 0 ? "completed" : "review"

  await supabase.from("question_generation_jobs").update({
    questions_approved: approved,
    questions_rejected: rejected,
    status,
    updated_at: new Date().toISOString(),
  }).eq("id", jobId)
}
```

### File Locations

```
apps/web/src/app/(platform)/courses/[courseId]/questions/
└── actions.ts                    # NEW: batch server actions
```

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|-----------|---------|
| Pre-Commit | Lint, typecheck | Yes |
| Pre-PR | Batch approve/reject 10+ perguntas, counters corretos, job status atualizado | Yes |

---

## Definition of Done

- [ ] Batch approve funcional
- [ ] Batch reject funcional
- [ ] Approve all pending funcional com modal
- [ ] Job counters atualizados corretamente
- [ ] Job auto-completa quando todos revisados
- [ ] Toast notifications
- [ ] Selecao limpa apos acao
- [ ] `pnpm lint && pnpm typecheck` pass

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dev)** | Implementar server actions e integracao UI |
| **@qa (QA)** | Testar batch com 10+ perguntas, edge cases |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-10 | 1.0 | Story criada | Morgan (PM) |

---

*Story criada por Morgan (PM) — eximIA Academy*

— Morgan, planejando o futuro 📊
