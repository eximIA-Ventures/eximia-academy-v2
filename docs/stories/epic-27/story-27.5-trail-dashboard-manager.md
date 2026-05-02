# Story 27.5: Trail Dashboard (Manager)

**Epic:** [Epic 27 — WS3: Learning Trails & Job Roles](../../epics/epic-27-ws3-learning-trails-job-roles.md)
**Version:** 1.0
**Created:** 2026-02-26
**Updated:** 2026-02-26
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 5
**Priority:** P1
**Blocked By:** Story 27.4
**Blocks:** None
**Assigned To:** @dev

---

## User Story

**As a** manager,
**I want** a dashboard showing team progress by trail and job role,
**so that** I can identify who's falling behind and which roles lack training.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws3-platform-evolution-architecture.md`, Secao 4.1 |
| **Epic Ref** | `docs/epics/epic-27-ws3-learning-trails-job-roles.md` — Story 27.5 |
| **Stack** | Next.js 15, @eximia/ui, recharts |
| **Package** | `apps/web` |
| **Risk** | BAIXO — leitura de dados |

---

## Acceptance Criteria

- [ ] **AC1:** Page `/trails/dashboard` acessivel por manager/admin
- [ ] **AC2:** Card: visao por trilha — % conclusao media, # alunos, # completaram
- [ ] **AC3:** Card: visao por cargo — quais cargos tem trilhas, quais nao
- [ ] **AC4:** Tabela: alunos por trilha — nome, cargo, % progresso, ultimo acesso, status
- [ ] **AC5:** Filtros: por area, por trilha, por cargo
- [ ] **AC6:** Server action `getTrailDashboardData(tenantId, filters)`
- [ ] **AC7:** Dados filtrados por tenant (RLS)

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Criar pagina dashboard
  - [ ] Criar `apps/web/src/app/(platform)/trails/dashboard/page.tsx`
  - [ ] Role check: manager/admin only
  - [ ] Layout: cards + tabela + filtros

- [ ] **Task 2** (AC: 2) Visao por trilha
  - [ ] Para cada trail activa: calcular % conclusao media dos alunos
  - [ ] Mostrar: titulo da trail, total alunos, # completaram, % media
  - [ ] Usar Card do @eximia/ui

- [ ] **Task 3** (AC: 3) Visao por cargo
  - [ ] Listar job_roles do tenant
  - [ ] Para cada: indicar se tem trail vinculada ou nao
  - [ ] Highlight cargos SEM trilha (gap identificado)

- [ ] **Task 4** (AC: 4) Tabela de alunos
  - [ ] Listar alunos enrolled em trilhas
  - [ ] Colunas: nome, cargo, trilha, % progresso, ultimo acesso, status (badge)
  - [ ] Ordenavel por progresso
  - [ ] Highlight alunos com progresso < 25% (atrasados)
  - [ ] Usar Table do @eximia/ui

- [ ] **Task 5** (AC: 5) Filtros
  - [ ] Select: area (filtra alunos por area)
  - [ ] Select: trilha (filtra por trilha especifica)
  - [ ] Select: cargo (filtra por cargo)
  - [ ] Filtros combinaveis

- [ ] **Task 6** (AC: 6, 7) Server action
  - [ ] Criar `getTrailDashboardData(tenantId, filters)` em actions
  - [ ] Query optimizada com JOINs
  - [ ] Retornar dados para todos os cards e tabela
  - [ ] RLS garante tenant isolation

---

## Dev Notes

### Technical Notes

- Queries envolvem JOINs entre: learning_trails, trail_courses, enrollments, users, job_roles, areas
- Performance: usar aggregacoes SQL (COUNT, AVG, GROUP BY) — nao calcular no JS
- "Atrasado": definir como aluno com progresso < 25% e ultimo acesso > 7 dias atras
- Se nao ha dados (nenhuma trail activa): mostrar empty state "Crie sua primeira trilha"

### File Locations

| Ficheiro | Acao |
|----------|------|
| `apps/web/src/app/(platform)/trails/dashboard/page.tsx` | CRIAR |

### Testing

- Dashboard mostra dados reais
- Filtros funcionam correctamente
- Dados filtrados por tenant (RLS)
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
