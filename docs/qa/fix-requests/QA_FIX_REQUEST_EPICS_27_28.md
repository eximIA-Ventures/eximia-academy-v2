# QA Fix Request: Epics 27 & 28

**Generated:** 2026-02-28T21:00:00Z
**QA Review Source:** In-session review (3 parallel subagents: DB, Security, UI)
**Reviewer:** Quinn (Test Architect & Quality Advisor)
**Branch:** `feat/ws2-epic20-foundation`
**Commit:** `be9e58b`

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
| CRITICAL | 4 | Must fix before merge |
| MAJOR | 8 | Should fix before merge |
| MINOR | 0 | Not included |

---

## Issues to Fix

### 1. [CRITICAL] `suggestTrails` aceita userId arbitrario sem autenticacao

**Issue ID:** FIX-E27-001

**Location:** `apps/web/src/lib/trails/recommendations.ts`

**Problem:**
A funcao `suggestTrails(userId)` aceita qualquer userId sem verificar se o chamador tem sessao autenticada ou se e o proprio usuario. Isso permite que qualquer chamador obtenha recomendacoes de qualquer usuario, vazando informacoes sobre trilhas, cargos e progresso.

**Expected:**
Adicionar verificacao de autenticacao antes de processar. A funcao deve:
1. Verificar sessao via `createClient()` + `getUser()`
2. Validar que o `userId` do parametro corresponde ao usuario autenticado (ou que o chamador e admin)
3. Rejeitar com erro se nao autenticado

```typescript
export async function suggestTrails(userId: string): Promise<TrailSuggestion[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Nao autenticado")
  if (user.id !== userId) {
    // Verificar se e admin
    const { data: profile } = await supabase
      .from("users").select("role").eq("id", user.id).single()
    if (!profile || !["admin", "super_admin"].includes(profile.role)) {
      throw new Error("Acesso negado")
    }
  }
  // ... restante da logica
}
```

**Verification:**

- [ ] Chamada sem sessao retorna erro
- [ ] Chamada com userId diferente do autenticado (sem ser admin) retorna erro
- [ ] Chamada com userId do proprio usuario funciona
- [ ] Chamada com admin para outro userId funciona
- [ ] `npm run typecheck` passa

**Status:** [ ] Fixed

---

### 2. [CRITICAL] Seed `plan_features` sem idempotencia (ON CONFLICT)

**Issue ID:** FIX-E28-001

**Location:** `supabase/migrations/20260229100000_plan_features.sql`

**Problem:**
O INSERT que popula as 21 linhas iniciais de `plan_features` nao tem clausula `ON CONFLICT DO NOTHING`. Se a migration for re-executada (comum em ambientes de dev/staging), ela falha com erro de duplicata na constraint UNIQUE.

**Expected:**
Adicionar `ON CONFLICT DO NOTHING` ao final do bloco INSERT:

```sql
INSERT INTO plan_features (plan, feature_key, is_enabled, quota)
VALUES
  ('essencial', 'courses', true, 10),
  -- ... demais linhas ...
  ('premium', 'api_access', true, NULL)
ON CONFLICT (plan, feature_key) DO NOTHING;
```

**Verification:**

- [ ] Migration roda sem erro na primeira vez
- [ ] Migration roda sem erro na segunda vez (idempotente)
- [ ] Dados existentes nao sao sobrescritos
- [ ] `supabase db reset` completa sem erros

**Status:** [ ] Fixed

---

### 3. [CRITICAL] Mensagens de erro raw do Supabase expostas ao cliente

**Issue ID:** FIX-E28-002

**Location:** `apps/web/src/app/(platform)/admin/plans/actions.ts` (linhas 116, 174, 232, 274)

**Problem:**
As server actions retornam `error.message` do Supabase diretamente ao cliente. Isso pode vazar detalhes internos como nomes de tabelas, constraints, e estrutura do schema.

Exemplo atual:
```typescript
if (error) return { error: `Erro ao carregar plan_features: ${error.message}` }
```

**Expected:**
Substituir por mensagens genericas, logando o erro real server-side:

```typescript
if (error) {
  console.error("[listPlanFeatures]", error)
  return { error: "Erro ao carregar configuracoes de plano" }
}
```

Aplicar em TODAS as 4 ocorrencias:
- Linha ~116: `listPlanFeatures`
- Linha ~174: `updatePlanFeature`
- Linha ~232: `getMyPlanFeatures`
- Linha ~274: `getFeatureUsageStats`

**Verification:**

- [ ] Nenhum `error.message` do Supabase aparece em retornos de server actions
- [ ] Erros sao logados com `console.error` no servidor
- [ ] Mensagens ao cliente sao genericas e em portugues
- [ ] `npm run typecheck` passa

**Status:** [ ] Fixed

