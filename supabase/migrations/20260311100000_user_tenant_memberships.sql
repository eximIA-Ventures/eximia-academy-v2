-- =============================================================
-- Multi-tenant user support: user_tenant_memberships
-- Allows users to belong to multiple tenants and switch between them.
-- auth_tenant_id() remains unchanged — tenant switch updates users.tenant_id directly.
-- =============================================================

-- 1. Junction table (idempotent)
CREATE TABLE IF NOT EXISTS user_tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_utm_user ON user_tenant_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_utm_tenant ON user_tenant_memberships(tenant_id);
ALTER TABLE user_tenant_memberships ENABLE ROW LEVEL SECURITY;
-- Users can see their own memberships (needed for tenant switcher)
DROP POLICY IF EXISTS "utm_select_own" ON user_tenant_memberships;
CREATE POLICY "utm_select_own" ON user_tenant_memberships FOR SELECT
  USING (user_id = auth.uid());
-- Admins/super_admins can manage memberships
DROP POLICY IF EXISTS "utm_admin_manage" ON user_tenant_memberships;
CREATE POLICY "utm_admin_manage" ON user_tenant_memberships FOR ALL
  USING (auth_user_role() IN ('admin', 'super_admin'));
-- 2. Populate from existing users (every user gets a membership for their current tenant)
INSERT INTO user_tenant_memberships (user_id, tenant_id, role)
SELECT id, tenant_id, role FROM users WHERE tenant_id IS NOT NULL
ON CONFLICT (user_id, tenant_id) DO NOTHING;
-- 3. Add Caio Pinheiro + Rinaldo to RP tenant (they're already in MG)
INSERT INTO user_tenant_memberships (user_id, tenant_id, role)
VALUES
  (
    (SELECT id FROM users WHERE email = 'caio.pinheiro@cory.com.br'),
    'c7d899f8-0e81-4059-b609-c6b77f6f0826',
    'student'
  ),
  (
    (SELECT id FROM users WHERE email = 'rinaldo.capitelli@cory.com.br'),
    'c7d899f8-0e81-4059-b609-c6b77f6f0826',
    'student'
  )
ON CONFLICT (user_id, tenant_id) DO NOTHING;
-- 4. Allow users to see tenants they have membership in (for tenant switcher)
DROP POLICY IF EXISTS tenants_select ON tenants;
CREATE POLICY tenants_select ON tenants FOR SELECT
  USING (
    id = auth_tenant_id()
    OR id IN (SELECT tenant_id FROM user_tenant_memberships WHERE user_id = auth.uid())
  );
-- 5. Allow users to always see their own profile (even if active tenant differs momentarily)
DROP POLICY IF EXISTS users_select ON users;
CREATE POLICY users_select ON users FOR SELECT
  USING (tenant_id = auth_tenant_id() OR id = auth.uid());
