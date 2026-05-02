-- =============================================================
-- Epic 11: Super Admin, Multi-Company, Whitelabel Pago
-- Story 11.1 — Schema, RLS, Audit Log
-- =============================================================

-- 1. Expand role CHECK constraint to include super_admin
-- (initial schema uses TEXT + CHECK, not a PostgreSQL ENUM type)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('student', 'teacher', 'admin', 'manager', 'super_admin'));
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
-- 4b. Ensure users.status column exists (may be missing if initial schema was applied before it was added)
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'inactive'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- 4c. [E11-H4 FIX] Tenant status column for soft delete
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
DO $$ BEGIN
  ALTER TABLE tenants ADD CONSTRAINT tenants_status_check CHECK (status IN ('active', 'inactive'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
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
DECLARE
  result BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'super_admin'
    AND status = 'active'
    AND deleted_at IS NULL
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;
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
