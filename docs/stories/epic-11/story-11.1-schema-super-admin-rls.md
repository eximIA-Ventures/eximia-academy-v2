# Story 11.1: Schema Super Admin + RLS Policies

**Epic:** [Epic 11 — Super Admin, Gestao de Empresas & Whitelabel Pago](../../epics/epic-11-super-admin-whitelabel.md)
**Version:** 1.1
**Created:** 2026-02-08
**Updated:** 2026-02-08
**Author:** Morgan (PM Agent)
**Status:** Pending
**Story Points:** 5
**Priority:** P0 (Blocker — all other stories depend on this schema)
**Blocked By:** Epic 5 (existing schema)
**Blocks:** Stories 11.2, 11.3, 11.4, 11.5, 11.6, 11.7
**Assigned To:** @dev (Dex)

---

## User Story

**As a** platform owner,
**I want** a database structure that supports a super admin role with cross-tenant access,
**so that** I can manage all companies from a single account without breaking tenant isolation.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | architecture.md v1.3, Section 6.1 (Data Models), 10.3 (RLS) |
| **PRD Ref** | prd.md — FR1, FR2 |
| **Stack** | Supabase PostgreSQL 16, TypeScript (packages/shared) |
| **DB Tables** | `users` (ALTER), `tenants` (ALTER), `platform_audit_log` (CREATE) |
| **RLS** | 3 new policies + 1 new helper function `is_super_admin()` |
| **Auth** | Supabase Auth — no changes to auth.users table |
| **Types** | `UserRole`, `WhitelabelConfig`, `Tenant` — packages/shared |

---

## Acceptance Criteria

- [ ] **AC1:** Enum `user_role` expandido com valor `super_admin`
- [ ] **AC2:** Coluna `users.tenant_id` torna-se nullable com CHECK constraint: `super_admin` DEVE ter `tenant_id IS NULL`, demais roles DEVEM ter `tenant_id IS NOT NULL`
- [ ] **AC3:** Colunas `whitelabel_enabled` (BOOLEAN DEFAULT FALSE) e `whitelabel_config` (JSONB DEFAULT '{}') adicionadas a tabela `tenants`
- [ ] **AC4:** Tabela `platform_audit_log` criada com campos: id (UUID PK), actor_id (FK auth.users), action (TEXT), target_type (TEXT), target_id (UUID), details (JSONB), created_at (TIMESTAMPTZ)
- [ ] **AC5:** Function `is_super_admin()` SECURITY DEFINER retorna true se `auth.uid()` tem role `super_admin` na tabela `users`
- [ ] **AC6:** RLS policy `super_admin_all_tenants` permite ALL operations em `tenants` para super_admin
- [ ] **AC7:** RLS policy `super_admin_all_users` permite ALL operations em `users` para super_admin
- [ ] **AC7b:** RLS policies `super_admin_all_*` adicionadas a TODAS as tabelas com RLS (courses, chapters, questions, enrollments, sessions, messages, analyses, qa_reports) — permite super_admin visualizar conteudo do tenant no contexto ativo [E11-H2 FIX]
- [ ] **AC8:** RLS em `platform_audit_log` habilitado com policy restrita a super_admin
- [ ] **AC8b:** Coluna `status` (TEXT DEFAULT 'active', CHECK IN ('active','inactive')) adicionada a tabela `tenants` + index `idx_tenants_status` [E11-H4 FIX]
- [ ] **AC9:** Indexes criados: `idx_platform_audit_actor`, `idx_platform_audit_target`, `idx_platform_audit_created`
- [ ] **AC10:** Tipo `UserRole` atualizado em `packages/shared/src/types/models.ts` para incluir `'super_admin'`
- [ ] **AC11:** Interface `WhitelabelConfig` criada em `packages/shared` com campos tipados
- [ ] **AC12:** Interface `Tenant` expandida com `whitelabel_enabled: boolean` e `whitelabel_config: WhitelabelConfig`
- [ ] **AC13:** Seed script (`supabase/seed.sql` + `supabase/seed-remote.ts`) inclui pelo menos 1 super_admin user

---

## CodeRabbit Integration

