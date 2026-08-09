-- auth_team_engagement_signals(_student_ids uuid[]) — RLS-proof per-student
-- engagement signals for the manager "Meu Time" buckets
-- (feat-team-view-hierarchy-switch, Iteração 3, 2026-07-03).
--
-- CONTEXT / BUG QUE ESTA FUNÇÃO CORRIGE (mesma classe do bug da Iteração 3 de
-- getDirectTeamStudentIds, ver 20260702222743_auth_direct_student_ids.sql):
--   classifyTeamEngagement (lib/engagement-helpers.ts) lia os SINAIS de
--   engajamento (sessions, slide_reflections, enrollments, courses) com o client
--   AUTENTICADO do gestor. O UNIVERSO de alunos já vinha correto das RPCs
--   SECURITY DEFINER (auth_direct_student_ids / subtree_student_ids /
--   auth_reachable_student_ids), que resolvem alunos por `reports_to` (organograma)
--   UNIÃO membros de manager_groups. PORÉM as RLS de produção nas tabelas de
--   sinal só concedem alcance de gestor via manager_group_members /
--   auth_team_reachable_student_ids() (subárvore de GRUPOS), NUNCA via
--   `reports_to`:
--     • sessions_select      → student_id = auth.uid() OR role = 'admin'
--     • sessions_group_select → student_id ∈ membros de grupos que o gestor possui
--     • sessions_team_subtree_select → student_id ∈ auth_team_reachable_student_ids()
--     • (idem slide_reflections: sr_team_subtree_select; enrollments: *_group / *_team_subtree)
--   Um aluno ligado ao gestor SÓ por `reports_to` (subordinado direto de
--   organograma, sem grupo) está no UNIVERSO mas é INVISÍVEL aos sinais. Suas
--   sessions retornam vazio → totalSessions = 0 → classificado como "Inativos",
--   mesmo tendo acessado hoje. Provado em produção (tenant Cory, gestor Rinaldo):
--   os 6 diretos e 12 dos 40 da hierarquia caíam nessa cegueira; Caio Pinheiro
--   (multi-chapéu manager+student, sessão de hoje) era um deles.
--
--   A correção é a MESMA receita das RPCs irmãs: ler os sinais em SQL
--   SECURITY DEFINER (privilégio elevado, contorna a RLS das tabelas de sinal),
--   nunca em query client-side sobre tabela RLS-protegida.
--
-- NÃO AMPLIA ALCANCE (defesa em profundidade): a função tem GATE próprio. Cada
-- id em `_student_ids` só é processado se estiver no alcance AUTORIZADO do
-- caller — ou seja, é o próprio auth.uid(), OU é um aluno-direto de algum nó da
-- subárvore do caller (auth_subtree_user_ids()), OU membro de um grupo que o
-- caller alcança. Isso reproduz EXATAMENTE o universo que as RPCs de escopo já
-- devolvem (reports_to ∪ manager_group_members, subárvore adentro), então a
-- função nunca devolve sinal de um aluno que o gestor não poderia ver por
-- outro caminho legítimo. Um id forjado fora do alcance é silenciosamente
-- ignorado (fail-closed), nunca vaza.
--
-- PACE (behind schedule): computado aqui em SQL, byte-a-byte equivalente ao JS
-- que ele substitui (manager-dashboard-page.tsx / engagement-helpers.ts):
--   deadline_days NÃO-NULO e > 0; enrollment 'active'; elapsed = (now - created)/86400;
--   expectedPct = LEAST(100, round(elapsed/deadline_days*100));
--   behind quando (progress->>'percentage')::numeric < expectedPct.
-- deadline_days NULL ou <= 0 → nunca "behind" (mesma guarda intencional do JS).
--
-- RETORNO: uma linha por id EM ALCANCE que exista como usuário do tenant (ids
-- fora de alcance ou inexistentes são omitidos; o chamador JS já tem o universo
-- e trata ausência como "sem sinal"). Colunas:
--   student_id, total_sessions, completed_sessions, last_activity_at,
--   reflections_count, behind_schedule.
CREATE OR REPLACE FUNCTION public.auth_team_engagement_signals(_student_ids uuid[])
RETURNS TABLE (
  student_id uuid,
  total_sessions bigint,
  completed_sessions bigint,
  last_activity_at timestamptz,
  reflections_count bigint,
  behind_schedule boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  _tenant uuid;
  _allowed uuid[];
BEGIN
  -- Fail-closed for anonymous callers: no auth.uid() → no signals.
  IF auth.uid() IS NULL OR _student_ids IS NULL OR array_length(_student_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  _tenant := auth_tenant_id();
  IF _tenant IS NULL THEN
    RETURN;
  END IF;

  -- GATE — the AUTHORIZED reach of this caller, resolved with elevated
  -- privilege exactly like the universe RPCs. A student is authorized iff:
  --   (a) they are the caller themselves (auth.uid()), OR
  --   (b) they are a DIRECT student of some node in the caller's own subtree
  --       (auth_subtree_user_ids()), where "direct" = reports_to ∪ owned
  --       manager_group members — the same union auth_direct_student_ids uses.
  -- This is the union across the WHOLE subtree, so it equals the Hierarquia
  -- universe (auth_reachable_student_ids) and is a superset of any single
  -- node's Diretos set. Admins/super_admins have their own tenant-wide reach;
  -- for them we allow the whole requested set within the tenant (their RLS
  -- already grants tenant-wide reads).
  IF is_super_admin() OR auth_user_role() = 'admin' THEN
    _allowed := _student_ids;
  ELSE
    SELECT array_agg(DISTINCT a.sid) INTO _allowed
    FROM (
      SELECT auth.uid() AS sid
      UNION
      SELECT ds.sid
      FROM unnest(auth_subtree_user_ids()) AS node(id)
      CROSS JOIN LATERAL auth_direct_student_ids(node.id) AS ds(sid)
    ) a;
  END IF;

  IF _allowed IS NULL OR array_length(_allowed, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH scope AS (
    -- Only ids that were BOTH requested AND authorized, within the tenant.
    SELECT DISTINCT u.id AS sid
    FROM users u
    WHERE u.tenant_id = _tenant
      AND u.id = ANY (_student_ids)
      AND u.id = ANY (_allowed)
  ),
  sess AS (
    SELECT s.student_id AS sid,
           count(*) AS total_sessions,
           count(*) FILTER (WHERE s.status = 'completed') AS completed_sessions,
           max(s.created_at) AS last_activity_at
    FROM sessions s
    JOIN scope sc ON sc.sid = s.student_id
    WHERE s.tenant_id = _tenant
    GROUP BY s.student_id
  ),
  refl AS (
    SELECT sr.student_id AS sid, count(*) AS reflections_count
    FROM slide_reflections sr
    JOIN scope sc ON sc.sid = sr.student_id
    WHERE sr.tenant_id = _tenant
    GROUP BY sr.student_id
  ),
  behind AS (
    -- ANY active enrollment past expected pace flags the student.
    SELECT DISTINCT e.student_id AS sid
    FROM enrollments e
    JOIN scope sc ON sc.sid = e.student_id
    JOIN courses c ON c.id = e.course_id
    WHERE e.tenant_id = _tenant
      AND e.status = 'active'
      AND c.tenant_id = _tenant
      AND c.deadline_days IS NOT NULL
      AND c.deadline_days > 0
      AND (
        COALESCE((e.progress->>'percentage')::numeric, 0)
        < LEAST(
            100,
            round(
              (GREATEST(0, extract(epoch FROM (now() - e.created_at)) / 86400.0) / c.deadline_days) * 100
            )
          )
      )
  )
  SELECT sc.sid AS student_id,
         COALESCE(sess.total_sessions, 0) AS total_sessions,
         COALESCE(sess.completed_sessions, 0) AS completed_sessions,
         sess.last_activity_at,
         COALESCE(refl.reflections_count, 0) AS reflections_count,
         (behind.sid IS NOT NULL) AS behind_schedule
  FROM scope sc
  LEFT JOIN sess ON sess.sid = sc.sid
  LEFT JOIN refl ON refl.sid = sc.sid
  LEFT JOIN behind ON behind.sid = sc.sid;
END;
$$;

-- Only authenticated users (whose auth.uid() drives the gate) and service_role
-- may execute. NEVER anon/PUBLIC: the anon key is public and would let an
-- unauthenticated caller harvest engagement signals via PostgREST rpc. The
-- explicit REVOKE FROM anon (beyond PUBLIC) mirrors the hardening applied to the
-- sibling RPCs after a real prod incident (CREATE OR REPLACE preserves any prior
-- direct GRANT to anon; REVOKE FROM PUBLIC alone would not remove it).
REVOKE EXECUTE ON FUNCTION public.auth_team_engagement_signals(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_team_engagement_signals(uuid[]) TO authenticated, service_role;
