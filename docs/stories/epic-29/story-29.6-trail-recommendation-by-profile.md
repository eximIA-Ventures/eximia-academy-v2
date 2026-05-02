# Story 29.6: Trail Recommendation by Profile

**Epic:** [Epic 29 — WS3: Adaptive Learning & Assessments](../../epics/epic-29-ws3-adaptive-learning-assessments.md)
**Version:** 1.0
**Created:** 2026-02-26
**Updated:** 2026-02-26
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 3
**Priority:** P2
**Blocked By:** Story 27.6 (base recommendation), Story 29.1, Story 29.2
**Blocks:** None
**Assigned To:** @dev

---

## User Story

**As a** student,
**I want** trail recommendations that consider my personality profile,
**so that** I'm directed to learning paths that match my strengths and interests.

---

## Acceptance Criteria

- [ ] **AC1:** `suggestTrails(userId)` (Story 27.6) estendido com scoring por perfil
- [ ] **AC2:** Regras de matching por dimensao (Openness → inovacao, Dominance → lideranca, etc.)
- [ ] **AC3:** Peso do perfil: 30% (70% continua sendo cargo/area)
- [ ] **AC4:** Funciona sem assessment (100% cargo/area)
- [ ] **AC5:** Tag visual "Recomendado para seu perfil" nas trilhas com match alto
- [ ] **AC6:** Server action `suggestTrailsByProfile(userId)`

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1, 2, 3) Estender suggestTrails com perfil
  - [ ] Modificar `apps/web/src/lib/trails/recommendations.ts` (Story 27.6)
  - [ ] Buscar assessment_history do user (big_five, disc)
  - [ ] Regras de matching:
    - Alto Openness → trails com tags: inovacao, lideranca criativa
    - Alto Conscientiousness → trails com tags: processos, compliance
    - Alto Dominance → trails: lideranca, gestao de resultados
    - Alto Influence → trails: comunicacao, vendas, apresentacoes
    - Alto Steadiness → trails: operacoes, suporte, qualidade
  - [ ] Scoring: 70% base (cargo/area) + 30% perfil match
  - [ ] Nota: trails precisam de tags/categorias para matching (pode usar keywords no titulo/descricao)

- [ ] **Task 2** (AC: 4) Fallback sem assessment
  - [ ] Se sem assessment: peso perfil = 0%, 100% cargo/area
  - [ ] Mesma logica de Story 27.6

- [ ] **Task 3** (AC: 5) Tag visual
  - [ ] Na listagem de sugestoes: Badge "Para seu perfil" em trilhas com profile_score > 70
  - [ ] Icone (ex: sparkle ou star) + cor diferenciada

- [ ] **Task 4** (AC: 6) Server action
  - [ ] `suggestTrailsByProfile(userId)` — wrapper que chama suggestTrails com profile data

---

## Dev Notes

### Technical Notes

- Matching por keywords no titulo/descricao e uma abordagem v1 simples. V2 pode usar tags estruturadas
- Profile score: para cada trail, calcular match com dimensoes do user. Ex: trail "Lideranca" + user alto D → match alto
- Keywords mapping pode ser hardcoded: `{ openness: ['inovacao', 'criativ', 'explorar'], dominance: ['lideranca', 'gestao', 'resultado'] }`
- Este e o ultimo story do WS3 — depende de todo o resto estar funcional

### File Locations

| Ficheiro | Acao |
|----------|------|
| `apps/web/src/lib/trails/recommendations.ts` | MODIFICAR (estender com perfil) |
| `apps/web/src/components/trails/trail-suggestions.tsx` | MODIFICAR (add badge) |

### Testing

- User com alto Openness → trails de inovacao com badge "Para seu perfil"
- User sem assessment → recomendacao apenas por cargo
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
