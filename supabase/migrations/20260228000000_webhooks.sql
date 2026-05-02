-- Migration: Webhooks + Delivery Log
-- Supports event-driven integrations with HMAC signing and retry

-- ============================================================
-- 1. webhooks — webhook endpoint registrations per tenant
-- ============================================================

CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  failure_count INTEGER DEFAULT 0,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_webhooks_tenant ON webhooks(tenant_id);
CREATE INDEX idx_webhooks_active ON webhooks(tenant_id, is_active) WHERE is_active = true;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhooks_select" ON webhooks FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin');
CREATE POLICY "webhooks_insert" ON webhooks FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin');
CREATE POLICY "webhooks_update" ON webhooks FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin');
CREATE POLICY "webhooks_delete" ON webhooks FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin');
CREATE POLICY "webhooks_super_admin" ON webhooks FOR ALL
  USING (auth_user_role() = 'super_admin');
-- ============================================================
-- 2. webhook_deliveries — delivery attempts and retry queue
-- ============================================================

CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  last_status_code INTEGER,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX idx_deliveries_tenant ON webhook_deliveries(tenant_id);
CREATE INDEX idx_deliveries_retry ON webhook_deliveries(status, next_retry_at)
  WHERE status = 'pending' OR status = 'retrying';
CREATE INDEX idx_deliveries_created ON webhook_deliveries(created_at DESC);
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deliveries_select" ON webhook_deliveries FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin');
CREATE POLICY "deliveries_super_admin" ON webhook_deliveries FOR ALL
  USING (auth_user_role() = 'super_admin');
-- Service role inserts deliveries (no RLS insert policy needed for end users);
