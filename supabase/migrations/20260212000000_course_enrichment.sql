-- Epic 15: AI Course Enrichment — Complementary Source Search
-- Tables for enrichment jobs and discovered sources

-- Table: enrichment_jobs (tracks enrichment pipeline execution)
CREATE TABLE enrichment_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  triggered_by UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'review', 'applying', 'completed', 'failed')),
  progress JSONB DEFAULT '{}',
  total_sources_found INTEGER DEFAULT 0,
  sources_approved INTEGER DEFAULT 0,
  sources_rejected INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_enrichment_jobs_tenant ON enrichment_jobs(tenant_id);
CREATE INDEX idx_enrichment_jobs_course ON enrichment_jobs(course_id);
CREATE INDEX idx_enrichment_jobs_status ON enrichment_jobs(status);
CREATE INDEX idx_enrichment_jobs_course_status ON enrichment_jobs(course_id, status);
-- Table: enrichment_sources (individual sources found per chapter)
CREATE TABLE enrichment_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES enrichment_jobs(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  snippet TEXT,
  relevance_score REAL DEFAULT 0 CHECK (relevance_score >= 0 AND relevance_score <= 1),
  search_query TEXT,
  ai_rationale TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  action TEXT CHECK (action IN ('incorporate', 'reference')),
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_enrichment_sources_job ON enrichment_sources(job_id);
CREATE INDEX idx_enrichment_sources_chapter ON enrichment_sources(chapter_id);
CREATE INDEX idx_enrichment_sources_status ON enrichment_sources(status);
CREATE INDEX idx_enrichment_sources_job_status ON enrichment_sources(job_id, status);
-- RLS: enrichment_jobs
ALTER TABLE enrichment_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enrichment_jobs_select" ON enrichment_jobs FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager', 'admin'));
CREATE POLICY "enrichment_jobs_insert" ON enrichment_jobs FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager', 'admin'));
CREATE POLICY "enrichment_jobs_update" ON enrichment_jobs FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager', 'admin'));
CREATE POLICY "enrichment_jobs_delete" ON enrichment_jobs FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin');
CREATE POLICY "enrichment_jobs_super_admin_select" ON enrichment_jobs FOR SELECT
  USING (auth_user_role() = 'super_admin');
CREATE POLICY "enrichment_jobs_super_admin_all" ON enrichment_jobs FOR ALL
  USING (auth_user_role() = 'super_admin');
-- RLS: enrichment_sources
ALTER TABLE enrichment_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enrichment_sources_select" ON enrichment_sources FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager', 'admin'));
CREATE POLICY "enrichment_sources_insert" ON enrichment_sources FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager', 'admin'));
CREATE POLICY "enrichment_sources_update" ON enrichment_sources FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager', 'admin'));
CREATE POLICY "enrichment_sources_delete" ON enrichment_sources FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin');
CREATE POLICY "enrichment_sources_super_admin_select" ON enrichment_sources FOR SELECT
  USING (auth_user_role() = 'super_admin');
CREATE POLICY "enrichment_sources_super_admin_all" ON enrichment_sources FOR ALL
  USING (auth_user_role() = 'super_admin');
