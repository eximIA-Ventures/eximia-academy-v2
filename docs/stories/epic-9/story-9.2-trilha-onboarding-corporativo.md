# Story 9.2: Trilha de Onboarding Corporativo

**Epic:** [Epic 9 — Onboarding Inteligente & Personalização Adaptativa](../../epics/epic-9-onboarding-inteligente-personalizacao.md)
**Version:** 1.0
**Created:** 2026-02-08
**Author:** River (Scrum Master)
**Status:** Draft
**Story Points:** 5
**Priority:** P0 (Blocker — Story 9.1 depende disso para auto-enrollment)
**Blocked By:** —
**Blocks:** Story 9.1
**Assigned To:** @dev (Dex)

---

## User Story

**As a** manager/teacher,
**I want** criar uma trilha marcada como "onboarding corporativo",
**so that** novos colaboradores sejam automaticamente direcionados ao conteúdo de boas-vindas da empresa.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/project-decisions/ADR-001-student-self-enroll-rls.md` (enrollment RLS), `supabase/migrations/20260207000000_initial_schema.sql` (courses table) |
| **Epic Ref** | `docs/epics/epic-9-onboarding-inteligente-personalizacao.md` v1.2 — Story 9.2 |
| **PRD Ref** | `docs/prd.md` — FR20 (extensão) |
| **Design Tokens** | `Benchmarks/Design/design-tokens.json` v1.2.1 |
| **Stack** | Next.js 15 (App Router) + Supabase + Drizzle ORM + Tailwind CSS 4 + shadcn/ui |
| **DB Tables** | `courses` (novo campo `type`), `enrollments` (auto-enroll via Story 9.1) |
| **Mutation** | Server Action `createCourse()` / `updateCourse()` — padrão Epic 2 |
| **CRITICAL** | Migration ADD COLUMN com default — backward compatible, nenhum curso existente quebra |
| **SECURITY** | Zod validation MUST incluir campo `type`. RLS policies existentes NÃO são afetadas |

---

## Acceptance Criteria

- [ ] **AC1:** Novo campo `type` na tabela `courses`: `'regular' | 'onboarding'` (default: 'regular')

- [ ] **AC2:** No fluxo de criação de curso (teacher/manager), opção para selecionar tipo "Onboarding Corporativo"

- [ ] **AC3:** Máximo 1 trilha ativa do tipo 'onboarding' por tenant (validação server-side + unique partial index)

- [ ] **AC4:** Se já existe trilha onboarding publicada e manager tenta publicar outra → mensagem informativa: "Já existe uma trilha de onboarding ativa: {titulo}. Deseja substituir?" Se sim, a trilha anterior volta para `type = 'regular'` e a nova assume `type = 'onboarding'` (swap atômico)

- [ ] **AC5:** Trilha onboarding aparece com badge/tag distinto na listagem de cursos (visível para teacher/manager)

- [ ] **AC6:** Aluno vê a trilha onboarding como qualquer outra trilha na listagem (sem tratamento especial na UI do aluno, exceto auto-enrollment via Story 9.1)

- [ ] **AC7:** Migration SQL adiciona coluna `type` com default 'regular' (backward compatible)

- [ ] **AC8:** RLS policies existentes continuam funcionando (campo `type` não afeta isolation)

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.
> To enable, set `coderabbit_integration.enabled: true` in core-config.yaml

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1, 7) Criar migration para campo `type` na tabela `courses`
  - [ ] Criar `supabase/migrations/20260209000000_epic9_courses_type.sql`
  - [ ] `ALTER TABLE courses ADD COLUMN type TEXT NOT NULL DEFAULT 'regular' CHECK (type IN ('regular', 'onboarding'));`
  - [ ] `CREATE UNIQUE INDEX courses_unique_onboarding_per_tenant ON courses (tenant_id) WHERE type = 'onboarding' AND status = 'published';`
  - [ ] Verificar: todos os cursos existentes recebem `type = 'regular'` automaticamente (migration default)
  - [ ] Verificar: migration é reversível (`DROP INDEX` + `ALTER TABLE DROP COLUMN`)

- [ ] **Task 2** (AC: 8) Verificar que RLS policies existentes continuam funcionando
  - [ ] Rodar test queries: criar curso, listar cursos, enrollment — tudo deve funcionar como antes
  - [ ] Campo `type` não aparece em nenhuma RLS policy condition (não afeta isolation)
  - [ ] Test: cross-tenant access bloqueado (integridade RLS mantida)

- [ ] **Task 3** (AC: 2) Atualizar formulário de criação/edição de curso com campo `type`
  - [ ] Atualizar `apps/web/src/app/(platform)/courses/_components/course-form-dialog.tsx`
  - [ ] Adicionar campo Select/Radio para `type`: "Regular" (default) | "Onboarding Corporativo"
  - [ ] Usar componente `Select` de `@eximia/ui` (padrão existente no formulário)
  - [ ] Campo visível apenas para roles teacher/manager/admin
  - [ ] Default: 'regular'

- [ ] **Task 4** (AC: 2) Atualizar Zod schema e Server Actions de cursos
  - [ ] Atualizar `createCourseSchema` em `packages/shared/src/validators/courses` — adicionar campo `type: z.enum(['regular', 'onboarding']).default('regular')`
  - [ ] Atualizar `createCourse()` em `apps/web/src/app/(platform)/courses/actions.ts` — incluir `type` no INSERT
  - [ ] Atualizar `updateCourse()` para permitir editar `type`

- [ ] **Task 5** (AC: 3, 4) Implementar validação de unicidade de trilha onboarding
  - [ ] No Server Action `publishCourse()`: antes de publicar curso tipo 'onboarding', verificar se já existe outro publicado no tenant
  - [ ] Query: `supabase.from('courses').select('id, title').eq('tenant_id', tenantId).eq('type', 'onboarding').eq('status', 'published').single()`
  - [ ] Se existe: retornar `{ conflict: true, existingTitle: data.title, existingId: data.id }` para UI mostrar confirmação
  - [ ] Se confirmado swap: transação atômica — old course: `type = 'regular'`, new course: `type = 'onboarding'` + `status = 'published'`
  - [ ] Se não confirmado: abortar publicação
  - [ ] Na UI (`course-form-dialog.tsx` ou `publish` action): mostrar modal de confirmação com mensagem do AC4

- [ ] **Task 6** (AC: 5) Adicionar badge "Onboarding" na listagem de cursos (teacher/manager view)
  - [ ] Em `apps/web/src/app/(platform)/courses/_components/` (componente de listagem)
  - [ ] Usar componente `Badge` de `@eximia/ui` com variant adequado
  - [ ] Condicional: `{course.type === 'onboarding' && <Badge variant="secondary">Onboarding</Badge>}`
  - [ ] Badge visível apenas para teacher/manager/admin (AC6: aluno não vê badge especial)

- [ ] **Task 7** (AC: 6) Garantir que aluno vê trilha onboarding como qualquer outra
  - [ ] Verificar que a listagem de cursos do aluno NÃO filtra por `type`
  - [ ] Verificar que NÃO há badge especial na view do aluno
  - [ ] O aluno será auto-inscrito via Story 9.1 (não precisa de tratamento especial aqui)

- [ ] **Task 8** Testes
  - [ ] Test: Migration aplica corretamente (cursos existentes = 'regular')
  - [ ] Test: Criar curso com `type = 'regular'` funciona (default)
  - [ ] Test: Criar curso com `type = 'onboarding'` funciona
  - [ ] Test: Publicar 2 cursos onboarding no mesmo tenant → constraint impede OU swap funciona
  - [ ] Test: Swap atômico: old → 'regular', new → 'onboarding'
  - [ ] Test: Badge "Onboarding" aparece para teacher/manager
  - [ ] Test: Badge NÃO aparece para student
  - [ ] Test: Zod rejeita `type` inválido
  - [ ] Test: RLS integridade mantida (cross-tenant bloqueado)
  - [ ] Test: `enrollments_student_self_enroll` funciona com cursos tipo 'onboarding' (published)

---

## Dev Notes

### Migration SQL [Source: epic-9 v1.2, Story 9.2 Technical Notes]

```sql
-- Migration: Add type column to courses table
-- Backward compatible: all existing courses get 'regular' by default

