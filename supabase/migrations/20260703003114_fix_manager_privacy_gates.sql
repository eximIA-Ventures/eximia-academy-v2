-- fix-manager-privacy-gates — LGPD + course-management RLS hardening
-- (Correção 1 + Correção 2, 2026-07-03)
--
-- CONTEXT: recon on prod (tenant Cory) proved two leaks:
--
--   Correção 1 (LGPD, raw student content):
--     • messages_select had NO role gate at all — qual was only
--       `tenant_id = auth_tenant_id()`. ANY authenticated tenant member
--       (student, manager, anyone) could SELECT * FROM messages and read
--       every student's raw chat text in the tenant. Proved: Caio Pinheiro
--       (manager+student) saw 960/960 tenant messages via direct query.
--     • slide_reflections had a manager-reachable raw-text policy
--       (sr_team_subtree_select) alongside the correctly-scoped
--       sr_content_role_select (instructor/admin only). Proved: Caio saw
--       45/184 tenant reflections (his subtree) via that policy.
--     • assignment_submissions / scenario_attempts content-role policies
--       included 'manager' directly in the role array — same raw-answer leak.
--
--   Correção 2 (course management):
--     • courses/chapters/questions INSERT/UPDATE policies included 'manager'
--       directly — a manager-only user could create/edit/publish course
--       content via direct table access (mirrors the app-layer gates fixed
--       alongside this migration in lib/course-management-guard.ts).
--
-- DECISION RULE (the dono, fix-manager-privacy-gates): permitido se o usuário
-- TEM chapéu instructor OU admin; negado se ele só alcança pela lente de
-- manager. A manager+instructor keeps the instructor's access.
--
-- MECHANISM: `auth_user_role()` reads the LEGACY SINGULAR `users.role` column
-- — verified in prod that Rinaldo (instructor+manager hats via `user_roles`,
-- but singular `users.role = 'manager'`) FAILS `auth_user_role() =
-- 'instructor'`. Tightening these policies to `auth_user_role() =
-- ANY('{instructor,admin}')` would have LOCKED RINALDO OUT despite his real
-- instructor hat. The fix uses `has_role(auth.uid(), 'instructor')` — the
-- SECURITY DEFINER multi-hat helper already established in E7
-- (20260701030000_epic30_user_roles.sql), which reads `user_roles` (the
-- union), not the singular column. This is the SAME helper already used by
-- `ur_admin_manage` on `user_roles` itself — no new mechanism introduced.
--
-- Proved in prod (see story doc for full simulation output):
--   Caio (manager-only hat)      → 0 messages, 0 slide_reflections raw rows
--   Rinaldo (instructor+manager) → full raw access preserved
--   student (own data)           → unaffected (their own-row policies untouched)

-- ---------------------------------------------------------------------------
-- Correção 1 — messages: add the role gate that never existed. Own-session
-- (student) OR instructor/admin/super_admin content-role, tenant-scoped.
-- super_admin_all_messages (is_super_admin()) already covers super_admin, so
-- the new content-role clause only needs instructor/admin.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS messages_select ON public.messages;

CREATE POLICY messages_own_session_select ON public.messages
  FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND session_id IN (
      SELECT s.id FROM public.sessions s WHERE s.student_id = auth.uid()
    )
  );

CREATE POLICY messages_content_role_select ON public.messages
  FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND (has_role(auth.uid(), 'instructor') OR has_role(auth.uid(), 'admin'))
  );

-- ---------------------------------------------------------------------------
-- Correção 1 — slide_reflections: drop the manager-subtree raw-content leak.
-- Rewrite sr_content_role_select to the multi-hat helper (fixes Rinaldo, who
-- was only getting raw access via the manager-subtree policy being removed).
-- sr_student_select / sr_leader_select (aggregate context, pre-existing,
-- unrelated to manager) are left untouched — out of this mission's scope.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS sr_team_subtree_select ON public.slide_reflections;
DROP POLICY IF EXISTS sr_content_role_select ON public.slide_reflections;

CREATE POLICY sr_content_role_select ON public.slide_reflections
  FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND (has_role(auth.uid(), 'instructor') OR has_role(auth.uid(), 'admin'))
  );

