-- Migration: Complete RLS policies for all blueprint tables
-- Migrates from legacy subquery pattern to modern auth_tenant_id()/auth_user_role() pattern
-- Reference: blueprint_modules pattern from 20260218000000_extend_blueprints_for_ws2.sql

-- ============================================================
-- 1. course_blueprints — has tenant_id directly
-- ============================================================

DROP POLICY IF EXISTS "blueprints_select_by_tenant" ON course_blueprints;
DROP POLICY IF EXISTS "blueprints_insert_by_tenant" ON course_blueprints;
DROP POLICY IF EXISTS "blueprints_update_by_tenant" ON course_blueprints;

CREATE POLICY "bp_select" ON course_blueprints FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager', 'admin'));

CREATE POLICY "bp_insert" ON course_blueprints FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager', 'admin'));

CREATE POLICY "bp_update" ON course_blueprints FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager', 'admin'));

CREATE POLICY "bp_delete" ON course_blueprints FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin');

CREATE POLICY "bp_super_admin" ON course_blueprints FOR ALL
  USING (auth_user_role() = 'super_admin');

-- ============================================================
-- 2. blueprint_objectives — no tenant_id, uses blueprint_id FK
-- ============================================================

DROP POLICY IF EXISTS "objectives_select_by_blueprint" ON blueprint_objectives;

CREATE POLICY "bp_objectives_select" ON blueprint_objectives FOR SELECT
  USING (
    blueprint_id IN (SELECT id FROM course_blueprints WHERE tenant_id = auth_tenant_id())
    AND auth_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "bp_objectives_insert" ON blueprint_objectives FOR INSERT
  WITH CHECK (
    blueprint_id IN (SELECT id FROM course_blueprints WHERE tenant_id = auth_tenant_id())
    AND auth_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "bp_objectives_update" ON blueprint_objectives FOR UPDATE
  USING (
    blueprint_id IN (SELECT id FROM course_blueprints WHERE tenant_id = auth_tenant_id())
    AND auth_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "bp_objectives_delete" ON blueprint_objectives FOR DELETE
  USING (
    blueprint_id IN (SELECT id FROM course_blueprints WHERE tenant_id = auth_tenant_id())
    AND auth_user_role() = 'admin'
  );

CREATE POLICY "bp_objectives_super_admin" ON blueprint_objectives FOR ALL
  USING (auth_user_role() = 'super_admin');

-- ============================================================
-- 3. blueprint_assessments — no tenant_id, uses blueprint_id FK
-- ============================================================

DROP POLICY IF EXISTS "assessments_select_by_blueprint" ON blueprint_assessments;

CREATE POLICY "bp_assessments_select" ON blueprint_assessments FOR SELECT
  USING (
    blueprint_id IN (SELECT id FROM course_blueprints WHERE tenant_id = auth_tenant_id())
    AND auth_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "bp_assessments_insert" ON blueprint_assessments FOR INSERT
  WITH CHECK (
    blueprint_id IN (SELECT id FROM course_blueprints WHERE tenant_id = auth_tenant_id())
    AND auth_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "bp_assessments_update" ON blueprint_assessments FOR UPDATE
  USING (
    blueprint_id IN (SELECT id FROM course_blueprints WHERE tenant_id = auth_tenant_id())
    AND auth_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "bp_assessments_delete" ON blueprint_assessments FOR DELETE
  USING (
    blueprint_id IN (SELECT id FROM course_blueprints WHERE tenant_id = auth_tenant_id())
    AND auth_user_role() = 'admin'
  );

CREATE POLICY "bp_assessments_super_admin" ON blueprint_assessments FOR ALL
  USING (auth_user_role() = 'super_admin');

-- ============================================================
-- 4. blueprint_generation_jobs — has tenant_id directly
-- ============================================================

DROP POLICY IF EXISTS "jobs_select_by_tenant" ON blueprint_generation_jobs;
DROP POLICY IF EXISTS "jobs_insert_by_tenant" ON blueprint_generation_jobs;

CREATE POLICY "bp_jobs_select" ON blueprint_generation_jobs FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager', 'admin'));

CREATE POLICY "bp_jobs_insert" ON blueprint_generation_jobs FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager', 'admin'));

CREATE POLICY "bp_jobs_update" ON blueprint_generation_jobs FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager', 'admin'));

CREATE POLICY "bp_jobs_delete" ON blueprint_generation_jobs FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin');

CREATE POLICY "bp_jobs_super_admin" ON blueprint_generation_jobs FOR ALL
  USING (auth_user_role() = 'super_admin');
