-- =============================================================
-- Areas + Role Unification Migration
-- Unifies teacher+manager into single 'manager' role
-- Adds formal areas/departments for scope control
-- =============================================================

-- =============================================================
-- 1. New Tables
-- =============================================================

-- 1.1 areas — formal departments within a tenant
CREATE TABLE IF NOT EXISTS areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, slug)
);
-- 1.2 user_areas — join table for user-area membership
CREATE TABLE IF NOT EXISTS user_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, area_id)
);
-- =============================================================
-- 2. area_id on courses
-- =============================================================

ALTER TABLE courses ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES areas(id) ON DELETE SET NULL;
-- =============================================================
-- 3. Indexes
-- =============================================================

CREATE INDEX IF NOT EXISTS idx_areas_tenant ON areas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_areas_user ON user_areas(user_id);
CREATE INDEX IF NOT EXISTS idx_user_areas_area ON user_areas(area_id);
CREATE INDEX IF NOT EXISTS idx_courses_area ON courses(area_id);
-- =============================================================
-- 4. Role Unification: teacher → manager
-- =============================================================

-- 4.1 Drop old constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
-- 4.2 Migrate teacher → manager
UPDATE users SET role = 'manager' WHERE role = 'teacher';
-- 4.3 Add new constraint (no teacher)
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('student', 'manager', 'admin', 'super_admin'));
-- =============================================================
-- 5. Helper Function
-- =============================================================

CREATE OR REPLACE FUNCTION auth_user_area_ids() RETURNS UUID[] AS $$
  SELECT COALESCE(array_agg(area_id), '{}'::UUID[])
  FROM user_areas WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;
-- =============================================================
-- 6. RLS for areas + user_areas
-- =============================================================

ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_areas ENABLE ROW LEVEL SECURITY;
-- areas: SELECT for all tenant users
DROP POLICY IF EXISTS areas_select ON areas;
CREATE POLICY areas_select ON areas FOR SELECT
  USING (tenant_id = auth_tenant_id());
-- areas: INSERT/UPDATE/DELETE for admin only
DROP POLICY IF EXISTS areas_insert ON areas;
CREATE POLICY areas_insert ON areas FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin');
DROP POLICY IF EXISTS areas_update ON areas;
CREATE POLICY areas_update ON areas FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin');
DROP POLICY IF EXISTS areas_delete ON areas;
CREATE POLICY areas_delete ON areas FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin');
-- user_areas: SELECT for tenant users
DROP POLICY IF EXISTS user_areas_select ON user_areas;
CREATE POLICY user_areas_select ON user_areas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = user_areas.user_id
      AND u.tenant_id = auth_tenant_id()
    )
  );
-- user_areas: INSERT for admin and manager
DROP POLICY IF EXISTS user_areas_insert ON user_areas;
CREATE POLICY user_areas_insert ON user_areas FOR INSERT
  WITH CHECK (
    auth_user_role() IN ('admin', 'manager')
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = user_areas.user_id
      AND u.tenant_id = auth_tenant_id()
    )
  );
-- user_areas: DELETE for admin and manager
DROP POLICY IF EXISTS user_areas_delete ON user_areas;
CREATE POLICY user_areas_delete ON user_areas FOR DELETE
  USING (
    auth_user_role() IN ('admin', 'manager')
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = user_areas.user_id
      AND u.tenant_id = auth_tenant_id()
    )
  );
-- =============================================================
-- 7. Update existing RLS policies: teacher → manager
-- =============================================================

-- courses_insert: teacher → manager
DROP POLICY IF EXISTS courses_insert ON courses;
CREATE POLICY courses_insert ON courses FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('manager', 'admin')
  );
-- chapters_insert: teacher → manager
DROP POLICY IF EXISTS chapters_insert ON chapters;
CREATE POLICY chapters_insert ON chapters FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('manager', 'admin')
  );
-- chapters_update: teacher → manager
DROP POLICY IF EXISTS chapters_update ON chapters;
CREATE POLICY chapters_update ON chapters FOR UPDATE
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('manager', 'admin')
  );
-- questions_insert: teacher → manager
DROP POLICY IF EXISTS questions_insert ON questions;
CREATE POLICY questions_insert ON questions FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('manager', 'admin')
  );
-- questions_update: teacher → manager
DROP POLICY IF EXISTS questions_update ON questions;
CREATE POLICY questions_update ON questions FOR UPDATE
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('manager', 'admin')
  );
-- enrollments_select: teacher → manager
DROP POLICY IF EXISTS enrollments_select ON enrollments;
CREATE POLICY enrollments_select ON enrollments FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND (student_id = auth.uid() OR auth_user_role() IN ('manager', 'admin'))
  );
-- enrollments_insert: teacher → manager
DROP POLICY IF EXISTS enrollments_insert ON enrollments;
CREATE POLICY enrollments_insert ON enrollments FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('manager', 'admin')
  );
-- enrollments_update: teacher → manager
DROP POLICY IF EXISTS enrollments_update ON enrollments;
CREATE POLICY enrollments_update ON enrollments FOR UPDATE
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('manager', 'admin')
  );
-- sessions_select: teacher → manager
DROP POLICY IF EXISTS sessions_select ON sessions;
CREATE POLICY sessions_select ON sessions FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND (student_id = auth.uid() OR auth_user_role() IN ('manager', 'admin'))
  );
-- analyses_select: teacher → manager
DROP POLICY IF EXISTS analyses_select ON analyses;
CREATE POLICY analyses_select ON analyses FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('manager', 'admin')
  );
-- qa_reports_select: teacher → manager
DROP POLICY IF EXISTS qa_reports_select ON qa_reports;
CREATE POLICY qa_reports_select ON qa_reports FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('manager', 'admin')
  );
-- =============================================================
-- 8. Seed: Create "Geral" area per tenant + assign users + courses
-- =============================================================

-- 8.1 Create "Geral" area for each existing tenant
INSERT INTO areas (id, tenant_id, name, slug, description)
SELECT
  gen_random_uuid(),
  t.id,
  'Geral',
  'geral',
  'Area padrao criada durante migracao'
FROM tenants t
ON CONFLICT (tenant_id, slug) DO NOTHING;
-- 8.2 Assign all non-super_admin users to "Geral" area of their tenant
INSERT INTO user_areas (user_id, area_id)
SELECT u.id, a.id
FROM users u
JOIN areas a ON a.tenant_id = u.tenant_id AND a.slug = 'geral'
WHERE u.tenant_id IS NOT NULL
  AND u.role != 'super_admin'
ON CONFLICT (user_id, area_id) DO NOTHING;
-- 8.3 Assign all existing courses to "Geral" area of their tenant
UPDATE courses c
SET area_id = a.id
FROM areas a
WHERE a.tenant_id = c.tenant_id
  AND a.slug = 'geral';
