-- Certificates table — auto-generated on course completion
CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE SET NULL,

  -- Certificate data
  student_name TEXT NOT NULL,
  course_title TEXT NOT NULL,
  instructor_name TEXT,
  workload_hours NUMERIC(6,1),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Verification
  verification_code TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),

  -- Storage
  pdf_path TEXT, -- Supabase Storage path: certificates/{tenant_id}/{id}.pdf

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevent duplicate certificates per enrollment
  UNIQUE(enrollment_id)
);

-- Indexes
CREATE INDEX idx_certificates_user ON certificates(user_id);
CREATE INDEX idx_certificates_tenant ON certificates(tenant_id);
CREATE INDEX idx_certificates_verification ON certificates(verification_code);

-- RLS
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- Students can view their own certificates
CREATE POLICY "students_view_own_certificates" ON certificates
  FOR SELECT USING (auth.uid() = user_id);

-- Managers/admins can view all certificates in their tenant
CREATE POLICY "managers_view_tenant_certificates" ON certificates
  FOR SELECT USING (
    tenant_id IN (
      SELECT u.tenant_id FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager', 'super_admin', 'instructor')
    )
  );

-- System can insert (service role for auto-generation)
CREATE POLICY "service_insert_certificates" ON certificates
  FOR INSERT WITH CHECK (true);

COMMENT ON TABLE certificates IS 'Auto-generated certificates on course completion. Verification via unique code + public URL.';
COMMENT ON COLUMN certificates.verification_code IS 'Public verification code. URL: /verify/{code}';
COMMENT ON COLUMN certificates.workload_hours IS 'Calculated from total session duration in the course.';
