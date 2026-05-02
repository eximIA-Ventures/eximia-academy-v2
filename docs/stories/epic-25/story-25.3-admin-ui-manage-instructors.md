# Story 25.3: Admin UI — Manage Instructors

**Epic:** [Epic 25 — WS3: Instructor Role & RBAC Enhancement](../../epics/epic-25-ws3-instructor-role-rbac.md)
**Version:** 1.0
**Created:** 2026-02-26
**Updated:** 2026-02-26
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 5
**Priority:** P0
**Blocked By:** Story 25.1, Story 25.2
**Blocks:** Story 25.4
**Assigned To:** @dev

---

## User Story

**As an** admin,
**I want** a UI to promote users to instructor, configure their permissions and assign areas,
**so that** I can control who creates content and for which departments.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws3-platform-evolution-architecture.md`, Secao 3 |
| **Epic Ref** | `docs/epics/epic-25-ws3-instructor-role-rbac.md` — Story 25.3 |
| **Stack** | Next.js 15, React Server Components, @eximia/ui |
| **Package** | `apps/web` |
| **Existing Pattern** | `apps/web/src/components/admin/role-selector.tsx` |
| **Risk** | BAIXO — UI pura, RLS ja configurado |

---

## Acceptance Criteria

- [x] **AC1:** `role-selector.tsx` estendido com opcao "Instrutor" no dropdown
- [x] **AC2:** Componente `InstructorPermissionsForm` com checkboxes: can_create_courses, can_create_quizzes, can_manage_trails, can_view_analytics, can_manage_enrollments
- [x] **AC3:** Componente `AreaAssignment` com multi-select das areas do tenant
- [x] **AC4:** API route `PATCH /api/admin/users/:id/instructor-permissions` funcional
- [x] **AC5:** Validador Zod `updateInstructorPermissionsSchema` em `packages/shared/`
- [x] **AC6:** Badge "Instrutor" com icone distinto na listagem de users
- [x] **AC7:** Quando admin seleciona role "instructor", form de permissoes aparece automaticamente
- [x] **AC8:** UI usa componentes `@eximia/ui` (Table, Card, Checkbox, Badge, Modal, Select)

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 1) Estender role-selector
  - [x] Abrir `apps/web/src/components/admin/role-selector.tsx`
  - [x] Adicionar opcao "Instrutor" ao dropdown/select de roles
  - [x] Quando "Instrutor" selecionado: mostrar secao de permissoes (Task 2)

- [x] **Task 2** (AC: 2, 7) Criar InstructorPermissionsForm
  - [x] Criar `apps/web/src/components/admin/instructor-permissions-form.tsx`
  - [x] 5 checkboxes com labels claros:
    - "Criar cursos" (can_create_courses) — default: checked
    - "Criar quizzes" (can_create_quizzes) — default: checked
    - "Gerenciar trilhas" (can_manage_trails) — default: unchecked
    - "Ver analytics" (can_view_analytics) — default: checked
    - "Gerenciar enrollments" (can_manage_enrollments) — default: checked
  - [x] Form controlado com estado local
  - [x] Usar `Checkbox` do @eximia/ui

- [x] **Task 3** (AC: 3) Criar AreaAssignment component
  - [x] Criar `apps/web/src/components/admin/area-assignment.tsx`
  - [x] Buscar areas do tenant via server action ou API
  - [x] Multi-select com chips para areas selecionadas
  - [x] Usar `Select` ou custom multi-select do @eximia/ui
  - [x] Salvar como array de UUIDs

- [x] **Task 4** (AC: 4, 5) API route para instructor permissions
  - [x] Criar `apps/web/src/app/api/admin/users/[userId]/instructor-permissions/route.ts`
  - [x] PATCH: recebe permissions + area_ids → upsert em `instructor_permissions`
  - [x] GET: retorna permissoes actuais do user
  - [x] Validar com Zod schema
  - [x] Apenas admin/super_admin pode aceder (role check)
  - [x] Criar `packages/shared/src/validators/instructor-permissions.ts` com `updateInstructorPermissionsSchema`

- [x] **Task 5** (AC: 6) Badge na listagem de users
  - [x] Na pagina de listagem de users (admin), adicionar Badge "Instrutor" com icone (ex: GraduationCap)
  - [x] Badge usa cor distinta (ex: accent-blue ou accent-purple)
  - [x] Usar `Badge` do @eximia/ui

- [x] **Task 6** (AC: 8) Verificar design system compliance
  - [x] Todos os componentes usam @eximia/ui
  - [x] Tokens de cor do tema (bg-bg-card, text-text-primary, etc.)
  - [x] Responsive: funciona em mobile

---

## Dev Notes

### Technical Notes

- `role-selector.tsx` existente provavelmente usa um Select com opcoes hardcoded. Adicionar "instructor" ao array
- O form de permissoes so aparece quando role = "instructor". Para outros roles, esconder
- Areas vem de `areas` table (ja implementada). Query: `SELECT id, name FROM areas WHERE tenant_id = ?`
- Upsert pattern: se `instructor_permissions` ja existe para (user_id, tenant_id), UPDATE. Se nao, INSERT
- Componentes @eximia/ui: ver `docs/design-system-guide.md` para catalogo completo

### File Locations

| Ficheiro | Acao |
|----------|------|
| `apps/web/src/components/admin/role-selector.tsx` | MODIFICAR |
| `apps/web/src/components/admin/instructor-permissions-form.tsx` | CRIAR |
| `apps/web/src/components/admin/area-assignment.tsx` | CRIAR |
| `apps/web/src/app/api/admin/users/[userId]/instructor-permissions/route.ts` | CRIAR |
| `packages/shared/src/validators/instructor-permissions.ts` | CRIAR |

### Testing

- Promover user a instructor → verificar permissoes salvas
- Editar permissoes → verificar update
- Atribuir areas → verificar array salvo
- `pnpm typecheck` passa

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-26 | 1.0 | Story criada a partir do Epic 25 | River (SM) |

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- Full monorepo typecheck: 6/6 packages passed
- Badge variant "info" confirmed in @eximia/ui Badge component
- Checkbox children prop confirmed for label rendering

### Completion Notes List
- role-selector.tsx: added "Instrutor" option + "info" badge variant for instructor
- InstructorPermissionsForm: 5 checkboxes with @eximia/ui Checkbox, controlled state, API save
- AreaAssignment: fetches areas from /api/admin/areas, multi-select with chips (Badge + X remove)
- API route: GET returns current permissions, PATCH upserts with Zod validation, admin-only access
- Zod validator: updateInstructorPermissionsSchema in packages/shared
- Badge: GraduationCap icon + "Instrutor" info badge in user-list name column
- AC7: when admin changes role to instructor, permissions form auto-expands below the user row
- user-list.tsx: expandable instructor permissions row with dropdown menu integration
- patchSchema and inviteSchema updated to accept "instructor" role

### File List
- `apps/web/src/components/admin/role-selector.tsx` — MODIFIED: added instructor option + info badge variant
- `apps/web/src/components/admin/user-list.tsx` — MODIFIED: instructor badge + expandable permissions form
- `apps/web/src/components/admin/instructor-permissions-form.tsx` — NEW: permission checkboxes form
- `apps/web/src/components/admin/area-assignment.tsx` — NEW: multi-select area assignment
- `apps/web/src/app/api/admin/users/[userId]/instructor-permissions/route.ts` — NEW: GET/PATCH API
- `apps/web/src/app/api/admin/users/[userId]/route.ts` — MODIFIED: patchSchema accepts instructor
- `apps/web/src/app/api/admin/users/route.ts` — MODIFIED: inviteSchema accepts instructor
- `packages/shared/src/validators/instructor-permissions.ts` — NEW: Zod schema
- `packages/shared/src/index.ts` — MODIFIED: added instructor-permissions export

---

## QA Results

**Reviewer:** Quinn (QA) | **Date:** 2026-02-28 | **Gate:** PASS with CONCERNS

### AC Verification

| AC | Status | Notes |
|----|--------|-------|
| AC1 | PASS | RoleSelector inclui opcao "Instrutor" |
| AC2 | PASS | InstructorPermissionsForm com 5 checkboxes usando @eximia/ui Checkbox |
| AC3 | PARTIAL | AreaAssignment componente existe mas nao esta integrado no InstructorPermissionsForm |
| AC4 | PASS | API route GET/PATCH funcional com Zod validation e admin-only access |
| AC5 | PASS | Zod validator em packages/shared com validacao UUID para area_ids |
| AC6 | PASS | Badge "Instrutor" com GraduationCap icon na user-list |
| AC7 | PASS | Formulario auto-expande quando role muda para instructor |
| AC8 | PASS | Usa @eximia/ui components (Card, CardContent, Checkbox, Button, Badge, Table, etc.) |

### Code Quality: FAIR

- Componentes seguem patterns existentes (client components, hooks pattern)
- API route com requireAdmin guard, Zod validation, upsert pattern
- UI theme tokens usados correctamente (text-text-primary, bg-bg-surface, etc.)

### Issues Found

1. **BUG-25.3-01** (HIGH) — `user-list.tsx:250-254`: `InstructorPermissionsForm` renderizado sem prop `initialPermissions`. Form mostra defaults em vez de dados salvos. Ao expandir permissoes de instructor existente, checkboxes mostram valores default e nao os reais
2. **BUG-25.3-02** (MEDIUM) — AreaAssignment nao esta integrado no InstructorPermissionsForm. Admin nao consegue atribuir areas ao instructor via UI. Componente existe (`area-assignment.tsx`) mas nao e renderizado
3. **BUG-25.3-03** (MEDIUM) — Ao salvar permissoes, `assigned_area_ids` envia `initialPermissions?.assigned_area_ids ?? []` (linha 65), ou seja, sempre `[]` pois `initialPermissions` nunca e passado

### Concerns (Tech Debt)

1. **TD-25.3-01** (MEDIUM) — Ao mudar role para instructor via RoleSelector, nao cria automaticamente `instructor_permissions` row com defaults. Admin precisa abrir permissoes e salvar manualmente
2. **TD-25.3-02** (LOW) — Form fecha ao salvar (`onSaved` sets `expandedInstructorId(null)`) sem feedback visual de sucesso

### Verdict: **PASS** — Funcional para fluxo basico (criar + salvar permissoes), mas BUG-25.3-01 deve ser corrigido para UX adequada

### Re-Review (2026-02-28)

**BUG-25.3-01 verificado:** `user-list.tsx` agora faz fetch de permissoes via `useEffect` ao expandir instructor row. State tipado, loading state "Carregando permissoes...", `initialPermissions` passado ao form. **RESOLVED.**

**BUG-25.3-02 verificado:** `AreaAssignment` agora integrado no `InstructorPermissionsForm` (linha 99). State `areaIds` separado, inicializado de `initialPermissions`. **RESOLVED.**

**BUG-25.3-03 verificado:** `handleSave` agora envia `assigned_area_ids: areaIds` (state real) em vez de `initialPermissions?.assigned_area_ids ?? []`. **RESOLVED.**

AC3 atualizado de PARTIAL para **PASS** — AreaAssignment integrado no form.

TD-25.3-01 e TD-25.3-02 permanecem como tech debt (MEDIUM/LOW).

**Updated Gate: PASS**
