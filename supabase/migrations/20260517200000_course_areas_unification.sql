-- ============================================================================
-- Course-Areas junction table (many-to-many)
-- A single course can belong to multiple areas/units
-- ============================================================================

CREATE TABLE IF NOT EXISTS course_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, area_id)
);

CREATE INDEX idx_course_areas_course ON course_areas(course_id);
CREATE INDEX idx_course_areas_area ON course_areas(area_id);
CREATE INDEX idx_course_areas_tenant ON course_areas(tenant_id);

ALTER TABLE course_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_course_areas" ON course_areas
  USING (tenant_id IN (SELECT u.tenant_id FROM users u WHERE u.id = auth.uid()));

CREATE POLICY "service_manage_course_areas" ON course_areas
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- Data migration: Unify Cory's duplicated courses
-- Keep course 4711c03e (Ribeirão Preto, created first)
-- Archive course d948fea5 (Minas Gerais, duplicate)
-- ============================================================================

-- 1. Register the primary course in BOTH areas
INSERT INTO course_areas (course_id, area_id, tenant_id) VALUES
  ('4711c03e-6f91-4b28-80cf-047cd607d04b', 'ebb3003d-c43c-4b01-a75f-e922841901d7', 'a9d56b85-ee0e-4295-8db2-5fbcb3fd7a32'),  -- Ribeirão Preto
  ('4711c03e-6f91-4b28-80cf-047cd607d04b', 'b0ddf110-e45d-45e4-96fb-6f91a9539649', 'a9d56b85-ee0e-4295-8db2-5fbcb3fd7a32')   -- Minas Gerais
ON CONFLICT (course_id, area_id) DO NOTHING;

-- 2. Clear area_id from the primary course (it's now multi-area via junction)
UPDATE courses SET area_id = NULL, updated_at = now()
WHERE id = '4711c03e-6f91-4b28-80cf-047cd607d04b';

-- 3. Archive the duplicate course (keep data intact for existing sessions/reflections)
UPDATE courses SET status = 'archived', updated_at = now()
WHERE id = 'd948fea5-840e-40b5-91f0-6005e81cda55';

-- 4. Migrate enrollments from duplicate to primary (skip if already enrolled)
UPDATE enrollments SET course_id = '4711c03e-6f91-4b28-80cf-047cd607d04b', updated_at = now()
WHERE course_id = 'd948fea5-840e-40b5-91f0-6005e81cda55'
  AND student_id NOT IN (
    SELECT student_id FROM enrollments WHERE course_id = '4711c03e-6f91-4b28-80cf-047cd607d04b'
  );

COMMENT ON TABLE course_areas IS 'Many-to-many: one course can belong to multiple areas/units. Replaces courses.area_id for multi-area courses.';
