-- =============================================================================
-- EPIC-JORNADA — fix: as 5 policies irmãs de escrita do aluno bloqueiam
-- qualquer usuário não-'student' em "visão de aluno"
-- =============================================================================
-- STATUS: APLICADA EM PRODUÇÃO em 2026-07-29, com GO explícito do Hugo.
-- Projeto Supabase: vaguswivhqnlbgqvnjch (eximia-academy — PRODUÇÃO COMPARTILHADA,
-- serve argos.eximiaacademy.com.br e o tenant Cory Alimentos).
-- Aplicada via Management API (POST /v1/projects/{ref}/database/query), numa
-- única transação atômica, NÃO via `supabase db push` (o histórico de migrations
-- deste banco está divergente e `db push` aplicaria migrations não autorizadas).
--
-- -----------------------------------------------------------------------------
-- DEFEITO
-- -----------------------------------------------------------------------------
-- Continuação direta de 20260729000000, que corrigiu `sp_student_insert` em
-- `study_plans`. Aquela migration destravou a criação da jornada, mas o mesmo
-- defeito permanecia em CINCO policies irmãs de escrita do aluno. Um usuário
-- com `users.role <> 'student'` navegando EM VISÃO DE ALUNO (padrão "uma conta,
-- dois mundos", cookie viewAsStudent), com matrícula própria e ativa, conseguia
-- montar a jornada mas recebia 42501 na PRIMEIRA interação real de aprendizado:
--
--   quiz_attempts.qa_student_insert          → responder um quiz
--   slide_reflections.sr_student_insert      → salvar uma reflexão de slide
--   assignment_submissions.as_student_insert → enviar uma atividade
--   scenario_attempts.sa_student_insert      → rodar um cenário
--   live_registrations.lr_student_insert     → inscrever-se numa live
--
-- -----------------------------------------------------------------------------
-- CAUSA
-- -----------------------------------------------------------------------------
-- Exatamente a mesma de 20260729000000: as cinco exigiam
-- `auth_user_role() = 'student'`. `auth_user_role()` lê a coluna SINGULAR LEGADA
-- `users.role` — nunca o hat multi-papel (`user_roles`), nunca a matrícula real.
-- Um manager/instructor com matrícula genuína como aluno de si mesmo tem
-- `users.role <> 'student'`, então o predicado é sempre falso para ele.
--
-- A assimetria era o próprio sintoma: as policies de SELECT irmãs
-- (`qa_student_select`, `sr_student_select`, ...) NÃO têm esse predicado — o
-- usuário conseguia LER o próprio progresso mas não ESCREVER nele.
--
-- -----------------------------------------------------------------------------
-- FIX
-- -----------------------------------------------------------------------------
-- Remove APENAS o predicado `auth_user_role() = 'student'` das cinco. Todo o
-- resto permanece byte a byte: dono da linha (`student_id = auth.uid()`, ou
-- `user_id = auth.uid()` em live_registrations) e `tenant_id = auth_tenant_id()`.
-- A ordem original dos predicados de cada policy foi preservada.
--
-- Ninguém ganha a capacidade de escrever para terceiros: o dono continua tendo
-- de ser `auth.uid()`, dentro do próprio tenant. O que deixa de importar é qual
-- é o "chapéu" singular do usuário na tabela `users`.
--
-- NOTA DE ESCOPO, REGISTRADA COM HONESTIDADE: diferente de `study_plans`, estas
-- cinco tabelas NÃO possuem um `EXISTS` sobre `enrollments` como backstop de
-- integridade. Portanto, depois deste fix, qualquer usuário autenticado do
-- tenant pode criar as PRÓPRIAS linhas nestas tabelas, mesmo sem matrícula no
-- curso correspondente. Antes, isso já valia para todo `role = 'student'` do
-- tenant (a matrícula nunca foi verificada aqui). O fix amplia esse conjunto de
-- "todo student do tenant" para "todo usuário do tenant", sempre restrito a
-- linhas próprias. Se um dia se quiser exigir matrícula, o lugar é adicionar um
-- `EXISTS` sobre `enrollments` nas cinco — mudança de escopo diferente desta.
--
-- -----------------------------------------------------------------------------
-- VERIFICAÇÃO EXECUTADA EM PRODUÇÃO (2026-07-29)
-- -----------------------------------------------------------------------------
-- Para cada uma das cinco, dentro de transação com ROLLBACK obrigatório:
--   POSITIVO: INSERT real como role `authenticated`, com
--             request.jwt.claims.sub = 2aed9aec-be4a-4301-ad86-3b4bb47e7605
--             (users.role = 'manager', tenant Cory) → ACEITO.
--   NEGATIVO: mesmo INSERT com o dono sendo um terceiro real → 42501.
-- O controle negativo não é opcional: sem ele, um "passou" poderia significar
-- apenas que a RLS nunca foi aplicada (o role `postgres` ignora policies e
-- `relforcerowsecurity` é false nestas tabelas).
--
-- Caso particular `live_registrations`: a policy irmã `lr_manager_all` (ALL,
-- permissiva) já concedia INSERT a admin/manager no tenant, então para um
-- MANAGER esta tabela nunca esteve de fato bloqueada, e o controle negativo com
-- manager passa por causa dela (comportamento pré-existente, não introduzido
-- aqui). A prova de `lr_student_insert` foi então isolada com o usuário
-- `instructor` 9597087e-0217-434f-b44b-15426ab201e9, para quem nem
-- `lr_manager_all` nem `lr_super_admin` se aplicam: INSERT para si → ACEITO
-- (só possível pela policy corrigida), INSERT para terceiro → 42501.
--
-- Contagens conferidas antes e depois: nenhuma linha nova em nenhuma das cinco
-- tabelas (todas as transações de prova foram revertidas).
-- =============================================================================

DROP POLICY IF EXISTS "qa_student_insert" ON quiz_attempts;

CREATE POLICY "qa_student_insert" ON quiz_attempts FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
  );

