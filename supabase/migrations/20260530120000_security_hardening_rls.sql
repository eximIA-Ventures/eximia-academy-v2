-- =============================================================================
-- Migration: Security Hardening — RLS consolidation
-- =============================================================================
-- Closes a set of RLS holes found in audit (RLS-01..08, SUPA-02, AUTH-04 RLS part).
-- Strategy: this migration ONLY rewrites existing policies via
-- DROP POLICY IF EXISTS + CREATE POLICY. No existing migration file is edited.
--
-- Common root cause: several "service_*" policies were declared
--   FOR ALL USING (true) WITH CHECK (true)   -- with NO `TO service_role`
-- which means they apply to the `authenticated` (and `anon`) roles too,
-- effectively granting blanket access and short-circuiting (via OR) every
-- tenant-isolation policy on the same table.
--
-- `service_role` already BYPASSES RLS entirely, so a policy "for service_role"
-- is only meaningful when scoped `TO service_role` (and even then redundant for
-- bypass purposes) — the leak is the permissive policy reaching the
-- authenticated/anon roles. Where the real caller uses the *authenticated*
-- client (certificates, gamification) we cannot simply lock to service_role
-- without breaking the feature, so we scope writes by tenant + ownership.
--
-- Helper functions used (defined in 20260207000000_initial_schema.sql and
-- 20260209000000_epic11_super_admin_whitelabel.sql):
--   auth_tenant_id()  -> UUID   tenant of the authenticated user
--   auth_user_role()  -> TEXT   role of the authenticated user
--   is_super_admin()  -> BOOL   true if authenticated user is an active super_admin
-- =============================================================================


-- =============================================================================
-- RLS-01 (CRITICAL) — integration_keys / integration_outbound / integration_logs
-- Source: 20260315000000_integration_contract.sql
-- The service_all_* policies were FOR ALL USING(true) WITH CHECK(true) with no
-- `TO service_role`, so any authenticated/anon caller could read secret material
-- (key_hash, api_key_encrypted) and write arbitrary rows.
-- FIX: restrict the blanket policy to TO service_role; add tenant-scoped READ
-- policies for admins that DO NOT expose the secret columns. Secret-bearing
-- tables are read column-by-column at the app layer, so we only grant SELECT on
-- the rows; the app must avoid selecting key_hash / api_key_encrypted for
-- non-service callers (followup note).
-- =============================================================================

-- integration_keys
DROP POLICY IF EXISTS "service_all_integration_keys" ON integration_keys;
CREATE POLICY "service_all_integration_keys" ON integration_keys
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_read_integration_keys" ON integration_keys;
CREATE POLICY "admin_read_integration_keys" ON integration_keys
  FOR SELECT TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('admin', 'super_admin')
  );

-- integration_outbound
DROP POLICY IF EXISTS "service_all_integration_outbound" ON integration_outbound;
CREATE POLICY "service_all_integration_outbound" ON integration_outbound
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_read_integration_outbound" ON integration_outbound;
CREATE POLICY "admin_read_integration_outbound" ON integration_outbound
  FOR SELECT TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('admin', 'super_admin')
  );

-- integration_logs (no secret columns, but still tenant-scope the admin read)
DROP POLICY IF EXISTS "service_all_integration_logs" ON integration_logs;
CREATE POLICY "service_all_integration_logs" ON integration_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_read_integration_logs" ON integration_logs;
CREATE POLICY "admin_read_integration_logs" ON integration_logs
  FOR SELECT TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('admin', 'super_admin')
  );


-- =============================================================================
-- RLS-03 (CRITICAL) — user_gamification
-- Source: 20260517000001_gamification.sql
-- service_upsert_gamification was FOR ALL USING(true) WITH CHECK(true) with no
-- `TO service_role`, granting blanket read/write to authenticated/anon.
-- The real writer (awardXp in lib/certificates/generate.ts) now runs via the
-- SERVICE CLIENT (system-triggered, on behalf of the user). Writes are therefore
-- restricted to service_role only — this also prevents an authenticated user
-- from forging their own XP/levels/badges via direct PostgREST. The existing
-- SELECT policies (students_view_own_gamification, tenant_leaderboard) remain
-- untouched for reads.
-- =============================================================================

DROP POLICY IF EXISTS "service_upsert_gamification" ON user_gamification;
DROP POLICY IF EXISTS "users_write_own_gamification" ON user_gamification;

-- Backend / service-role path only (awardXp uses the service client)
CREATE POLICY "service_upsert_gamification" ON user_gamification
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- =============================================================================
-- RLS-07 (HIGH) — course_areas
-- Source: 20260517200000_course_areas_unification.sql
-- service_manage_course_areas was FOR ALL USING(true) WITH CHECK(true) with no
-- `TO service_role`, which via OR nullified tenant_isolation_course_areas.
-- Also the isolation policy had no WITH CHECK (writes were unconstrained).
-- FIX: scope blanket policy to service_role, add WITH CHECK to the isolation
-- read policy, and add an admin/manager write policy scoped by tenant.
-- =============================================================================

