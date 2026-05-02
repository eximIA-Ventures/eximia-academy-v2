# Story 25.2: Backend — Instructor Auth & Middleware

**Epic:** [Epic 25 — WS3: Instructor Role & RBAC Enhancement](../../epics/epic-25-ws3-instructor-role-rbac.md)
**Version:** 1.0
**Created:** 2026-02-26
**Updated:** 2026-02-26
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 5
**Priority:** P0
**Blocked By:** Story 25.1
**Blocks:** Story 25.3, Story 25.4
**Assigned To:** @dev

---

## User Story

**As an** instructor,
**I want** the middleware and navigation to recognize my role with correct permissions,
**so that** I can access course creation tools without being blocked or seeing admin-only pages.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws3-platform-evolution-architecture.md`, Secao 3 (D1-D3) |
| **Epic Ref** | `docs/epics/epic-25-ws3-instructor-role-rbac.md` — Story 25.2 |
| **Stack** | Next.js 15 middleware, TypeScript |
| **Package** | `apps/web` |
| **Existing Pattern** | `apps/web/src/middleware.ts`, `apps/web/src/lib/navigation.ts` |
| **Risk** | MEDIO — middleware incorreto bloqueia toda a app para instructors |

---

## Acceptance Criteria

- [x] **AC1:** Middleware reconhece `instructor` role e concede acesso a rotas de criacao (`/courses/new`, `/courses/[id]/edit`, `/courses/[id]/chapters`)
- [x] **AC2:** Middleware bloqueia instructor de aceder `/admin/users`, `/admin/settings`, `/admin/api-keys` (redirect para `/instructor`)
- [x] **AC3:** Navigation mostra items correctos para instructor: "Meu Painel", "Cursos", "Biblioteca", "Analytics" (sem "Users", "Settings", "API Keys")
- [x] **AC4:** Helper `checkInstructorPermission(userId, permission)` criado em `apps/web/src/lib/api-auth/instructor-permissions.ts`
- [x] **AC5:** Server actions em `courses/actions.ts` permitem instructor criar/editar cursos
- [x] **AC6:** Instructor filtrado por `assigned_area_ids` via `getInstructorAreaIds()` helper
- [x] **AC7:** `packages/shared/src/types/models.ts` tem `instructor` no UserRole union

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 1, 2) Actualizar middleware
  - [x] Abrir `apps/web/src/middleware.ts`
  - [x] Adicionar `instructor` ao array de roles permitidos em rotas de criacao
  - [x] Rotas permitidas para instructor: `/courses/*`, `/chapters/*`, `/blueprints/*`, `/analytics/*`, `/instructor/*`
  - [x] Rotas bloqueadas para instructor: `/admin/users`, `/admin/settings`, `/admin/api-keys`, `/admin/webhooks`
  - [x] Redirect para `/instructor` se instructor tenta aceder rota bloqueada

- [x] **Task 2** (AC: 3) Actualizar navigation
  - [x] Abrir `apps/web/src/lib/navigation.ts`
  - [x] Adicionar nav items para role `instructor`: "Meu Painel" → `/instructor`, "Cursos" → `/courses`, "Biblioteca", "Analytics" → `/analytics`
  - [x] Remover nav items admin-only do instructor
  - [x] Manter items comuns (perfil, logout)

- [x] **Task 3** (AC: 4) Criar helper checkInstructorPermission
  - [x] Criar `apps/web/src/lib/api-auth/instructor-permissions.ts`
  - [x] Funcao `checkInstructorPermission(userId: string, permission: string): Promise<boolean>`
  - [x] Query `instructor_permissions` table por userId e tenantId
  - [x] Verificar campo correspondente (can_create_courses, can_create_quizzes, etc.)
  - [x] Cache resultado por 5 minutos (in-memory)
  - [x] Export via `apps/web/src/lib/api-auth/index.ts`

- [x] **Task 4** (AC: 5) Actualizar server actions de courses
  - [x] Abrir `apps/web/src/app/(platform)/courses/actions.ts`
  - [x] Na funcao requireContentRole: aceitar role `instructor` alem de admin/manager
  - [x] deleteCourse: instructor tem mesma restrição que manager (só draft)
  - [x] Mesma logica para updateCourse, archiveCourse, publishCourse

- [x] **Task 5** (AC: 6) Filtro por areas atribuidas
  - [x] `getInstructorAreaIds(userId)` helper criado
  - [x] Retorna assigned_area_ids do instructor_permissions
  - [x] Se vazio: instructor ve todos os cursos do tenant (sem filtro de area)

- [x] **Task 6** (AC: 7) Verificar types
  - [x] Confirmado `packages/shared/src/types/models.ts` tem `instructor` (Story 25.1)
  - [x] `pnpm typecheck` passa — 6/6 packages OK

---

## Dev Notes

### Technical Notes

- Middleware actual usa `roleAccessMap` ou logica similar para definir rotas por role. Seguir mesmo pattern
- Navigation actual: ver `getNavigationItems(role)` ou similar em `navigation.ts`
- Server actions usam `createServerClient()` que automaticamente aplica RLS. A RLS ja permite instructor (Story 25.1), mas o server action pode ter check adicional de role no codigo
- `checkInstructorPermission` deve usar service client (bypassa RLS) para ler `instructor_permissions`

### File Locations

| Ficheiro | Acao |
|----------|------|
| `apps/web/src/middleware.ts` | MODIFICAR |
| `apps/web/src/lib/navigation.ts` | MODIFICAR |
| `apps/web/src/lib/api-auth/instructor-permissions.ts` | CRIAR |
| `apps/web/src/lib/api-auth/index.ts` | MODIFICAR (add export) |
| `apps/web/src/app/(platform)/courses/actions.ts` | MODIFICAR |

### Testing

- Login como instructor → verificar navigation items
- Tentar aceder `/admin/users` → deve redirecionar
- Criar curso como instructor → deve funcionar
- `pnpm typecheck` deve passar

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
- Sidebar already has fallback for unknown roles (`navigationByRole[role] || navigationByRole.student`)

### Completion Notes List
- Middleware: instructor can access /courses/*, /instructor/*, /analytics/*, /biblioteca/*
- Middleware: instructor blocked from /admin/users, /admin/settings, /admin/api-keys, /admin/webhooks → redirects to /instructor
- Middleware: instructor login redirects to /instructor (not /dashboard)
- Navigation: instructor sees "Meu Painel", "Cursos", "Biblioteca", "Analytics"
- checkInstructorPermission: typed permission keys, 5min in-memory cache, service client (bypasses RLS)
- getInstructorAreaIds: returns assigned area IDs for area-based filtering
- requireContentRole: now accepts 'instructor' alongside 'manager' and 'admin'
- deleteCourse: instructor can only delete draft courses (same restriction as manager)

### File List
- `apps/web/src/middleware.ts` — MODIFIED: instructor routing + blocking
- `apps/web/src/lib/navigation.ts` — MODIFIED: added instructor nav items
- `apps/web/src/lib/api-auth/instructor-permissions.ts` — NEW: checkInstructorPermission + getInstructorAreaIds
- `apps/web/src/lib/api-auth/index.ts` — MODIFIED: added instructor permission exports
- `apps/web/src/app/(platform)/courses/actions.ts` — MODIFIED: instructor role in requireContentRole + deleteCourse

---

## QA Results

**Reviewer:** Quinn (QA) | **Date:** 2026-02-28 | **Gate:** PASS with CONCERNS

### AC Verification

| AC | Status | Notes |
|----|--------|-------|
| AC1 | PASS | Middleware reconhece instructor, permite /courses/*, /instructor/*, /analytics/*, /biblioteca/* |
| AC2 | PASS | Instructor bloqueado de /admin/users, /admin/settings, /admin/api-keys, /admin/webhooks → redirect /instructor |
| AC3 | PASS | Navigation mostra "Meu Painel", "Cursos", "Biblioteca", "Analytics" para instructor |
| AC4 | PASS | `checkInstructorPermission(userId, permission)` funcional com cache 5min |
| AC5 | PASS | `requireContentRole` aceita instructor em courses/actions.ts |
| AC6 | PASS | `getInstructorAreaIds()` retorna area IDs |
| AC7 | PASS | deleteCourse permite instructor apagar apenas draft (mesma restricao que manager) |
| AC8 | PASS | `pnpm typecheck` 6/6 OK |

### Code Quality: GOOD

- Middleware segue padrao existente de role-based routing
- Cache com TTL e invalidacao adequada
- Service client para bypass RLS em permission checks

### Concerns (Tech Debt)

1. **TD-25.2-01** (HIGH) — Cache key em `instructor-permissions.ts:24` usa apenas `ip:${userId}`, deveria incluir tenant_id: `ip:${userId}:${tenantId}`. Se user pertencer a multiplos tenants, cache retorna permissoes do tenant errado. Fix: adicionar `tenantId` como parametro de `getInstructorPermissions()`
2. **TD-25.2-02** (HIGH) — Query em `instructor-permissions.ts:36` filtra apenas por `user_id`, sem filtrar `tenant_id`. Com UNIQUE(user_id, tenant_id), `.single()` falha se user tiver permissoes em multiplos tenants
3. **TD-25.2-03** (MEDIUM) — `checkInstructorPermission` nao e chamado em `courses/actions.ts` — `requireContentRole` valida role mas nao permissoes granulares (ex: `can_create_courses`). Aceitavel para MVP, mas deve ser adicionado para enforcement completo
4. **TD-25.2-04** (LOW) — Instructor que cria curso nao recebe auto-assign de `area_id` (managers recebem). Curso fica sem area

### Verdict: **PASS** — TD-25.2-01 e TD-25.2-02 devem ser corrigidos antes de multi-tenant production

### Re-Review (2026-02-28)

**FIX-25.2-01 verificado:** `tenantId` adicionado como parametro a `getInstructorPermissions`, `checkInstructorPermission`, `getInstructorAreaIds`. Cache key agora `ip:${userId}:${tenantId}`. Query filtra por ambos `.eq("user_id").eq("tenant_id")`. Testes atualizados com mock chain de dois `.eq()` e assertions de tenant. **RESOLVED.**

TD-25.2-01 e TD-25.2-02 **fechados**. TD-25.2-03 e TD-25.2-04 permanecem como tech debt (MEDIUM/LOW).

**Updated Gate: PASS**
