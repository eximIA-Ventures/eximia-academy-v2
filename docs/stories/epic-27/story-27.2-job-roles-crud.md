# Story 27.2: Job Roles CRUD

**Epic:** [Epic 27 — WS3: Learning Trails & Job Roles](../../epics/epic-27-ws3-learning-trails-job-roles.md)
**Version:** 1.0
**Created:** 2026-02-26
**Updated:** 2026-02-26
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 5
**Priority:** P0
**Blocked By:** Story 27.1
**Blocks:** Story 27.3, Story 27.4
**Assigned To:** @dev

---

## User Story

**As an** admin or instructor,
**I want** to create, edit, and delete job roles grouped by department,
**so that** I can organize employees by their roles for trail assignment.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws3-platform-evolution-architecture.md`, Secao 4.1 |
| **Epic Ref** | `docs/epics/epic-27-ws3-learning-trails-job-roles.md` — Story 27.2 |
| **Stack** | Next.js 15, @eximia/ui, Zod |
| **Package** | `apps/web` |
| **Risk** | BAIXO — CRUD padrao |

---

## Acceptance Criteria

- [ ] **AC1:** Page `/admin/job-roles` com listagem de cargos agrupados por area
- [ ] **AC2:** Table: nome, area, senioridade, # trails vinculadas
- [ ] **AC3:** Modal de criacao: nome, area (select), senioridade (select: junior/mid/senior/lead/manager), descricao
- [ ] **AC4:** Edicao inline ou via modal
- [ ] **AC5:** Delete com confirmacao — bloqueado se tem trails activas vinculadas
- [ ] **AC6:** Server actions: `createJobRole()`, `updateJobRole()`, `deleteJobRole()`
- [ ] **AC7:** Validadores Zod: `createJobRoleSchema`, `updateJobRoleSchema`
- [ ] **AC8:** Navigation entry "Cargos" no menu admin/instructor
- [ ] **AC9:** Users podem ser associados a um cargo (estender user profile ou criar relacao)

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1, 2) Pagina de listagem
  - [ ] Criar `apps/web/src/app/(platform)/admin/job-roles/page.tsx`
  - [ ] Buscar job_roles do tenant com JOIN areas para nome da area
  - [ ] Contar trails activas por job_role
  - [ ] Agrupar por area no UI (ou tabs por area)
  - [ ] Usar Table do @eximia/ui

- [ ] **Task 2** (AC: 3) Modal de criacao
  - [ ] Componente `CreateJobRoleModal`
  - [ ] Campos: nome (input), area (select das areas do tenant), senioridade (select), descricao (textarea)
  - [ ] Slug auto-gerado do nome (kebab-case)
  - [ ] Usar Modal, Input, Select, Button do @eximia/ui

- [ ] **Task 3** (AC: 4) Edicao
  - [ ] Reuser modal com pre-fill dos dados existentes
  - [ ] Ou edicao inline na tabela para campos simples

- [ ] **Task 4** (AC: 5) Delete com protecao
  - [ ] Antes de delete: verificar se existem trails com status='active' vinculadas ao job_role
  - [ ] Se sim: mostrar alert "Nao e possivel excluir — existem X trilhas activas"
  - [ ] Se nao: confirmacao dialog → delete

- [ ] **Task 5** (AC: 6, 7) Server actions + validacao
  - [ ] Criar `apps/web/src/app/(platform)/admin/job-roles/actions.ts`
  - [ ] `createJobRole()`: valida, gera slug, insere
  - [ ] `updateJobRole()`: valida, actualiza
  - [ ] `deleteJobRole()`: verifica trails activas, deleta se ok
  - [ ] Criar `packages/shared/src/validators/job-roles.ts`

- [ ] **Task 6** (AC: 8) Navigation
  - [ ] Adicionar "Cargos" no menu admin e instructor
  - [ ] Actualizar `apps/web/src/lib/navigation.ts`

- [ ] **Task 7** (AC: 9) Associar users a job roles
  - [ ] Opcao A: adicionar `job_role_id` no user profile
  - [ ] Opcao B: criar tabela `user_job_roles` (many-to-many)
  - [ ] Preferir opcao A (mais simples) — `ALTER TABLE users ADD COLUMN job_role_id UUID REFERENCES job_roles(id)`
  - [ ] Ou se users ja tem muitas colunas: criar migration separada

---

## Dev Notes

### Technical Notes

- Areas ja existem: `SELECT id, name FROM areas WHERE tenant_id = ?`
- Slug generation: `name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')`
- Delete protection: `SELECT COUNT(*) FROM learning_trails WHERE target_job_role_id = ? AND status = 'active'`
- Associacao user-job_role: a forma mais simples e adicionar coluna na tabela users. Considerar que um user pode ter apenas 1 cargo por tenant

### File Locations

| Ficheiro | Acao |
|----------|------|
| `apps/web/src/app/(platform)/admin/job-roles/page.tsx` | CRIAR |
| `apps/web/src/app/(platform)/admin/job-roles/actions.ts` | CRIAR |
| `packages/shared/src/validators/job-roles.ts` | CRIAR |
| `apps/web/src/lib/navigation.ts` | MODIFICAR |

### Testing

- Criar cargo → aparece na listagem
- Delete cargo com trail activa → bloqueado
- Delete cargo sem trails → sucesso
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