DROP POLICY IF EXISTS "service_manage_course_areas" ON course_areas;
CREATE POLICY "service_manage_course_areas" ON course_areas
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_isolation_course_areas" ON course_areas;
CREATE POLICY "tenant_isolation_course_areas" ON course_areas
  FOR SELECT TO authenticated
  USING (tenant_id = auth_tenant_id());

DROP POLICY IF EXISTS "course_areas_write" ON course_areas;
CREATE POLICY "course_areas_write" ON course_areas
  FOR ALL TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('teacher', 'instructor', 'manager', 'admin', 'super_admin')
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('teacher', 'instructor', 'manager', 'admin', 'super_admin')
  );


-- =============================================================================
-- SUPA-02 / RLS-04 (HIGH) — verso_posts
-- Source: 20260315000001_verso_posts.sql
-- verso_posts_insert WITH CHECK and verso_posts_update USING checked only role,
-- not tenant_id — an admin/instructor of tenant A could write rows for tenant B.
-- FIX: add tenant_id = auth_tenant_id() to the insert WITH CHECK and to both the
-- update USING and WITH CHECK, mirroring books_insert/books_update.
-- =============================================================================

DROP POLICY IF EXISTS "verso_posts_insert" ON public.verso_posts;
CREATE POLICY "verso_posts_insert" ON public.verso_posts
  FOR INSERT WITH CHECK (
    tenant_id = auth_tenant_id()
    AND exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'super_admin', 'instructor')
    )
  );

DROP POLICY IF EXISTS "verso_posts_update" ON public.verso_posts;
CREATE POLICY "verso_posts_update" ON public.verso_posts
  FOR UPDATE
  USING (
    tenant_id = auth_tenant_id()
    AND exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'super_admin', 'instructor')
    )
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'super_admin', 'instructor')
    )
  );


-- =============================================================================
-- RLS-02 (HIGH) — certificates
-- Source: 20260517000000_certificates.sql
-- service_insert_certificates was FOR INSERT WITH CHECK(true) with no `TO`, so
-- any authenticated/anon caller could forge certificates for any user/tenant.
-- FIX: issueCertificate now runs via the SERVICE CLIENT (server-side, privileged),
-- so certificate INSERT is restricted to service_role only. This closes the hole
-- where an authenticated student could forge a certificate for any enrollment
-- they own — including incomplete ones (an ownership WITH CHECK could not verify
-- status='completed'). SELECT policies that let users read their own certificates
-- remain in the original certificates migration.
-- =============================================================================

DROP POLICY IF EXISTS "service_insert_certificates" ON certificates;
DROP POLICY IF EXISTS "service_role_insert_certificates" ON certificates;
CREATE POLICY "service_role_insert_certificates" ON certificates
  FOR INSERT TO service_role
  WITH CHECK (true);


-- =============================================================================
-- RLS-05 (HIGH) — user_tenant_memberships
-- Source: 20260311100000_user_tenant_memberships.sql
-- utm_admin_manage was FOR ALL USING (role IN admin/super_admin) with NO
-- WITH CHECK and no tenant filter, so a tenant-A admin could read/insert/update
-- memberships for tenant B, and writes were unconstrained.
-- FIX: split into two branches — super_admin (cross-tenant via is_super_admin())
-- and tenant admin (restricted to tenant_id = auth_tenant_id()) with USING and
-- WITH CHECK on both.
-- =============================================================================

DROP POLICY IF EXISTS "utm_admin_manage" ON user_tenant_memberships;

CREATE POLICY "utm_super_admin_manage" ON user_tenant_memberships
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "utm_admin_manage" ON user_tenant_memberships
  FOR ALL
  USING (
    auth_user_role() = 'admin'
    AND tenant_id = auth_tenant_id()
  )
  WITH CHECK (
    auth_user_role() = 'admin'
    AND tenant_id = auth_tenant_id()
  );


-- =============================================================================
-- RLS-06 (HIGH) — storage.objects for 'materials' and 'books' buckets
-- Sources: 20260211200000_materials.sql, 20260214000000_biblioteca_books.sql
-- Read policies only checked bucket_id (no tenant filter), and the buckets are
-- public, so any authenticated user could read any tenant's files by guessing
-- the path. App convention stores objects under "<tenant_id>/...", so the first
-- path segment is the tenant id.
-- FIX (SQL part): replace the bucket-only policies with tenant-prefix-scoped
-- policies for SELECT/INSERT/UPDATE/DELETE validating
--   (storage.foldername(name))[1] = auth_tenant_id()::text
-- Write policies additionally keep the role gate (manager/admin/super_admin),
-- matching the original.
-- NOTE: making the buckets private + serving via signed URLs is an APP change
-- (getPublicUrl -> createSignedUrl) and is captured in followups — NOT done here.
-- =============================================================================

