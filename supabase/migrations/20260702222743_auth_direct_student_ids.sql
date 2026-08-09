-- auth_direct_student_ids(_node uuid) — RLS-proof resolver for the "Diretos"
-- team-view mode (feat-team-view-hierarchy-switch, Iteração 3, 2026-07-02).
--
-- CONTEXT (dívida técnica pré-existente): a família de RPCs SECURITY DEFINER
-- que resolve escopo de gestor (auth_reachable_student_ids, auth_subtree_user_ids,
-- subtree_student_ids) foi aplicada em produção fora do fluxo de migrations
-- rastreado (ver Notes de docs/stories/feat-team-view-hierarchy-switch.md).
-- Esta é a PRIMEIRA função dessa família versionada nesta migration — o SQL
-- abaixo é o MESMO aplicado em produção via Management API (verificado por
-- teste direto, ver relatório da story). As três irmãs continuam não
-- versionadas; não fazem parte do escopo desta migration.
--
-- BUG QUE ESTA FUNÇÃO CORRIGE: getDirectTeamStudentIds (area-context.ts)
-- resolvia o chapéu 'student' consultando `user_roles` com o client
-- AUTENTICADO do gestor. Em produção, as policies de `user_roles` são
-- ur_self_select (user_id = auth.uid()), ur_admin_manage (admin) e
-- ur_super_admin_all — um MANAGER não enxerga o chapéu de TERCEIROS, então a
-- query sempre voltava vazia e o modo "Diretos" colapsava para escopo vazio
-- em produção (embora os testes unitários passassem, pois os mocks não
-- simulam RLS). A correção é a mesma receita das RPCs irmãs: resolver em SQL
-- SECURITY DEFINER, nunca em query client-side sobre tabela RLS-protegida.
--
-- GATE (fail-closed, mesmo padrão de auth_reachable_student_ids): _node deve
-- ser o próprio auth.uid() OU pertencer à subárvore do caller
-- (auth_subtree_user_ids()); caso contrário retorna vazio. Isso espelha o
-- gate que os call-sites JS já aplicam via auth_subtree_user_ids() antes de
-- invocar subtree_student_ids() — aqui o gate fica embutido na própria
-- função (defesa em profundidade extra, já que "diretos" é chamada com mais
-- frequência a partir de superfícies diversas).
--
-- RESOLUÇÃO = união de:
--   (a) alunos com users.reports_to = _node (organograma direto), com o
--       chapéu 'student' via user_roles (multi-chapéu, contrato E7);
--   (b) membros explícitos de manager_group_members para os manager_groups
--       cujo manager_id = _node (grupos que _node possui, sem fan-out).
-- Sempre um SUBSET estrito de subtree_student_ids(_node) — nunca amplia.
CREATE OR REPLACE FUNCTION public.auth_direct_student_ids(_node uuid)
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- Fail-closed for anonymous/unauthenticated callers: auth.uid() IS NULL makes
  -- the gate below three-valued (NULL), which does NOT take the early RETURN and
  -- leaks a node's direct students to `anon`. Deny NULL caller up front.
  IF _node IS NULL OR auth.uid() IS NULL THEN
    RETURN;
  END IF;

  -- GATE: _node é o próprio caller, ou está na subárvore que o caller alcança.
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
      -- ramo (b): membros explícitos dos manager_groups que _node possui.
      SELECT mgm.student_id AS sid
        FROM manager_group_members mgm
        JOIN manager_groups mg ON mg.id = mgm.group_id
       WHERE mg.manager_id = _node
    ) agg
   WHERE agg.sid <> _node;
END;
$$;

-- Only the authenticated role (a logged-in user, whose auth.uid() drives the
-- gate) and service_role may execute. Do NOT grant to PUBLIC/anon: the anon key
-- is public and would allow unauthenticated harvesting of any node's direct
-- students via PostgREST rpc.
-- REVOKE explícito de anon além de PUBLIC: CREATE OR REPLACE preserva a ACL
-- pré-existente da função, então um GRANT direto a anon feito antes NÃO é
-- removido por REVOKE FROM PUBLIC (foi exatamente o caso na primeira aplicação
-- em produção, detectado por verificação adversarial e corrigido em hotfix).
REVOKE EXECUTE ON FUNCTION public.auth_direct_student_ids(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_direct_student_ids(uuid) TO authenticated, service_role;

-- Fechamento da exposição pré-existente das RPCs irmãs (aplicadas manualmente
-- em produção fora de migration, com EXECUTE aberto a anon; subtree_student_ids
-- não tem gate próprio e vazava a subárvore de qualquer nó para chamadores
-- anônimos com a anon key pública):
REVOKE EXECUTE ON FUNCTION public.subtree_student_ids(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.auth_subtree_user_ids() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.auth_reachable_student_ids() FROM PUBLIC, anon;
