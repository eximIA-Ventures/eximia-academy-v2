-- ROLLBACK das policies ANTES da hardening transitória (2026-05-30)
-- Snapshot capturado de produção (eximia-academy) via Management API.
-- Recria EXATAMENTE o estado anterior. Rodar só se a hardening precisar ser revertida.
-- NÃO toca em dados — apenas DROP/CREATE POLICY.

BEGIN;

-- integration_keys
DROP POLICY IF EXISTS "service_all_integration_keys" ON integration_keys;
CREATE POLICY "service_all_integration_keys" ON integration_keys
  FOR ALL USING (true) WITH CHECK (true);

-- integration_logs
DROP POLICY IF EXISTS "service_all_integration_logs" ON integration_logs;
CREATE POLICY "service_all_integration_logs" ON integration_logs
  FOR ALL USING (true) WITH CHECK (true);

-- integration_outbound
DROP POLICY IF EXISTS "service_all_integration_outbound" ON integration_outbound;
CREATE POLICY "service_all_integration_outbound" ON integration_outbound
  FOR ALL USING (true) WITH CHECK (true);

-- course_areas
DROP POLICY IF EXISTS "service_manage_course_areas" ON course_areas;
CREATE POLICY "service_manage_course_areas" ON course_areas
  FOR ALL USING (true) WITH CHECK (true);

-- certificates
DROP POLICY IF EXISTS "service_insert_certificates" ON certificates;
CREATE POLICY "service_insert_certificates" ON certificates
  FOR INSERT WITH CHECK (true);

-- user_gamification
DROP POLICY IF EXISTS "service_upsert_gamification" ON user_gamification;
CREATE POLICY "service_upsert_gamification" ON user_gamification
  FOR ALL USING (true) WITH CHECK (true);

-- user_tenant_memberships
DROP POLICY IF EXISTS "utm_super_admin_manage" ON user_tenant_memberships;
DROP POLICY IF EXISTS "utm_admin_manage" ON user_tenant_memberships;
CREATE POLICY "utm_admin_manage" ON user_tenant_memberships
  FOR ALL USING (auth_user_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]));

-- verso_posts
DROP POLICY IF EXISTS "verso_posts_insert" ON verso_posts;
CREATE POLICY "verso_posts_insert" ON verso_posts
  FOR INSERT WITH CHECK (EXISTS ( SELECT 1 FROM users
    WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text, 'instructor'::text])))));

DROP POLICY IF EXISTS "verso_posts_update" ON verso_posts;
CREATE POLICY "verso_posts_update" ON verso_posts
  FOR UPDATE USING (EXISTS ( SELECT 1 FROM users
    WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text, 'instructor'::text])))));

DROP POLICY IF EXISTS "verso_posts_delete" ON verso_posts;
CREATE POLICY "verso_posts_delete" ON verso_posts
  FOR DELETE USING (EXISTS ( SELECT 1 FROM users
    WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text])))));

COMMIT;
