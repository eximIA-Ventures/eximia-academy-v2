# Story 29.1: Big Five Assessment UI

**Epic:** [Epic 29 — WS3: Adaptive Learning & Assessments](../../epics/epic-29-ws3-adaptive-learning-assessments.md)
**Version:** 1.0
**Created:** 2026-02-26
**Updated:** 2026-02-26
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 5
**Priority:** P0
**Blocked By:** None (assessment_history table already exists)
**Blocks:** Story 29.3, Story 29.5
**Assigned To:** @dev

---

## User Story

**As a** student,
**I want** to complete a Big Five personality assessment with a friendly UX,
**so that** my learning profile is enriched with explicit personality data.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws3-platform-evolution-architecture.md`, Secao 4.3 |
| **Epic Ref** | `docs/epics/epic-29-ws3-adaptive-learning-assessments.md` — Story 29.1 |
| **Stack** | Next.js 15, @eximia/ui, recharts (radar chart) |
| **Package** | `apps/web` |
| **Existing Pattern** | `assessment_history` table (5 types, migration `20260210000001`) |
| **Risk** | BAIXO — UI + scoring determinístico |

---

## Acceptance Criteria

- [ ] **AC1:** Page `/assessments/big-five` com 44 perguntas IPIP-NEO (versao open-source)
- [ ] **AC2:** Layout: 1 pergunta por vez com progress bar (nao formulario longo)
- [ ] **AC3:** Escala Likert 5 pontos: "Discordo totalmente" → "Concordo totalmente"
- [ ] **AC4:** Scoring automatico: 5 dimensoes (O, C, E, A, N) em escala 0-100
- [ ] **AC5:** Resultado salvo em `assessment_history` (type: 'big_five')
- [ ] **AC6:** Tela de resultado: radar chart + descricao por dimensao
- [ ] **AC7:** Cooldown de 30 dias entre submissoes
- [ ] **AC8:** Server action `submitBigFiveAssessment(responses)` com validador Zod

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1, 2, 3) UI do questionario
  - [ ] Criar `apps/web/src/app/(platform)/assessments/big-five/page.tsx`
  - [ ] Componente `AssessmentWizard` com estado: currentQuestion, responses[]
  - [ ] 1 pergunta por vez com 5 opcoes (Likert)
  - [ ] Progress bar: "Pergunta X de 44"
  - [ ] Botoes: "Anterior" / "Proximo"
  - [ ] Items IPIP-NEO simplificado (44 items — public domain)
  - [ ] Shuffle items para reduzir bias (mas manter mapeamento para dimensao)

- [ ] **Task 2** (AC: 4) Scoring
  - [ ] Criar `apps/web/src/lib/assessments/big-five-scoring.ts`
  - [ ] 44 items mapeados para 5 dimensoes (O, C, E, A, N)
  - [ ] Scoring: somar pontos por dimensao, normalizar para 0-100
  - [ ] Items invertidos: subtrair de 6 antes de somar
  - [ ] Retornar: `{ openness, conscientiousness, extraversion, agreeableness, neuroticism }`

- [ ] **Task 3** (AC: 5, 8) Server action + persistencia
  - [ ] Criar `apps/web/src/app/(platform)/assessments/big-five/actions.ts`
  - [ ] `submitBigFiveAssessment(responses: number[])`: valida, calcula scores, salva
  - [ ] INSERT em assessment_history: `{ type: 'big_five', scores: { O, C, E, A, N }, raw_responses: [...] }`
  - [ ] Validador Zod: `bigFiveResponseSchema` (array de 44 numeros 1-5)

- [ ] **Task 4** (AC: 6) Tela de resultado
  - [ ] Componente `BigFiveResult`: radar chart com 5 eixos
  - [ ] Usar recharts RadarChart
  - [ ] Descricao em linguagem simples para cada dimensao:
    - Openness: "Voce e curioso e aberto a novas experiencias"
    - Conscientiousness: "Voce e organizado e orientado a objetivos"
    - etc.
  - [ ] Descricoes variam com score (alto/medio/baixo)

- [ ] **Task 5** (AC: 7) Cooldown
  - [ ] Antes de mostrar questionario: verificar ultimo assessment big_five do user
  - [ ] Se < 30 dias: mostrar "Voce ja completou este assessment em [data]. Disponivel novamente em [data+30]"
  - [ ] Bloquear nova submissao

---

## Dev Notes

### Technical Notes

- IPIP-NEO 44-item version e public domain — sem licensing concerns
- `assessment_history` table ja existe com campos: user_id, tenant_id, type, scores JSONB, raw_responses JSONB, created_at
- Profiler agent em `packages/agents/src/profiler/` tem logica parcial de Big Five — pode reusar scoring
- Items IPIP-NEO: predefinir no codigo como array de `{ id, text, dimension, reversed }`
- Radar chart: recharts RadarChart com PolarGrid, PolarAngleAxis, Radar

### File Locations

| Ficheiro | Acao |
|----------|------|
| `apps/web/src/app/(platform)/assessments/big-five/page.tsx` | CRIAR |
| `apps/web/src/app/(platform)/assessments/big-five/actions.ts` | CRIAR |
| `apps/web/src/lib/assessments/big-five-scoring.ts` | CRIAR |
| `apps/web/src/lib/assessments/big-five-items.ts` | CRIAR (44 items data) |

### Testing

- Completar 44 perguntas → scores calculados correctamente
- Resultado salvo em assessment_history
- Radar chart renderiza com 5 dimensoes
- Cooldown bloqueia nova submissao antes de 30 dias
- `pnpm typecheck` passa

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-26 | 1.0 | Story criada a partir do Epic 29 | River (SM) |

---

## Dev Agent Record

### Agent Model Used
_(preenchido pelo dev agent)_

### Debug Log References
_(preenchido pelo dev agent)_

### Completion Notes List
_(preenchido pelo dev agent)_

### File List
_(preenchido pelo dev agent)_

---

## QA Results
_(preenchido pelo QA agent)_
