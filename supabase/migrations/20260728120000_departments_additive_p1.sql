-- =============================================================================
-- Migration: DEPARTMENT layer (additive P1) — CFG-2.1
-- =============================================================================
-- Splits the two concepts that today collide inside the existing `areas` table,
-- WITHOUT changing what `areas` means and WITHOUT rewriting a single existing
-- row. Decision P1 of docs/architecture/configuracoes-publicacao-fase1.md §4
-- (P2 "rename the existing table" and P3 "kind + parent_id" were REJECTED: both
-- flip the meaning of live production rows silently).
--
-- TERMINOLOGY (critical — do NOT confuse these two concepts):
--   • UNIDADE = the existing `areas` table (e.g. "Ribeirão Preto", "Minas
--               Gerais"): a physical/organizational SITE inside a tenant. This
--               migration does NOT touch it — it keeps its meaning, its rows,
--               its columns and its RLS policies exactly as they are today.
--               Precedent for this stance: 20260530130000_area_gestor.sql.
--   • DEPARTMENT (this migration, table `departments`) = a functional org unit
--               (e.g. "Finanças"). In the product vocabulary (README D4) this is
--               what is called "Área". The table-name × product-vocabulary
--               mismatch is DELIBERATE, documented debt: the price of not
--               renaming a table that live code reads through untyped clients.
--
-- RELATIONSHIP MODELED:
--   person → (member of) → department → (present in) → UNIDADE(s) (`areas`)
--   A department present in 2+ rows of `department_areas` IS the "corporate
--   area" case (D4) — no boolean flag is needed, the cardinality says it.
--
-- NOT the same thing as `manager_groups` (20260530130000_area_gestor.sql): that
-- entity is a manager-owned TEAM of students, a different concept with its own
-- tables. No name, FK or policy defined here collides with it.
--
-- This migration is fully ADDITIVE (no DROP, no ALTER of any pre-existing
-- object, no data rewrite) and IDEMPOTENT (CREATE ... IF NOT EXISTS /
-- DROP POLICY IF EXISTS), so it is safe to run more than once.
--
-- Helper functions reused (already defined in earlier, applied migrations):
--   auth_tenant_id()  -> UUID   tenant of the authenticated user
--   auth_user_role()  -> TEXT   role of the authenticated user
--   is_super_admin()  -> BOOL   active super_admin (cross-tenant bypass)
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. departments — the functional org unit ("Área" in the product vocabulary)
-- =============================================================================
-- Mirrors the shape of `areas` on purpose (id/tenant_id/name/slug/description/
-- timestamps + UNIQUE (tenant_id, slug)) so both read the same way in the UI.
--
-- NOTE on `updated_at`: like `areas`, this table has a DEFAULT but NO trigger,
-- so the column reflects creation time until the application writes it. Adding
-- a BEFORE UPDATE trigger is a deliberate follow-up decision (it would leave an
-- orphan function behind the 3-table rollback below), not an omission.
-- =============================================================================
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

COMMENT ON TABLE departments IS
  'DEPARTMENT: functional org unit inside a tenant ("Área" in the product '
  'vocabulary, README D4). DISTINCT from the `areas` table, which is the '
  'UNIDADE (physical site) and is left untouched by this migration.';

-- =============================================================================
-- 2. department_areas — N:N junction department ↔ UNIDADE
-- =============================================================================
-- `area_id` references the EXISTING `areas` table (= UNIDADE), following the
-- convention already used by user_areas.area_id / course_areas.area_id /
-- job_roles.area_id, which all point at the same UNIDADE without ambiguity.
--
-- CARDINALITY IS THE SEMANTICS:
--   • 1 row for a department  → the department lives in a single UNIDADE
--   • 2+ rows for a department → CORPORATE department (spans several UNIDADEs)
-- =============================================================================
CREATE TABLE IF NOT EXISTS department_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (department_id, area_id)
);

COMMENT ON TABLE department_areas IS
  'N:N junction department ↔ UNIDADE. area_id -> areas.id (UNIDADE, unchanged). '
  'A department present in 2+ rows here is a CORPORATE department (D4).';

-- =============================================================================
-- 3. user_departments — person ↔ department link
-- =============================================================================
-- A NEW, independent table on purpose: `user_areas` keeps describing ONLY the
-- person ↔ UNIDADE link and is not altered here (that is what keeps "zero
-- pre-existing object touched" literally true).
--
-- There is deliberately NO unidade column here: the person's UNIDADE is already
-- known through user_areas.area_id, and duplicating it would create a second
-- source of truth that can silently drift.
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, department_id)
);

COMMENT ON TABLE user_departments IS
  'Person ↔ department link. Independent from user_areas (person ↔ UNIDADE), '
  'which remains unchanged. No unidade column here on purpose (no duplication).';

-- =============================================================================
-- 4. Indexes (FK lookups; all dropped together with their tables on rollback)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_departments_tenant     ON departments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dept_areas_department  ON department_areas(department_id);
CREATE INDEX IF NOT EXISTS idx_dept_areas_area        ON department_areas(area_id);
CREATE INDEX IF NOT EXISTS idx_dept_areas_tenant      ON department_areas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_departments_user  ON user_departments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_departments_dept  ON user_departments(department_id);
CREATE INDEX IF NOT EXISTS idx_user_departments_tenant ON user_departments(tenant_id);

