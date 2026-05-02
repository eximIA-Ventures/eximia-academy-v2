# Story 16.5: Tenant Plan & Configuracao de Planos

**Epic:** [Epic 16 — Core Agents & Pipeline Socratico](../../epics/epic-16-ws1-core-agents-pipeline-socratico.md)
**Version:** 1.0
**Created:** 2026-02-15
**Updated:** 2026-02-15
**Author:** River (SM)
**Status:** Ready
**Story Points:** 3
**Priority:** P1
**Blocked By:** Story 16.4 (Orquestrador v2)
**Blocks:** Story 16.6
**Assigned To:** @dev

---

## User Story

**As a** platform admin,
**I want** configurar o plano de cada tenant (Essencial, Standard, Premium),
**so that** o Model Router use os modelos corretos por tenant.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws1-motor-socratico-architecture.md`, Secao 9 |
| **PRD Ref** | `docs/prd/evolucao-eximia-academy-workstreams.md` — WS1: Motor Socratico |
| **Stack** | Drizzle ORM, PostgreSQL (Supabase), SQL migrations |
| **DB Tables** | `tenants` (ALTER — add plan column) |
| **Existing Schema** | `packages/database/src/schema/tenants.ts` |
| **Risk** | LOW — campo adicional em tabela existente |

---

## Acceptance Criteria

- [ ] **AC1:** Campo `plan` adicionado na tabela `tenants`
  - Tipo: `TEXT CHECK (plan IN ('essencial', 'standard', 'premium'))`
  - Default: `'standard'`
  - Migration SQL sem downtime
- [ ] **AC2:** Drizzle schema atualizado em `packages/database/src/schema/tenants.ts`
- [ ] **AC3:** Orquestrador v2 busca plano do tenant do contexto da sessao
- [ ] **AC4:** RLS: apenas super_admin pode alterar plano
- [ ] **AC5:** Tenants existentes recebem `plan = 'standard'` na migration

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1, 5) Criar migration SQL
  - [ ] Criar `supabase/migrations/YYYYMMDD_add_tenant_plan.sql`
  - [ ] `ALTER TABLE tenants ADD COLUMN plan TEXT NOT NULL DEFAULT 'standard' CHECK (plan IN ('essencial', 'standard', 'premium'));`
  - [ ] Tenants existentes recebem `'standard'` automaticamente via DEFAULT

- [ ] **Task 2** (AC: 4) Criar RLS policy
  - [ ] Adicionar na migration:
    ```sql
    CREATE POLICY "tenants_plan_update" ON tenants FOR UPDATE
      USING (auth_user_role() = 'super_admin')
      WITH CHECK (auth_user_role() = 'super_admin');
    ```
  - [ ] Verificar se policy de UPDATE ja existe (pode precisar ser ALTER ou DROP+CREATE)

- [ ] **Task 3** (AC: 2) Atualizar Drizzle schema
  - [ ] Adicionar campo `plan` em `packages/database/src/schema/tenants.ts`:
    ```typescript
    plan: text("plan", { enum: ["essencial", "standard", "premium"] }).default("standard").notNull(),
    ```
  - [ ] **NOTA**: O schema existente ja tem campo `plan` com `enum: ["free", "pro", "enterprise"]`. SUBSTITUIR pelos novos valores.

- [ ] **Task 4** (AC: 3) Integrar com Orquestrador
  - [ ] Garantir que API route passa `tenantPlan` para o Orquestrador v2
  - [ ] Buscar `plan` do tenant no contexto da sessao (ja disponivel via session → chapter → course → tenant)

- [ ] **Task 5** Validar
  - [ ] `pnpm typecheck` passa
  - [ ] Migration aplica sem erros
  - [ ] Tenants existentes tem plan = 'standard'

---

## Dev Notes

### Schema Existente — tenants.ts

O arquivo `packages/database/src/schema/tenants.ts` ja existe com campo `plan`:

```typescript
plan: text("plan", { enum: ["free", "pro", "enterprise"] }).default("free"),
```

**ATENCAO**: Substituir o enum existente (`free`, `pro`, `enterprise`) pelos novos valores (`essencial`, `standard`, `premium`). Isso requer:
1. Migration SQL que altera o CHECK constraint
2. UPDATE dos tenants existentes: `free` → `essencial`, `pro` → `standard`, `enterprise` → `premium`
3. Atualizar o Drizzle schema

[Source: packages/database/src/schema/tenants.ts]

### Migration SQL Sugerida

```sql
-- Step 1: Remove existing check constraint (if any)
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_plan_check;

-- Step 2: Handle NULLs (existing schema allows NULL)
UPDATE tenants SET plan = 'standard' WHERE plan IS NULL;

-- Step 3: Update existing values
UPDATE tenants SET plan = CASE
  WHEN plan = 'free' THEN 'essencial'
  WHEN plan = 'pro' THEN 'standard'
  WHEN plan = 'enterprise' THEN 'premium'
  ELSE 'standard'
END;

-- Step 4: Add NOT NULL constraint
ALTER TABLE tenants ALTER COLUMN plan SET NOT NULL;

-- Step 5: Add new check constraint
ALTER TABLE tenants ADD CONSTRAINT tenants_plan_check
  CHECK (plan IN ('essencial', 'standard', 'premium'));

-- Step 6: Set default
ALTER TABLE tenants ALTER COLUMN plan SET DEFAULT 'standard';
```

### RLS Functions Existentes

O projeto usa `auth_user_role()` e `auth_tenant_id()` para RLS. Verificar se `super_admin` e um role valido no sistema. Se nao, usar `admin`.

[Source: packages/database/src/schema/ — RLS pattern existente]

### File Locations

```
packages/database/src/schema/
└── tenants.ts              # ATUALIZAR (plan enum)

supabase/migrations/
└── YYYYMMDD_add_tenant_plan.sql  # NOVO
```

### Testing

- Validar que migration aplica sem erros
- Validar que tenants existentes recebem plan correto
- Testes de RLS: apenas admin pode alterar plan

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-15 | 1.0 | Story creation | River (SM) |
| 2026-02-15 | 1.1 | QA fix: Migration SQL corrigido — handle NULLs + SET NOT NULL antes de CHECK | Quinn (QA) + River (SM) |

---

## Dev Agent Record

### Agent Model Used
_To be filled by @dev_

### Debug Log References
_To be filled by @dev_

### Completion Notes List
_To be filled by @dev_

### File List
_To be filled by @dev_

---

## QA Results
_To be filled by @qa_
