-- =============================================================================
-- Migration: ÁREA / GESTOR  (manager-owned student groups, distinct from UNIDADE)
-- =============================================================================
-- FASE 0 — Data Architecture (item 8). Foundational, additive, non-destructive.
--
-- TERMINOLOGY (critical — do NOT confuse these two concepts):
--   • UNIDADE  = the existing `areas` table (e.g. "Minas Gerais", "Ribeirão Preto").
--                It is a geographic/organizational SITE inside a tenant. In the
--                current codebase it is (confusingly) called "area" / areaName /
--                area_id. We do NOT touch it here — it keeps its meaning.
--                Seed evidence: 20260517200000_course_areas_unification.sql maps
--                courses to Ribeirão Preto / Minas Gerais areas; the
--                20260406000000_unit_scoped_enrollments.sql comment literally says
--                "Unit/area the student belongs to". UI: UnitStats.areaName + the
--                "units" comparison mode in unit-comparison.tsx.
--
--   • ÁREA / GESTOR (this migration) = a MANAGEABLE TEAM of students OWNED by a
--                manager (gestor). It is NOT a site. A non-corporate group lives
--                inside a single UNIDADE; a CORPORATE group (is_corporate = true)
--                spans MORE THAN ONE UNIDADE so the gestor sees their whole team
--                across sites. UI hook: the (currently disabled) "Áreas / Gestor"
--                comparison mode in unit-comparison.tsx.
--
-- RELATIONSHIP MODELED:  student → (member of) → manager_group → (spans) → UNIDADE(s)
--                        manager_group → (owned by) → gestor (users.role = manager)
--
-- This migration is fully ADDITIVE (no DROP of existing tables/columns, no data
-- rewrites) and IDEMPOTENT (CREATE ... IF NOT EXISTS / DROP POLICY IF EXISTS).
--
-- Helper functions reused (already defined in earlier migrations):
--   auth_tenant_id()  -> UUID   tenant of the authenticated user
--   auth_user_role()  -> TEXT   role of the authenticated user
--   is_super_admin()  -> BOOL   active super_admin
-- New helper added here:
--   auth_managed_group_ids() -> UUID[]  groups the caller owns/co-manages
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. manager_groups  — the ÁREA / GESTOR entity (a manageable team of students)
-- =============================================================================
-- A group is a team a gestor manages. `manager_id` is the primary owner (a user
-- with role manager/admin). `is_corporate` is the requested "corporativo" flag:
--   • false  → the team is confined to exactly one UNIDADE (see manager_group_units)
--   • true   → the team spans MULTIPLE UNIDADEs; the corporate gestor sees the
--              whole team across sites.
-- =============================================================================
CREATE TABLE IF NOT EXISTS manager_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Owner gestor. ON DELETE SET NULL so the group/team survives gestor removal
  -- (a new gestor can be assigned). NULL = orphan group, admin must reassign.
  manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  -- CORPORATIVO flag: true => team spans more than one UNIDADE.
  is_corporate BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

COMMENT ON TABLE manager_groups IS
  'ÁREA/GESTOR: a manager-owned TEAM of students. DISTINCT from `areas` (UNIDADE). '
  'is_corporate=true means the team spans multiple UNIDADEs (manager_group_units).';
COMMENT ON COLUMN manager_groups.manager_id IS
  'Owning gestor (users.role in manager/admin). NULL = unassigned/orphan group.';
COMMENT ON COLUMN manager_groups.is_corporate IS
  'CORPORATIVO flag. true => team spans MORE THAN ONE UNIDADE (areas).';

-- =============================================================================
-- 2. manager_group_units  — which UNIDADE(s) (areas) a group spans
-- =============================================================================
-- Links a manager_group to one or more existing UNIDADEs (`areas`).
--   • non-corporate group  → exactly one row here (enforced at app layer)
--   • corporate group      → one row per UNIDADE the gestor oversees
-- The student → unidade link still lives in user_areas; this table records the
-- group's REACH across unidades so a corporate gestor's analytics can fan out.
-- =============================================================================
CREATE TABLE IF NOT EXISTS manager_group_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES manager_groups(id) ON DELETE CASCADE,
  -- `unit_id` references the EXISTING `areas` table (= UNIDADE). Named unit_id
  -- on purpose to disambiguate from the ÁREA/GESTOR group.
  unit_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, unit_id)
);

COMMENT ON TABLE manager_group_units IS
  'UNIDADE(s) (areas) spanned by a manager_group. unit_id -> areas.id (UNIDADE). '
  'One row for non-corporate groups; many for corporate (is_corporate) groups.';

