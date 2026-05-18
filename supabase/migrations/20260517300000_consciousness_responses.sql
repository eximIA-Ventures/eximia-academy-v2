-- Consciousness Responses: "Fase Consciencia" (Tranjan's Learning Wheel)
-- Pre-course self-assessment + post-course closure ritual

CREATE TABLE IF NOT EXISTS consciousness_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK (phase IN ('pre', 'post')),
  challenge_text TEXT,
  self_rating INTEGER CHECK (self_rating BETWEEN 1 AND 5),
  learning_goal TEXT,
  commitment TEXT,
  rating_change INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for quick lookups by enrollment + phase
CREATE INDEX idx_consciousness_responses_enrollment_phase
  ON consciousness_responses (enrollment_id, phase);

-- Index for tenant-scoped queries (leaders/managers)
CREATE INDEX idx_consciousness_responses_tenant
  ON consciousness_responses (tenant_id);

-- RLS
ALTER TABLE consciousness_responses ENABLE ROW LEVEL SECURITY;

-- Students can read their own responses
CREATE POLICY "Students can view own consciousness responses"
  ON consciousness_responses FOR SELECT
  USING (student_id = auth.uid());

-- Students can insert their own responses
CREATE POLICY "Students can insert own consciousness responses"
  ON consciousness_responses FOR INSERT
  WITH CHECK (student_id = auth.uid());

-- Students can update their own responses
CREATE POLICY "Students can update own consciousness responses"
  ON consciousness_responses FOR UPDATE
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- Leaders, managers, instructors, admins can view responses in their tenant
CREATE POLICY "Staff can view tenant consciousness responses"
  ON consciousness_responses FOR SELECT
  USING (
    tenant_id IN (
      SELECT u.tenant_id FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('manager', 'admin', 'instructor', 'super_admin')
    )
  );
