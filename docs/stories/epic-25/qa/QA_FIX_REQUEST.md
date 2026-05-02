# QA Fix Request: Epic 25 — Instructor Role & RBAC

**Generated:** 2026-02-28T18:00:00Z
**QA Review Source:** Stories 25.1-25.5 QA Results sections
**Reviewer:** Quinn (Test Architect)

---

## Instructions for @dev

Fix ONLY the issues listed below. Do not add features or refactor unrelated code.

**Process:**

1. Read each issue carefully
2. Fix the specific problem described
3. Verify using the verification steps provided
4. Mark the issue as fixed in this document
5. Run all tests before marking complete

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| HIGH | 3 | Must fix before merge |
| MEDIUM | 7 | Should fix / backlog |
| LOW | 4 | Optional / tech debt |

**Scope:** Fix the 3 HIGH issues. MEDIUM issues documentados como tech debt para backlog.

---

## Issues to Fix

### 1. [HIGH] Cache key sem tenant isolation

**Issue ID:** FIX-25.2-01

**Location:** `apps/web/src/lib/api-auth/instructor-permissions.ts:23-24,36`

**Problem:**

```typescript
// Line 23-24: Cache key sem tenant_id
async function getInstructorPermissions(userId: string): Promise<InstructorPermissions | null> {
  const cacheKey = `ip:${userId}`

// Line 36: Query sem filtro tenant_id
  .eq("user_id", userId)
  .single()
```

A funcao `getInstructorPermissions` nao aceita `tenantId` como parametro. O cache key usa apenas `userId` e a query filtra apenas por `user_id`. Com a constraint `UNIQUE(user_id, tenant_id)`, se um user tiver permissoes em multiplos tenants, `.single()` retorna erro PGRST116 ou dados do tenant errado.

**Expected:**

```typescript
async function getInstructorPermissions(
  userId: string,
  tenantId: string,
): Promise<InstructorPermissions | null> {
  const cacheKey = `ip:${userId}:${tenantId}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expiry > Date.now()) {
    return cached.data
  }

  const supabase = createServiceClient()
  const { data } = await supabase
    .from("instructor_permissions")
    .select(
      "can_create_courses, can_create_quizzes, can_manage_trails, can_view_analytics, can_manage_enrollments, assigned_area_ids",
    )
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .single()
  // ... rest unchanged
```

Tambem atualizar as funcoes exportadas `checkInstructorPermission` e `getInstructorAreaIds` para aceitar `tenantId`:

```typescript
export async function checkInstructorPermission(
  userId: string,
  tenantId: string,
  permission: InstructorPermissionKey,
): Promise<boolean> {
  const permissions = await getInstructorPermissions(userId, tenantId)
  if (!permissions) return false
  return permissions[permission]
}

export async function getInstructorAreaIds(
  userId: string,
  tenantId: string,
): Promise<string[]> {
  const permissions = await getInstructorPermissions(userId, tenantId)
  return permissions?.assigned_area_ids ?? []
}
```

**Verification:**

- [x] `getInstructorPermissions` aceita `tenantId` como segundo parametro
- [x] Cache key inclui tenant_id: `ip:${userId}:${tenantId}`
- [x] Query filtra por `.eq("user_id", userId).eq("tenant_id", tenantId)`
- [x] `checkInstructorPermission` e `getInstructorAreaIds` aceitam `tenantId`
- [x] Todos os call sites atualizados para passar `tenantId`
- [x] Unit tests atualizados em `instructor-permissions.test.ts`
- [x] `pnpm typecheck` passa

**Status:** [x] Fixed

---

### 2. [HIGH] InstructorPermissionsForm nao carrega dados iniciais

**Issue ID:** FIX-25.3-01

**Location:** `apps/web/src/components/admin/user-list.tsx:250-254`

**Problem:**

```tsx
// Line 250-254: Form renderizado sem initialPermissions
<InstructorPermissionsForm
  userId={user.id}
  onSaved={() => setExpandedInstructorId(null)}
  onError={setActionError}
/>
```

O componente `InstructorPermissionsForm` aceita a prop `initialPermissions` mas esta nunca e passada pelo `UserList`. Resultado: ao expandir as permissoes de um instructor existente, o form mostra valores default (can_create_courses=true, etc.) em vez dos valores reais salvos no banco.

**Expected:**

Fetch as permissoes do instructor ao expandir e passar como `initialPermissions`:

```tsx
// Opcao A (mais simples): Fetch no parent via useEffect
const [instructorPerms, setInstructorPerms] = useState<Record<string, unknown> | null>(null)

useEffect(() => {
  if (!expandedInstructorId) return
  fetch(`/api/admin/users/${expandedInstructorId}/instructor-permissions`)
    .then((res) => res.json())
    .then((json) => setInstructorPerms(json.data))
    .catch(() => setInstructorPerms(null))
}, [expandedInstructorId])

