# Story 26.2: Quiz Creation UI

**Epic:** [Epic 26 — WS3: Quiz & Assessment Engine](../../epics/epic-26-ws3-quiz-assessment-engine.md)
**Version:** 1.0
**Created:** 2026-02-26
**Updated:** 2026-02-26
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 8
**Priority:** P0
**Blocked By:** Story 26.1
**Blocks:** Story 26.3, Story 26.5
**Assigned To:** @dev

---

## User Story

**As an** instructor,
**I want** to create quizzes by selecting questions from the existing pool and configuring rules,
**so that** I can assess students formally with different quiz types.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws3-platform-evolution-architecture.md`, Secao 4.2 |
| **Epic Ref** | `docs/epics/epic-26-ws3-quiz-assessment-engine.md` — Story 26.2 |
| **Stack** | Next.js 15, React, @eximia/ui, Zod |
| **Package** | `apps/web` |
| **Existing Pattern** | Question generation: `apps/web/src/app/api/chapters/[chapterId]/generate-questions/` |
| **Risk** | MEDIO — UI complexa com multi-step wizard |

---

## Acceptance Criteria

- [ ] **AC1:** Page `/courses/[courseId]/quiz/new` com wizard de 3 steps
- [ ] **AC2:** Step 1: titulo, tipo (practice/exam/diagnostic), capitulo alvo (opcional select)
- [ ] **AC3:** Step 2: selecao de questoes do pool — filtro por capitulo, tipo (multiple_choice/open_ended/true_false), difficulty. Checkbox multi-select
- [ ] **AC4:** Step 3: configuracao de regras — tempo limite, max tentativas, nota minima, shuffle, mostrar respostas apos
- [ ] **AC5:** Preview do quiz antes de salvar
- [ ] **AC6:** Server action `createQuizSession()` persiste quiz
- [ ] **AC7:** Validador Zod `createQuizSessionSchema`
- [ ] **AC8:** API route `GET /api/courses/[courseId]/quizzes` lista quizzes do curso
- [ ] **AC9:** Quizzes listados na pagina do curso com badge de tipo (practice=blue, exam=red, diagnostic=yellow)
- [ ] **AC10:** Apenas instructor/admin pode criar

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 1) Criar pagina wizard
  - [x] Criar `apps/web/src/app/(platform)/courses/[courseId]/quiz/new/page.tsx`
  - [x] Componente `QuizWizard` com state machine de 4 steps (info, questions, rules, preview)
  - [x] Progress indicator (step 1/2/3/4)
  - [x] Botoes "Anterior" / "Proximo" / "Criar Quiz"

- [x] **Task 2** (AC: 2) Step 1: Informacoes basicas
  - [x] Input: titulo (obrigatorio)
  - [x] Select: tipo (practice/exam/diagnostic) com descricao de cada
  - [x] Select: capitulo (opcional — lista capitulos do curso)
  - [x] Usa componentes @eximia/ui (Badge, Button, Card)

- [x] **Task 3** (AC: 3) Step 2: Selecao de questoes
  - [x] Buscar questoes do curso (e capitulo se selecionado)
  - [x] Filtros: por capitulo e por texto (search)
  - [x] Lista com checkbox para selecionar cada questao
  - [x] Contador: "X questoes selecionadas"
  - [x] Se pool vazio: CTA "Gere questoes primeiro"

- [x] **Task 4** (AC: 4) Step 3: Configuracao de regras
  - [x] Input numero: tempo limite em minutos (opcional)
  - [x] Input numero: max tentativas (default: 3)
  - [x] Input numero: nota minima para aprovacao (default: 70%)
  - [x] Toggle: shuffle questoes (default: false)
  - [x] Select: mostrar respostas (completion/never/always)

- [x] **Task 5** (AC: 5) Preview
  - [x] Step 4 mostra quiz como aluno vai ver
  - [x] Lista questoes na ordem selecionada
  - [x] Mostra regras aplicadas (tempo, tentativas, nota minima)
  - [x] Botao "Criar Quiz"

- [x] **Task 6** (AC: 6, 7, 10) Server action + validacao
  - [x] Criar server action `createQuizSession()` em quiz/actions.ts
  - [x] Verificar role: instructor/admin/manager only
  - [x] Validar com `createQuizSessionSchema`
  - [x] Inserir em `quiz_sessions` via Supabase
  - [x] Criar `packages/shared/src/validators/quiz.ts` com schemas Zod

- [x] **Task 7** (AC: 8, 9) Listagem de quizzes
  - [x] Criar API route `apps/web/src/app/api/courses/[courseId]/quizzes/route.ts` (GET)
  - [x] Componente `QuizList` com lista de quizzes
  - [x] Badge por tipo: practice=info, exam=error, diagnostic=warning
  - [x] Botao "Novo Quiz" para criacao

---

## Dev Notes

### Technical Notes

- Questions pool: `SELECT * FROM questions WHERE course_id = ? AND tenant_id = ?` (ou filtrar por chapter_id)
- Questions ja tem campos `type` (multiple_choice, open_ended, true_false), `difficulty`, `chapter_id`
- `question_ids` em quiz_sessions e um array UUID — armazena IDs das questoes selecionadas na ordem
- Wizard pattern: usar estado local com `useState` para cada step, submit final faz server action
- Se pool de questoes vazio para o curso: mostrar empty state com CTA para gerar questoes (feature existente)

### File Locations

| Ficheiro | Acao |
|----------|------|
| `apps/web/src/app/(platform)/courses/[courseId]/quiz/new/page.tsx` | CRIAR |
| `apps/web/src/app/(platform)/courses/[courseId]/quiz/actions.ts` | CRIAR |
| `apps/web/src/app/api/courses/[courseId]/quizzes/route.ts` | CRIAR |
| `packages/shared/src/validators/quiz.ts` | CRIAR |

### Testing

- Instructor cria quiz com 5 questoes → salvo correctamente
- Pool vazio mostra CTA
- Validacao rejeita quiz sem titulo ou sem questoes
- Badge de tipo correcto na listagem
- `pnpm typecheck` passa

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-26 | 1.0 | Story criada a partir do Epic 26 | River (SM) |

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- Full monorepo typecheck: 6/6 packages passed
- QuizWizard: 4-step wizard (info → questions → rules → preview)

### Completion Notes List
- QuizWizard: 4-step client component with progress indicator, validated state transitions
- Step 1: title input, quiz type cards (practice/exam/diagnostic), optional chapter select
- Step 2: question pool from server action, search + chapter filter, checkbox multi-select
- Step 3: time limit, max attempts, passing score, shuffle toggle, show answers select
- Step 4: preview with summary + question list, confirm + create button
- Server actions: createQuizSession, listCourseQuizzes, listCourseQuestions, listCourseChapters
- Zod validators: createQuizSessionSchema, updateQuizSessionSchema in packages/shared
- QuizList: standalone component with type badges (info/error/warning), question count, time, score

### File List
- `apps/web/src/app/(platform)/courses/[courseId]/quiz/new/page.tsx` — NEW: wizard page
- `apps/web/src/app/(platform)/courses/[courseId]/quiz/_components/quiz-wizard.tsx` — NEW: 4-step wizard
- `apps/web/src/app/(platform)/courses/[courseId]/quiz/_components/quiz-list.tsx` — NEW: quiz listing
- `apps/web/src/app/(platform)/courses/[courseId]/quiz/actions.ts` — NEW: server actions
- `apps/web/src/app/api/courses/[courseId]/quizzes/route.ts` — NEW: GET API
- `packages/shared/src/validators/quiz.ts` — NEW: Zod schemas
- `packages/shared/src/index.ts` — MODIFIED: added quiz export

---

## QA Results

**Reviewer:** Quinn (QA) | **Date:** 2026-02-28 | **Gate:** PASS

### Findings

| ID | Severity | Issue |
|----|----------|-------|
| FIX-26.2-001 | MEDIUM | `createQuizSession()` nao verifica courseId pertence ao tenant (FK permite cross-tenant reference) |
| FIX-26.2-002 | MEDIUM | `error.message` do Supabase exposto diretamente ao client — usar mensagens genericas |
| FIX-26.2-003 | LOW | Zod `question_ids` sem max bound (aceita arrays de tamanho ilimitado) |

### Positives
- QuizWizard 4-step bem estruturado com validacao por step
- Zod validators completos com min/max constraints
- Server actions com role check (manager/admin/instructor)
- QuizList com type badges e metadata display
- @eximia/ui usado consistentemente

### Verdict
PASS — implementacao solida. FIX-26.2-001 e FIX-26.2-002 recomendados mas nao bloqueiam.
