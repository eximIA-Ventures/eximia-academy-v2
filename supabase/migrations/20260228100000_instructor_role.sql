-- Story 25.1: DB Migration — Instructor Role
-- Epic 25: WS3 Instructor Role & RBAC Enhancement
--
-- Adds instructor role to the platform:
-- 1. Extends role CHECK constraint with 'instructor'
-- 2. Creates instructor_permissions table
-- 3. Updates RLS policies to allow instructor content creation
-- 4. Adds RLS policies for instructor_permissions table

BEGIN;

-- ============================================================
-- 1. Extend role CHECK constraint
-- ============================================================

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('student', 'manager', 'admin', 'super_admin', 'instructor'));

-- ============================================================
-- 2. Create instructor_permissions table
-- ============================================================

CREATE TABLE IF NOT EXISTS instructor_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  can_create_courses BOOLEAN NOT NULL DEFAULT true,
  can_create_quizzes BOOLEAN NOT NULL DEFAULT true,
  can_manage_trails BOOLEAN NOT NULL DEFAULT false,
  can_view_analytics BOOLEAN NOT NULL DEFAULT true,
  can_manage_enrollments BOOLEAN NOT NULL DEFAULT true,
  assigned_area_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

ALTER TABLE instructor_permissions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. RLS policies for instructor_permissions
-- ============================================================

-- Admin/super_admin can CRUD
CREATE POLICY "ip_admin_all" ON instructor_permissions FOR ALL
  USING (
    auth_user_role() IN ('admin', 'super_admin')
    OR (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin')
  )
  WITH CHECK (
    auth_user_role() IN ('admin', 'super_admin')
    OR (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin')
  );

-- Instructor can SELECT own permissions
CREATE POLICY "ip_instructor_select_own" ON instructor_permissions FOR SELECT
  USING (
    user_id = auth.uid()
    AND tenant_id = auth_tenant_id()
  );

-- Super admin bypass
CREATE POLICY "ip_super_admin" ON instructor_permissions FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ============================================================
-- 4. Update courses RLS policies — add instructor
-- ============================================================

DROP POLICY IF EXISTS courses_insert ON courses;
CREATE POLICY courses_insert ON courses FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('manager', 'admin', 'instructor')
  );

DROP POLICY IF EXISTS courses_update ON courses;
CREATE POLICY courses_update ON courses FOR UPDATE
  USING (
    tenant_id = auth_tenant_id()
    AND (created_by = auth.uid() OR auth_user_role() IN ('admin', 'manager', 'instructor'))
  );

-- ============================================================
-- 5. Update chapters RLS policies — add instructor
-- ============================================================

DROP POLICY IF EXISTS chapters_insert ON chapters;
CREATE POLICY chapters_insert ON chapters FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('manager', 'admin', 'instructor')
  );

DROP POLICY IF EXISTS chapters_update ON chapters;
CREATE POLICY chapters_update ON chapters FOR UPDATE
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('manager', 'admin', 'instructor')
  );

-- ============================================================
-- 6. Update questions RLS policies — add instructor
-- ============================================================

DROP POLICY IF EXISTS questions_insert ON questions;
CREATE POLICY questions_insert ON questions FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('manager', 'admin', 'instructor')
  );

DROP POLICY IF EXISTS questions_update ON questions;
CREATE POLICY questions_update ON questions FOR UPDATE
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('manager', 'admin', 'instructor')
  );

-- ============================================================
-- 7. Update enrollments RLS policies — instructor can SELECT/INSERT
-- ============================================================

DROP POLICY IF EXISTS enrollments_insert ON enrollments;
CREATE POLICY enrollments_insert ON enrollments FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('manager', 'admin', 'instructor')
  );

-- ============================================================
-- 8. Update sessions RLS — instructor can SELECT for their tenant
-- ============================================================
-- sessions_select already allows all tenant users (tenant_id = auth_tenant_id()),
-- so instructor is already covered for SELECT. No change needed.

-- ============================================================
-- 9. Update blueprint RLS policies — instructor can INSERT/SELECT
-- ============================================================

DROP POLICY IF EXISTS "bp_insert" ON course_blueprints;
CREATE POLICY "bp_insert" ON course_blueprints FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('manager', 'admin', 'instructor')
  );

DROP POLICY IF EXISTS "bp_mod_insert" ON blueprint_modules;
CREATE POLICY "bp_mod_insert" ON blueprint_modules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM course_blueprints
      WHERE id = blueprint_modules.blueprint_id
      AND tenant_id = auth_tenant_id()
    )
    AND auth_user_role() IN ('manager', 'admin', 'instructor')
  );

-- ============================================================
-- 10. Verify instructor CANNOT access users table directly
-- ============================================================
-- The existing users_select policy uses tenant_id = auth_tenant_id()
-- which means instructor CAN read users in their tenant (needed for
-- seeing student names). The users_update policy restricts writes to
-- admin/self. No changes needed — instructor cannot modify other users.

COMMIT;
