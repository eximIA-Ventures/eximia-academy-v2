-- Live Events & Registrations
-- Páginas /lives para agendamento, transmissão e gravações

BEGIN;
-- ============================================================
-- 1. live_events table
-- ============================================================
CREATE TABLE live_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  host_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  meeting_url TEXT,
  thumbnail_url TEXT,
  recording_url TEXT,
  max_participants INTEGER,
  tags TEXT[],
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_live_events_tenant ON live_events(tenant_id);
CREATE INDEX idx_live_events_status ON live_events(status);
CREATE INDEX idx_live_events_scheduled ON live_events(scheduled_at);
ALTER TABLE live_events ENABLE ROW LEVEL SECURITY;
-- Super admin bypass
CREATE POLICY "le_super_admin" ON live_events FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());
-- Admin/manager full CRUD
CREATE POLICY "le_manager_all" ON live_events FOR ALL
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('admin', 'manager')
  );
-- Student/instructor read-only
CREATE POLICY "le_read" ON live_events FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('student', 'instructor')
  );
-- ============================================================
-- 2. live_registrations table
-- ============================================================
CREATE TABLE live_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_event_id UUID NOT NULL REFERENCES live_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ DEFAULT now(),
  attended BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(live_event_id, user_id)
);
CREATE INDEX idx_live_registrations_event ON live_registrations(live_event_id);
CREATE INDEX idx_live_registrations_user ON live_registrations(user_id);
CREATE INDEX idx_live_registrations_tenant ON live_registrations(tenant_id);
ALTER TABLE live_registrations ENABLE ROW LEVEL SECURITY;
-- Super admin bypass
CREATE POLICY "lr_super_admin" ON live_registrations FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());
-- Admin/manager can see all registrations in tenant
CREATE POLICY "lr_manager_all" ON live_registrations FOR ALL
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('admin', 'manager')
  );
-- Students can see own registrations
CREATE POLICY "lr_student_select" ON live_registrations FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND user_id = auth.uid()
  );
-- Students can self-register
CREATE POLICY "lr_student_insert" ON live_registrations FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND user_id = auth.uid()
    AND auth_user_role() = 'student'
  );
-- Students can cancel own registration
CREATE POLICY "lr_student_delete" ON live_registrations FOR DELETE
  USING (
    tenant_id = auth_tenant_id()
    AND user_id = auth.uid()
    AND auth_user_role() = 'student'
  );
COMMIT;
