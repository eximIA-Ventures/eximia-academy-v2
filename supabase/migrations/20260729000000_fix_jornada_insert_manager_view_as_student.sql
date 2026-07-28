-- =============================================================================
-- EPIC-JORNADA — fix: sp_student_insert bloqueia manager em "visão de aluno"
-- =============================================================================
-- STATUS: ESCRITA, NÃO APLICADA. O banco do .env.local (deploy/cory) é
-- PRODUÇÃO COMPARTILHADA — aplicar exige GO explícito do Hugo.
--
-- DEFEITO (reproduzido em prod, 2026-07-28): ao clicar "Começar minha jornada",
-- o INSERT em study_plans falha com 42501 (RLS) para o usuário
-- hugocapitelli@gmail.com (id 2aed9aec-be4a-4301-ad86-3b4bb47e7605), que tem
-- `users.role = 'manager'` mas está navegando EM VISÃO DE ALUNO (padrão "uma
-- conta, dois mundos", cookie viewAsStudent) com matrícula ativa
-- (enrollment ac8bd7d5-446b-49ce-9db7-1ade5d24d56d) no curso
-- 4711c03e-6f91-4b28-80cf-047cd607d04b.
--
-- CAUSA: `sp_student_insert` (20260723000000_jornada_study_plans.sql) exige
-- `auth_user_role() = 'student'`. `auth_user_role()` lê a coluna SINGULAR
-- LEGADA `users.role` (mecanismo documentado e já provado em prod por
-- 20260703003114_fix_manager_privacy_gates.sql) — nunca o hat multi-papel
-- (`user_roles`) nem a matrícula real. Um manager com matrícula própria e
-- genuína (o mesmo padrão "uma conta, dois mundos" que motivou aquela
-- migration) tem `users.role = 'manager'`, então `auth_user_role() = 'student'`
-- é sempre falso para ele, mesmo tendo uma enrollment ativa como aluno de si
-- mesmo. A action `saveJourneyPlan` (jornada/actions.ts) já reflete essa
-- intenção corretamente: `authedStudent()` lê `role` mas NUNCA o usa para
-- gating — quem prova que o usuário pode agir como aluno é a própria
-- matrícula (resolveEnrollmentContext filtra por `student_id = auth.uid()`).
-- A policy de INSERT, sozinha, estava mais restritiva que a leitura/escrita
-- (sp_student_select / sp_student_update não têm esse predicado de role) —
-- essa assimetria era o próprio sintoma do bug.
--
-- FIX: remove o predicado `auth_user_role() = 'student'`. O EXISTS que já
-- existia continua provando a integridade completa: a enrollment referenciada
-- precisa ter `student_id = study_plans.student_id` (= auth.uid(), pelo
-- predicado que permanece) E `course_id`/`tenant_id` batendo com os do
-- INSERT. Ou seja, ninguém ganha a capacidade de criar jornada para
-- terceiros — o INSERT continua só para si mesmo (`student_id = auth.uid()`),
-- no próprio tenant, com matrícula ATIVA e genuína provada por linha real em
-- `enrollments`. O que muda é apenas: deixa de importar qual é o "chapéu"
-- singular do usuário na tabela `users` — o mesmo espírito de
-- 20260703003114 (não confundir hat/role legado com "este usuário está
-- agindo como aluno agora, de fato matriculado").
-- =============================================================================

DROP POLICY IF EXISTS "sp_student_insert" ON study_plans;

CREATE POLICY "sp_student_insert" ON study_plans FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
    AND EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.id = study_plans.enrollment_id
        AND e.student_id = study_plans.student_id
        AND e.course_id = study_plans.course_id
        AND e.tenant_id = study_plans.tenant_id
    )
  );

-- ---------------------------------------------------------------------------
-- ROLLBACK (manual, se necessário): recriar a policy com o predicado antigo
--   DROP POLICY IF EXISTS "sp_student_insert" ON study_plans;
--   CREATE POLICY "sp_student_insert" ON study_plans FOR INSERT
--     WITH CHECK (
--       student_id = auth.uid()
--       AND tenant_id = auth_tenant_id()
--       AND auth_user_role() = 'student'
--       AND EXISTS (
--         SELECT 1 FROM enrollments e
--         WHERE e.id = study_plans.enrollment_id
--           AND e.student_id = study_plans.student_id
--           AND e.course_id = study_plans.course_id
--           AND e.tenant_id = study_plans.tenant_id
--       )
--     );
-- ---------------------------------------------------------------------------
