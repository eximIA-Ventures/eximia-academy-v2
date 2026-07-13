-- =============================================================================
-- Migration: FIX ÁREA / GESTOR RLS — drop `leader` over-read from group SELECT
-- =============================================================================
-- Follow-up to 20260530130000_area_gestor.sql (already applied in production —
-- do NOT edit it). That migration granted the `leader` role tenant-wide SELECT on
-- manager_groups and manager_group_units via the IN (...) role list. That is too
-- broad: a leader (read-only learning companion) must NOT be able to read EVERY
-- manager_group / manager_group_unit in the tenant.
--
-- FIX (part a — REQUIRED):
--   Recreate mg_select (manager_groups) and mgu_select (manager_group_units)
--   removing `leader` from the role IN (...) list. The remaining roles
--   admin/manager/instructor keep tenant-wide SELECT; the owning gestor keeps
--   self-visibility (manager_groups: manager_id = auth.uid(); group units:
--   group_id = ANY (auth_managed_group_ids())). A leader that legitimately owns a
--   group (manager_id = auth.uid()) still sees it through that owner predicate.
--   No `teacher` dead value was present in either policy, so nothing to strip there.
--
-- FIX (part b) is INTENTIONALLY OMITTED here — see notes / the COMMENT block at
-- the end of this file. A partial unique index with a subquery on
-- manager_group_units (cap a non-corporate group to a single UNIDADE) is NOT
-- expressible in Postgres, and the alternative (BEFORE INSERT/UPDATE trigger)
-- was judged out of scope / risky for this RLS-focused fix. The 1-unit rule
-- remains enforced at the app layer as documented in the original migration.
--
-- This migration is IDEMPOTENT (DROP POLICY IF EXISTS + CREATE POLICY) and only
-- recreates two SELECT policies; it does not touch tables, columns, helper
-- functions, or any other policy.
-- =============================================================================

BEGIN;

-- =============================================================================
-- manager_groups — mg_select: drop `leader` from the tenant-wide role list
-- =============================================================================
-- SELECT: admins/managers/instructors see all tenant groups; the owning gestor
-- always sees their own (manager_id = auth.uid()). `leader` removed — a leader
-- no longer reads every group in the tenant, only one it owns (if any).
DROP POLICY IF EXISTS mg_select ON manager_groups;
CREATE POLICY mg_select ON manager_groups FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND (
      auth_user_role() IN ('admin', 'manager', 'instructor')
      OR manager_id = auth.uid()
    )
  );

-- =============================================================================
-- manager_group_units — mgu_select: drop `leader` from the tenant-wide role list
-- =============================================================================
-- SELECT: tenant admins/managers/instructors, plus the owning gestor of the
-- parent group (group_id = ANY (auth_managed_group_ids())). `leader` removed.
DROP POLICY IF EXISTS mgu_select ON manager_group_units;
CREATE POLICY mgu_select ON manager_group_units FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND (
      auth_user_role() IN ('admin', 'manager', 'instructor')
      OR group_id = ANY (auth_managed_group_ids())
    )
  );

COMMIT;

-- =============================================================================
-- (b) Non-corporate group → at most ONE UNIDADE  (NOT implemented — rationale)
-- =============================================================================
-- Goal: a manager_group with is_corporate = false should map to at most one row
-- in manager_group_units. This CANNOT be done with a partial UNIQUE index,
-- because the partial predicate would need a subquery into manager_groups
-- (WHERE is_corporate = false), and Postgres index predicates/expressions cannot
-- contain subqueries or reference other tables.
--
-- The only correct way is a BEFORE INSERT/UPDATE trigger on manager_group_units
-- that counts existing rows for the group and rejects the write when the group
-- is non-corporate and already has one unit, e.g.:
--
--   CREATE OR REPLACE FUNCTION enforce_single_unit_for_noncorp()
--   RETURNS TRIGGER AS $$
--   DECLARE _is_corp BOOLEAN; _cnt INT;
--   BEGIN
--     SELECT is_corporate INTO _is_corp FROM manager_groups WHERE id = NEW.group_id;
--     IF _is_corp IS NOT TRUE THEN
--       SELECT count(*) INTO _cnt FROM manager_group_units
--        WHERE group_id = NEW.group_id AND id <> COALESCE(NEW.id, gen_random_uuid());
--       IF _cnt >= 1 THEN
--         RAISE EXCEPTION 'non-corporate manager_group % may map to at most one UNIDADE', NEW.group_id;
--       END IF;
--     END IF;
--     RETURN NEW;
--   END; $$ LANGUAGE plpgsql;
--
-- Left UNCOMMENTED-out / unimplemented here to keep this migration narrowly
-- scoped to the RLS over-read fix and avoid altering write behaviour. The 1-unit
-- rule is currently enforced at the application layer (see original migration,
-- section 2). Implement the trigger above in a dedicated follow-up if DB-level
-- enforcement is required.
-- =============================================================================
