-- =============================================================================
-- Migration: ENGAGEMENT RLS — group-scope the manager WRITE path
-- =============================================================================
-- WHAT THIS PROTECTS (and what it does NOT):
--   The Engagement Engine SELECT path is already group-scoped — a gestor may
--   READ a notification only for a recipient on one of their teams
--   (notifications_select, migration 20260604120000). But the WRITE policies
--   TO authenticated were TENANT-WIDE: any `manager` could INSERT a notification
--   for ANY student in the tenant (notifications_insert) and write ANY
--   nudge_suggestions row (ns_write). That left a real, exploitable vector: a
--   manager hitting PostgREST DIRECTLY with the anon key + their own JWT (i.e.
--   NOT going through our endpoints) could write for students outside their
--   team, the WRITE mirror of the SELECT-scoped/WRITE-tenant-wide asymmetry.
--
--   This migration recreates BOTH write policies with the SAME group predicate
--   the SELECT policy already proves:
--       recipient_id IN (
--         SELECT mgm.student_id FROM manager_group_members mgm
--         WHERE mgm.group_id = ANY (auth_managed_group_ids())
--       )
--   so a `manager` writing under their OWN authenticated JWT may write ONLY for
--   students on a team they OWN. `admin` stays tenant-wide and `super_admin`
--   keeps its cross-tenant bypass — exactly as the read side already behaves.
--
-- SCOPE OF THESE POLICIES — READ CAREFULLY:
--   These policies are TO authenticated, so they ONLY constrain the DIRECT
--   authenticated-client vector described above (a gestor's JWT hitting
--   notifications / nudge_suggestions through PostgREST). They are DEFENCE-IN-
--   DEPTH for that vector, not the trava of the product path.
--
--   They DO NOT run on the product path endpoint→engine. That path writes via
--   the service_role (notifications_service / ns_service USING(true), BYPASSRLS),
--   so this TO authenticated predicate is NEVER evaluated there. The PRIMARY
--   non-leakage trava on the product path is the APP LAYER: the route + engine
--   re-resolve the manager's team scope and intersect studentIds (`safeIds`)
--   BEFORE any service_role write. This migration closes the OTHER door (the
--   direct JWT vector) that the app filter cannot reach.
--
-- Helpers reused (defined in earlier migrations, unchanged):
--   auth_tenant_id()         -> UUID    tenant of the authenticated user
--   auth_user_role()         -> TEXT    role of the authenticated user
--   is_super_admin()         -> BOOL    active super_admin (cross-tenant bypass)
--   auth_managed_group_ids() -> UUID[]  manager_group ids owned by the caller
--
-- IDEMPOTENT: every policy is DROP POLICY IF EXISTS then CREATE. The service
-- role policies (notifications_service / ns_service) are NOT touched — server
-- writes via the service client keep their own RLS-bypassing path, re-scoped in
-- application code. The super_admin policies are also left intact.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. notifications — INSERT: admin tenant-wide; manager group-scoped
-- =============================================================================
-- Constrains the DIRECT authenticated-client vector ONLY (a gestor's JWT via
-- PostgREST). Mirrors the notifications_select group predicate. A manager may
-- only INSERT a row whose recipient is a member of a manager_group they OWN.
-- admin keeps the tenant-wide insert; super_admin uses notifications_super_admin
-- (untouched). The recipient-membership EXISTS clause (tenant guard) is preserved
-- from the original policy so a forged tenant_id/recipient_id still can't cross
-- tenants. Does NOT fire on the product path (service_role / BYPASSRLS) — that
-- path is gated by the app-layer safeIds filter in the route + engine.
-- =============================================================================
DROP POLICY IF EXISTS notifications_insert ON notifications;
CREATE POLICY notifications_insert ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = notifications.recipient_id
        AND u.tenant_id = auth_tenant_id()
    )
    AND (
      -- admin: tenant-wide (unchanged authority).
      auth_user_role() = 'admin'
      -- manager: ONLY recipients on a team they own (same predicate as SELECT).
      OR (
        auth_user_role() = 'manager'
        AND notifications.recipient_id IN (
          SELECT mgm.student_id
          FROM manager_group_members mgm
          WHERE mgm.group_id = ANY (auth_managed_group_ids())
        )
      )
    )
  );

-- =============================================================================
-- 2. nudge_suggestions — WRITE: admin tenant-wide; manager group-scoped
-- =============================================================================
-- Constrains the DIRECT authenticated-client vector ONLY (a gestor's JWT via
-- PostgREST). A manager may only write a suggestion whose EVERY target student
-- is on a team they own. `target_student_ids` is a JSONB array of users.id — the
-- NOT EXISTS against jsonb_array_elements_text asserts "no target falls outside
-- the owned teams". An empty array trivially passes the NOT EXISTS (no offending
-- element), which is harmless: a suggestion with no targets materialises nothing.
-- admin stays tenant-wide; super_admin uses ns_super_admin (untouched). Does NOT
-- fire on the product path (service_role / BYPASSRLS) — the app-layer safeIds
-- filter is the trava there.
-- =============================================================================
DROP POLICY IF EXISTS ns_write ON nudge_suggestions;
CREATE POLICY ns_write ON nudge_suggestions FOR ALL
  TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND (
      auth_user_role() = 'admin'
      OR (
        auth_user_role() = 'manager'
        AND NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(nudge_suggestions.target_student_ids) AS t(student_id)
          WHERE t.student_id::uuid NOT IN (
            SELECT mgm.student_id
            FROM manager_group_members mgm
            WHERE mgm.group_id = ANY (auth_managed_group_ids())
          )
        )
      )
    )
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND (
      auth_user_role() = 'admin'
      OR (
        auth_user_role() = 'manager'
        AND NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(nudge_suggestions.target_student_ids) AS t(student_id)
          WHERE t.student_id::uuid NOT IN (
            SELECT mgm.student_id
            FROM manager_group_members mgm
            WHERE mgm.group_id = ANY (auth_managed_group_ids())
          )
        )
      )
    )
  );

COMMIT;