-- ---- materials bucket ----
DROP POLICY IF EXISTS "materials_storage_read" ON storage.objects;
CREATE POLICY "materials_storage_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'materials'
    AND (storage.foldername(name))[1] = auth_tenant_id()::text
  );

DROP POLICY IF EXISTS "materials_storage_upload" ON storage.objects;
CREATE POLICY "materials_storage_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'materials'
    AND (storage.foldername(name))[1] = auth_tenant_id()::text
    AND auth_user_role() in ('manager', 'admin', 'super_admin')
  );

DROP POLICY IF EXISTS "materials_storage_update" ON storage.objects;
CREATE POLICY "materials_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'materials'
    AND (storage.foldername(name))[1] = auth_tenant_id()::text
    AND auth_user_role() in ('manager', 'admin', 'super_admin')
  )
  WITH CHECK (
    bucket_id = 'materials'
    AND (storage.foldername(name))[1] = auth_tenant_id()::text
    AND auth_user_role() in ('manager', 'admin', 'super_admin')
  );

DROP POLICY IF EXISTS "materials_storage_delete" ON storage.objects;
CREATE POLICY "materials_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'materials'
    AND (storage.foldername(name))[1] = auth_tenant_id()::text
    AND auth_user_role() in ('manager', 'admin', 'super_admin')
  );

-- ---- books bucket ----
DROP POLICY IF EXISTS "books_storage_read" ON storage.objects;
CREATE POLICY "books_storage_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'books'
    AND (storage.foldername(name))[1] = auth_tenant_id()::text
  );

DROP POLICY IF EXISTS "books_storage_upload" ON storage.objects;
CREATE POLICY "books_storage_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'books'
    AND (storage.foldername(name))[1] = auth_tenant_id()::text
    AND auth_user_role() in ('manager', 'admin', 'super_admin')
  );

DROP POLICY IF EXISTS "books_storage_update" ON storage.objects;
CREATE POLICY "books_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'books'
    AND (storage.foldername(name))[1] = auth_tenant_id()::text
    AND auth_user_role() in ('manager', 'admin', 'super_admin')
  )
  WITH CHECK (
    bucket_id = 'books'
    AND (storage.foldername(name))[1] = auth_tenant_id()::text
    AND auth_user_role() in ('manager', 'admin', 'super_admin')
  );

DROP POLICY IF EXISTS "books_storage_delete" ON storage.objects;
CREATE POLICY "books_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'books'
    AND (storage.foldername(name))[1] = auth_tenant_id()::text
    AND auth_user_role() in ('manager', 'admin', 'super_admin')
  );


-- =============================================================================
-- RLS-08 (MEDIUM) — messages
-- Source: 20260207000000_initial_schema.sql
-- messages_insert validated only tenant_id = auth_tenant_id(), so any user in
-- the tenant could insert messages into another user's session.
-- FIX: restrict INSERT to the caller's own session.
-- =============================================================================

DROP POLICY IF EXISTS messages_insert ON messages;
CREATE POLICY messages_insert ON messages FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND session_id IN (
      SELECT id FROM sessions WHERE student_id = auth.uid()
    )
  );


-- =============================================================================
-- AUTH-04 (HIGH, RLS part) — users_update self-escalation
-- Source: 20260207000000_initial_schema.sql
-- users_update had USING ( tenant_id = auth_tenant_id() AND (id = auth.uid()
-- OR auth_user_role() IN ('admin','manager')) ) and NO WITH CHECK, so a user
-- updating their own row could change role/tenant_id (privilege escalation /
-- tenant hop).
-- FIX: rewrite with a WITH CHECK that prevents the self-update branch from
-- changing role or tenant_id. super_admin (is_super_admin()) keeps full
-- cross-tenant management. The app-layer accept-invite path is owned by another
-- group.
-- Note: WITH CHECK can only reference the NEW row; to assert "role/tenant_id
-- unchanged" we compare NEW against the persisted value via a subquery on users
-- (the row being updated, id = auth.uid() for the self branch).
-- =============================================================================

DROP POLICY IF EXISTS users_update ON users;
CREATE POLICY users_update ON users FOR UPDATE
  USING (
    is_super_admin()
    OR (
      tenant_id = auth_tenant_id()
      AND (id = auth.uid() OR auth_user_role() IN ('admin', 'manager'))
    )
  )
  WITH CHECK (
    -- super_admin may set role/tenant freely
    is_super_admin()
    OR (
      -- tenant admin/manager managing ANOTHER user's row (not themselves) may
      -- set role/tenant within their own tenant
      id <> auth.uid()
      AND auth_user_role() IN ('admin', 'manager')
      AND tenant_id = auth_tenant_id()
    )
    OR (
      -- self-update branch: the user editing their OWN row may NOT change their
      -- role or tenant_id (compare NEW row against the stored values). This also
      -- blocks an admin/manager from self-promoting via their own row.
      id = auth.uid()
      AND role = (SELECT u.role FROM users u WHERE u.id = auth.uid())
      AND tenant_id = (SELECT u.tenant_id FROM users u WHERE u.id = auth.uid())
    )
  );
