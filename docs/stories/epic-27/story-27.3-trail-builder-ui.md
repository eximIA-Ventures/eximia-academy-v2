# Story 27.3: Trail Builder UI

**Epic:** [Epic 27 — WS3: Learning Trails & Job Roles](../../epics/epic-27-ws3-learning-trails-job-roles.md)
**Version:** 1.0
**Created:** 2026-02-26
**Updated:** 2026-02-26
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 8
**Priority:** P0
**Blocked By:** Story 27.1, Story 27.2
**Blocks:** Story 27.4, Story 27.5
**Assigned To:** @dev

---

## User Story

**As an** instructor,
**I want** to build learning trails by dragging courses into a sequence,
**so that** students follow a structured learning path.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws3-platform-evolution-architecture.md`, Secao 4.1 |
| **Epic Ref** | `docs/epics/epic-27-ws3-learning-trails-job-roles.md` — Story 27.3 |
| **Stack** | Next.js 15, @dnd-kit/sortable (drag-and-drop), @eximia/ui |
| **Package** | `apps/web` |
| **Risk** | MEDIO — drag-and-drop pode ser complexo. Fallback: lista com setas up/down |

---

## Acceptance Criteria

- [ ] **AC1:** Page `/trails/new` com formulario multi-step
- [ ] **AC2:** Step 1: titulo, descricao, cargo alvo (select de job_roles), obrigatoria (toggle)
- [ ] **AC3:** Step 2: selecionar cursos do tenant com search/filter. Drag-and-drop para ordenar
- [ ] **AC4:** Para cada curso na trilha: marcar se obrigatorio, definir horas estimadas
- [ ] **AC5:** Preview: visualizar trilha como sequencia de cards
- [ ] **AC6:** Page `/trails` com listagem de trilhas (titulo, status, cargo, # cursos)
- [ ] **AC7:** Page `/trails/[trailId]` com detalhe da trilha e seus cursos
- [ ] **AC8:** Server actions: `createTrail()`, `updateTrail()`, `addCourseToTrail()`, `reorderTrailCourses()`
- [ ] **AC9:** Navigation entry "Trilhas" para instructor/admin/manager

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1, 2) Step 1: informacoes da trilha
  - [ ] Criar `apps/web/src/app/(platform)/trails/new/page.tsx`
  - [ ] Input: titulo, descricao (textarea)
  - [ ] Select: cargo alvo (job_roles do tenant)
  - [ ] Toggle: obrigatoria (is_mandatory)

- [ ] **Task 2** (AC: 3, 4) Step 2: selecao e ordenacao de cursos
  - [ ] Buscar cursos do tenant: `SELECT id, title, status FROM courses WHERE tenant_id = ?`
  - [ ] Lista de cursos disponiveis com search input
  - [ ] Ao clicar/arrastar curso: adicionar a "trilha" (lista ordenada)
  - [ ] Usar `@dnd-kit/sortable` para reordenacao. Fallback: botoes up/down
  - [ ] Para cada curso adicionado: checkbox "Obrigatorio" + input "Horas estimadas"
  - [ ] Instalar `@dnd-kit/core` e `@dnd-kit/sortable` se nao existirem

- [ ] **Task 3** (AC: 5) Preview
  - [ ] Componente `TrailPreview`: sequencia vertical de cards representando cursos
  - [ ] Cada card: titulo do curso, badge obrigatorio/opcional, horas estimadas
  - [ ] Conexoes visuais entre cards (linhas ou setas)

- [ ] **Task 4** (AC: 6) Listagem de trilhas
  - [ ] Criar `apps/web/src/app/(platform)/trails/page.tsx`
  - [ ] Table: titulo, status (badge: draft/active/archived), cargo alvo, # cursos, estimated_hours total
  - [ ] Link para detalhe de cada trilha
  - [ ] Usar Table do @eximia/ui

- [ ] **Task 5** (AC: 7) Detalhe da trilha
  - [ ] Criar `apps/web/src/app/(platform)/trails/[trailId]/page.tsx`
  - [ ] Mostrar info da trilha + lista de cursos na ordem
  - [ ] Botoes: "Editar", "Activar" (se draft), "Arquivar" (se active)

- [ ] **Task 6** (AC: 8) Server actions
  - [ ] Criar `apps/web/src/app/(platform)/trails/actions.ts`
  - [ ] `createTrail()`: insere learning_trail + trail_courses
  - [ ] `updateTrail()`: actualiza trail info
  - [ ] `addCourseToTrail()`: insere trail_course com order
  - [ ] `reorderTrailCourses()`: actualiza order de todos os trail_courses
  - [ ] Validadores Zod em `packages/shared/src/validators/trails.ts`

- [ ] **Task 7** (AC: 9) Navigation
  - [ ] Adicionar "Trilhas" para instructor, admin, manager em navigation.ts

---

## Dev Notes

### Technical Notes

- `@dnd-kit/sortable` e a library recomendada para drag-and-drop em React. Se ja existe no projecto, reusar
- Se instalar `@dnd-kit`: `pnpm --filter web add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
- Fallback sem drag-and-drop: lista com botoes de seta para mover up/down — funcional mas menos UX
- Reorder: ao submeter, enviar array de `{ course_id, order }` e fazer UPDATE batch
- Trail status machine: draft → active → archived. So admin/instructor pode mudar status

### File Locations

| Ficheiro | Acao |
|----------|------|
| `apps/web/src/app/(platform)/trails/new/page.tsx` | CRIAR |
| `apps/web/src/app/(platform)/trails/page.tsx` | CRIAR |
| `apps/web/src/app/(platform)/trails/[trailId]/page.tsx` | CRIAR |
| `apps/web/src/app/(platform)/trails/actions.ts` | CRIAR |
| `packages/shared/src/validators/trails.ts` | CRIAR |
| `apps/web/src/lib/navigation.ts` | MODIFICAR |

### Testing

- Criar trilha com 3 cursos → persistido na ordem correcta
- Reordenar cursos → nova ordem salva
- Preview mostra trilha correctamente
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
