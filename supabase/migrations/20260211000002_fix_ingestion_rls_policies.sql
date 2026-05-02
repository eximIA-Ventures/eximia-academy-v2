-- =============================================================
-- Epic 13: Fix RLS policies for content_ingestions
-- Adds teacher and super_admin roles, fixes UPDATE WITH CHECK
-- =============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "ingestions_select" ON content_ingestions;
DROP POLICY IF EXISTS "ingestions_insert" ON content_ingestions;
DROP POLICY IF EXISTS "ingestions_update" ON content_ingestions;
DROP POLICY IF EXISTS "ingestions_delete" ON content_ingestions;

-- SELECT: managers, admins, teachers, and super_admins can view tenant ingestions
CREATE POLICY "ingestions_select" ON content_ingestions FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('teacher', 'manager', 'admin', 'super_admin')
  );

-- INSERT: teachers, managers, and admins can create ingestions
CREATE POLICY "ingestions_insert" ON content_ingestions FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('teacher', 'manager', 'admin', 'super_admin')
  );

-- UPDATE: creators can update their own ingestions (with role check)
CREATE POLICY "ingestions_update" ON content_ingestions FOR UPDATE
  USING (
    tenant_id = auth_tenant_id()
    AND created_by = auth.uid()
    AND auth_user_role() IN ('teacher', 'manager', 'admin', 'super_admin')
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('teacher', 'manager', 'admin', 'super_admin')
  );

-- DELETE: admins and super_admins can delete ingestions
CREATE POLICY "ingestions_delete" ON content_ingestions FOR DELETE
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('admin', 'super_admin')
  );