DROP POLICY IF EXISTS "sr_student_insert" ON slide_reflections;

CREATE POLICY "sr_student_insert" ON slide_reflections FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
  );

DROP POLICY IF EXISTS "as_student_insert" ON assignment_submissions;

CREATE POLICY "as_student_insert" ON assignment_submissions FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
  );

DROP POLICY IF EXISTS "sa_student_insert" ON scenario_attempts;

CREATE POLICY "sa_student_insert" ON scenario_attempts FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
  );

DROP POLICY IF EXISTS "lr_student_insert" ON live_registrations;

CREATE POLICY "lr_student_insert" ON live_registrations FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND user_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- ROLLBACK (manual, por policy — recriar com o predicado antigo).
-- Estados anteriores também salvos em /tmp/<policy>_before.sql em 2026-07-29.
-- ---------------------------------------------------------------------------
--
--   DROP POLICY IF EXISTS "qa_student_insert" ON quiz_attempts;
--   CREATE POLICY "qa_student_insert" ON quiz_attempts FOR INSERT
--     WITH CHECK (
--       student_id = auth.uid()
--       AND tenant_id = auth_tenant_id()
--       AND auth_user_role() = 'student'
--     );
--
--   DROP POLICY IF EXISTS "sr_student_insert" ON slide_reflections;
--   CREATE POLICY "sr_student_insert" ON slide_reflections FOR INSERT
--     WITH CHECK (
--       student_id = auth.uid()
--       AND tenant_id = auth_tenant_id()
--       AND auth_user_role() = 'student'
--     );
--
--   DROP POLICY IF EXISTS "as_student_insert" ON assignment_submissions;
--   CREATE POLICY "as_student_insert" ON assignment_submissions FOR INSERT
--     WITH CHECK (
--       student_id = auth.uid()
--       AND tenant_id = auth_tenant_id()
--       AND auth_user_role() = 'student'
--     );
--
--   DROP POLICY IF EXISTS "sa_student_insert" ON scenario_attempts;
--   CREATE POLICY "sa_student_insert" ON scenario_attempts FOR INSERT
--     WITH CHECK (
--       student_id = auth.uid()
--       AND tenant_id = auth_tenant_id()
--       AND auth_user_role() = 'student'
--     );
--
--   DROP POLICY IF EXISTS "lr_student_insert" ON live_registrations;
--   CREATE POLICY "lr_student_insert" ON live_registrations FOR INSERT
--     WITH CHECK (
--       tenant_id = auth_tenant_id()
--       AND user_id = auth.uid()
--       AND auth_user_role() = 'student'
--     );
-- ---------------------------------------------------------------------------
