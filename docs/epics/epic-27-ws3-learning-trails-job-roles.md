# Epic 27: WS3 — Learning Trails & Job Roles

**Version:** 1.0
**Created:** 2026-02-26
**Updated:** 2026-02-26
**Author:** Atlas (Analyst) com arquitectura de WS3 v1.0
**Status:** Draft
**Architecture Reference:** `docs/architecture/ws3-platform-evolution-architecture.md` — Seções 4.1, 5.2
**Workstream:** WS3 (Platform Evolution — depende de Epic 25)

---

## Epic Goal

Implementar trilhas de aprendizado sequenciais vinculadas a cargos/funções. O gestor define cargos por departamento, o instructor monta trilhas com cursos ordenados, e alunos são auto-inscritos na trilha do seu cargo. Isso transforma cursos soltos num produto visível para RH: "trilhas por cargo".

## Epic Context

| Item | Detalhe |
|------|---------|
| **Stack** | Next.js 15, Supabase, @eximia/ui |
| **DB Tables** | `job_roles` (NOVO), `learning_trails` (NOVO), `trail_courses` (NOVO), `enrollments` (extend) |
| **Roles Impactados** | admin/instructor (CRUD), manager (dashboard), student (consome trilhas) |
| **Package** | `apps/web`, `packages/database`, `packages/shared` |
| **Story Points** | 29 SP |
| **Depende de** | Epic 25 (instructor role) |

---

## Existing System Context

### Infrastructure Already in Place

| Component | Status | Reference |
|-----------|--------|-----------|
| Courses CRUD | Implementado | `apps/web/src/app/(platform)/courses/` |
| Enrollments (student ↔ course) | Implementado | `packages/database/src/schema/enrollments.ts` |
| Areas/Departments | Implementado | `packages/database/src/schema/areas.ts` |
| User-Areas | Implementado | `packages/database/src/schema/user-areas.ts` |
| Cursor-based pagination | Implementado | `apps/web/src/lib/api-auth/v1-helpers.ts` |
| Analytics infrastructure | Implementado | `apps/web/src/app/api/analytics/` |

### What This Epic Changes

```
ANTES:
  Cursos soltos → aluno se inscreve individualmente
  Sem relação entre cargo e aprendizado
  Manager não sabe quem precisa de quê

DEPOIS:
  Cargos definidos por área
  Trilhas montadas com cursos em sequência
  Aluno auto-inscrito na trilha do seu cargo
  Manager vê progresso da equipe por trilha/cargo
```

---

## Enhancement Details

### Domain Model

```
Area (Departamento)
  └── Job Role (Cargo)
       └── Learning Trail (Trilha)
            ├── Course A (order: 1, required: true)
            ├── Course B (order: 2, required: true)
            └── Course C (order: 3, required: false)

User
  └── enrolled in Trail via Job Role
       └── Enrollment per Course (auto-created)
```

### Trail Status Machine

```
draft → active → archived
         ↓
  (alunos auto-inscritos quando trail fica active)
```

---

## Stories

### Story 27.1: DB Migration — Trails & Job Roles

**SP:** 3 | **Priority:** P0

**Descrição:** Criar tabelas `job_roles`, `learning_trails`, `trail_courses` e estender `enrollments` com campo `trail_id`.

**Tasks:**

- [ ] Criar migration SQL: `job_roles` (id, tenant_id, area_id, name, slug, description, seniority_level, created_by, timestamps)
- [ ] Criar migration SQL: `learning_trails` (id, tenant_id, title, description, target_job_role_id, estimated_hours, is_mandatory, status, created_by, timestamps)
- [ ] Criar migration SQL: `trail_courses` (id, trail_id, course_id, order, is_required, estimated_hours)
- [ ] Estender enrollments: `ALTER TABLE enrollments ADD COLUMN trail_id UUID REFERENCES learning_trails(id)`
- [ ] Estender enrollments: `ALTER TABLE enrollments ADD COLUMN trail_course_order INTEGER`
- [ ] RLS: instructor/admin CRUD em job_roles, learning_trails, trail_courses
- [ ] RLS: manager read em todas as tabelas do seu tenant
- [ ] RLS: student read learning_trails e trail_courses se enrolled
- [ ] Unique constraints: (tenant_id, slug) em job_roles, (trail_id, course_id) em trail_courses
- [ ] Criar Drizzle schemas
- [ ] Actualizar exports em `packages/database/src/schema/index.ts`

**Acceptance Criteria:**

- [ ] Migration aplica sem erros
- [ ] Constraints de unicidade funcionam
- [ ] RLS permite/bloqueia conforme role

---

### Story 27.2: Job Roles CRUD

**SP:** 5 | **Priority:** P0

**Descrição:** Interface para admin/instructor criar e gerir cargos por área.

**Tasks:**

- [ ] Criar page `apps/web/src/app/(platform)/admin/job-roles/page.tsx`
- [ ] Listagem de cargos agrupados por área — Table com nome, área, senioridade, # trails
- [ ] Modal de criação: nome, área (select), senioridade (select: junior/mid/senior/lead/manager), descrição
- [ ] Edição inline ou via modal
- [ ] Delete com confirmação (bloquear se tem trails activas)
- [ ] Server actions: `createJobRole()`, `updateJobRole()`, `deleteJobRole()`
- [ ] Validadores Zod: `createJobRoleSchema`, `updateJobRoleSchema`
- [ ] Associar users a job roles: estender user profile ou criar `user_job_roles`
- [ ] Navigation entry: "Cargos" no admin nav

