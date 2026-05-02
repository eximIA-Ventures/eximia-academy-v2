# Story 14.4: Course Questions Overview UI (Batch Review)

**Epic:** [Epic 14 — AI Question Generation Pipeline](../../epics/epic-14-ai-question-generation-pipeline.md)
**Version:** 1.0
**Created:** 2026-02-10
**Updated:** 2026-02-10
**Author:** Morgan (PM)
**Status:** Done
**Story Points:** 8
**Priority:** P0 (main user interface)
**Blocked By:** Story 14.2
**Blocks:** Story 14.5, Story 14.6
**Assigned To:** @dev

---

## User Story

**As a** manager,
**I want** a single page to review all questions for the entire course grouped by chapter,
**so that** I can efficiently approve or reject questions in batch instead of chapter by chapter.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.4, Section 6.2 |
| **PRD Ref** | `docs/prd.md` — FR5 (Question Review) |
| **Stack** | Next.js 15 (RSC + Client), @eximia/ui, Tailwind v4 |
| **DB Tables** | `courses` (read), `chapters` (read), `questions` (read), `question_generation_jobs` (read) |
| **QA Notes** | Reutilizar QuestionReviewCard existente quando possivel |

---

## Acceptance Criteria

- [ ] **AC1:** Nova pagina `/courses/[courseId]/questions`
  - Server page que busca todos dados necessarios
  - Agrupa perguntas por capitulo
  - Passa dados para client component
  - Breadcrumb: Cursos > [Nome do Curso] > Perguntas
- [ ] **AC2:** Dashboard de stats no topo
  - 4 cards lado a lado: Total Geradas, Pendentes, Aprovadas, Rejeitadas
  - Cada card com numero grande e label
  - Cores: total (neutro), pendentes (warning/amarelo), aprovadas (success/verde), rejeitadas (error/vermelho)
  - Usa Badge ou Card de @eximia/ui
- [ ] **AC3:** Lista agrupada por capitulo
  - Cada capitulo como Accordion colapsavel
  - Header do accordion: titulo do capitulo + badge com contagem (ex: "3 perguntas") + status summary
  - Botao "Gerar" individual por capitulo (para chapters sem perguntas)
  - Capitulos sem perguntas: texto "Nenhuma pergunta gerada" + botao Gerar
  - Capitulos ordenados pela order do chapter
- [ ] **AC4:** Selecao multipla com checkboxes
  - Checkbox em cada pergunta pendente
  - "Selecionar todas" dentro de cada capitulo
  - "Selecionar todas pendentes" global (no header)
  - Selecionadas mantidas durante scroll
- [ ] **AC5:** Sticky action bar no bottom
  - Aparece quando >= 1 pergunta selecionada
  - Mostra: "N selecionadas"
  - Botoes: "Aprovar selecionadas" (verde), "Rejeitar selecionadas" (vermelho)
  - Desaparece quando seleção vazia
  - z-index acima do conteudo
- [ ] **AC6:** Botao "Aprovar todas pendentes" no header
  - Aprova todas perguntas pendentes de uma vez
  - Modal de confirmacao: "Aprovar N perguntas pendentes?"
  - Disabled se nao houver pendentes
- [ ] **AC7:** Botao "Gerar para todos" no header
  - Trigger batch generation
  - Disabled se job em andamento
  - Disabled se todos capitulos ja tem perguntas
- [ ] **AC8:** Cada pergunta mostra: texto, skill badge, status badge, botoes aprovar/editar/rejeitar
  - Reutilizar logica do QuestionReviewCard existente
  - Adicionar checkbox para selecao
- [ ] **AC9:** Link de acesso na pagina do curso
  - Botao ou link no header/sidebar: "Perguntas Socraticas"
  - Badge com contagem de pendentes (se > 0)
- [ ] **AC10:** Todos componentes @eximia/ui, responsivo

---

## CodeRabbit Integration

> CodeRabbit will review this story's PR for: Component patterns, accessibility (aria-labels, keyboard nav), @eximia/ui compliance.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Criar server page
  - [ ] Criar `apps/web/src/app/(platform)/courses/[courseId]/questions/page.tsx`
  - [ ] Fetch course, chapters (ordenados), questions, active job
  - [ ] Agrupar questions por chapter_id
  - [ ] Passar para client component

- [ ] **Task 2** (AC: 2) Criar stats dashboard
  - [ ] Criar `_components/questions-stats-bar.tsx`
  - [ ] 4 cards com contadores
  - [ ] Calcular stats a partir dos dados

- [ ] **Task 3** (AC: 3, 8) Criar lista agrupada
  - [ ] Criar `_components/chapter-questions-group.tsx`
  - [ ] Accordion por capitulo
  - [ ] Integrar QuestionReviewCard existente (adaptar para checkbox)
  - [ ] Botao Gerar por capitulo

- [ ] **Task 4** (AC: 4) Implementar selecao multipla
  - [ ] State management para selected IDs (Set)
  - [ ] Checkbox por pergunta
  - [ ] Select all por capitulo
  - [ ] Select all pendentes global

- [ ] **Task 5** (AC: 5) Criar sticky action bar
  - [ ] Criar `_components/batch-action-bar.tsx`
  - [ ] Fixed bottom, conditional render
  - [ ] Botoes aprovar/rejeitar com contagem