// No render:
{isExpanded && user.role === "instructor" && (
  <TableRow>
    <TableCell colSpan={6} className="bg-bg-surface/50 p-4">
      <InstructorPermissionsForm
        userId={user.id}
        initialPermissions={instructorPerms ?? undefined}
        onSaved={() => setExpandedInstructorId(null)}
        onError={setActionError}
      />
    </TableCell>
  </TableRow>
)}
```

**Verification:**

- [x] Ao expandir permissoes de instructor existente, form mostra valores salvos (nao defaults)
- [x] Ao expandir instructor sem permissions row, form mostra defaults correctamente
- [x] Loading state enquanto fetch esta em progresso
- [x] `pnpm typecheck` passa

**Status:** [x] Fixed

---

### 3. [HIGH] assigned_area_ids sempre envia array vazio ao salvar

**Issue ID:** FIX-25.3-02

**Location:** `apps/web/src/components/admin/instructor-permissions-form.tsx:63-66`

**Problem:**

```typescript
// Line 63-66: assigned_area_ids usa initialPermissions que nunca e passado
body: JSON.stringify({
  ...permissions,
  assigned_area_ids: initialPermissions?.assigned_area_ids ?? [],
}),
```

Como `initialPermissions` nunca e passado (Issue FIX-25.3-01), `assigned_area_ids` sera sempre `[]`. Ao salvar permissoes, qualquer area assignment existente e sobrescrita com array vazio.

**Expected:**

Apos corrigir FIX-25.3-01 (passar `initialPermissions`), este problema resolve-se automaticamente. Adicionalmente, integrar o `AreaAssignment` component no form para que areas possam ser editadas:

```tsx
// Dentro de InstructorPermissionsForm, adicionar state para areas
const [areaIds, setAreaIds] = useState<string[]>(
  initialPermissions?.assigned_area_ids ?? []
)

// No handleSave:
body: JSON.stringify({
  ...permissions,
  assigned_area_ids: areaIds,
}),

// No render, apos os checkboxes:
<AreaAssignment
  userId={userId}
  selectedAreaIds={areaIds}
  onChange={setAreaIds}
/>
```

**Verification:**

- [x] `assigned_area_ids` envia valores reais (nao `[]`) ao salvar
- [x] AreaAssignment component renderizado dentro do form
- [x] Areas selecionadas persistem apos salvar e reabrir
- [x] `pnpm typecheck` passa

**Status:** [x] Fixed

---

## Tech Debt (MEDIUM — Backlog)

Estes issues nao bloqueiam merge mas devem ser enderecados em futuras stories:

| ID | Story | Description | Recommendation |
|----|-------|-------------|----------------|
| TD-25.1-02 | 25.1 | `courses_update` RLS permite instructor editar cursos de outros | Restringir a `created_by = auth.uid()` para instructor |
| TD-25.2-03 | 25.2 | Permissoes granulares nao enforced em course actions | Chamar `checkInstructorPermission` em `createCourse`, `updateCourse` |
| TD-25.2-04 | 25.2 | Instructor nao recebe auto-assign de `area_id` ao criar curso | Adicionar logica similar ao manager em `createCourse` |
| BUG-25.3-02 | 25.3 | AreaAssignment nao integrado no form (resolvido parcialmente por FIX-25.3-02) | Confirmar integracao apos fix |
| TD-25.3-01 | 25.3 | Role change para instructor nao cria permissions row automaticamente | Adicionar auto-create na API PATCH de user role |
| TD-25.4-01 | 25.4 | N+1 queries para enrollment count (20 cursos = 20 queries extras) | Aggregate query: `SELECT course_id, COUNT(*) GROUP BY course_id` |
| TD-25.4-03 | 25.4 | Sem areas atribuidas, dashboard mostra todos students do tenant | Documentar como fallback behavior ou restringir |

---

## Constraints

**CRITICAL: @dev must follow these constraints:**

- [x] Fix ONLY the 3 HIGH issues listed above
- [x] Do NOT add new features
- [x] Do NOT refactor unrelated code
- [x] Run all tests before marking complete: `pnpm test` — 267 passed, 0 failures
- [x] Run linting before marking complete: `pnpm lint` — modified files formatted with biome
- [x] Run type check before marking complete: `pnpm typecheck` — 6/6 packages passed
- [x] Update story file lists if any new files created
- [x] Update unit tests for changed function signatures

---

## After Fixing

1. Mark each issue as fixed in this document
2. Update Stories 25.2 and 25.3 Dev Agent Record with fix summary
3. Request QA re-review: `@qa *review epic-25`

---

_Generated by Quinn (Test Architect) - AIOS QA System_