-- ---------------------------------------------------------------------------
-- Correção 1 — assignment_submissions / scenario_attempts: same fix, drop
-- 'manager' from the content-role array, rewrite via has_role().
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS as_content_role_select ON public.assignment_submissions;

CREATE POLICY as_content_role_select ON public.assignment_submissions
  FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND (has_role(auth.uid(), 'instructor') OR has_role(auth.uid(), 'admin'))
  );

DROP POLICY IF EXISTS sa_content_role_select ON public.scenario_attempts;

CREATE POLICY sa_content_role_select ON public.scenario_attempts
  FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND (has_role(auth.uid(), 'instructor') OR has_role(auth.uid(), 'admin'))
  );

-- ---------------------------------------------------------------------------
-- Correção 2 — courses: drop 'manager' from insert/update, rewrite via
-- has_role(). courses_update keeps the `created_by = auth.uid()` fallback
-- (unrelated to this fix — a course a manager already created before this
-- migration remains editable by its creator; no NEW manager-only creation
-- path exists going forward since courses_insert now requires the hat).
-- courses_delete (admin-only) and courses_select (tenant-wide read) are
-- untouched — out of scope.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS courses_insert ON public.courses;

CREATE POLICY courses_insert ON public.courses
  FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND (has_role(auth.uid(), 'instructor') OR has_role(auth.uid(), 'admin'))
  );

DROP POLICY IF EXISTS courses_update ON public.courses;

CREATE POLICY courses_update ON public.courses
  FOR UPDATE
  USING (
    tenant_id = auth_tenant_id()
    AND (
      created_by = auth.uid()
      OR has_role(auth.uid(), 'instructor')
      OR has_role(auth.uid(), 'admin')
    )
  );

-- ---------------------------------------------------------------------------
-- Correção 2 — chapters: same fix on insert/update.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS chapters_insert ON public.chapters;

CREATE POLICY chapters_insert ON public.chapters
  FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND (has_role(auth.uid(), 'instructor') OR has_role(auth.uid(), 'admin'))
  );

DROP POLICY IF EXISTS chapters_update ON public.chapters;

CREATE POLICY chapters_update ON public.chapters
  FOR UPDATE
  USING (
    tenant_id = auth_tenant_id()
    AND (has_role(auth.uid(), 'instructor') OR has_role(auth.uid(), 'admin'))
  );

-- ---------------------------------------------------------------------------
-- Correção 2 — questions: same fix on insert/update (chapter question bank
-- managed from "Interações").
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS questions_insert ON public.questions;

CREATE POLICY questions_insert ON public.questions
  FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND (has_role(auth.uid(), 'instructor') OR has_role(auth.uid(), 'admin'))
  );

DROP POLICY IF EXISTS questions_update ON public.questions;

CREATE POLICY questions_update ON public.questions
  FOR UPDATE
  USING (
    tenant_id = auth_tenant_id()
    AND (has_role(auth.uid(), 'instructor') OR has_role(auth.uid(), 'admin'))
  );
-- Correção 1 (adendo pós-auditoria, 2026-07-03) — consciousness_responses e
-- semantic_analyses foram perdidas na primeira passada. Ambas tinham policy de
-- SELECT incluindo 'manager' via coluna singular users.role: um manager lia o
-- texto bruto do aluno (challenge_text/learning_goal/commitment) e o
-- perfilamento psicológico (jung/cma/summary/evidence) de terceiros. Provado em
-- produção: Caio (manager) lia 17 consciousness + 22 semantic de outros alunos.
-- Fecha para instructor/admin/super_admin via has_role (multi-chapéu E7),
-- preservando o aluno vendo os próprios dados. O pipeline de classificação usa
-- service client (bypassa RLS), então não quebra.
DROP POLICY IF EXISTS "Staff can view tenant consciousness responses" ON public.consciousness_responses;
CREATE POLICY cr_content_role_select ON public.consciousness_responses
  FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND (has_role(auth.uid(), 'instructor') OR has_role(auth.uid(), 'admin') OR is_super_admin())
  );

DROP POLICY IF EXISTS "Managers can view tenant analyses" ON public.semantic_analyses;
CREATE POLICY sa_analysis_role_select ON public.semantic_analyses
  FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND (has_role(auth.uid(), 'instructor') OR has_role(auth.uid(), 'admin') OR is_super_admin())
  );
