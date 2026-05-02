-- eximIA Integration Contract v1 — Database tables
-- Implements: integration_keys (inbound), integration_outbound, integration_logs

-- Inbound API keys (other apps calling this app)
CREATE TABLE IF NOT EXISTS integration_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  app_name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  scopes TEXT[] DEFAULT '{read}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  last_used TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_integration_keys_hash ON integration_keys(key_hash);
CREATE INDEX idx_integration_keys_tenant ON integration_keys(tenant_id);

-- Outbound connections (this app calling others)
CREATE TABLE IF NOT EXISTS integration_outbound (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  remote_app TEXT NOT NULL,
  remote_url TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'error', 'pending', 'disabled')),
  entities TEXT[] DEFAULT '{}',
  catalog_cache JSONB,
  last_sync TIMESTAMPTZ,
  last_error TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_integration_outbound_tenant ON integration_outbound(tenant_id);

-- Integration logs (all inbound + outbound calls)
CREATE TABLE IF NOT EXISTS integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  method TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  entity TEXT,
  status_code INT NOT NULL,
  duration_ms INT NOT NULL,
  remote_app TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_integration_logs_tenant ON integration_logs(tenant_id);
CREATE INDEX idx_integration_logs_created ON integration_logs(created_at DESC);

-- Add integration_enabled to tenants settings
-- (uses existing JSONB settings column — no schema change needed)
-- Usage: settings->'integration_enabled' = true

-- RLS policies
ALTER TABLE integration_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_outbound ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (used by API routes)
CREATE POLICY "service_all_integration_keys" ON integration_keys FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all_integration_outbound" ON integration_outbound FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all_integration_logs" ON integration_logs FOR ALL USING (true) WITH CHECK (true);
