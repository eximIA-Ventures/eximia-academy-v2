-- Assessment history for tracking evolution over time
CREATE TABLE IF NOT EXISTS assessment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assessment_type TEXT NOT NULL CHECK (assessment_type IN (
    'big_five', 'enneagram', 'disc', 'multiple_intelligences', 'career_anchors'
  )),
  result JSONB NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assessment_history_user ON assessment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_assessment_history_user_type ON assessment_history(user_id, assessment_type);
CREATE INDEX IF NOT EXISTS idx_assessment_history_tenant ON assessment_history(tenant_id);

-- RLS
ALTER TABLE assessment_history ENABLE ROW LEVEL SECURITY;

-- User policies (with tenant isolation)
DROP POLICY IF EXISTS "Users can view own assessment history" ON assessment_history;
CREATE POLICY "Users can view own assessment history"
  ON assessment_history FOR SELECT
  USING (user_id = auth.uid() AND tenant_id = auth_tenant_id());

DROP POLICY IF EXISTS "Users can insert own assessment history" ON assessment_history;
CREATE POLICY "Users can insert own assessment history"
  ON assessment_history FOR INSERT
  WITH CHECK (user_id = auth.uid() AND tenant_id = auth_tenant_id());

-- Manager/Admin can view tenant assessment history
DROP POLICY IF EXISTS "Admins can view tenant assessment history" ON assessment_history;
CREATE POLICY "Admins can view tenant assessment history"
  ON assessment_history FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager', 'admin'));

-- Admin can delete (LGPD compliance)
DROP POLICY IF EXISTS "Admins can delete tenant assessment history" ON assessment_history;
CREATE POLICY "Admins can delete tenant assessment history"
  ON assessment_history FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin');

-- Super admin full access
DROP POLICY IF EXISTS "super_admin_all_assessment_history" ON assessment_history;
CREATE POLICY "super_admin_all_assessment_history"
  ON assessment_history FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());