---

### 4. [CRITICAL] Elementos HTML raw violando Design System (@eximia/ui)

**Issue ID:** FIX-UI-001

**Location:** Multiplos arquivos

**Problem:**
CLAUDE.md e regras do projeto exigem que TODO elemento UI use componentes de `@eximia/ui`. Os seguintes arquivos usam HTML raw:

| Arquivo | Elemento raw | Componente correto |
|---------|--------------|-------------------|
| `admin/plans/plans-client.tsx` | `<table>`, `<thead>`, `<tr>`, `<th>`, `<td>` | Importar `Table` de `@eximia/ui` (ou usar estrutura com div + grid se Table nao disponivel) |
| `admin/plans/plans-client.tsx` | `<select>` | `Select` de `@eximia/ui` |
| `admin/plans/plans-client.tsx` | `<input type="checkbox">` | `Toggle` de `@eximia/ui` |
| `admin/job-roles/job-roles-client.tsx` | `<select>` | `Select` de `@eximia/ui` |
| `admin/job-roles/job-roles-client.tsx` | `<textarea>` | `Textarea` de `@eximia/ui` |
| `trails/new/trail-builder-client.tsx` | `<select>` | `Select` de `@eximia/ui` |
| `trails/new/trail-builder-client.tsx` | `<textarea>` | `Textarea` de `@eximia/ui` |
| `trails/new/trail-builder-client.tsx` | `<input type="checkbox">` | `Toggle` de `@eximia/ui` |
| `trails/[trailId]/trail-detail-client.tsx` | `<select>` | `Select` de `@eximia/ui` |

**Expected:**
Substituir cada elemento raw pelo componente equivalente de `@eximia/ui`:

```typescript
import { Select, Textarea, Toggle, Table } from "@eximia/ui"

// Antes:
<select value={x} onChange={...}>
  <option value="a">A</option>
</select>

// Depois:
<Select value={x} onValueChange={...}>
  <SelectTrigger><SelectValue /></SelectTrigger>
  <SelectContent>
    <SelectItem value="a">A</SelectItem>
  </SelectContent>
</Select>
```

**Verification:**

- [ ] `grep -r '<select' apps/web/src/app/\(platform\)/` retorna 0 resultados
- [ ] `grep -r '<textarea' apps/web/src/app/\(platform\)/` retorna 0 resultados
- [ ] `grep -r '<table' apps/web/src/app/\(platform\)/` retorna 0 resultados (ou somente em componentes wrapper)
- [ ] `grep -r 'type="checkbox"' apps/web/src/app/\(platform\)/` retorna 0 resultados
- [ ] UI visual mantem o mesmo comportamento
- [ ] `npm run typecheck` passa
- [ ] `npm run lint` passa

**Status:** [ ] Fixed

---

### 5. [MAJOR] UUID de parametros nao validado em server actions

**Issue ID:** FIX-E27-002

**Location:** `apps/web/src/app/(platform)/trails/actions.ts` (6+ funcoes)

**Problem:**
Funcoes como `getTrailDetail(trailId)`, `updateTrail(trailId, ...)`, `addCourseToTrail(trailId, courseId)`, `removeCourseFromTrail(trailId, courseId)`, `selfEnrollInTrail(trailId)`, `updateTrailStatus(trailId, ...)` recebem IDs como `string` sem validar formato UUID. Um input malformado pode causar queries desnecessarias ou erros inesperados.

**Expected:**
Adicionar validacao UUID no inicio de cada funcao:

```typescript
import { z } from "zod"
const uuidSchema = z.string().uuid()

export async function getTrailDetail(trailId: string) {
  const parsed = uuidSchema.safeParse(trailId)
  if (!parsed.success) return { error: "ID invalido" }
  // ... restante
}
```

Aplicar em: `getTrailDetail`, `updateTrail`, `updateTrailStatus`, `addCourseToTrail`, `removeCourseFromTrail`, `selfEnrollInTrail`

**Verification:**

- [ ] Cada funcao rejeita IDs nao-UUID com mensagem clara
- [ ] IDs validos continuam funcionando normalmente
- [ ] `npm run typecheck` passa

**Status:** [ ] Fixed

---

### 6. [MAJOR] FK `created_by` sem ON DELETE CASCADE/SET NULL

**Issue ID:** FIX-E27-003

**Location:** `supabase/migrations/20260229000000_trails_job_roles.sql`

**Problem:**
As FKs `created_by REFERENCES users(id)` nas tabelas `job_roles`, `learning_trails` e `trail_courses` nao especificam comportamento ON DELETE. Se um usuario for deletado, a FK bloqueara a operacao com erro.

**Expected:**
Adicionar `ON DELETE SET NULL` e tornar a coluna nullable, ou `ON DELETE CASCADE` se registros devem ser removidos junto:

