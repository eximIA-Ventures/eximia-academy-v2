# Story 26.6: Quiz Retry & Remediation

**Epic:** [Epic 26 — WS3: Quiz & Assessment Engine](../../epics/epic-26-ws3-quiz-assessment-engine.md)
**Version:** 1.0
**Created:** 2026-02-26
**Updated:** 2026-02-26
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 3
**Priority:** P1
**Blocked By:** Story 26.4
**Blocks:** None
**Assigned To:** @dev

---

## User Story

**As a** student who failed a quiz,
**I want** to see which chapters I should review and try again,
**so that** I can improve my knowledge before retaking the assessment.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws3-platform-evolution-architecture.md`, Secao 4.2 |
| **Epic Ref** | `docs/epics/epic-26-ws3-quiz-assessment-engine.md` — Story 26.6 |
| **Stack** | Next.js 15, @eximia/ui |
| **Package** | `apps/web` |
| **Risk** | BAIXO — UI + logica simples de mapeamento |

---

## Acceptance Criteria

- [ ] **AC1:** Apos quiz `failed`: componente `RemediationSuggestion` aparece na tela de resultado
- [ ] **AC2:** Mostra lista de capitulos onde aluno errou, ordenados por % de erro
- [ ] **AC3:** Links directos para cada capitulo sugerido para revisao
- [ ] **AC4:** Botao "Tentar Novamente" so habilitado se attempts < max_attempts
- [ ] **AC5:** Se max_attempts atingido: mensagem "Contacte seu instrutor"
- [ ] **AC6:** Track de tentativas correcto no quiz_attempts

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 1, 2, 3) Componente RemediationSuggestion
  - [x] Criar `apps/web/src/components/quiz/remediation-suggestion.tsx`
  - [x] Input: feedback array + quiz session info
  - [x] Mapear questoes erradas → chapter_id (via question.chapter_id)
  - [x] Agrupar por capitulo: "Capitulo X — Y questoes erradas"
  - [x] Ordenar por mais erros primeiro
  - [x] Link para `/courses/[courseId]/chapters/[chapterId]` em cada capitulo
  - [x] Icone de estudo + texto motivacional: "Revise estes capitulos antes de tentar novamente"

- [x] **Task 2** (AC: 4, 5) Controlo de retry
  - [x] Buscar contagem de attempts do aluno para este quiz
  - [x] Se attempts < max_attempts: botao "Tentar Novamente" habilitado
  - [x] Se attempts >= max_attempts: mostrar "Limite de tentativas atingido. Contacte seu instrutor"
  - [x] Botao "Tentar Novamente" → redirect para tela de inicio do quiz

- [x] **Task 3** (AC: 6) Integrar na tela de resultado
  - [x] No componente QuizResult (Story 26.3): se status = 'failed', renderizar RemediationSuggestion
  - [x] Passar feedback e session info como props

---

## Dev Notes

### Technical Notes

- Mapeamento questao → capitulo: `questions.chapter_id` (campo existente)
- Se question nao tem chapter_id (questao generica do curso): nao incluir na sugestao de capitulos
- Logica simples: agrupar erros por capitulo, mostrar os com mais erros primeiro
- Nao envolve IA — e mapeamento determinístico

### File Locations

| Ficheiro | Acao |
|----------|------|
| `apps/web/src/components/quiz/remediation-suggestion.tsx` | CRIAR |
| `apps/web/src/components/quiz/quiz-result.tsx` | MODIFICAR (integrar remediation) |

### Testing

- Aluno falha quiz → ve sugestoes de capitulos
- Links apontam para capitulos correctos
- Botao retry habilitado/desabilitado conforme max_attempts
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
- `RemediationSuggestion` component: groups incorrect answers by chapter, sorted by error count
- Links to `/courses/[courseId]/chapters/[chapterId]` for each chapter
- BookOpen icon + motivational text: "Revise estes capitulos antes de tentar novamente"
- `getRemediationChapters()` server action: maps incorrect questionIds → chapter_id → chapter title
- QuizResult updated: shows remediation when status=failed and not pending_review
- Retry button: enabled when attemptsUsed < maxAttempts (already in QuizResult from Story 26.3)
- Max attempts reached: shows "Limite de tentativas atingido" + "Contacte seu instrutor"
- Page.tsx handleComplete: fetches remediation chapters for failed attempts
- Chapter suggestions passed via chapterSuggestions prop to QuizResult

### File List
- `apps/web/src/components/quiz/remediation-suggestion.tsx` — NEW: remediation chapter suggestions
- `apps/web/src/components/quiz/quiz-result.tsx` — MODIFIED: integrated RemediationSuggestion, added courseId/chapterSuggestions props
- `apps/web/src/app/(platform)/courses/[courseId]/quiz/[quizId]/actions.ts` — MODIFIED: added getRemediationChapters
- `apps/web/src/app/(platform)/courses/[courseId]/quiz/[quizId]/page.tsx` — MODIFIED: added chapterSuggestions state, load on failure

---

## QA Results

**Reviewer:** Quinn (QA) | **Date:** 2026-02-28 | **Gate:** PASS

### Findings
Nenhum issue encontrado.

### Positives
- RemediationSuggestion: agrupa erros por capitulo, sorted by error count
- Links diretos para `/courses/[courseId]/chapters/[chapterId]`
- BookOpen icon + texto motivacional
- `getRemediationChapters()` server action: mapeamento question → chapter_id → title
- Retry button controlado por attemptsUsed < maxAttempts
- "Limite de tentativas atingido" + "Contacte seu instrutor" quando max_attempts
- Integrado no QuizResult: mostra apenas quando status=failed e nao pending_review

### Verdict
PASS — implementacao limpa e completa.
