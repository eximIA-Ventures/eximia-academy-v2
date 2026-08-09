-- =============================================================================
-- Migration: PERSONAL TEMPLATES — Fase 0 (schema + RLS ONLY)
--            E12 Rodada 5, item 5 (achado Dave Malouf, painel real 2026-07-10)
-- =============================================================================
-- Extends notification_templates (20260604120000_engagement_engine.sql) with a
-- SCOPE so a manager can, in a FUTURE round, own PERSONAL templates that no one
-- else sees, without touching the shared org catalogue.
--
-- SCOPE OF THIS MIGRATION (deliberately minimal):
--   • ADD notification_templates.scope         ('org' | 'personal', default 'org')
--   • ADD notification_templates.owner_user_id (nullable; set only for personal)
--   • ADJUST RLS so a `personal` template is visible/editable ONLY by its owner;
--     `org` templates keep EXACTLY the current policy (any manager/admin of the
--     tenant may edit — a KNOWN latent risk Malouf registered, NOT resolved here,
--     just not made worse).
--
-- NON-GOALS (explicitly out of scope, NO UI this round):
--   • No UI to create/edit personal templates.
--   • No change to the org-template edit permission model.
--
-- BACKWARD COMPATIBILITY: additive + retrocompatible. Every existing template
-- becomes scope='org' (the column default + explicit backfill), owner_user_id
-- stays NULL — so the current behaviour is byte-for-byte preserved.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Columns (additive). scope defaults to 'org' so existing rows + any code
--    that inserts without scope keep the shared behaviour. owner_user_id is
--    nullable and only meaningful when scope='personal'.
-- -----------------------------------------------------------------------------
ALTER TABLE notification_templates
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'org'
    CHECK (scope IN ('org', 'personal')),
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Data integrity: a personal template MUST have an owner; an org template MUST
-- NOT. Enforced at the DB so a malformed insert can never produce an orphan
-- personal template (visible to nobody) or an owned org template (ambiguous).
ALTER TABLE notification_templates
  DROP CONSTRAINT IF EXISTS notification_templates_scope_owner_chk;
ALTER TABLE notification_templates
  ADD CONSTRAINT notification_templates_scope_owner_chk
  CHECK (
    (scope = 'org' AND owner_user_id IS NULL)
    OR (scope = 'personal' AND owner_user_id IS NOT NULL)
  );

COMMENT ON COLUMN notification_templates.scope IS
  'org = shared tenant catalogue (any manager/admin edits); personal = owned by owner_user_id only.';
COMMENT ON COLUMN notification_templates.owner_user_id IS
  'Owner of a personal template (scope=personal). NULL for org templates.';

-- Explicit backfill (belt-and-suspenders alongside the column DEFAULT): every
-- pre-existing template is an org template.
UPDATE notification_templates SET scope = 'org' WHERE scope IS NULL;

-- Partial index for the owner-scoped read path (personal templates by owner).
CREATE INDEX IF NOT EXISTS idx_notif_templates_owner
  ON notification_templates(owner_user_id)
  WHERE scope = 'personal';

-- -----------------------------------------------------------------------------
-- 2. RLS — differentiate by scope.
--    • super_admin: unchanged FOR ALL bypass (nt_super_admin, not redefined here).
--    • org template   → the CURRENT policy (managing/teaching read; admin/manager
--                       write) — unchanged behaviour, just re-expressed with the
--                       explicit `scope = 'org'` guard.
--    • personal template → visible/editable ONLY by owner_user_id = auth.uid().
-- -----------------------------------------------------------------------------

-- SELECT: org templates → any tenant member with a managing/teaching role
-- (unchanged). personal templates → only the owner sees them.
DROP POLICY IF EXISTS nt_select ON notification_templates;
CREATE POLICY nt_select ON notification_templates FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND (
      (
        scope = 'org'
        AND auth_user_role() IN ('admin', 'manager', 'instructor', 'teacher')
      )
      OR (scope = 'personal' AND owner_user_id = auth.uid())
    )
  );

-- WRITE (INSERT/UPDATE/DELETE): org templates → admin/manager of the tenant
-- (unchanged — the known latent risk, NOT resolved here). personal templates →
-- only the owner (and the owner must be the caller on INSERT, WITH CHECK).
DROP POLICY IF EXISTS nt_write ON notification_templates;
CREATE POLICY nt_write ON notification_templates FOR ALL
  USING (
    tenant_id = auth_tenant_id()
    AND (
      (scope = 'org' AND auth_user_role() IN ('admin', 'manager'))
      OR (scope = 'personal' AND owner_user_id = auth.uid())
    )
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND (
      (scope = 'org' AND auth_user_role() IN ('admin', 'manager'))
      OR (scope = 'personal' AND owner_user_id = auth.uid())
    )
  );

COMMIT;
