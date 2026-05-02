# Story 29.4: Team Profile View (Manager)

**Epic:** [Epic 29 — WS3: Adaptive Learning & Assessments](../../epics/epic-29-ws3-adaptive-learning-assessments.md)
**Version:** 1.0
**Created:** 2026-02-26
**Updated:** 2026-02-26
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 3
**Priority:** P1
**Blocked By:** Story 29.1, Story 29.2
**Blocks:** None
**Assigned To:** @dev

---

## User Story

**As a** manager,
**I want** to see my team's aggregate personality and learning profile,
**so that** I can understand team dynamics and identify development gaps.

---

## Acceptance Criteria

- [ ] **AC1:** Page `/team/profiles` acessivel por manager/admin
- [ ] **AC2:** Card: distribuicao DISC da equipe (pie chart: % D, I, S, C)
- [ ] **AC3:** Card: medias Big Five da equipe (radar chart com media + range)
- [ ] **AC4:** Card: gaps identificados com sugestoes accionáveis
- [ ] **AC5:** Tabela: membros — tipo DISC, learning style, ultimo assessment
- [ ] **AC6:** Filtros: por area, por cargo
- [ ] **AC7:** Privacidade: medias e distribuicoes, sem scores individuais detalhados

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Criar pagina
  - [ ] Criar `apps/web/src/app/(platform)/team/profiles/page.tsx`
  - [ ] Role check: manager/admin

- [ ] **Task 2** (AC: 2) Distribuicao DISC
  - [ ] Contar membros por tipo dominante DISC
  - [ ] Pie chart com 4 segmentos (D, I, S, C)
  - [ ] Usar recharts PieChart

- [ ] **Task 3** (AC: 3) Medias Big Five
  - [ ] Calcular media de cada dimensao (O, C, E, A, N) da equipe
  - [ ] Radar chart com media + min/max range
  - [ ] Usar recharts RadarChart

- [ ] **Task 4** (AC: 4) Gaps e sugestoes
  - [ ] Regras: se media Openness < 40 → "Equipe com baixo Openness — considerar trilhas de inovacao"
  - [ ] Se 80% da equipe e S ou C → "Equipe conservadora — diversificar abordagens"
  - [ ] 3-5 insights accionáveis

- [ ] **Task 5** (AC: 5, 7) Tabela de membros
  - [ ] Listar membros da equipe (da area do manager)
  - [ ] Colunas: nome, tipo DISC (badge), learning style, data ultimo assessment
  - [ ] NAO mostrar scores individuais detalhados (privacidade)
  - [ ] Usar Table do @eximia/ui

- [ ] **Task 6** (AC: 6) Filtros
  - [ ] Por area, por cargo (se Epic 27 implementado)

---

## Dev Notes

### Technical Notes

- "Equipe do manager": users nas areas atribuidas ao manager (via user_areas ou assigned_area_ids)
- Privacidade: mostrar apenas tipo dominante DISC (1 letra) e learning style — NAO mostrar scores numericos individuais
- Se poucos membros completaram assessments: mostrar "X de Y membros completaram o perfil"
- Insights sao regras estaticas (if/else por medias)

### File Locations

| Ficheiro | Acao |
|----------|------|
| `apps/web/src/app/(platform)/team/profiles/page.tsx` | CRIAR |

### Testing

- Dashboard mostra dados agregados
- Privacidade respeitada
- Filtros funcionam
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
