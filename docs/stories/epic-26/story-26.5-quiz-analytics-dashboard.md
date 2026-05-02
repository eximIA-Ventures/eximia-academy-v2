# Story 26.5: Quiz Analytics Dashboard

**Epic:** [Epic 26 — WS3: Quiz & Assessment Engine](../../epics/epic-26-ws3-quiz-assessment-engine.md)
**Version:** 1.0
**Created:** 2026-02-26
**Updated:** 2026-02-26
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 5
**Priority:** P1
**Blocked By:** Story 26.4
**Blocks:** None
**Assigned To:** @dev

---

## User Story

**As an** instructor,
**I want** analytics showing pass rates, hardest questions, and score distributions,
**so that** I can identify content that needs improvement.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws3-platform-evolution-architecture.md`, Secao 4.2 |
| **Epic Ref** | `docs/epics/epic-26-ws3-quiz-assessment-engine.md` — Story 26.5 |
| **Stack** | Next.js 15, @eximia/ui, recharts (graficos) |
| **Package** | `apps/web` |
| **Existing Pattern** | `apps/web/src/app/api/analytics/` |
| **Risk** | BAIXO — leitura de dados, sem side effects |

---

## Acceptance Criteria

- [ ] **AC1:** Page `/courses/[courseId]/quiz/[quizId]/analytics` acessivel por instructor/manager/admin
- [ ] **AC2:** Card: taxa de aprovacao (%) com trend vs periodo anterior
- [ ] **AC3:** Card: nota media com distribuicao (histograma de scores)
- [ ] **AC4:** Card: tempo medio de conclusao
- [ ] **AC5:** Tabela: top 5 questoes mais erradas com % de erro
- [ ] **AC6:** Tabela: alunos — nome, nota, tempo, tentativas, status
- [ ] **AC7:** Server action `getQuizAnalytics(quizId)` funcional
- [ ] **AC8:** Filtro por periodo: 7d, 30d, all

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 1) Criar pagina analytics
  - [x] Criar `apps/web/src/app/(platform)/courses/[courseId]/quiz/[quizId]/analytics/page.tsx`
  - [x] Role check: instructor/manager/admin only
  - [x] Layout: grid de cards + tabelas

- [x] **Task 2** (AC: 2) Card taxa de aprovacao
  - [x] Calcular: `COUNT(status='passed') / COUNT(status IN ('passed','failed')) * 100`
  - [x] Trend: comparar com periodo anterior (ex: 7d actual vs 7d anterior)
  - [x] Mostrar com seta up/down e cor (verde/vermelho)

- [x] **Task 3** (AC: 3) Card nota media + histograma
  - [x] Calcular: AVG(score) dos attempts completed
  - [x] Histograma: distribuicao de scores em buckets (0-20, 20-40, 40-60, 60-80, 80-100)
  - [x] Usar recharts BarChart

- [x] **Task 4** (AC: 4) Card tempo medio
  - [x] Calcular: AVG(completed_at - started_at) em minutos
  - [x] Mostrar em formato legivel (ex: "12 min")

- [x] **Task 5** (AC: 5) Tabela questoes mais erradas
  - [x] Analisar feedback JSONB de todos os attempts
  - [x] Contar incorrect por question_id
  - [x] Top 5 com: texto da questao (truncado), % erro, total respostas
  - [x] Usar Table do @eximia/ui

- [x] **Task 6** (AC: 6) Tabela alunos
  - [x] Listar todos os attempts com: nome aluno, nota, tempo, # tentativas, status (badge)
  - [x] Ordenavel por nota (default: desc)
  - [x] Usar Table do @eximia/ui

- [x] **Task 7** (AC: 7, 8) Server action + filtros
  - [x] Criar `getQuizAnalytics(quizId, period)` em actions
  - [x] period: '7d' | '30d' | 'all'
  - [x] Filtrar attempts por created_at
  - [x] Retornar objecto com todos os dados para os cards e tabelas

---

## Dev Notes

### Technical Notes

- Analytics existente em `apps/web/src/app/api/analytics/` pode servir de referencia para pattern
- Queries devem usar aggregacoes SQL (COUNT, AVG, GROUP BY) — nao calcular no JS
- Feedback JSONB parsing: `jsonb_array_elements(feedback) ->> 'correct'` para contar erros por questao
- recharts ja deve estar disponivel no projecto — verificar package.json
- Performance: para quizzes com muitos attempts, considerar materialized views no futuro

### File Locations

| Ficheiro | Acao |
|----------|------|
| `apps/web/src/app/(platform)/courses/[courseId]/quiz/[quizId]/analytics/page.tsx` | CRIAR |
| `apps/web/src/app/(platform)/courses/[courseId]/quiz/[quizId]/analytics/actions.ts` | CRIAR |

### Testing

- Dashboard mostra dados reais de attempts existentes
- Filtro 7d/30d/all funciona
- Questoes mais erradas calculadas correctamente
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
- `getQuizAnalytics(quizId, period)` server action with role check (instructor/manager/admin)
- Period filter: 7d, 30d, all — with trend comparison vs previous period
- Pass rate card with up/down trend arrow and color coding
- Average score card with value
- Average time card (completed_at - started_at in minutes)
- Total attempts card
- Score distribution histogram using recharts BarChart (5 buckets: 0-20, 20-40, 40-60, 60-80, 80-100)
- Hardest questions table: top 5 by error rate from feedback JSONB, with progress bar
- Student table: aggregated per student with best score, time, attempt count, status badge
- Empty state when no attempts found
- All queries done server-side, no client-side data processing

### File List
- `apps/web/src/app/(platform)/courses/[courseId]/quiz/[quizId]/analytics/actions.ts` — NEW: getQuizAnalytics server action
- `apps/web/src/app/(platform)/courses/[courseId]/quiz/[quizId]/analytics/page.tsx` — NEW: analytics dashboard page

---

## QA Results

**Reviewer:** Quinn (QA) | **Date:** 2026-02-28 | **Gate:** PASS

### Findings

| ID | Severity | Issue |
|----|----------|-------|
| FIX-26.5-001 | LOW | Analytics nao verifica quiz pertence aos cursos do instrutor (RLS mitiga — retorna 0 resultados para quiz de outro tenant) |

### Positives
- Role check (instructor/manager/admin) correto
- Period filter (7d/30d/all) com trend vs periodo anterior
- Score distribution histogram com 5 buckets usando recharts BarChart
- Hardest questions: top 5 por error rate do feedback JSONB
- Student table agregada por aluno (best score, attempts, time)
- Sanity check em tempos (>0 e <300 min)
- Empty state tratado corretamente
- Todas as queries server-side

### Verdict
PASS — dashboard analytics bem implementado. Note: depende do fix de scoring (FIX-26.1-001) para dados reais.
