# Story 29.2: DISC Assessment UI

**Epic:** [Epic 29 — WS3: Adaptive Learning & Assessments](../../epics/epic-29-ws3-adaptive-learning-assessments.md)
**Version:** 1.0
**Created:** 2026-02-26
**Updated:** 2026-02-26
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 5
**Priority:** P0
**Blocked By:** None
**Blocks:** Story 29.3, Story 29.4, Story 29.5
**Assigned To:** @dev

---

## User Story

**As a** student,
**I want** to complete a DISC behavioral assessment with ranking-based UX,
**so that** my communication style and work preferences are captured.

---

## Acceptance Criteria

- [ ] **AC1:** Page `/assessments/disc` com 28 items (7 grupos de 4)
- [ ] **AC2:** Layout: forced ranking — aluno ordena 4 afirmacoes por grupo (drag ou click)
- [ ] **AC3:** Scoring automatico: 4 dimensoes (D, I, S, C) em escala 0-100
- [ ] **AC4:** Tipo dominante e secundario determinados (ex: "DI — Influenciador Decisivo")
- [ ] **AC5:** Resultado salvo em `assessment_history` (type: 'disc')
- [ ] **AC6:** Tela de resultado: radar chart + descricao do tipo dominante com strengths/challenges
- [ ] **AC7:** Cooldown de 30 dias
- [ ] **AC8:** Server action `submitDiscAssessment(responses)` com validador Zod

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1, 2) UI do questionario
  - [ ] Criar `apps/web/src/app/(platform)/assessments/disc/page.tsx`
  - [ ] 7 grupos, cada um com 4 afirmacoes
  - [ ] UX: drag to rank (usando @dnd-kit/sortable) OU click-to-rank (1o, 2o, 3o, 4o)
  - [ ] Progress: "Grupo X de 7"
  - [ ] Cada grupo mostra 4 statements que aluno ordena do "mais me descreve" ao "menos"

- [ ] **Task 2** (AC: 3) Scoring
  - [ ] Criar `apps/web/src/lib/assessments/disc-scoring.ts`
  - [ ] Para cada grupo: posicao 1 = 4 pontos, posicao 4 = 1 ponto
  - [ ] Cada statement mapeada para uma dimensao (D, I, S, C)
  - [ ] Somar pontos por dimensao, normalizar para 0-100
  - [ ] Retornar: `{ dominance, influence, steadiness, conscientiousness }`

- [ ] **Task 3** (AC: 4) Determinar tipo dominante
  - [ ] Tipo dominante = dimensao com maior score
  - [ ] Tipo secundario = segunda dimensao
  - [ ] Label: ex: "DI" (Dominance + Influence)
  - [ ] Nomes descritivos: D=Dominante, I=Influenciador, S=Estavel, C=Consciencioso
  - [ ] Combinacoes: "DI — Influenciador Decisivo", "SC — Analista Estavel", etc.

- [ ] **Task 4** (AC: 5, 8) Server action + persistencia
  - [ ] Criar `apps/web/src/app/(platform)/assessments/disc/actions.ts`
  - [ ] `submitDiscAssessment(responses)`: valida, calcula, salva
  - [ ] INSERT em assessment_history: `{ type: 'disc', scores: { D, I, S, C, dominantType }, raw_responses }`
  - [ ] Validador: `discResponseSchema` (7 arrays de 4 rankings)

- [ ] **Task 5** (AC: 6) Tela de resultado
  - [ ] Radar chart com 4 eixos (D, I, S, C)
  - [ ] Descricao do tipo dominante com strengths e challenges
  - [ ] Nao-julgamental: todos os tipos sao validos
  - [ ] Usar recharts RadarChart

- [ ] **Task 6** (AC: 7) Cooldown
  - [ ] Mesma logica do Big Five: verificar ultimo assessment disc, bloquear se < 30 dias

---

## Dev Notes

### Technical Notes

- DISC simplificado (28 items, 7 grupos) e public domain — sem licensing
- Forced ranking e mais preciso que Likert para DISC
- Se drag-and-drop nao funcionar bem: fallback para numbered selection (selecionar 1o, 2o, 3o, 4o)
- Items DISC: predefinir como array de grupos com statements e dimensao mapeada
- Combinacoes de tipo: 12 possiveis (4 dominantes x 3 secundarios)

### File Locations

| Ficheiro | Acao |
|----------|------|
| `apps/web/src/app/(platform)/assessments/disc/page.tsx` | CRIAR |
| `apps/web/src/app/(platform)/assessments/disc/actions.ts` | CRIAR |
| `apps/web/src/lib/assessments/disc-scoring.ts` | CRIAR |
| `apps/web/src/lib/assessments/disc-items.ts` | CRIAR (28 items data) |

### Testing

- Completar 7 grupos → scores calculados correctamente
- Tipo dominante determinado
- Resultado salvo em assessment_history
- Cooldown funciona
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