> CodeRabbit will review this story's PR for: migration safety, RLS policy correctness, constraint logic, type safety.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1, 2, 3, 4, 5, 6, 7, 7b, 8, 8b, 9) Create database migration
  - [ ] Create migration file `supabase/migrations/20260209000000_epic11_super_admin_whitelabel.sql`
  - [ ] Add `super_admin` value to `user_role` enum
  - [ ] Make `users.tenant_id` nullable (`ALTER COLUMN tenant_id DROP NOT NULL`)
  - [ ] Add CHECK constraint `users_super_admin_tenant_check`
  - [ ] Add `whitelabel_enabled` and `whitelabel_config` columns to `tenants`
  - [ ] Add `status` column to `tenants` (TEXT DEFAULT 'active', CHECK IN ('active','inactive')) + index [E11-H4 FIX]
  - [ ] Create `platform_audit_log` table with all columns and PK
  - [ ] Create 3 indexes on `platform_audit_log`
  - [ ] Create `is_super_admin()` function (SECURITY DEFINER, STABLE)
  - [ ] Create `super_admin_all_tenants` RLS policy on `tenants`
  - [ ] Create `super_admin_all_users` RLS policy on `users`
  - [ ] Create `super_admin_all_*` RLS policies on ALL remaining content tables: courses, chapters, questions, enrollments, sessions, messages, analyses, qa_reports [E11-H2 FIX]
  - [ ] Enable RLS on `platform_audit_log` and create access policy
  - [ ] Test migration applies cleanly on fresh and existing DB

- [ ] **Task 2** (AC: 10, 11, 12) Update shared types
  - [ ] Update `UserRole` type in `packages/shared/src/types/models.ts`
  - [ ] Create `WhitelabelConfig` interface
  - [ ] Expand `Tenant` interface with new fields
  - [ ] Add Zod validators for new types
  - [ ] Verify `pnpm typecheck` passes across all packages

- [ ] **Task 3** (AC: 13) Update seed scripts
  - [ ] Define deterministic UUID for super_admin: `00000000-0000-0000-0000-000000000005` [E11-M5 FIX]
  - [ ] Add super_admin to `supabase/seed.sql`: INSERT into auth.users FIRST (FK ordering), then public.users with `tenant_id = NULL` [E11-M5 FIX]
  - [ ] Add super_admin to `supabase/seed-remote.ts` via `supabase.auth.admin.createUser()` then public.users insert
  - [ ] Ensure super_admin has `tenant_id = NULL`
  - [ ] Test seed runs without constraint violations on fresh DB

- [ ] **Task 4** (AC: all) Regression validation
  - [ ] Verify existing RLS policies still function for all 4 existing roles
  - [ ] Verify `auth_tenant_id()` returns non-null for existing roles
  - [ ] Verify `auth_user_role()` returns correct values
  - [ ] Verify no cross-tenant data leakage for existing users
  - [ ] Verify existing seed data loads correctly with new constraints

---

## Dev Notes

### Migration SQL

```sql
-- supabase/migrations/20260209000000_epic11_super_admin_whitelabel.sql
-- Epic 11: Super Admin, Multi-Company, Whitelabel Pago

-- 1. Expand role enum
ALTER TYPE user_role ADD VALUE 'super_admin';

-- 2. Make tenant_id nullable for super_admin
ALTER TABLE users ALTER COLUMN tenant_id DROP NOT NULL;

-- 3. Consistency constraint: super_admin must have NULL tenant_id, others must have non-NULL
ALTER TABLE users ADD CONSTRAINT users_super_admin_tenant_check
  CHECK (
    (role = 'super_admin' AND tenant_id IS NULL) OR
    (role != 'super_admin' AND tenant_id IS NOT NULL)
  );

-- 4. Whitelabel columns on tenants
ALTER TABLE tenants ADD COLUMN whitelabel_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE tenants ADD COLUMN whitelabel_config JSONB DEFAULT '{}'::jsonb;

-- 4b. [E11-H4 FIX] Tenant status column for soft delete
ALTER TABLE tenants ADD COLUMN status TEXT DEFAULT 'active'
  CHECK (status IN ('active', 'inactive'));
CREATE INDEX idx_tenants_status ON tenants(status);

-- 5. Audit log table
CREATE TABLE platform_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_platform_audit_actor ON platform_audit_log(actor_id);
CREATE INDEX idx_platform_audit_target ON platform_audit_log(target_type, target_id);
CREATE INDEX idx_platform_audit_created ON platform_audit_log(created_at DESC);

-- 6. Helper function
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'super_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 7. Super admin cross-tenant RLS
CREATE POLICY "super_admin_all_tenants"
  ON tenants FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "super_admin_all_users"
  ON users FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- 8. Audit log RLS
ALTER TABLE platform_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_audit_access"
  ON platform_audit_log FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- 9. [E11-H2 FIX] Super admin RLS for ALL content tables
-- Required for tenant switcher (Story 11.4) — super admin needs to view
-- courses, sessions, analytics when in tenant context
CREATE POLICY "super_admin_all_courses" ON courses FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "super_admin_all_chapters" ON chapters FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "super_admin_all_questions" ON questions FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "super_admin_all_enrollments" ON enrollments FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "super_admin_all_sessions" ON sessions FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "super_admin_all_messages" ON messages FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "super_admin_all_analyses" ON analyses FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "super_admin_all_qa_reports" ON qa_reports FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());
```

