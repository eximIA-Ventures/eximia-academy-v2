# Story 27.6: Trail Recommendation Engine

**Epic:** [Epic 27 — WS3: Learning Trails & Job Roles](../../epics/epic-27-ws3-learning-trails-job-roles.md)
**Version:** 1.0
**Created:** 2026-02-26
**Updated:** 2026-02-26
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 3
**Priority:** P2
**Blocked By:** Story 27.4
**Blocks:** None (Epic 29.6 extends this)
**Assigned To:** @dev

---

## User Story

**As a** student,
**I want** trail suggestions based on my job role and area,
**so that** I discover relevant learning paths beyond my assigned trail.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws3-platform-evolution-architecture.md`, Secao 4.1 |
| **Epic Ref** | `docs/epics/epic-27-ws3-learning-trails-job-roles.md` — Story 27.6 |
| **Stack** | Next.js 15, @eximia/ui |
| **Package** | `apps/web` |
| **Risk** | BAIXO — logica simples de matching |

---

## Acceptance Criteria

- [ ] **AC1:** Funcao `suggestTrails(userId)` retorna trilhas relevantes ordenadas
- [ ] **AC2:** Se aluno tem cargo: sugerir trilhas do cargo + cargos adjacentes (ex: junior → mid)
- [ ] **AC3:** Se aluno nao tem cargo: sugerir trilhas populares do tenant
- [ ] **AC4:** Se aluno ja completou trilha do cargo: sugerir trilhas de proximo nivel
- [ ] **AC5:** Componente `TrailSuggestions` no dashboard do aluno
- [ ] **AC6:** Sugestoes sao actionáveis (botao "Inscrever-me")

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1, 2, 3, 4) Funcao suggestTrails
  - [ ] Criar `apps/web/src/lib/trails/recommendations.ts`
  - [ ] Input: userId
  - [ ] Buscar cargo do user e area
  - [ ] Regra 1: trilhas do cargo do user (excluir ja enrolled)
  - [ ] Regra 2: trilhas de cargos adjacentes na mesma area (ex: senior se user e mid)
  - [ ] Regra 3: trilhas populares do tenant (mais enrollments)
  - [ ] Se sem cargo: apenas regra 3
  - [ ] Ordenar por relevancia (cargo match > adjacente > popular)
  - [ ] Limit: top 5 sugestoes

- [ ] **Task 2** (AC: 5) Componente TrailSuggestions
  - [ ] Criar `apps/web/src/components/trails/trail-suggestions.tsx`
  - [ ] Lista de cards com: titulo da trail, cargo alvo, # cursos, badge "Recomendado"
  - [ ] Usar Card do @eximia/ui

- [ ] **Task 3** (AC: 6) Botao inscrever-me
  - [ ] Botao "Inscrever-me" em cada sugestao
  - [ ] Server action `selfEnrollInTrail(userId, trailId)`: criar enrollments para cada curso da trail
  - [ ] Feedback: toast "Inscrito com sucesso na trilha X"

- [ ] **Task 4** Integrar no dashboard
  - [ ] Adicionar `TrailSuggestions` no dashboard do aluno
  - [ ] Ou na page `/trails` (student view)

---

## Dev Notes

### Technical Notes

- Adjacencia de cargos: baseada em seniority_level. Ex: junior < mid < senior < lead < manager
- Trilhas populares: `SELECT trail_id, COUNT(*) FROM enrollments GROUP BY trail_id ORDER BY count DESC`
- Self-enrollment: cria enrollments sem trail activation (diferente de auto-enroll por cargo)
- Este componente sera estendido no Epic 29.6 com recomendacao por perfil (Big Five/DISC)

### File Locations

| Ficheiro | Acao |
|----------|------|
| `apps/web/src/lib/trails/recommendations.ts` | CRIAR |
| `apps/web/src/components/trails/trail-suggestions.tsx` | CRIAR |

### Testing

- User com cargo mid → ve trilhas do mid e senior
- User sem cargo → ve trilhas populares
- Botao inscrever-me cria enrollments
- `pnpm typecheck` passa

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-26 | 1.0 | Story criada a partir do Epic 27 | River (SM) |

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