```sql
-- Opcao recomendada: SET NULL (preserva o registro, perde autoria)
ALTER TABLE job_roles ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE job_roles
  DROP CONSTRAINT job_roles_created_by_fkey,
  ADD CONSTRAINT job_roles_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
```

Aplicar para: `job_roles`, `learning_trails`, `trail_courses`

**Verification:**

- [ ] Deletar usuario nao causa erro de FK
- [ ] Registros criados pelo usuario permanecem (com created_by = NULL)
- [ ] `supabase db reset` completa sem erros
- [ ] Drizzle schemas atualizados para refletir nullable

**Status:** [ ] Fixed

---

### 7. [MAJOR] `plan_features` sem RLS SELECT para role student

**Issue ID:** FIX-E28-003

**Location:** `supabase/migrations/20260229100000_plan_features.sql`

**Problem:**
A tabela `plan_features` tem RLS habilitado mas nenhuma policy de SELECT para students. O componente `<FeatureGate>` e o hook `useFeatureAccess` precisam ler plan_features para verificar se uma feature esta habilitada para o plano do tenant. Sem policy de leitura, o `feature-gate.ts` falha silenciosamente (usa `createServiceClient` que bypassa RLS, mas se alguem acessar via client normal, retorna vazio).

**Expected:**
Adicionar policy de leitura para qualquer usuario autenticado do mesmo tenant:

```sql
CREATE POLICY "Authenticated users can read plan features"
  ON plan_features FOR SELECT
  TO authenticated
  USING (true);
```

Nota: `plan_features` e uma lookup table publica (planos e features sao informacao de produto, nao dados sensiveis). SELECT aberto para authenticated e adequado.

**Verification:**

- [ ] Query `select * from plan_features` funciona para role student
- [ ] Query funciona para role admin
- [ ] Nenhuma outra operacao (INSERT/UPDATE/DELETE) e permitida para student
- [ ] `supabase db reset` completa sem erros

**Status:** [ ] Fixed

---

### 8. [MAJOR] Cores hardcoded nos componentes (violacao de theme tokens)

**Issue ID:** FIX-UI-002

**Location:** `admin/plans/plans-client.tsx`, `trails/dashboard/trail-dashboard-client.tsx`

**Problem:**
Cores hexadecimais hardcoded como `#22c55e`, `#ef4444`, `#f59e0b`, `#3b82f6`, `bg-green-100`, `text-green-800`, `bg-red-100`, `text-red-800` violam a regra de usar somente tokens de tema.

**Expected:**
Substituir por tokens semanticos do theme:

| Hardcoded | Token correto |
|-----------|---------------|
| `text-green-600`, `bg-green-100` | `text-semantic-success`, `bg-semantic-success/10` |
| `text-red-600`, `bg-red-100` | `text-semantic-error`, `bg-semantic-error/10` |
| `text-yellow-600`, `bg-yellow-100` | `text-semantic-warning`, `bg-semantic-warning/10` |
| `text-blue-600`, `bg-blue-100` | `text-semantic-info`, `bg-semantic-info/10` |
| `#22c55e` | `var(--color-semantic-success)` |
| `#ef4444` | `var(--color-semantic-error)` |

Verificar tokens exatos em `apps/web/src/styles/theme.css`.

**Verification:**

- [ ] `grep -rn '#[0-9a-fA-F]\{6\}' apps/web/src/app/\(platform\)/` retorna 0 resultados novos
- [ ] `grep -rn 'text-green\|text-red\|text-yellow\|bg-green\|bg-red\|bg-yellow' apps/web/src/app/\(platform\)/` retorna 0 resultados
- [ ] Visual mantem mesma semantica de cores (success=verde, error=vermelho, warning=amarelo)
- [ ] `npm run lint` passa

**Status:** [ ] Fixed

---

### 9. [MAJOR] `alert()`/`confirm()`/`window.location.reload()` usados ao inves de componentes UI

**Issue ID:** FIX-UI-003

**Location:** `admin/job-roles/job-roles-client.tsx`, `trails/[trailId]/trail-detail-client.tsx`

**Problem:**
Uso de `alert()`, `confirm()` e `window.location.reload()` nativos do browser. Isso quebra UX (dialogs nao-estilizados), acessibilidade (screen readers), e impede testes automatizados.

**Expected:**
- Substituir `alert()` por toast notification (se disponivel em `@eximia/ui`) ou estado de erro inline
- Substituir `confirm()` por `Modal` de `@eximia/ui` com botoes de confirmacao
- Substituir `window.location.reload()` por `router.refresh()` do Next.js

```typescript
import { useRouter } from "next/navigation"
const router = useRouter()

// Antes:
if (confirm("Tem certeza?")) { ... }
window.location.reload()

// Depois:
const [showConfirm, setShowConfirm] = useState(false)
// ... Modal com onConfirm handler
router.refresh()
```