### Shared Types

```typescript
// packages/shared/src/types/models.ts — Updates
// [Source: architecture.md Section 6.1]

export type UserRole = 'student' | 'teacher' | 'admin' | 'manager' | 'super_admin'

export interface WhitelabelConfig {
  custom_texts?: {
    app_name?: string
    tagline?: string
    login_title?: string
    login_subtitle?: string
  }
  favicon_url?: string | null
  footer_text?: string
  support_email?: string
  custom_css?: string
}

// Expand existing Tenant interface
export interface Tenant {
  id: string
  name: string
  slug: string
  plan: TenantPlan
  status: 'active' | 'inactive'  // [E11-H4 FIX]
  branding: TenantBranding
  settings: TenantSettings
  whitelabel_enabled: boolean
  whitelabel_config: WhitelabelConfig
}
```

### Screens Reference

| Zone | Component | Story |
|------|-----------|-------|
| N/A (schema-only) | Database migration | 11.1 |

### RLS Policies — New (Additive)

- `super_admin_all_tenants` → ALL on tenants WHERE `is_super_admin()`
- `super_admin_all_users` → ALL on users WHERE `is_super_admin()`
- `super_admin_audit_access` → ALL on platform_audit_log WHERE `is_super_admin()`
- `super_admin_all_courses` → ALL on courses WHERE `is_super_admin()` [E11-H2 FIX]
- `super_admin_all_chapters` → ALL on chapters WHERE `is_super_admin()` [E11-H2 FIX]
- `super_admin_all_questions` → ALL on questions WHERE `is_super_admin()` [E11-H2 FIX]
- `super_admin_all_enrollments` → ALL on enrollments WHERE `is_super_admin()` [E11-H2 FIX]
- `super_admin_all_sessions` → ALL on sessions WHERE `is_super_admin()` [E11-H2 FIX]
- `super_admin_all_messages` → ALL on messages WHERE `is_super_admin()` [E11-H2 FIX]
- `super_admin_all_analyses` → ALL on analyses WHERE `is_super_admin()` [E11-H2 FIX]
- `super_admin_all_qa_reports` → ALL on qa_reports WHERE `is_super_admin()` [E11-H2 FIX]
- [Source: Architect (Aria) architecture proposal + E11-H2 QA fix]

### File Locations

```
supabase/
├── migrations/
│   └── 20260209000000_epic11_super_admin_whitelabel.sql  # NEW
├── seed.sql                                               # UPDATED
└── seed-remote.ts                                         # UPDATED

packages/shared/src/
├── types/
│   └── models.ts                                          # UPDATED: UserRole, WhitelabelConfig, Tenant
└── validators/
    └── index.ts                                           # UPDATED: new Zod schemas
```

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|-----------|---------|
| Pre-Commit | Migration applies without errors. `pnpm typecheck` passes. Seed runs. | Yes |
| Pre-PR | RLS verified: super_admin sees all tenants, regular admin sees only own. Constraint prevents super_admin with tenant_id. Audit log accessible only to super_admin. Existing role permissions unchanged. | Yes |

---

## Definition of Done

- [ ] Migration applies cleanly on fresh and existing database
- [ ] CHECK constraint enforced: super_admin has NULL tenant_id, others have non-NULL
- [ ] `is_super_admin()` function works correctly
- [ ] 3 new RLS policies active and tested
- [ ] `platform_audit_log` table created with RLS and indexes
- [ ] Shared types updated and compile without errors
- [ ] Seed scripts include super_admin user
- [ ] All existing RLS policies continue to function
- [ ] No regression in existing functionality
- [ ] `pnpm lint && pnpm typecheck` pass

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Migration SQL, shared types, seed scripts, regression testing |
| **@data-engineer** | Review RLS policies, validate constraint logic, index strategy |
| **@qa (Quinn)** | Validate RLS isolation, constraint enforcement, super_admin access patterns |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Nullable tenant_id breaks existing queries | HIGH | CHECK constraint garante consistencia. Queries existentes usam `auth_tenant_id()` que retorna non-null para roles existentes |
| Enum expansion causes downtime | LOW | `ALTER TYPE ADD VALUE` nao requer table lock no PostgreSQL |
| Super admin role escalation | CRITICAL | `is_super_admin()` usa SECURITY DEFINER. Nenhuma API permite criar super_admin |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-08 | 1.0 | Story created from Epic 11 architecture | Morgan (PM) |
| 2026-02-08 | 1.1 | QA fixes: E11-H2 (super_admin RLS on ALL 10 tables), E11-H4 (tenants.status column), E11-M5 (seed UUID coordination) | River (SM) |

---

*Story criada por Morgan (PM Agent) — eximIA Academy*
