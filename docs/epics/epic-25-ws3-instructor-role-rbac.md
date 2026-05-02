# Epic 25: WS3 — Instructor Role & RBAC Enhancement

**Version:** 1.0
**Created:** 2026-02-26
**Updated:** 2026-02-26
**Author:** Atlas (Analyst) com arquitectura de WS3 v1.0
**Status:** Draft
**Architecture Reference:** `docs/architecture/ws3-platform-evolution-architecture.md` — Seções 3, 5.1
**Workstream:** WS3 (Platform Evolution — independente)

---

## Epic Goal

Adicionar o role `instructor` ao sistema RBAC, com permissões granulares para criação de conteúdo, gestão de alunos por área e dashboard específico. O instructor é o pilar operacional da plataforma corporativa — sem ele, todo o trabalho de criação recai sobre admins/managers.

## Epic Context

| Item | Detalhe |
|------|---------|
| **Stack** | Next.js 15, Supabase, Drizzle ORM, Tailwind CSS 4, @eximia/ui |
| **DB Tables** | `users` (extend role enum), `instructor_permissions` (NOVO), RLS policies (~8-10 updates) |
| **Auth** | Supabase Auth, middleware role checks |
| **Roles Impactados** | Todos — novo role afecta RLS, navigation, middleware |
| **Package** | `apps/web`, `packages/shared`, `packages/database` |
| **Story Points** | 21 SP |

---

## Existing System Context

### Infrastructure Already in Place

| Component | Status | Reference |
|-----------|--------|-----------|
| 4 roles (student, manager, admin, super_admin) | Implementado | `packages/database/src/schema/users.ts` |
| RLS com `auth_user_role()` | Implementado | `supabase/migrations/20260207*` |
| Role selector UI | Implementado | `apps/web/src/components/admin/role-selector.tsx` |
| Areas/Departments | Implementado | `packages/database/src/schema/areas.ts` |
| User-Areas many-to-many | Implementado | `packages/database/src/schema/user-areas.ts` |
| Navigation por role | Implementado | `apps/web/src/lib/navigation.ts` |
| API key scopes | Implementado | `apps/web/src/lib/api-auth/scopes.ts` |

### What This Epic Changes

```
ANTES:
  Admin/Manager → cria cursos, gerencia tudo
  Student → consome

DEPOIS:
  Admin → gerencia plataforma
  Instructor → cria cursos, quizzes, trilhas, vê analytics dos seus alunos
  Manager → visão gerencial, analytics, enrollments
  Student → consome
```

---

## Enhancement Details

### Role Hierarchy

```
super_admin
  └── admin
       ├── instructor (NOVO — foco em criação de conteúdo)
       └── manager (foco em gestão de pessoas)
            └── student
```

### Instructor Permissions Model

| Permissão | Default | Configurável |
|-----------|---------|-------------|
| Criar cursos | Sim | Sim |
| Criar quizzes | Sim | Sim |
| Gerenciar trilhas | Não | Sim |
| Ver analytics | Sim (próprios cursos) | Sim |
| Gerenciar enrollments | Sim (próprias áreas) | Sim |
| Áreas atribuídas | [] | Sim (admin define) |

---

## Stories

### Story 25.1: DB Migration — Instructor Role

**SP:** 3 | **Priority:** P0

**Descrição:** Estender o enum de roles para incluir `instructor`, criar tabela `instructor_permissions` para permissões granulares, e actualizar ~8-10 RLS policies para reconhecer o novo role.

**Tasks:**

- [ ] Criar migration SQL: extend role check constraint
- [ ] Criar tabela `instructor_permissions` com campos: can_create_courses, can_create_quizzes, can_manage_trails, can_view_analytics, can_manage_enrollments, assigned_area_ids
- [ ] Actualizar RLS policies em: courses, chapters, questions, enrollments, sessions, blueprints, analytics
- [ ] Pattern: `auth_user_role() IN ('instructor', 'admin', 'super_admin')` para criação
- [ ] Criar Drizzle schema para `instructor_permissions`
- [ ] Actualizar `packages/database/src/schema/index.ts`
- [ ] Actualizar role types em `packages/shared/src/types/models.ts`

**Acceptance Criteria:**

- [ ] Migration aplica sem erros no Supabase
- [ ] Instructor pode ser criado via SQL
- [ ] RLS policies permitem instructor criar cursos/chapters
- [ ] RLS policies bloqueiam instructor de ver cursos de outros tenants
- [ ] RLS policies bloqueiam instructor de gerenciar users

**Dev Notes:**

- Role `teacher` foi removido na migration `20260210000000_areas_role_unification.sql`. `instructor` é diferente — tem permissões configuráveis.
- Testar com: `SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = '{"sub":"uuid","user_role":"instructor","tenant_id":"uuid"}'`

---

