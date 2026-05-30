-- HARDENING TRANSITÓRIA de RLS (2026-05-30) — aplicada direto em produção via Management API.
-- Objetivo: fechar os vazamentos cross-tenant CRÍTICOS/ALTOS SEM quebrar o código deployado.
-- Princípio: integration_* e course_areas → service_role (código usa service client).
--            certificates / user_gamification / verso_posts / memberships → ownership+tenant
--            (código usa authenticated client; mantém self/admin intra-tenant funcionando).
-- NÃO toca em dados. Apenas DROP/CREATE POLICY. Reversível via policies-rollback-20260530.sql.
-- messages (RLS-08) deliberadamente FORA deste lote (intra-tenant + fluxo de chat) — aguarda deploy coordenado.

BEGIN;

-- ── RLS-01: integration_* (código = service client) → trancar em service_role ──
DROP POLICY IF EXISTS "service_all_integration_keys" ON integration_keys;
CREATE POLICY "service_all_integration_keys" ON integration_keys
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_all_integration_logs" ON integration_logs;
CREATE POLICY "service_all_integration_logs" ON integration_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_all_integration_outbound" ON integration_outbound;
CREATE POLICY "service_all_integration_outbound" ON integration_outbound
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── RLS-07: course_areas service_manage (código = service client) → service_role ──
-- (tenant_isolation_course_areas permanece para leitura authenticated tenant-scoped)
DROP POLICY IF EXISTS "service_manage_course_areas" ON course_areas;
CREATE POLICY "service_manage_course_areas" ON course_areas
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── RLS-02: certificates INSERT (código = authenticated) → ownership + tenant + role ──
DROP POLICY IF EXISTS "service_insert_certificates" ON certificates;
CREATE POLICY "service_insert_certificates" ON certificates
  FOR INSERT WITH CHECK (
    is_super_admin()
    OR (
      tenant_id = auth_tenant_id()
      AND (
        user_id = auth.uid()
        OR auth_user_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'super_admin'::text, 'instructor'::text])
      )
    )
  );

-- ── RLS-03: user_gamification (código = authenticated) → ownership + tenant + role ──
DROP POLICY IF EXISTS "service_upsert_gamification" ON user_gamification;
CREATE POLICY "service_upsert_gamification" ON user_gamification
  FOR ALL USING (
    is_super_admin()
    OR (
      tenant_id = auth_tenant_id()
      AND (
        user_id = auth.uid()
        OR auth_user_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'super_admin'::text, 'instructor'::text])
      )
    )
  ) WITH CHECK (
    is_super_admin()
    OR (
      tenant_id = auth_tenant_id()
      AND (
        user_id = auth.uid()
        OR auth_user_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'super_admin'::text, 'instructor'::text])
      )
    )
  );

-- ── RLS-05: user_tenant_memberships → split super_admin (cross) vs admin (tenant-scoped) ──
DROP POLICY IF EXISTS "utm_admin_manage" ON user_tenant_memberships;
CREATE POLICY "utm_super_admin_manage" ON user_tenant_memberships
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "utm_admin_manage" ON user_tenant_memberships
  FOR ALL USING (auth_user_role() = 'admin' AND tenant_id = auth_tenant_id())
  WITH CHECK (auth_user_role() = 'admin' AND tenant_id = auth_tenant_id());

-- ── SUPA-02/RLS-04: verso_posts → adicionar tenant_id ao role-check (insert/update/delete) ──
DROP POLICY IF EXISTS "verso_posts_insert" ON verso_posts;
CREATE POLICY "verso_posts_insert" ON verso_posts
  FOR INSERT WITH CHECK (
    is_super_admin()
    OR (
      tenant_id = auth_tenant_id()
      AND EXISTS ( SELECT 1 FROM users
        WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text, 'instructor'::text]))))
    )
  );

DROP POLICY IF EXISTS "verso_posts_update" ON verso_posts;
CREATE POLICY "verso_posts_update" ON verso_posts
  FOR UPDATE USING (
    is_super_admin()
    OR (
      tenant_id = auth_tenant_id()
      AND EXISTS ( SELECT 1 FROM users
        WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text, 'instructor'::text]))))
    )
  ) WITH CHECK (
    is_super_admin()
    OR (
      tenant_id = auth_tenant_id()
      AND EXISTS ( SELECT 1 FROM users
        WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text, 'instructor'::text]))))
    )
  );

DROP POLICY IF EXISTS "verso_posts_delete" ON verso_posts;
CREATE POLICY "verso_posts_delete" ON verso_posts
  FOR DELETE USING (
    is_super_admin()
    OR (
      tenant_id = auth_tenant_id()
      AND EXISTS ( SELECT 1 FROM users
        WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))
    )
  );

COMMIT;
