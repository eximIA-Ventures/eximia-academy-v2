-- =============================================================
-- Epic 13: AI Content Ingestion — Schema Migration
-- Story 13.1: content_ingestions table + RLS policies
-- =============================================================

-- 1. Table
CREATE TABLE content_ingestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL
    CHECK (source_type IN ('pdf', 'docx', 'txt', 'audio', 'video_url', 'paste')),
  source_url TEXT,
  source_filename TEXT,
  source_size_bytes INTEGER,
  raw_text TEXT,
  ai_output JSONB,
  status TEXT NOT NULL DEFAULT 'uploading'
    CHECK (status IN ('uploading', 'extracting', 'processing', 'review', 'approved', 'failed')),
  error_message TEXT,
  processing_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- 2. Indexes
CREATE INDEX idx_content_ingestions_tenant ON content_ingestions(tenant_id);
CREATE INDEX idx_content_ingestions_created_by ON content_ingestions(created_by);
CREATE INDEX idx_content_ingestions_status ON content_ingestions(status);
-- 3. RLS
ALTER TABLE content_ingestions ENABLE ROW LEVEL SECURITY;
-- Managers and admins can view their tenant's ingestions
CREATE POLICY "ingestions_select" ON content_ingestions FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('manager', 'admin')
  );
-- Managers and admins can create ingestions
CREATE POLICY "ingestions_insert" ON content_ingestions FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('manager', 'admin')
  );
-- Managers/admins can update their own ingestions
CREATE POLICY "ingestions_update" ON content_ingestions FOR UPDATE
  USING (
    tenant_id = auth_tenant_id()
    AND created_by = auth.uid()
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
  );
-- Only admins can delete ingestions
CREATE POLICY "ingestions_delete" ON content_ingestions FOR DELETE
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() = 'admin'
  );
