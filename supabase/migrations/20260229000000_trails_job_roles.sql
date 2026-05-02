-- Epic 27: Learning Trails & Job Roles
-- Story 27.1: DB Migration

BEGIN;

-- ============================================================
-- 1. job_roles table
-- ============================================================
CREATE TABLE job_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  seniority_level TEXT NOT NULL DEFAULT 'mid' CHECK (seniority_level IN ('junior', 'mid', 'senior', 'lead', 'manager')),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_job_roles_tenant ON job_roles(tenant_id);
CREATE INDEX idx_job_roles_area ON job_roles(area_id);

ALTER TABLE job_roles ENABLE ROW LEVEL SECURITY;

-- Super admin bypass
CREATE POLICY "jr_super_admin" ON job_roles FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Instructor/admin/manager full CRUD
CREATE POLICY "jr_content_role_all" ON job_roles FOR ALL
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('instructor', 'manager', 'admin')
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('instructor', 'manager', 'admin')
  );

-- Student read-only
CREATE POLICY "jr_student_select" ON job_roles FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'student');

-- ============================================================
-- 2. learning_trails table
-- ============================================================
CREATE TABLE learning_trails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_job_role_id UUID REFERENCES job_roles(id) ON DELETE SET NULL,
  estimated_hours INTEGER,
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_learning_trails_tenant ON learning_trails(tenant_id);
CREATE INDEX idx_learning_trails_job_role ON learning_trails(target_job_role_id);
CREATE INDEX idx_learning_trails_status ON learning_trails(status);

ALTER TABLE learning_trails ENABLE ROW LEVEL SECURITY;

-- Super admin bypass
CREATE POLICY "lt_super_admin" ON learning_trails FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Instructor/admin CRUD
CREATE POLICY "lt_content_role_all" ON learning_trails FOR ALL
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('instructor', 'admin')
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('instructor', 'admin')
  );

-- Manager read-only
CREATE POLICY "lt_manager_select" ON learning_trails FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'manager');

-- Student read active trails (enrolled or public)
CREATE POLICY "lt_student_select" ON learning_trails FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() = 'student'
    AND status = 'active'
  );

-- ============================================================
-- 3. trail_courses junction table
-- ============================================================
CREATE TABLE trail_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id UUID NOT NULL REFERENCES learning_trails(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  "order" INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT true,
  estimated_hours INTEGER,
  UNIQUE(trail_id, course_id)
);

CREATE INDEX idx_trail_courses_trail ON trail_courses(trail_id);
CREATE INDEX idx_trail_courses_course ON trail_courses(course_id);

ALTER TABLE trail_courses ENABLE ROW LEVEL SECURITY;

-- Super admin bypass
CREATE POLICY "tc_super_admin" ON trail_courses FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Instructor/admin CRUD via trail ownership
CREATE POLICY "tc_content_role_all" ON trail_courses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM learning_trails lt
      WHERE lt.id = trail_courses.trail_id
      AND lt.tenant_id = auth_tenant_id()
      AND auth_user_role() IN ('instructor', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM learning_trails lt
      WHERE lt.id = trail_courses.trail_id
      AND lt.tenant_id = auth_tenant_id()
      AND auth_user_role() IN ('instructor', 'admin')
    )
  );

-- Manager/student read-only via trail
CREATE POLICY "tc_read" ON trail_courses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM learning_trails lt
      WHERE lt.id = trail_courses.trail_id
      AND lt.tenant_id = auth_tenant_id()
    )
  );

-- ============================================================
-- 4. Extend enrollments with trail columns
-- ============================================================
ALTER TABLE enrollments ADD COLUMN trail_id UUID REFERENCES learning_trails(id) ON DELETE SET NULL;
ALTER TABLE enrollments ADD COLUMN trail_course_order INTEGER;

CREATE INDEX idx_enrollments_trail ON enrollments(trail_id);

-- ============================================================
-- 5. Extend users with job_role_id
-- ============================================================
ALTER TABLE users ADD COLUMN job_role_id UUID REFERENCES job_roles(id) ON DELETE SET NULL;

CREATE INDEX idx_users_job_role ON users(job_role_id);

COMMIT;