ALTER TABLE courses ADD COLUMN type TEXT NOT NULL DEFAULT 'regular'
  CHECK (type IN ('regular', 'onboarding'));

-- Unique partial index: max 1 active onboarding per tenant
-- Only applies to published courses (draft/archived can have multiple)
CREATE UNIQUE INDEX courses_unique_onboarding_per_tenant
  ON courses (tenant_id)
  WHERE type = 'onboarding' AND status = 'published';
```

### Existing Course Schema [Source: supabase/migrations/20260207000000_initial_schema.sql]

```sql
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('university', 'corporate')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Course Form Dialog — Current Pattern [Source: apps/web/src/app/(platform)/courses/_components/course-form-dialog.tsx]

```typescript
// Existing form uses: FormField, Input, Textarea, Select from @eximia/ui
// Pattern to follow — add new FormField for type:
<FormField label="Tipo" htmlFor="type" required>
  <Select id="type" name="type" defaultValue="regular">
    <option value="regular">Regular</option>
    <option value="onboarding">Onboarding Corporativo</option>
  </Select>
</FormField>
```

### Course Actions — Existing Pattern [Source: apps/web/src/app/(platform)/courses/actions.ts]

```typescript
// createCourse() — extend with type field
// Uses createCourseSchema from @eximia/shared
// Insert: supabase.from('courses').insert({ ...fields, type })

// publishCourse() — add swap logic before publishing
// If type === 'onboarding', check for existing published onboarding course
```

