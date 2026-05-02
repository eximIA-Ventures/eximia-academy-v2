# Story 26.3: Quiz Taking UI (Student)

**Epic:** [Epic 26 — WS3: Quiz & Assessment Engine](../../epics/epic-26-ws3-quiz-assessment-engine.md)
**Version:** 1.0
**Created:** 2026-02-26
**Updated:** 2026-02-26
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 8
**Priority:** P0
**Blocked By:** Story 26.1, Story 26.2
**Blocks:** Story 26.4, Story 26.6
**Assigned To:** @dev

---

## User Story

**As a** student,
**I want** to take quizzes with a timer, navigate between questions, and submit my answers,
**so that** I can be formally assessed on the course material.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws3-platform-evolution-architecture.md`, Secao 4.2 |
| **Epic Ref** | `docs/epics/epic-26-ws3-quiz-assessment-engine.md` — Story 26.3 |
| **Stack** | Next.js 15, React (client components para timer), @eximia/ui |
| **Package** | `apps/web` |
| **Risk** | MEDIO — timer client/server sync, auto-submit on timeout |

---

## Acceptance Criteria

- [ ] **AC1:** Page `/courses/[courseId]/quiz/[quizId]` com tela de inicio mostrando titulo, regras, botao "Iniciar"
- [ ] **AC2:** Layout de quiz: questao actual, opcoes de resposta, navegacao (anterior/proximo), indicador de progresso
- [ ] **AC3:** Timer countdown visivel se `time_limit_minutes` definido
- [ ] **AC4:** Questoes shuffled se configurado
- [ ] **AC5:** Server action `startQuizAttempt()` cria record com status `in_progress`
- [ ] **AC6:** Server action `submitQuizAttempt()` recebe respostas e actualiza status
- [ ] **AC7:** Auto-submit quando timer expira (status `timed_out`)
- [ ] **AC8:** Tela de resultado: score, questoes certas/erradas, feedback (se show_answers_after=true)
- [ ] **AC9:** Bloqueio se max_attempts atingido
- [ ] **AC10:** Aluno pode navegar entre questoes antes de submeter (nao e linear-only)

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 1, 9) Tela de inicio
  - [x] Criar `apps/web/src/app/(platform)/courses/[courseId]/quiz/[quizId]/page.tsx`
  - [x] Mostrar: titulo, tipo, regras (tempo, tentativas, nota minima)
  - [x] Contar tentativas anteriores do aluno
  - [x] Se max_attempts atingido: mostrar mensagem "Limite de tentativas atingido" + link para resultados
  - [x] Botao "Iniciar Quiz" → chama startQuizAttempt

- [x] **Task 2** (AC: 2, 4, 10) Layout de quiz
  - [x] Componente `QuizPlayer` (client component para interactividade)
  - [x] Estado: currentQuestionIndex, answers (Map<questionId, answer>)
  - [x] Mostrar 1 questao por vez com opcoes de resposta
  - [x] Multiple choice: radio buttons
  - [x] True/false: 2 botoes
  - [x] Open-ended: textarea
  - [x] Navegacao: botoes "Anterior" / "Proximo" + grid de numeros para saltar
  - [x] Indicador de progresso: "Questao 3 de 10" + barra
  - [x] Shuffle questoes na inicializacao se configurado

- [x] **Task 3** (AC: 3, 7) Timer
  - [x] Componente `QuizTimer` (client component)
  - [x] Countdown baseado em `time_limit_minutes`
  - [x] Mostrar MM:SS no header
  - [x] Quando chega a 0: trigger auto-submit com status `timed_out`
  - [x] Timer e cosmético — server valida via `started_at + time_limit`
  - [x] Alerta visual quando faltam 5 minutos (cor muda para vermelho)

- [x] **Task 4** (AC: 5) Server action startQuizAttempt
  - [x] Criar em `apps/web/src/app/(platform)/courses/[courseId]/quiz/[quizId]/actions.ts`
  - [x] Verificar que aluno esta enrolled no curso
  - [x] Verificar max_attempts nao atingido
  - [x] INSERT em quiz_attempts com status `in_progress`, total_questions, started_at
  - [x] Retornar attempt_id + questoes (com opcoes, sem correct_answer)

- [x] **Task 5** (AC: 6, 7) Server action submitQuizAttempt
  - [x] Receber: attempt_id, answers array
  - [x] Verificar que attempt pertence ao aluno e esta `in_progress`
  - [x] Se tempo expirado (started_at + time_limit < now): status `timed_out`
  - [x] Salvar answers JSONB no quiz_attempts
  - [x] Actualizar status para `completed` (ou `timed_out`)
  - [x] Trigger scoring (Story 26.4) — por agora apenas salvar respostas

- [x] **Task 6** (AC: 8) Tela de resultado
  - [x] Componente `QuizResult`
  - [x] Mostrar: score (%), questoes certas / total
  - [x] Status: passed/failed com icone e cor
  - [x] Se show_answers_after=true: listar cada questao com resposta do aluno, resposta correcta, e explicacao
  - [x] Se show_answers_after=false: apenas score e status
  - [x] Botao "Tentar Novamente" se attempts < max_attempts

---

## Dev Notes

### Technical Notes

- Timer: server e source of truth (`started_at + time_limit_minutes`). Client timer e apenas UX. No submit, server verifica se tempo expirou
- Questoes devem ser servidas SEM `correct_answer` para o client — apenas titulo, opcoes, tipo
- `correct_answer` so e acessado no server durante scoring
- Shuffle: usar Fisher-Yates no client com seed baseado no attempt_id (para consistencia se reload)
- JSONB answers format: `[{ questionId: "uuid", answer: "option_a" | "true" | "texto livre" }]`
- Para open_ended na v1: salvar resposta como texto, scoring sera manual (Story 26.4)

### File Locations

| Ficheiro | Acao |
|----------|------|
| `apps/web/src/app/(platform)/courses/[courseId]/quiz/[quizId]/page.tsx` | CRIAR |
| `apps/web/src/app/(platform)/courses/[courseId]/quiz/[quizId]/actions.ts` | CRIAR |
| `apps/web/src/components/quiz/quiz-player.tsx` | CRIAR |
| `apps/web/src/components/quiz/quiz-timer.tsx` | CRIAR |
| `apps/web/src/components/quiz/quiz-result.tsx` | CRIAR |

### Testing

- Aluno inicia quiz → attempt criado
- Timer funciona e auto-submit no timeout
- Navegacao entre questoes preserva respostas
- Max attempts enforcement
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

### Completion Notes List
- Quiz page with 4 phases: loading → start → playing → result/max_reached
- Start screen: shows rules (questions, time, passing score, attempts remaining)
- QuizPlayer: textarea per question, navigation grid, prev/next buttons, submit button
- QuizTimer: countdown MM:SS, red alert at 5 min remaining, auto-submit on timeout
- QuizResult: score display, pass/fail status, retry button if attempts available
- Server actions: getQuizSession, getStudentAttempts, getQuizQuestions, startQuizAttempt, submitQuizAttempt
- Enrollment verification + max attempts check in startQuizAttempt
- Server-side time validation in submitQuizAttempt (started_at + time_limit)
- Fisher-Yates shuffle with seed from attemptId for consistency

### File List
- `apps/web/src/app/(platform)/courses/[courseId]/quiz/[quizId]/page.tsx` — NEW: quiz taking page
- `apps/web/src/app/(platform)/courses/[courseId]/quiz/[quizId]/actions.ts` — NEW: server actions
- `apps/web/src/components/quiz/quiz-player.tsx` — NEW: quiz player component
- `apps/web/src/components/quiz/quiz-timer.tsx` — NEW: countdown timer
- `apps/web/src/components/quiz/quiz-result.tsx` — NEW: result display

---

## QA Results

**Reviewer:** Quinn (QA) | **Date:** 2026-02-28 | **Gate:** CONCERNS

### Findings

| ID | Severity | Issue |
|----|----------|-------|
| FIX-26.3-001 | MEDIUM | 6/6 task checkboxes `[ ]` nao atualizados — inconsistente com Dev Agent Record que confirma implementacao completa |
| FIX-26.3-002 | LOW | `getQuizSession()` nao verifica que quizId pertence ao courseId na URL (RLS mitiga mas URL manipulation possivel) |

### Positives
- Arquitetura 4-fases (loading → start → playing → result) bem implementada
- QuizPlayer: MC radio buttons, TF buttons, open_ended textarea — rendering condicional correto
- QuizTimer: countdown server-based (started_at + time_limit), client cosmetic, alerta visual 5min
- Fisher-Yates shuffle com seed deterministic (attemptId) — consistente entre reloads
- Enrollment verification + max attempts check em startQuizAttempt
- Server-side time validation em submitQuizAttempt
- Non-linear navigation com grid de questoes
- useTransition para loading states

### Verdict
Implementacao funcional e bem construida. Task checkboxes precisam ser atualizados para `[x]`.