**Acceptance Criteria:**

- [ ] Admin/instructor cria cargos com área e senioridade
- [ ] Delete bloqueado se há trails activas
- [ ] Cargos visíveis por tenant apenas
- [ ] Users podem ser associados a um cargo

---

### Story 27.3: Trail Builder UI

**SP:** 8 | **Priority:** P0

**Descrição:** Interface drag-and-drop para instructor montar trilha de aprendizado com cursos ordenados.

**Tasks:**

- [ ] Criar page `apps/web/src/app/(platform)/trails/new/page.tsx`
- [ ] Step 1: Título, descrição, cargo alvo (select de job_roles), obrigatória (toggle)
- [ ] Step 2: Selecionar cursos — lista de cursos do tenant com search/filter. Drag-and-drop para ordenar
- [ ] Para cada curso na trilha: marcar se obrigatório, definir horas estimadas
- [ ] Preview: visualizar trilha como sequência de cards
- [ ] Criar page `apps/web/src/app/(platform)/trails/page.tsx` — listagem de trilhas
- [ ] Criar page `apps/web/src/app/(platform)/trails/[trailId]/page.tsx` — detalhe com cursos
- [ ] Server actions: `createTrail()`, `updateTrail()`, `addCourseToTrail()`, `reorderTrailCourses()`
- [ ] Validadores Zod
- [ ] Navigation entry: "Trilhas" para instructor/admin/manager

**Acceptance Criteria:**

- [ ] Instructor monta trilha com cursos arrastáveis
- [ ] Ordem dos cursos definida e persistida
- [ ] Preview mostra trilha visualmente
- [ ] Trilha associada a um cargo (opcional)

---

### Story 27.4: Trail Enrollment & Progress

**SP:** 5 | **Priority:** P0

**Descrição:** Auto-enroll alunos em trilha quando trail fica active. Track progresso cross-cursos.

**Tasks:**

- [ ] Quando trail status muda para `active`: buscar users com o job_role alvo → criar enrollments para cada curso da trail
- [ ] Server action `activateTrail(trailId)` — batch enroll
- [ ] Enrollment com `trail_id` e `trail_course_order` para track sequência
- [ ] Componente `TrailProgress` no dashboard do aluno: barra de progresso com cursos completed/in_progress/pending
- [ ] Lógica de "próximo curso": quando aluno completa curso N, destacar curso N+1
- [ ] Notificação simples (badge ou banner): "Próximo curso disponível na sua trilha"
- [ ] Student view: `/trails` mostra minhas trilhas com progresso

**Acceptance Criteria:**

- [ ] Activar trail cria enrollments automaticamente
- [ ] Aluno vê progresso da trilha no dashboard
- [ ] Próximo curso destacado após conclusão
- [ ] Novo aluno no cargo recebe enrollments na trilha

---

### Story 27.5: Trail Dashboard (Manager)

**SP:** 5 | **Priority:** P1

**Descrição:** Dashboard para manager ver progresso da equipe por trilha e cargo.

**Tasks:**

- [ ] Criar page `apps/web/src/app/(platform)/trails/dashboard/page.tsx`
- [ ] Card: Visão por trilha — % conclusão média, # alunos, # completaram
- [ ] Card: Visão por cargo — quais cargos têm trilhas, quais não
- [ ] Tabela: Alunos por trilha — nome, cargo, % progresso, último acesso, status
- [ ] Filtros: por área, por trilha, por cargo
- [ ] Export CSV (opcional — nice-to-have)
- [ ] Server action `getTrailDashboardData(tenantId, filters)`

**Acceptance Criteria:**

- [ ] Manager vê progresso real por trilha e cargo
- [ ] Filtros funcionam correctamente
- [ ] Dados filtrados por tenant (RLS)
- [ ] Identifica quem está atrasado

---

### Story 27.6: Trail Recommendation Engine

**SP:** 3 | **Priority:** P2

**Descrição:** IA sugere trilhas relevantes baseado no cargo e área do aluno.

**Tasks:**

- [ ] Função `suggestTrails(userId)` — busca cargo do user → trilhas do cargo → ordena por relevância
- [ ] Se aluno não tem cargo definido: sugerir trilhas populares do tenant
- [ ] Se aluno já completou trilha do cargo: sugerir trilhas de cargos adjacentes (ex: junior → mid)
- [ ] Componente `TrailSuggestions` no dashboard do aluno
- [ ] Integração futura com learner_profile (Epic 29) para refinar sugestões

**Acceptance Criteria:**

- [ ] Aluno vê sugestões de trilhas no dashboard
- [ ] Sugestões baseadas no cargo real
- [ ] Sugestões são actionable (botão "Inscrever-me")

---

## Dependencies

| Dependency | Type | Status |
|-----------|------|--------|
| Epic 25 (Instructor role) | Interna | Pendente |
| Courses CRUD | Interna | Implementado |
| Enrollments system | Interna | Implementado |
| Areas/Departments | Interna | Implementado |

## Risks

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Drag-and-drop complexo de implementar | Médio | Usar library como `@dnd-kit/sortable`. Fallback: lista com setas |
| Auto-enroll em massa pode ser lento | Baixo | Batch insert com transaction. Limitar a 500 users por vez |
| Trilha com cursos em draft | Médio | Validar: trail só pode activar se todos os cursos required estão published |

---

*Epic 27 — WS3 Learning Trails & Job Roles v1.0*
