# Story 14.3: Auto-Trigger (Post-Ingestion e Post-Publish)

**Epic:** [Epic 14 — AI Question Generation Pipeline](../../epics/epic-14-ai-question-generation-pipeline.md)
**Version:** 1.0
**Created:** 2026-02-10
**Updated:** 2026-02-10
**Author:** Morgan (PM)
**Status:** Done
**Story Points:** 3
**Priority:** P1 (automacao)
**Blocked By:** Story 14.2
**Blocks:** None
**Assigned To:** @dev

---

## User Story

**As a** manager,
**I want** questions to be automatically generated after content ingestion or chapter publishing,
**so that** I don't need to manually trigger generation every time.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.4, Section 5.3 |
| **PRD Ref** | `docs/prd.md` — FR4 (Socratic Questions) |
| **Stack** | Server Actions, API Routes, Next.js |
| **DB Tables** | `courses` (read settings), `chapters` (read status), `question_generation_jobs` (insert) |
| **QA Notes** | Testar auto-trigger em ambos cenarios sem bloquear fluxo existente |

---

## Acceptance Criteria

- [ ] **AC1:** Auto-trigger apos publicacao de capitulo
  - Quando `toggleChapterStatus()` publica capitulo (draft → published)
  - Se capitulo nao tem perguntas ativas
  - Chama API de geracao para aquele capitulo especifico (scope='chapter')
  - Fire-and-forget (nao bloqueia a acao de publicacao)
  - Log de erro silencioso se falhar
- [ ] **AC2:** Auto-trigger apos ingestion aprovada (Epic 13)
  - Quando `POST /api/ingestion/[id]/approve` cria o curso
  - Chama `POST /api/courses/[courseId]/generate-questions`
  - Fire-and-forget
- [ ] **AC3:** Indicador visual no curso
  - Badge no header da pagina do curso quando job em andamento
  - Texto: "Gerando perguntas..." (animado)
  - Badge quando job completo: "N perguntas pendentes de revisao"
  - Link clicavel para `/courses/[courseId]/questions`
- [ ] **AC4:** Opt-out via course settings
  - Campo `auto_generate_questions: boolean` no `courses.settings` JSONB
  - Default: `true`
  - Toggle na pagina de settings do curso (se existir) ou inline
  - Quando false, auto-trigger nao dispara
- [ ] **AC5:** Nao gera duplicatas
  - Skip capitulos que ja tem perguntas ativas
  - Skip se job ja em andamento para o mesmo curso

---

## CodeRabbit Integration

> CodeRabbit will review this story's PR for: Fire-and-forget patterns, error handling, settings validation.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Adicionar auto-trigger no toggleChapterStatus
  - [ ] Editar `apps/web/src/app/(platform)/courses/[courseId]/chapters/actions.ts`
  - [ ] Apos publicacao bem-sucedida, verificar se auto-generate esta habilitado
  - [ ] Chamar API de geracao (fire-and-forget)
  - [ ] Nao bloquear resposta da action

- [ ] **Task 2** (AC: 2) Adicionar auto-trigger no ingestion approve
  - [ ] Editar `apps/web/src/app/api/ingestion/[id]/approve/route.ts` (quando existir)
  - [ ] Apos criar curso + chapters, trigger batch generation
  - [ ] Nota: pode ser implementado quando Epic 13 estiver pronto

- [ ] **Task 3** (AC: 3) Criar badge component
  - [ ] Criar `apps/web/src/app/(platform)/courses/[courseId]/_components/question-generation-badge.tsx`
  - [ ] Buscar job ativo no server component
  - [ ] Exibir badge com status e link
  - [ ] Adicionar na pagina do curso

- [ ] **Task 4** (AC: 4) Implementar opt-out
  - [ ] Ler `courses.settings.auto_generate_questions` no trigger
  - [ ] Se false, skip auto-trigger
  - [ ] Adicionar toggle na UI (inline button ou settings page)

- [ ] **Task 5** (AC: 5) Prevenir duplicatas
  - [ ] Verificar se ja existe job em andamento antes de criar novo
  - [ ] Verificar perguntas ativas antes de gerar

---

## Dev Notes

### Auto-Trigger no toggleChapterStatus

```typescript
// apps/web/src/app/(platform)/courses/[courseId]/chapters/actions.ts
// Adicionar apos a publicacao bem-sucedida:

if (newStatus === "published") {
  // Check auto-generate setting
  const { data: course } = await supabase
    .from("courses")
    .select("settings")
    .eq("id", courseId)
    .single()

  const autoGenerate = (course?.settings as any)?.auto_generate_questions !== false

  if (autoGenerate) {
    // Check if chapter already has active questions
    const { count } = await supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("chapter_id", chapterId)
      .eq("status", "active")

    if (!count || count === 0) {
      // Fire-and-forget: don't await, don't block
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/chapters/${chapterId}/generate-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).catch((err) => {
        console.error("Auto-trigger question generation failed:", err)
      })
    }
  }
}
```

### Badge Component

```typescript
// question-generation-badge.tsx
import { Badge } from "@eximia/ui"
import Link from "next/link"

interface Props {
  courseId: string
  activeJobStatus?: string
  pendingQuestionsCount: number
}

export function QuestionGenerationBadge({
  courseId,
  activeJobStatus,
  pendingQuestionsCount,
}: Props) {
  if (activeJobStatus === "processing") {
    return (
      <Badge variant="warning" className="animate-pulse">
        Gerando perguntas...
      </Badge>
    )
  }

  if (pendingQuestionsCount > 0) {
    return (
      <Link href={`/courses/${courseId}/questions`}>
        <Badge variant="warning">
          {pendingQuestionsCount} perguntas pendentes
        </Badge>
      </Link>
    )
  }

  return null
}
```

### File Locations

```
apps/web/src/app/(platform)/courses/[courseId]/
├── _components/
│   └── question-generation-badge.tsx    # NEW
├── chapters/
│   └── actions.ts                       # UPDATED: auto-trigger
```

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|-----------|---------|
| Pre-Commit | Lint, typecheck | Yes |
| Pre-PR | Auto-trigger dispara ao publicar capitulo, badge visivel | Yes |

---

## Definition of Done

- [ ] Auto-trigger funciona ao publicar capitulo
- [ ] Badge exibido no curso com status correto
- [ ] Opt-out via settings funcional
- [ ] Nao duplica perguntas/jobs
- [ ] Fire-and-forget nao bloqueia fluxo existente
- [ ] `pnpm lint && pnpm typecheck` pass

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dev)** | Implementar triggers e badge |
| **@qa (QA)** | Testar auto-trigger em ambos cenarios |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-10 | 1.0 | Story criada | Morgan (PM) |

---

*Story criada por Morgan (PM) — eximIA Academy*

— Morgan, planejando o futuro 📊