-- =============================================================================
-- 3. manager_group_members  — which students belong to a group (the team)
-- =============================================================================
-- The student ↔ ÁREA/GESTOR link. A student may belong to more than one group
-- (e.g. a local unit gestor + a corporate gestor), so this is a true junction.
-- =============================================================================
CREATE TABLE IF NOT EXISTS manager_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES manager_groups(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, student_id)
);

COMMENT ON TABLE manager_group_members IS
  'Students (team) belonging to a manager_group (ÁREA/GESTOR). student_id -> users.id.';

-- =============================================================================
-- 4. Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_manager_groups_tenant   ON manager_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_manager_groups_manager  ON manager_groups(manager_id);
CREATE INDEX IF NOT EXISTS idx_mgu_group                ON manager_group_units(group_id);
CREATE INDEX IF NOT EXISTS idx_mgu_unit                 ON manager_group_units(unit_id);
CREATE INDEX IF NOT EXISTS idx_mgu_tenant               ON manager_group_units(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mgm_group                ON manager_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_mgm_student              ON manager_group_members(student_id);
CREATE INDEX IF NOT EXISTS idx_mgm_tenant               ON manager_group_members(tenant_id);

-- =============================================================================
-- 5. Helper function: groups the caller owns (as gestor)
-- =============================================================================
-- Returns the set of manager_group ids where the caller is the owning gestor
-- (manager_id). Used by RLS on manager_group_units / manager_group_members /
-- enrollments / sessions so a gestor can read their own team's data.
--
-- IMPORTANT: written in PL/pgSQL (NOT sql) on purpose. The repo learned the hard
-- way (20260518100000_fix_leader_rls_recursion.sql) that LANGUAGE sql helpers can
-- be INLINED by the optimizer, losing SECURITY DEFINER and triggering recursive
-- RLS evaluation. PL/pgSQL functions are never inlined, so SECURITY DEFINER (and
-- thus the RLS bypass on manager_groups) is guaranteed and recursion is avoided.
-- =============================================================================
CREATE OR REPLACE FUNCTION auth_managed_group_ids() RETURNS UUID[] AS $$
DECLARE
  _ids UUID[];
BEGIN
  SELECT COALESCE(array_agg(id), '{}'::UUID[])
  INTO _ids
  FROM manager_groups
  WHERE manager_id = auth.uid();
  RETURN _ids;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

COMMENT ON FUNCTION auth_managed_group_ids() IS
  'manager_group ids owned by the authenticated gestor (manager_groups.manager_id = auth.uid()).';

-- =============================================================================
-- 6. RLS — manager_groups
-- =============================================================================
ALTER TABLE manager_groups ENABLE ROW LEVEL SECURITY;

-- super_admin cross-tenant bypass (pattern from epic11)
DROP POLICY IF EXISTS mg_super_admin ON manager_groups;
CREATE POLICY mg_super_admin ON manager_groups FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- SELECT: admins/managers see all tenant groups; the owning gestor always sees
-- their own; leaders (read-only learning companions) may see tenant groups too.
DROP POLICY IF EXISTS mg_select ON manager_groups;
CREATE POLICY mg_select ON manager_groups FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND (
      auth_user_role() IN ('admin', 'manager', 'instructor', 'leader')
      OR manager_id = auth.uid()
    )
  );

-- INSERT: admin (any group in tenant) or manager (only groups they own).
DROP POLICY IF EXISTS mg_insert ON manager_groups;
CREATE POLICY mg_insert ON manager_groups FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND (
      auth_user_role() = 'admin'
      OR (auth_user_role() = 'manager' AND manager_id = auth.uid())
    )
  );

-- UPDATE: admin (any) or the owning gestor (their own group).
DROP POLICY IF EXISTS mg_update ON manager_groups;
CREATE POLICY mg_update ON manager_groups FOR UPDATE
  USING (
    tenant_id = auth_tenant_id()
    AND (auth_user_role() = 'admin' OR manager_id = auth.uid())
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND (auth_user_role() = 'admin' OR manager_id = auth.uid())
  );

-- DELETE: admin only (managers cannot delete their own group — admin governs).
DROP POLICY IF EXISTS mg_delete ON manager_groups;
CREATE POLICY mg_delete ON manager_groups FOR DELETE
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() = 'admin'
  );

-- =============================================================================
-- 7. RLS — manager_group_units
-- =============================================================================
ALTER TABLE manager_group_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mgu_super_admin ON manager_group_units;
CREATE POLICY mgu_super_admin ON manager_group_units FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- SELECT: tenant admins/managers/instructors/leaders, plus the owning gestor of
-- the parent group.
DROP POLICY IF EXISTS mgu_select ON manager_group_units;
CREATE POLICY mgu_select ON manager_group_units FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND (
      auth_user_role() IN ('admin', 'manager', 'instructor', 'leader')
      OR group_id = ANY (auth_managed_group_ids())
    )
  );

