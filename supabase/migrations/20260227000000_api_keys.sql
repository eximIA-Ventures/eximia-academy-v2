-- Migration: API Keys + Usage Log for Public REST API
-- Supports multi-tenant API key management with RLS (admin-only + super_admin bypass)

-- ============================================================
-- 1. api_keys — stores hashed API keys per tenant
-- ============================================================

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  rate_limit_rpm INTEGER DEFAULT 60,
  rate_limit_rpd INTEGER DEFAULT 10000,
  cors_origins TEXT[] DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_active ON api_keys(tenant_id, is_active) WHERE is_active = true;

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_keys_select" ON api_keys FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin');

CREATE POLICY "api_keys_insert" ON api_keys FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin');

CREATE POLICY "api_keys_update" ON api_keys FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin');

CREATE POLICY "api_keys_delete" ON api_keys FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin');

CREATE POLICY "api_keys_super_admin" ON api_keys FOR ALL
  USING (auth_user_role() = 'super_admin');

-- ============================================================
-- 2. api_key_usage_log — request-level logging
-- ============================================================

CREATE TABLE api_key_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_usage_log_api_key ON api_key_usage_log(api_key_id);
CREATE INDEX idx_usage_log_tenant ON api_key_usage_log(tenant_id);
CREATE INDEX idx_usage_log_created ON api_key_usage_log(created_at DESC);

ALTER TABLE api_key_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usage_log_select" ON api_key_usage_log FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin');

CREATE POLICY "usage_log_super_admin" ON api_key_usage_log FOR ALL
  USING (auth_user_role() = 'super_admin');

-- Service role inserts usage logs (no RLS insert policy needed for end users)