**Verification:**

- [ ] `grep -rn 'alert(' apps/web/src/app/\(platform\)/` retorna 0 resultados
- [ ] `grep -rn 'confirm(' apps/web/src/app/\(platform\)/` retorna 0 resultados
- [ ] `grep -rn 'window.location.reload' apps/web/src/app/\(platform\)/` retorna 0 resultados
- [ ] Dialogs de confirmacao usam Modal estilizado
- [ ] Navegacao usa router.refresh()

**Status:** [ ] Fixed

---

### 10. [MAJOR] Missing `aria-label` em controles interativos

**Issue ID:** FIX-UI-004

**Location:** Multiplos componentes UI

**Problem:**
Botoes com apenas icone, toggles e selects sem `aria-label` explicitam. Afeta acessibilidade (WCAG 2.1 Level A).

**Expected:**
Adicionar `aria-label` descritivo em:
- Botoes de icone (editar, deletar, fechar)
- Toggle switches (habilitar/desabilitar feature)
- Select dropdowns sem label visivel

Exemplo:
```tsx
<Button variant="ghost" size="sm" aria-label="Editar cargo" onClick={...}>
  <PencilIcon />
</Button>
```

**Verification:**

- [ ] Todos os botoes somente-icone tem `aria-label`
- [ ] Todos os toggles tem `aria-label` ou `aria-labelledby`
- [ ] `npm run lint` passa (se configurado com regra jsx-a11y)

**Status:** [ ] Fixed

---

### 11. [MAJOR] Cookie `active_tenant` aceito sem validacao UUID

**Issue ID:** FIX-E28-004

**Location:** `apps/web/src/lib/super-admin-context.ts` (usado por `plans/actions.ts`)

**Problem:**
`getActiveTenantForSuperAdmin()` le o cookie `active_tenant` e usa o valor diretamente em queries sem validar que e um UUID valido. Um cookie manipulado poderia injetar valor inesperado.

**Expected:**
Validar formato UUID antes de usar:

```typescript
import { z } from "zod"

export async function getActiveTenantForSuperAdmin(): Promise<string | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get("active_tenant")?.value
  if (!raw) return null

  const parsed = z.string().uuid().safeParse(raw)
  if (!parsed.success) return null

  return parsed.data
}
```

**Verification:**

- [ ] Cookie com UUID valido funciona normalmente
- [ ] Cookie com valor nao-UUID retorna null (sem erro)
- [ ] Cookie ausente retorna null
- [ ] `npm run typecheck` passa

**Status:** [ ] Fixed

---

### 12. [MAJOR] `autoEnrollTrailUsers` operacao em batch sem transacao

**Issue ID:** FIX-E27-004

**Location:** `apps/web/src/app/(platform)/trails/actions.ts` (funcao `autoEnrollTrailUsers`)

**Problem:**
A funcao faz upserts em loop (batch de 500) sem transacao. Se falhar no meio, parte dos usuarios ficara enrolled e parte nao, deixando estado inconsistente.

**Expected:**
Usar uma unica chamada upsert com array completo ao inves de loop, ou documentar que a operacao e idempotente (upsert com ON CONFLICT) e pode ser re-executada:

```typescript
// Se upsert e idempotente, documentar e adicionar retry:
// Cada upsert individual e idempotente via ON CONFLICT DO NOTHING
// Re-execucao segura: usuarios ja enrolled nao sao duplicados
```

Se o Supabase suporta upsert em batch (array de objetos), usar:
```typescript
const { error } = await service
  .from("enrollments")
  .upsert(enrollmentRows, { onConflict: "user_id,course_id" })
```

**Verification:**

- [ ] Auto-enrollment de 10+ usuarios completa sem erro
- [ ] Re-execucao nao cria duplicatas
- [ ] Falha parcial nao deixa estado inconsistente (ou e re-executavel)

**Status:** [ ] Fixed

---

## Constraints

**CRITICAL: @dev must follow these constraints:**

- [ ] Fix ONLY the issues listed above
- [ ] Do NOT add new features
- [ ] Do NOT refactor unrelated code
- [ ] Run all tests before marking complete: `npm test`
- [ ] Run linting before marking complete: `npm run lint`
- [ ] Run type check before marking complete: `npm run typecheck`
- [ ] Update story file list if any new files created
- [ ] Ensure existing 298 tests continue passing

---

## After Fixing

1. Mark each issue as fixed in this document
2. Run full validation suite: `npm run lint && npm run typecheck && npm test`
3. Create commit with fixes
4. Request QA re-review: `@qa *review epics-27-28`

---

_Generated by Quinn (Test Architect) - AIOS QA System_