- [ ] **Task 6** (AC: 6, 7) Botoes do header
  - [ ] Criar `_components/course-questions-overview.tsx` (main container)
  - [ ] Botao "Aprovar todas" com Modal de confirmacao
  - [ ] Botao "Gerar para todos"

- [ ] **Task 7** (AC: 9) Link na pagina do curso
  - [ ] Adicionar link/botao na pagina de detalhes do curso
  - [ ] Badge com contagem de pendentes

- [ ] **Task 8** (AC: 10) Polish
  - [ ] Verificar @eximia/ui compliance
  - [ ] Testar responsividade
  - [ ] Acessibilidade (aria-labels)

---

## Dev Notes

### Server Page

```typescript
// apps/web/src/app/(platform)/courses/[courseId]/questions/page.tsx
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { CourseQuestionsOverview } from "./_components/course-questions-overview"

interface PageProps {
  params: Promise<{ courseId: string }>
}

export default async function CourseQuestionsPage({ params }: PageProps) {
  const { courseId } = await params
  const supabase = await createClient()

  // Auth guard
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users").select("role").eq("id", user.id).single()
  if (!profile || !["manager", "admin"].includes(profile.role)) redirect("/courses")

  // Fetch data
  const { data: course } = await supabase
    .from("courses").select("id, title").eq("id", courseId).single()
  if (!course) redirect("/courses")

  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, title, order, status")
    .eq("course_id", courseId)
    .order("order")

  const chapterIds = chapters?.map(c => c.id) ?? []

  const { data: questions } = chapterIds.length > 0
    ? await supabase
        .from("questions")
        .select("id, chapter_id, text, skill, intention, expected_depth, status, job_id, created_at")
        .in("chapter_id", chapterIds)
        .order("created_at")
    : { data: [] }

  const { data: activeJob } = await supabase
    .from("question_generation_jobs")
    .select("id, status, progress, questions_generated")
    .eq("course_id", courseId)
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <CourseQuestionsOverview
      course={course}
      chapters={chapters ?? []}
      questions={questions ?? []}
      activeJob={activeJob}
    />
  )
}
```

### Selection State

```typescript
// In course-questions-overview.tsx
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

const toggleSelect = (id: string) => {
  setSelectedIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
}

const selectAllPending = () => {
  const pendingIds = questions.filter(q => q.status === "pending").map(q => q.id)
  setSelectedIds(new Set(pendingIds))
}

const clearSelection = () => setSelectedIds(new Set())
```

### UI Layout Reference

```
┌────────────────────────────────────────────────────────┐
│  Breadcrumb: Cursos > Curso X > Perguntas              │
│                                                        │
│  ┌─── Stats ────────────────────────────────────────┐  │
│  │ 12 Total  │ 8 Pendentes │ 4 Aprovadas │ 0 Rej.  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  [Gerar para todos]  [Aprovar todas pendentes (8)]     │
│                                                        │
│  ▼ Cap 1: Introducao (3 perguntas — 2 pendentes)       │
│    ☐ [analise]  Pergunta 1...     [Pendente] [✓][✎][✗] │
│    ☐ [sintese]  Pergunta 2...     [Pendente] [✓][✎][✗] │
│    ─ [aplicacao] Pergunta 3...    [Aprovada]            │
│                                                        │
│  ▼ Cap 2: Fundamentos (3 perguntas — 3 pendentes)      │
│    ☐ [reflexao] Pergunta 4...     [Pendente] [✓][✎][✗] │
│    ...                                                  │
│                                                        │
│  ▶ Cap 3: Aplicacoes (sem perguntas)         [Gerar]   │
│                                                        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  3 selecionadas  [Aprovar selecionadas] [Rejeitar]     │  ← sticky
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
└────────────────────────────────────────────────────────┘
```

### File Locations

```
apps/web/src/app/(platform)/courses/[courseId]/questions/
├── page.tsx                              # NEW: server page
└── _components/
    ├── course-questions-overview.tsx      # NEW: main container
    ├── chapter-questions-group.tsx        # NEW: accordion group
    ├── batch-action-bar.tsx              # NEW: sticky bottom
    ├── questions-stats-bar.tsx           # NEW: stats cards
    └── question-filter-bar.tsx           # NEW: filters (future)
```

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|-----------|---------|
| Pre-Commit | Lint, typecheck, sem hardcoded colors | Yes |
| Pre-PR | Tela funcional com dados reais, selecao multipla, responsivo | Yes |

---

## Definition of Done

- [ ] Pagina /courses/[courseId]/questions funcional
- [ ] Stats dashboard correto
- [ ] Lista agrupada por capitulo com accordion
- [ ] Selecao multipla funcional
- [ ] Sticky action bar aparece/desaparece corretamente
- [ ] Botoes header (aprovar todas, gerar para todos)
- [ ] Link de acesso na pagina do curso
- [ ] Responsivo (mobile >= 375px)
- [ ] `pnpm lint && pnpm typecheck` pass

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dev)** | Implementar todos componentes |
| **@ux-design-expert (Uma)** | Revisar UX da tela |
| **@qa (QA)** | Testar selecao multipla, batch actions, responsividade |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-10 | 1.0 | Story criada | Morgan (PM) |

---

*Story criada por Morgan (PM) — eximIA Academy*

— Morgan, planejando o futuro 📊