### Swap Logic (AC4) [Source: epic-9 v1.2, M-4 fix]

```typescript
// Atomic swap when publishing new onboarding course
async function swapOnboardingCourse(tenantId: string, newCourseId: string) {
  // 1. Find existing onboarding course
  const { data: existing } = await supabase
    .from('courses')
    .select('id, title')
    .eq('tenant_id', tenantId)
    .eq('type', 'onboarding')
    .eq('status', 'published')
    .single()

  if (existing) {
    // 2. Demote existing: type → 'regular'
    await supabase
      .from('courses')
      .update({ type: 'regular' })
      .eq('id', existing.id)

    // 3. Promote new: type → 'onboarding', status → 'published'
    await supabase
      .from('courses')
      .update({ type: 'onboarding', status: 'published' })
      .eq('id', newCourseId)
  }
}
```

### RLS Enrollment Policy [Source: ADR-001-student-self-enroll-rls.md]

```sql
-- Student self-enrollment: allows INSERT where course is published
-- Type 'onboarding' courses with status 'published' ARE eligible for enrollment
-- No change needed to this policy
CREATE POLICY enrollments_student_self_enroll ON enrollments FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND student_id = auth.uid()
    AND auth_user_role() = 'student'
    AND course_id IN (
      SELECT id FROM courses
      WHERE tenant_id = auth_tenant_id()
      AND status = 'published'
    )
  );
```

### Auto-Enrollment Query (for Story 9.1) [Source: epic-9 v1.2]

```typescript
// Story 9.1 will use this query to find the onboarding course
const { data: onboardingCourse } = await supabase
  .from('courses')
  .select('id')
  .eq('tenant_id', tenantId)
  .eq('type', 'onboarding')
  .eq('status', 'published')
  .single()
```

### Badge Component [Source: docs/design-system-guide.md]

```typescript
import { Badge } from "@eximia/ui"

// Use secondary variant for onboarding badge
<Badge variant="secondary">Onboarding</Badge>
```

### File Locations

```
supabase/migrations/
└── 20260209000000_epic9_courses_type.sql          # NEW: Migration

apps/web/src/app/(platform)/courses/
├── actions.ts                                       # UPDATED: createCourse, publishCourse
└── _components/
    └── course-form-dialog.tsx                       # UPDATED: Add type field

packages/shared/src/validators/
└── courses.ts                                       # UPDATED: Add type to schema
```

### Testing

- **Test location:** `apps/web/tests/` and component `__tests__/`
- **Framework:** Vitest + Testing Library
- **Mock pattern:** Mock Supabase client for RLS/enrollment tests
- **Key concern:** Unique partial index behavior, swap atomicity, backward compatibility

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` passam. Migration é reversível. Campo `type` tem default. | Yes |
| Pre-PR | Criar trilha onboarding funciona. Constraint de unicidade impede duplicatas. Trilhas existentes mantêm `type = 'regular'`. CRUD existente não quebra. Badge aparece para teacher/manager. Badge NÃO aparece para student. | Yes |

---

## Definition of Done

- [ ] Migration aplica corretamente, cursos existentes recebem `type = 'regular'`
- [ ] Formulário de criação de curso tem opção "Onboarding Corporativo"
- [ ] Constraint de unicidade: max 1 onboarding publicado por tenant
- [ ] Swap funciona: confirmar substituição quando já existe trilha onboarding
- [ ] Badge "Onboarding" visível para teacher/manager/admin
- [ ] Aluno não vê badge especial
- [ ] RLS policies inalteradas — nenhum cross-tenant access
- [ ] Zod validation inclui campo `type`
- [ ] Testes passam
- [ ] `pnpm lint && pnpm typecheck` passam

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Migration, CRUD update, badge UI, validação de unicidade, swap logic |
| **@qa (Quinn)** | Validação: constraint unicidade, backward compat, badge rendering, RLS integridade |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Migration quebra cursos existentes | HIGH | ADD COLUMN com DEFAULT 'regular' — todos os cursos existentes ganham type automaticamente. Migration reversível. |
| Unique partial index causa erro inesperado | MEDIUM | Index só aplica para `type = 'onboarding' AND status = 'published'`. Drafts e archived não são afetados. |
| Swap não-atômico causa estado inconsistente | MEDIUM | Executar swap em sequência (update old → update new). Se falhar no meio, partial index protege contra 2 onboardings publicados. |
| Badge confunde aluno | LOW | Badge visível apenas para teacher/manager/admin views. |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-08 | 1.0 | Story created from Epic 9 v1.2 | River (SM) |

---

*Story criada por River (Scrum Master) — exímIA Academy*
