-- Leader Role Migration
-- Adds 'leader' role: a learning companion who can see their team's
-- progress (via shared area) but cannot manage platform or content.
-- Based on Roberto Tranjan's Metanoia: "Lider que e lider, educa."

BEGIN;

-- ============================================================
-- 1. Extend role CHECK constraint to include 'leader'
-- ============================================================

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('student', 'leader', 'manager', 'admin', 'super_admin', 'instructor'));

-- ============================================================
-- 2. Leader can SELECT users in their same area(s)
-- ============================================================
-- Leaders need to see team member names, emails, avatars
-- Scope: users who share at least one area with the leader

DROP POLICY IF EXISTS users_leader_select ON users;
CREATE POLICY users_leader_select ON users FOR SELECT
  USING (
    auth_user_role() = 'leader'
    AND tenant_id = auth_tenant_id()
    AND (
      -- Leader can always see themselves
      id = auth.uid()
      OR
      -- Leader can see users in their area(s)
      id IN (
        SELECT ua2.user_id
        FROM user_areas ua1
        JOIN user_areas ua2 ON ua1.area_id = ua2.area_id
        WHERE ua1.user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- 3. Leader can SELECT enrollments for users in their area
-- ============================================================

DROP POLICY IF EXISTS enrollments_leader_select ON enrollments;
CREATE POLICY enrollments_leader_select ON enrollments FOR SELECT
  USING (
    auth_user_role() = 'leader'
    AND tenant_id = auth_tenant_id()
    AND (
      -- Own enrollments
      student_id = auth.uid()
      OR
      -- Team member enrollments
      student_id IN (
        SELECT ua2.user_id
        FROM user_areas ua1
        JOIN user_areas ua2 ON ua1.area_id = ua2.area_id
        WHERE ua1.user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- 4. Leader can SELECT sessions for users in their area
-- ============================================================

DROP POLICY IF EXISTS sessions_leader_select ON sessions;
CREATE POLICY sessions_leader_select ON sessions FOR SELECT
  USING (
    auth_user_role() = 'leader'
    AND tenant_id = auth_tenant_id()
    AND (
      -- Own sessions
      student_id = auth.uid()
      OR
      -- Team member sessions
      student_id IN (
        SELECT ua2.user_id
        FROM user_areas ua1
        JOIN user_areas ua2 ON ua1.area_id = ua2.area_id
        WHERE ua1.user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- 5. Leader can SELECT slide_reflections for users in their area
-- ============================================================

DROP POLICY IF EXISTS sr_leader_select ON slide_reflections;
CREATE POLICY sr_leader_select ON slide_reflections FOR SELECT
  USING (
    auth_user_role() = 'leader'
    AND tenant_id = auth_tenant_id()
    AND (
      student_id = auth.uid()
      OR
      student_id IN (
        SELECT ua2.user_id
        FROM user_areas ua1
        JOIN user_areas ua2 ON ua1.area_id = ua2.area_id
        WHERE ua1.user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- 6. Leader can SELECT courses (read-only, same as student)
-- ============================================================
-- courses_select already uses tenant_id = auth_tenant_id()
-- which covers all tenant users. No change needed.

-- ============================================================
-- 7. Leader can SELECT chapters (read-only)
-- ============================================================
-- chapters_select already uses tenant_id = auth_tenant_id()
-- which covers all tenant users. No change needed.

-- ============================================================
-- 8. Leader can SELECT areas and user_areas
-- ============================================================
-- areas_select already allows all tenant users.
-- user_areas_select allows any user in the same tenant.
-- No changes needed.

-- ============================================================
-- 9. Leader can INSERT/SELECT messages (for own sessions)
-- ============================================================
-- messages RLS already allows student_id = auth.uid() for
-- session-based access. Leader uses the same mechanism for
-- their own learning. No change needed.

-- ============================================================
-- 10. Create leader_comments table for reflection feedback
-- ============================================================
-- Leaders can leave encouraging comments on team reflections

CREATE TABLE IF NOT EXISTS leader_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reflection_id UUID NOT NULL REFERENCES slide_reflections(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One comment per leader per reflection
  UNIQUE(leader_id, reflection_id)
);

CREATE INDEX idx_leader_comments_reflection ON leader_comments(reflection_id);
CREATE INDEX idx_leader_comments_tenant ON leader_comments(tenant_id);

ALTER TABLE leader_comments ENABLE ROW LEVEL SECURITY;

-- Leader can CRUD own comments
CREATE POLICY lc_leader_all ON leader_comments FOR ALL
  USING (
    leader_id = auth.uid()
    AND tenant_id = auth_tenant_id()
  )
  WITH CHECK (
    leader_id = auth.uid()
    AND tenant_id = auth_tenant_id()
    AND auth_user_role() = 'leader'
  );

-- Students can see comments on their own reflections
CREATE POLICY lc_student_select ON leader_comments FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND reflection_id IN (
      SELECT id FROM slide_reflections WHERE student_id = auth.uid()
    )
  );

-- Admin/manager can see all comments in tenant
CREATE POLICY lc_admin_select ON leader_comments FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('admin', 'manager', 'instructor')
  );

-- Super admin bypass
CREATE POLICY lc_super_admin ON leader_comments FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

COMMIT;