### Story 25.2: Backend — Instructor Auth & Middleware

**SP:** 5 | **Priority:** P0

**Descrição:** Actualizar middleware, navigation, server actions e API routes para reconhecer o role instructor com as permissões correctas.

**Tasks:**

- [ ] Actualizar `apps/web/src/middleware.ts`: instructor tem acesso a rotas de criação
- [ ] Actualizar `apps/web/src/lib/navigation.ts`: nav items específicos para instructor
- [ ] Criar helper `checkInstructorPermission(userId, permission)` em `apps/web/src/lib/api-auth/`
- [ ] Actualizar server actions em `courses/actions.ts`: instructor pode criar/editar cursos
- [ ] Actualizar admin routes: instructor NÃO acessa `/admin/users`, `/admin/settings`, `/admin/api-keys`
- [ ] Actualizar `packages/shared/src/types/models.ts`: adicionar `instructor` ao UserRole union

**Acceptance Criteria:**

- [ ] Instructor logado vê navigation correcta (cursos, analytics, sem admin)
- [ ] Instructor pode criar curso via server action
- [ ] Instructor NÃO pode aceder `/admin/users` (redirect)
- [ ] Instructor filtrado por assigned_area_ids vê apenas cursos das suas áreas

---

### Story 25.3: Admin UI — Manage Instructors

**SP:** 5 | **Priority:** P0

**Descrição:** Interface para admin promover users a instructor, definir permissões granulares e atribuir áreas.

**Tasks:**

- [ ] Estender `role-selector.tsx` com opção "Instrutor"
- [ ] Criar componente `InstructorPermissionsForm` com checkboxes para cada permissão
- [ ] Criar componente `AreaAssignment` — multi-select das áreas do tenant
- [ ] API route `PATCH /api/admin/users/:id/instructor-permissions`
- [ ] Validador Zod: `updateInstructorPermissionsSchema`
- [ ] Na listagem de users, badge "Instrutor" com ícone distinto

**Acceptance Criteria:**

- [ ] Admin promove user a instructor com 1 clique
- [ ] Admin configura permissões via checkboxes
- [ ] Admin atribui áreas (multi-select)
- [ ] Permissões salvas e enforcement imediato
- [ ] UI usa componentes `@eximia/ui` (Table, Card, Checkbox, Badge, Modal)

---

### Story 25.4: Instructor Dashboard

**SP:** 5 | **Priority:** P1

**Descrição:** Dashboard específico para instructor: meus cursos, meus alunos, quizzes pendentes de review, analytics resumido.

**Tasks:**

- [ ] Criar page `apps/web/src/app/(platform)/instructor/page.tsx`
- [ ] Card "Meus Cursos" — lista de cursos criados por mim, com status e enrollment count
- [ ] Card "Meus Alunos" — total de alunos nas minhas áreas, com progresso médio
- [ ] Card "Quizzes Pendentes" — placeholder para Epic 26 (mostrar "Em breve" na v1)
- [ ] Card "Analytics Resumido" — sessões esta semana, taxa de conclusão, nota média
- [ ] Server action `getInstructorDashboardData(userId, tenantId)`
- [ ] Navigation entry para instructor: "Meu Painel" → `/instructor`

**Acceptance Criteria:**

- [ ] Instructor vê dashboard com dados reais dos seus cursos
- [ ] Dados filtrados por áreas atribuídas
- [ ] Cards usam componentes `@eximia/ui`
- [ ] Responsive (mobile-friendly)

---

### Story 25.5: Tests — Instructor RBAC

**SP:** 3 | **Priority:** P1

**Descrição:** Testes unitários e E2E para validar que o role instructor funciona correctamente.

**Tasks:**

- [ ] Unit tests: RLS policies com role instructor (create course, read course, blocked from users table)
- [ ] Unit tests: `checkInstructorPermission()` helper
- [ ] E2E: Login como instructor → verificar navigation → criar curso → verificar acesso bloqueado a /admin/users
- [ ] E2E: Admin promove user a instructor → verifica permissões
- [ ] Regression: Verificar que student/manager/admin não foram afectados

**Acceptance Criteria:**

- [ ] Todos os testes passam
- [ ] Cobertura de RLS para instructor ≥ 80%
- [ ] Zero regressão nos roles existentes

---

## Dependencies

| Dependency | Type | Status |
|-----------|------|--------|
| Multi-tenant RLS pattern | Interna | Implementado |
| Areas/Departments system | Interna | Implementado |
| Role selector component | Interna | Implementado (estender) |
| Navigation system | Interna | Implementado (estender) |

## Risks

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Instructor role quebra RLS existentes | Alto | Testar todas as 30+ policies antes de deploy |
| Confusão entre instructor e manager | Médio | Documentar claramente a diferença na UI |

---

*Epic 25 — WS3 Instructor Role & RBAC v1.0*