-- =============================================================================
-- 5. RLS — departments
-- =============================================================================
-- Same shape as the `areas` policies (20260210000000_areas_role_unification.sql:
-- tenant-wide SELECT, admin-only writes), PLUS the super_admin cross-tenant
-- bypass that the 2026-02-10 pattern predates (20260530130000_area_gestor.sql).
--
-- Deviation on purpose: UPDATE carries a WITH CHECK identical to its USING (the
-- 2026-02-10 policies have USING only). Without it, a tenant admin could move a
-- row to another tenant_id. It never denies a legitimate in-tenant update.
-- =============================================================================
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS departments_super_admin ON departments;
CREATE POLICY departments_super_admin ON departments FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS departments_select ON departments;
CREATE POLICY departments_select ON departments FOR SELECT
  USING (tenant_id = auth_tenant_id());

DROP POLICY IF EXISTS departments_insert ON departments;
CREATE POLICY departments_insert ON departments FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin');

DROP POLICY IF EXISTS departments_update ON departments;
CREATE POLICY departments_update ON departments FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin');

DROP POLICY IF EXISTS departments_delete ON departments;
CREATE POLICY departments_delete ON departments FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin');

-- =============================================================================
-- 6. RLS — department_areas
-- =============================================================================
-- Same shape as departments above. The write policy additionally re-validates
-- that BOTH sides of the junction belong to the caller's tenant (pattern taken
-- from mgu_write in 20260530130000_area_gestor.sql), so a crafted request
-- cannot link a foreign department to a local UNIDADE or vice-versa.
-- =============================================================================
ALTER TABLE department_areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS department_areas_super_admin ON department_areas;
CREATE POLICY department_areas_super_admin ON department_areas FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS department_areas_select ON department_areas;
CREATE POLICY department_areas_select ON department_areas FOR SELECT
  USING (tenant_id = auth_tenant_id());

DROP POLICY IF EXISTS department_areas_insert ON department_areas;
CREATE POLICY department_areas_insert ON department_areas FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM departments d
      WHERE d.id = department_areas.department_id
        AND d.tenant_id = auth_tenant_id()
    )
    AND EXISTS (
      -- the referenced UNIDADE must belong to the same tenant
      SELECT 1 FROM areas a
      WHERE a.id = department_areas.area_id
        AND a.tenant_id = auth_tenant_id()
    )
  );

DROP POLICY IF EXISTS department_areas_update ON department_areas;
CREATE POLICY department_areas_update ON department_areas FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin')
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM departments d
      WHERE d.id = department_areas.department_id
        AND d.tenant_id = auth_tenant_id()
    )
    AND EXISTS (
      SELECT 1 FROM areas a
      WHERE a.id = department_areas.area_id
        AND a.tenant_id = auth_tenant_id()
    )
  );

DROP POLICY IF EXISTS department_areas_delete ON department_areas;
CREATE POLICY department_areas_delete ON department_areas FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin');

-- =============================================================================
-- 7. RLS — user_departments
-- =============================================================================
-- Mirrors the `user_areas` block (20260210000000_areas_role_unification.sql):
-- SELECT gated by an EXISTS over `users` in the caller's tenant; INSERT/DELETE
-- restricted to admin + manager. Plus the super_admin bypass.
--
-- Like user_areas, there is NO UPDATE policy: a membership row is created or
-- removed, never mutated, so UPDATE stays denied by default.
-- =============================================================================
ALTER TABLE user_departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_departments_super_admin ON user_departments;
CREATE POLICY user_departments_super_admin ON user_departments FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS user_departments_select ON user_departments;
CREATE POLICY user_departments_select ON user_departments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = user_departments.user_id
        AND u.tenant_id = auth_tenant_id()
    )
  );

DROP POLICY IF EXISTS user_departments_insert ON user_departments;
CREATE POLICY user_departments_insert ON user_departments FOR INSERT
  WITH CHECK (
    auth_user_role() IN ('admin', 'manager')
    AND tenant_id = auth_tenant_id()
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = user_departments.user_id
        AND u.tenant_id = auth_tenant_id()
    )
    AND EXISTS (
      SELECT 1 FROM departments d
      WHERE d.id = user_departments.department_id
        AND d.tenant_id = auth_tenant_id()
    )
  );

DROP POLICY IF EXISTS user_departments_delete ON user_departments;
CREATE POLICY user_departments_delete ON user_departments FOR DELETE
  USING (
    auth_user_role() IN ('admin', 'manager')
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = user_departments.user_id
        AND u.tenant_id = auth_tenant_id()
    )
  );

COMMIT;

-- =============================================================================
-- ROLLBACK (inert — commented on purpose, never executed by this file)
-- =============================================================================
-- Reverses this migration completely, in dependency-safe order. Nothing that
-- predates this migration is affected: the three tables below did not exist
-- before it, so dropping them cannot lose pre-existing data. Policies and
-- indexes go away with their tables.
--
-- Gate note: the story's `grep -nE "ALTER TABLE (...)|DROP (TABLE|COLUMN)"`
-- check hits the three commented DROP lines below and only them. The command
-- that proves no DESTRUCTIVE STATEMENT actually runs is the anchored variant:
--   grep -nE '^[[:space:]]*(ALTER TABLE|DROP TABLE|DROP COLUMN)' <this file>
-- which returns exactly three lines — the `ALTER TABLE <new table> ENABLE ROW
-- LEVEL SECURITY` statements on the three tables created above — and zero
-- DROP TABLE / DROP COLUMN. No pre-existing object appears in that output.
--
-- BEGIN;
--   DROP TABLE IF EXISTS user_departments;
--   DROP TABLE IF EXISTS department_areas;
--   DROP TABLE IF EXISTS departments;
-- COMMIT;
-- =============================================================================
