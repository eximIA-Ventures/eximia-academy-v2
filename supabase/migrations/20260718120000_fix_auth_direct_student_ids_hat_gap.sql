-- FIX (Crivo review, T1 rodada 1, 2026-07-18) — auth_direct_student_ids ramo (b)
-- não verificava o chapéu 'student' via user_roles, ao contrário do ramo (a).
--
-- ACHADO: manager_group_members não tem NENHUMA constraint de role no schema —
-- qualquer user_id pode ser inserido como "membro" de um manager_group,
-- inclusive um usuário que NUNCA teve o chapéu 'student' (ex: um instructor-only
-- adicionado por engano por um admin curando o time). O ramo (a) desta função já
-- exige `EXISTS (SELECT 1 FROM user_roles ur WHERE ur.role = 'student')`; o ramo
-- (b) apenas fazia JOIN manager_groups/manager_group_members e devolvia
-- mgm.student_id sem NENHUMA verificação de chapéu — um usuário assim seria
-- tratado como aluno em qualquer superfície que consome esta RPC (Engagement,
-- Analytics, nudges), incluindo poder receber cobrança/reconhecimento e contar
-- nas métricas de engajamento como se fosse um aluno real.
--
-- CORREÇÃO: ramo (b) ganha o MESMO EXISTS (user_roles.role='student') do ramo
-- (a). Isto SÓ PODE ESTREITAR o conjunto retornado (nunca alarga) — um membro
-- que já tinha o chapéu continua sendo retornado; só quem NUNCA teve o chapéu
-- 'student' deixa de aparecer. CREATE OR REPLACE preserva o ACL existente
-- (REVOKE/GRANT já aplicados na migration 20260702222743 permanecem válidos —
-- não repetidos aqui).
--
-- ESCOPO DESTA MIGRATION: apenas auth_direct_student_ids, a ÚNICA das quatro
-- funções da família (auth_direct_student_ids, auth_reachable_student_ids,
-- auth_subtree_user_ids, subtree_student_ids) cujo SQL está versionado neste
-- repositório — as outras três foram aplicadas em produção fora do fluxo de
-- migrations rastreado (ver nota na migration 20260702222743) e seu texto atual
-- não pôde ser auditado a partir do código-fonte. Mitigação para essas três: um
-- guard de aplicação (SERVICE CLIENT, filterToStudentHat) foi adicionado em
-- apps/web/src/lib/notifications/engagement-scope.ts, que intersecta QUALQUER
-- resultado de escopo de gestor contra user_roles antes de devolvê-lo aos
-- callers de /api/engagement/* — cobre esta RPC E as três não versionadas, como
-- defesa em profundidade, mesmo antes desta migration ser aplicada.
--
-- NÃO APLICADA AO BANCO DE PRODUÇÃO POR ESTE AGENTE — mutação de função
-- SECURITY DEFINER em produção fora do fluxo de deploy normal é exatamente o
-- anti-padrão que a migration 20260702222743 documenta como erro passado deste
-- projeto. Requer autorização/deploy explícito do Hugo (supabase db push ou
-- equivalente controlado).
CREATE OR REPLACE FUNCTION public.auth_direct_student_ids(_node uuid)
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF _node IS NULL OR auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF _node <> auth.uid() AND NOT EXISTS (
    SELECT 1 FROM unnest(auth_subtree_user_ids()) AS sid WHERE sid = _node
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT agg.sid
    FROM (
      -- ramo (a): reports_to direto + chapéu 'student' via user_roles.
      SELECT u.id AS sid
        FROM users u
       WHERE u.reports_to = _node
         AND EXISTS (
           SELECT 1 FROM user_roles ur
            WHERE ur.user_id = u.id AND ur.role = 'student'
         )
      UNION
      -- ramo (b): membros explícitos dos manager_groups que _node possui — AGORA
      -- também exige o chapéu 'student' (FIX, mesma regra do ramo a). Antes desta
      -- migration, qualquer linha de manager_group_members era devolvida sem essa
      -- checagem, mesmo para um user_id que nunca teve o chapéu 'student'.
      SELECT mgm.student_id AS sid
        FROM manager_group_members mgm
        JOIN manager_groups mg ON mg.id = mgm.group_id
       WHERE mg.manager_id = _node
         AND EXISTS (
           SELECT 1 FROM user_roles ur
            WHERE ur.user_id = mgm.student_id AND ur.role = 'student'
         )
    ) agg
   WHERE agg.sid <> _node;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auth_direct_student_ids(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_direct_student_ids(uuid) TO authenticated, service_role;
