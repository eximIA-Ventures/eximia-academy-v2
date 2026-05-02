-- Slide Reflections: student free-text responses per slide
-- Supports interaction_type 'reflection' in chapter_slides

BEGIN;
-- =============================================================
-- 1. Create slide_reflections table
-- =============================================================

CREATE TABLE slide_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slide_id UUID NOT NULL REFERENCES chapter_slides(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  response TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One response per student per slide
  UNIQUE(student_id, slide_id)
);
-- =============================================================
-- 2. Indexes
-- =============================================================

CREATE INDEX idx_slide_reflections_slide ON slide_reflections(slide_id);
CREATE INDEX idx_slide_reflections_tenant ON slide_reflections(tenant_id);
CREATE INDEX idx_slide_reflections_student_tenant ON slide_reflections(student_id, tenant_id);
-- =============================================================
-- 3. RLS
-- =============================================================

ALTER TABLE slide_reflections ENABLE ROW LEVEL SECURITY;
-- Students can read their own reflections
CREATE POLICY "sr_student_select" ON slide_reflections FOR SELECT
  USING (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
  );
-- Students can insert their own reflections
CREATE POLICY "sr_student_insert" ON slide_reflections FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
    AND auth_user_role() = 'student'
  );
-- Students can update their own reflections
CREATE POLICY "sr_student_update" ON slide_reflections FOR UPDATE
  USING (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
  )
  WITH CHECK (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
  );
-- Managers, admins, and instructors can read all reflections in their tenant
CREATE POLICY "sr_content_role_select" ON slide_reflections FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('instructor', 'manager', 'admin')
  );
-- Super admin bypass
CREATE POLICY "sr_super_admin" ON slide_reflections FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
-- =============================================================
-- 4. Updated_at trigger
-- =============================================================

CREATE OR REPLACE FUNCTION set_slide_reflections_updated_at_fn()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER set_slide_reflections_updated_at
  BEFORE UPDATE ON slide_reflections
  FOR EACH ROW
  EXECUTE FUNCTION set_slide_reflections_updated_at_fn();
COMMIT;