-- WRITE (INSERT/UPDATE/DELETE): admin, or the owning gestor of the parent group.
-- WITH CHECK also re-validates the parent group belongs to the caller's tenant.
DROP POLICY IF EXISTS mgu_write ON manager_group_units;
CREATE POLICY mgu_write ON manager_group_units FOR ALL
  USING (
    tenant_id = auth_tenant_id()
    AND (auth_user_role() = 'admin' OR group_id = ANY (auth_managed_group_ids()))
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND (auth_user_role() = 'admin' OR group_id = ANY (auth_managed_group_ids()))
    AND EXISTS (
      SELECT 1 FROM manager_groups mg
      WHERE mg.id = manager_group_units.group_id
        AND mg.tenant_id = auth_tenant_id()
    )
    AND EXISTS (
      -- the referenced UNIDADE must be in the same tenant
      SELECT 1 FROM areas a
      WHERE a.id = manager_group_units.unit_id
        AND a.tenant_id = auth_tenant_id()
    )
  );

-- =============================================================================
-- 8. RLS — manager_group_members
-- =============================================================================
ALTER TABLE manager_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mgm_super_admin ON manager_group_members;
CREATE POLICY mgm_super_admin ON manager_group_members FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- SELECT: admins/managers/instructors; the owning gestor of the group; and the
-- student themselves (so a student can see which teams they're on).
DROP POLICY IF EXISTS mgm_select ON manager_group_members;
CREATE POLICY mgm_select ON manager_group_members FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND (
      auth_user_role() IN ('admin', 'manager', 'instructor')
      OR group_id = ANY (auth_managed_group_ids())
      OR student_id = auth.uid()
    )
  );

-- WRITE: admin, or the owning gestor of the parent group. WITH CHECK validates
-- the parent group and the student both belong to the caller's tenant.
DROP POLICY IF EXISTS mgm_write ON manager_group_members;
CREATE POLICY mgm_write ON manager_group_members FOR ALL
  USING (
    tenant_id = auth_tenant_id()
    AND (auth_user_role() = 'admin' OR group_id = ANY (auth_managed_group_ids()))
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND (auth_user_role() = 'admin' OR group_id = ANY (auth_managed_group_ids()))
    AND EXISTS (
      SELECT 1 FROM manager_groups mg
      WHERE mg.id = manager_group_members.group_id
        AND mg.tenant_id = auth_tenant_id()
    )
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = manager_group_members.student_id
        AND u.tenant_id = auth_tenant_id()
    )
  );

-- =============================================================================
-- 9. Cross-table visibility — gestor sees their TEAM's learning data
-- =============================================================================
-- A gestor (manager_id) must be able to read enrollments / sessions of the
-- students in the groups they own, EVEN WHEN those students span multiple
-- UNIDADEs (the corporate case). The existing `manager` role already has broad
-- tenant-wide SELECT on enrollments/sessions (see areas_role_unification), so
-- these policies are ADDITIVE and specifically empower the case where a manager
-- is scoped to their owned group(s) only. They are written as OR-policies and
-- never reduce existing access.
--
-- NOTE: We intentionally do NOT rewrite the existing manager-wide policies here
-- (that is a FASE 1 scoping decision — see openQuestions). These additive
-- policies make the group→team→data path queryable for any role gated to it.
-- =============================================================================

-- enrollments: owning gestor can read enrollments of their team members.
DROP POLICY IF EXISTS enrollments_group_select ON enrollments;
CREATE POLICY enrollments_group_select ON enrollments FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND student_id IN (
      SELECT mgm.student_id
      FROM manager_group_members mgm
      WHERE mgm.group_id = ANY (auth_managed_group_ids())
    )
  );

-- sessions: owning gestor can read sessions of their team members.
DROP POLICY IF EXISTS sessions_group_select ON sessions;
CREATE POLICY sessions_group_select ON sessions FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND student_id IN (
      SELECT mgm.student_id
      FROM manager_group_members mgm
      WHERE mgm.group_id = ANY (auth_managed_group_ids())
    )
  );

-- =============================================================================
-- 10. updated_at trigger for manager_groups (parity with other tables)
-- =============================================================================
CREATE OR REPLACE FUNCTION set_manager_groups_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_manager_groups_updated_at ON manager_groups;
CREATE TRIGGER trg_manager_groups_updated_at
  BEFORE UPDATE ON manager_groups
  FOR EACH ROW EXECUTE FUNCTION set_manager_groups_updated_at();

COMMIT;
