# Story 27.4: Trail Enrollment & Progress

**Epic:** [Epic 27 — WS3: Learning Trails & Job Roles](../../epics/epic-27-ws3-learning-trails-job-roles.md)
**Version:** 1.0
**Created:** 2026-02-26
**Updated:** 2026-02-26
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 5
**Priority:** P0
**Blocked By:** Story 27.1, Story 27.3
**Blocks:** Story 27.5
**Assigned To:** @dev

---

## User Story

**As a** student,
**I want** to be automatically enrolled in my job role's trail and see my progress,
**so that** I follow a structured learning path without manual enrollment.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws3-platform-evolution-architecture.md`, Secao 4.1 |
| **Epic Ref** | `docs/epics/epic-27-ws3-learning-trails-job-roles.md` — Story 27.4 |
| **Stack** | Next.js 15, Supabase, @eximia/ui |
| **Package** | `apps/web` |
| **Risk** | MEDIO — batch enrollment pode ser lento para muitos users |

---

## Acceptance Criteria

- [ ] **AC1:** Quando trail status muda para `active`: auto-enroll users com o job_role alvo
- [ ] **AC2:** Server action `activateTrail(trailId)` faz batch enroll
- [ ] **AC3:** Enrollments criados com `trail_id` e `trail_course_order`
- [ ] **AC4:** Componente `TrailProgress` no dashboard do aluno: barra de progresso com cursos completed/in_progress/pending
- [ ] **AC5:** Logica de "proximo curso": quando aluno completa curso N, destacar curso N+1
- [ ] **AC6:** Notificacao simples (badge ou banner): "Proximo curso disponivel"
- [ ] **AC7:** Student view: `/trails` mostra minhas trilhas com progresso
- [ ] **AC8:** Novo aluno adicionado ao cargo recebe enrollments na trilha activa

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1, 2, 3) Auto-enrollment na activacao
  - [ ] Server action `activateTrail(trailId)` em `apps/web/src/app/(platform)/trails/actions.ts`
  - [ ] Buscar target_job_role_id da trail
  - [ ] Buscar users com esse job_role (via user.job_role_id ou user_job_roles)
  - [ ] Para cada user: criar enrollment para cada curso da trail com trail_id e trail_course_order
  - [ ] Batch insert com transaction (limitar a 500 users por batch)
  - [ ] Actualizar trail status para 'active'

- [ ] **Task 2** (AC: 4) Componente TrailProgress
  - [ ] Criar `apps/web/src/components/trails/trail-progress.tsx`
  - [ ] Input: trail info + enrollments do user
  - [ ] Barra de progresso horizontal com segmentos por curso
  - [ ] Cores: completed (verde), in_progress (azul), pending (cinza)
  - [ ] Percentagem total

- [ ] **Task 3** (AC: 5) Logica de proximo curso
  - [ ] Determinar ultimo curso completed na trail
  - [ ] Destacar proximo curso na sequencia (borda, icone, etc.)
  - [ ] Link directo para iniciar proximo curso

- [ ] **Task 4** (AC: 6) Notificacao
  - [ ] Badge ou banner no dashboard: "Proximo curso disponivel na sua trilha: [nome do curso]"
  - [ ] Simples — sem sistema de notificacao complexo (apenas UI check)

- [ ] **Task 5** (AC: 7) Student view de trilhas
  - [ ] Na page `/trails`: se role = student, mostrar "Minhas Trilhas"
  - [ ] Lista de trilhas em que o aluno esta enrolled
  - [ ] Para cada: titulo, cargo, progresso (barra), status
  - [ ] Link para detalhe da trilha com cursos

- [ ] **Task 6** (AC: 8) Auto-enroll novo user
  - [ ] Quando user recebe job_role_id (update de profile): verificar se existem trails activas para esse cargo
  - [ ] Se sim: criar enrollments automaticamente
  - [ ] Pode ser trigger no UPDATE de users.job_role_id ou server action

---

## Dev Notes

### Technical Notes

- Batch enrollment: usar INSERT INTO enrollments (columns) SELECT ... FROM users WHERE job_role_id = ? para eficiencia
- Transaction: se batch falhar, rollback tudo
- Limitar batch a 500 users por vez — se mais, processar em chunks
- Trail progress: JOIN enrollments com trail_courses para obter ordem e status
- "Proximo curso": `SELECT trail_course_order FROM enrollments WHERE trail_id = ? AND user_id = ? AND status != 'completed' ORDER BY trail_course_order LIMIT 1`

### File Locations

| Ficheiro | Acao |
|----------|------|
| `apps/web/src/app/(platform)/trails/actions.ts` | MODIFICAR (add activateTrail) |
| `apps/web/src/components/trails/trail-progress.tsx` | CRIAR |
| `apps/web/src/app/(platform)/trails/page.tsx` | MODIFICAR (student view) |

### Testing

- Activar trail → enrollments criados para users do cargo
- Aluno ve progresso na trilha
- Proximo curso destacado apos completar anterior
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
