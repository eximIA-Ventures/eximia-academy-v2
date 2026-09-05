-- Versiona as TRES funcoes de alcance de gestor que `20260702222743` REVOGA e
-- que nenhuma migration deste repositorio jamais criou:
--
--     public.subtree_student_ids(uuid)
--     public.auth_subtree_user_ids()
--     public.auth_reachable_student_ids()
--
-- =============================================================================
-- POR QUE ESTE ARQUIVO E POR QUE ESTA VERSAO
-- =============================================================================
-- `20260702222743_auth_direct_student_ids.sql`, linhas 96-98, executa
--
--     REVOKE EXECUTE ON FUNCTION public.subtree_student_ids(uuid)     FROM PUBLIC, anon;
--     REVOKE EXECUTE ON FUNCTION public.auth_subtree_user_ids()       FROM PUBLIC, anon;
--     REVOKE EXECUTE ON FUNCTION public.auth_reachable_student_ids()  FROM PUBLIC, anon;
--
-- Num banco reconstruido a partir do git as tres NAO EXISTEM, e `REVOKE EXECUTE
-- ON FUNCTION` sobre funcao inexistente aborta com `42883 function does not
-- exist`. O replay do zero PARA EM JULHO e nunca chega as 40 migrations
-- seguintes. Isso esta declarado, e nao resolvido, no cabecalho de
-- `20260905120000_equivalencia_git_producao_colunas_gatilhos_tabelas.sql`
-- (secao "BLOQUEIO A MONTANTE, QUE ESTE ARQUIVO **NAO** RESOLVE").
--
-- `20260702222742` < `20260702222743`. Num replay ordenado, DEFINE e so entao
-- REVOGA — o mesmo movimento que `20260831125000` fez ao se colocar antes do
-- `20260831130000`. E o pre-requisito de tudo que dependa de um ambiente novo
-- reprodutivel (faxina 2026-09, decisao D14).
--
-- =============================================================================
-- DE ONDE VIERAM OS CORPOS — E O QUE ISSO NAO PROVA
-- =============================================================================
-- FONTE: `supabase/migrations/20260621102000_e3_subtree_resolvers.sql` no commit
-- `8388e0e` ("fix(epic-30): D2 resolver soma manager_group do proprio gestor +
-- validacao no DB local"), da branch `feat/epic-30-multinivel`, que NUNCA foi
-- mergeada. Recuperado com `git log -S auth_reachable_student_ids --all`.
-- Os tipos de retorno batem com `packages/database/src/types/supabase.ts`
-- (`Returns: string[]` para as tres), que foi gerado a partir de um banco local
-- onde aquela migration havia sido aplicada.
--
-- O QUE ISTO NAO E: leitura de `pg_get_functiondef` na producao. Nao ha Docker
-- nem psql nesta maquina, e o cabecalho de
-- `20260718120000_fix_auth_direct_student_ids_hat_gap.sql` (linhas 23-30) diz
-- textualmente que o texto ATUAL destas tres em producao "nao pode ser auditado
-- a partir do codigo-fonte" — elas foram aplicadas la fora do fluxo de
-- migrations. Ou seja: os corpos abaixo sao a MELHOR FONTE DISPONIVEL no
-- repositorio, e nao uma copia certificada da producao.
--
-- =============================================================================
-- CRIACAO CONDICIONAL: EM PRODUCAO ESTE ARQUIVO NAO TOCA NENHUM DOS TRES CORPOS
-- =============================================================================
-- Os tres blocos abaixo sao `DO $do$ ... IF to_regprocedure(...) IS NULL THEN
-- CREATE FUNCTION ... END IF ... $do$`, e NAO `CREATE OR REPLACE`.
--
-- A razao e o modo de falha que a versao com `CREATE OR REPLACE` tinha: este
-- arquivo e RETRODATADO (`20260702222742` e anterior a ultima migration ja
-- registrada no remoto), entao `supabase db push` recusa e exige
-- `--include-all`. Quem rodasse com `--include-all` executaria o corpo em
-- producao — e `CREATE OR REPLACE` preserva a ACL mas SUBSTITUI O CORPO,
-- apagando em silencio a versao que esta la e que o proprio cabecalho de
-- `20260718120000` (linhas 23-30) declara NAO auditavel a partir do
-- codigo-fonte. Escopo de gestor errado nao levanta erro: o gestor so passa a
-- ver o conjunto errado de alunos. A unica trava era um paragrafo de prosa
-- pedindo ao operador que comparasse antes; agora a trava esta no SQL.
--
-- Efeito, por terreno:
--   * banco novo (replay do zero, D14): as tres nascem com os corpos abaixo e o
--     `REVOKE` de `20260702222743` para de abortar com `42883`;
--   * producao: as tres ja existem, os blocos emitem `NOTICE` e seguem — nenhum
--     `CREATE` roda, nenhum corpo muda.
--
-- Se um dia se QUISER alinhar producao a estes corpos, isso e uma migration
-- nova e deliberada, com o texto de producao lido antes por:
--
--        SELECT p.proname, pg_get_functiondef(p.oid)
--          FROM pg_proc p
--          JOIN pg_namespace n ON n.oid = p.pronamespace
--         WHERE n.nspname = 'public'
--           AND p.proname IN ('subtree_student_ids',
--                             'auth_subtree_user_ids',
--                             'auth_reachable_student_ids');
--
-- =============================================================================
-- POR QUE `CREATE` FUNCIONA NUM BANCO ONDE `users.reports_to` AINDA NAO EXISTE
-- =============================================================================
-- Em `plpgsql` o corpo nao e resolvido na criacao, so analisado sintaticamente.
-- `users.reports_to`, `manager_groups.parent_group_id` e a tabela `user_roles`
-- so nascem em `20260701030000` / `20260905120000` — e as tres CRIAM sem erro
-- aqui mesmo assim. Mesma nota tecnica do rodape de `20260831125000`.
--
-- =============================================================================
-- GRANTS: POR QUE ELES ESTAO AQUI, E NAO SO O REVOKE DE 20260702222743
-- =============================================================================
-- Funcao recem-criada nasce com `EXECUTE` para `PUBLIC`. O arquivo seguinte
-- revoga de `PUBLIC, anon` e NAO concede a ninguem — num banco reconstruido as
-- tres ficariam sem nenhum executor, e o app quebra: `lib/area-context.ts`
-- chama `auth_reachable_student_ids`, `auth_subtree_user_ids` e
-- `subtree_student_ids` pelo cliente AUTENTICADO do gestor (as tres leem
-- `auth.uid()`; passar o service client seria erro de seguranca, e o arquivo
-- documenta isso). O par REVOKE/GRANT abaixo e o mesmo de
-- `auth_direct_student_ids` em `20260702222743:99-101`, aplicado a familia
-- inteira: nada para `anon` (a anon key e publica), `authenticated` e
-- `service_role` executam.
--
-- REVERSAO: `DROP FUNCTION IF EXISTS public.<nome>(<args>);` — mas so faz
-- sentido num banco onde elas nao deveriam existir. Em producao, nunca.

BEGIN;

-- ---------------------------------------------------------------------------
-- auth_reachable_student_ids()
--   Alunos alcancaveis pelo GESTOR AUTENTICADO (auth.uid()).
--   UNIAO SEMPRE: [alunos da subarvore reports_to com chapeu 'student']
--               U [members dos manager_groups de QUALQUER gestor descendente].
--   Auto-exclui auth.uid(). Dedup via UNION + array_agg(DISTINCT).
-- ---------------------------------------------------------------------------
DO $do$
BEGIN
  -- CRIA SO SE NAO EXISTIR. `CREATE OR REPLACE` preserva a ACL mas SUBSTITUI O
  -- CORPO: aplicado em producao com `--include-all`, apagaria em silencio a
  -- versao que esta la (e que o cabecalho deste arquivo declara NAO auditada).
  -- Escopo de gestor errado nao levanta erro — o gestor so passa a ver o
  -- conjunto errado de alunos. Terreno virgem ganha a definicao; terreno
  -- ocupado fica intacto, sem depender de o operador lembrar de ler o
  -- cabecalho antes de rodar.
  IF to_regprocedure('public.auth_reachable_student_ids()') IS NULL THEN
    EXECUTE $f$  CREATE FUNCTION public.auth_reachable_student_ids()
  RETURNS uuid[]
  AS $$
  DECLARE
    _ids uuid[];
  BEGIN
    WITH RECURSIVE subtree AS (
      -- ancora: filhos diretos do gestor autenticado
      SELECT u.id, 1 AS depth
        FROM users u
       WHERE u.reports_to = auth.uid()
      UNION                              -- UNION (nao UNION ALL) => dedup => cycle-safe
      -- recursao: descendentes, com guarda de profundidade defensiva
      SELECT c.id, s.depth + 1
        FROM users c
        JOIN subtree s ON c.reports_to = s.id
       WHERE s.depth < 10               -- guarda de profundidade (defesa em prof.; trigger E2 ja impede ciclo)
    )
    SELECT COALESCE(array_agg(DISTINCT agg.sid), '{}'::uuid[])
      INTO _ids
      FROM (
        -- ramo A: pessoas da subarvore que possuem o chapeu 'student' em user_roles (NAO users.role)
        SELECT st.id AS sid
          FROM subtree st
         WHERE EXISTS (
           SELECT 1 FROM user_roles ur
            WHERE ur.user_id = st.id AND ur.role = 'student'
         )
        UNION                            -- UNIAO SEMPRE (sem CLIFF): roda mesmo se ramo A ja trouxe alunos
        -- ramo B: members dos manager_groups do PROPRIO gestor + de QUALQUER descendente (inclusao aditiva).
        -- D2: "grupos do gestor sao aditivos ao proprio alcance" => inclui mg.manager_id = auth.uid()
        -- (a subarvore ancora em reports_to=auth.uid() e NAO contem o proprio gestor; sem o OR, o
        --  manager_group do proprio gestor seria ignorado — cenario-ancora D2 Theo=5 quebraria -> 4).
        SELECT mgm.student_id AS sid
          FROM manager_group_members mgm
          JOIN manager_groups mg ON mg.id = mgm.group_id
         WHERE (mg.manager_id IN (SELECT id FROM subtree) OR mg.manager_id = auth.uid())
      ) agg
     WHERE agg.sid <> auth.uid();        -- auto-exclusao do gestor (nao polui a media do time)

    RETURN _ids;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;
    $f$;

    -- COMMENT em EXECUTE proprio: um `EXECUTE` por comando deixa
    -- explicito que o comentario so e escrito quando a funcao acabou de
    -- nascer aqui — em producao ele tambem fica intacto.
    EXECUTE $c$
  COMMENT ON FUNCTION public.auth_reachable_student_ids() IS
    'EPIC-30 E3: alunos alcancaveis pelo gestor autenticado. UNIAO subarvore(reports_to,student) U members(manager_groups descendentes), dedup, auto-exclui auth.uid(). DEFINER STABLE.';
    $c$;
  ELSE
    RAISE NOTICE 'migration 20260702222742: public.auth_reachable_student_ids() ja existe — corpo PRESERVADO (ver cabecalho do arquivo)';
  END IF;
END
$do$;

-- ---------------------------------------------------------------------------
-- subtree_student_ids(_node uuid)
--   Gemea PARAMETRIZADA da anterior, para DRILL-DOWN em no arbitrario.
--   O app DEVE checar _node em auth_subtree_user_ids() ANTES de chamar
--   (esta funcao nao tem gate proprio — e a razao de `20260702222743` revogar
--   o EXECUTE de `anon` com urgencia).
-- ---------------------------------------------------------------------------
DO $do$
BEGIN
  -- CRIA SO SE NAO EXISTIR. `CREATE OR REPLACE` preserva a ACL mas SUBSTITUI O
  -- CORPO: aplicado em producao com `--include-all`, apagaria em silencio a
  -- versao que esta la (e que o cabecalho deste arquivo declara NAO auditada).
  -- Escopo de gestor errado nao levanta erro — o gestor so passa a ver o
  -- conjunto errado de alunos. Terreno virgem ganha a definicao; terreno
  -- ocupado fica intacto, sem depender de o operador lembrar de ler o
  -- cabecalho antes de rodar.
  IF to_regprocedure('public.subtree_student_ids(uuid)') IS NULL THEN
    EXECUTE $f$  CREATE FUNCTION public.subtree_student_ids(_node uuid)
  RETURNS uuid[]
  AS $$
  DECLARE
    _ids uuid[];
  BEGIN
    IF _node IS NULL THEN
      RETURN '{}'::uuid[];
    END IF;

    WITH RECURSIVE subtree AS (
      SELECT u.id, 1 AS depth
        FROM users u
       WHERE u.reports_to = _node
      UNION
      SELECT c.id, s.depth + 1
        FROM users c
        JOIN subtree s ON c.reports_to = s.id
       WHERE s.depth < 10
    )
    SELECT COALESCE(array_agg(DISTINCT agg.sid), '{}'::uuid[])
      INTO _ids
      FROM (
        SELECT st.id AS sid
          FROM subtree st
         WHERE EXISTS (
           SELECT 1 FROM user_roles ur
            WHERE ur.user_id = st.id AND ur.role = 'student'
         )
        UNION
        -- ramo B: members dos manager_groups do PROPRIO _node + de qualquer descendente (aditivo).
        -- Coerencia com auth_reachable_student_ids: inclui mg.manager_id = _node (a subarvore
        -- ancora em reports_to=_node e nao contem o proprio no).
        SELECT mgm.student_id AS sid
          FROM manager_group_members mgm
          JOIN manager_groups mg ON mg.id = mgm.group_id
         WHERE (mg.manager_id IN (SELECT id FROM subtree) OR mg.manager_id = _node)
      ) agg
     WHERE agg.sid <> _node;             -- auto-exclusao do NO-alvo

    RETURN _ids;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;
    $f$;

    -- COMMENT em EXECUTE proprio: um `EXECUTE` por comando deixa
    -- explicito que o comentario so e escrito quando a funcao acabou de
    -- nascer aqui — em producao ele tambem fica intacto.
    EXECUTE $c$
  COMMENT ON FUNCTION public.subtree_student_ids(uuid) IS
    'EPIC-30 E3: alunos alcancaveis a partir de _node (drill-down). Mesma logica de auth_reachable_student_ids. CHECK de pertencimento (node em auth_subtree_user_ids) e responsabilidade do app/E4. DEFINER STABLE.';
    $c$;
  ELSE
    RAISE NOTICE 'migration 20260702222742: public.subtree_student_ids(uuid) ja existe — corpo PRESERVADO (ver cabecalho do arquivo)';
  END IF;
END
$do$;

-- ---------------------------------------------------------------------------
-- auth_subtree_user_ids()
--   PESSOAS (nao so alunos) na subarvore do gestor autenticado.
--   Usado para: (a) montar o organograma, (b) gate de pertencimento do
--   drill-down, (c) policy users_subtree_select (E4).
--   INCLUI o proprio auth.uid() como raiz visivel (organograma mostra o gestor).
-- ---------------------------------------------------------------------------
DO $do$
BEGIN
  -- CRIA SO SE NAO EXISTIR. `CREATE OR REPLACE` preserva a ACL mas SUBSTITUI O
  -- CORPO: aplicado em producao com `--include-all`, apagaria em silencio a
  -- versao que esta la (e que o cabecalho deste arquivo declara NAO auditada).
  -- Escopo de gestor errado nao levanta erro — o gestor so passa a ver o
  -- conjunto errado de alunos. Terreno virgem ganha a definicao; terreno
  -- ocupado fica intacto, sem depender de o operador lembrar de ler o
  -- cabecalho antes de rodar.
  IF to_regprocedure('public.auth_subtree_user_ids()') IS NULL THEN
    EXECUTE $f$  CREATE FUNCTION public.auth_subtree_user_ids()
  RETURNS uuid[]
  AS $$
  DECLARE
    _ids uuid[];
  BEGIN
    WITH RECURSIVE subtree AS (
      SELECT u.id, 1 AS depth
        FROM users u
       WHERE u.reports_to = auth.uid()
      UNION
      SELECT c.id, s.depth + 1
        FROM users c
        JOIN subtree s ON c.reports_to = s.id
       WHERE s.depth < 10
    )
    SELECT COALESCE(array_agg(DISTINCT id), '{}'::uuid[])
      INTO _ids
      FROM (
        SELECT id FROM subtree                  -- todos os descendentes (qualquer chapeu)
        UNION
        SELECT auth.uid()                       -- raiz: o proprio gestor compoe o organograma
      ) people;

    RETURN _ids;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;
    $f$;

    -- COMMENT em EXECUTE proprio: um `EXECUTE` por comando deixa
    -- explicito que o comentario so e escrito quando a funcao acabou de
    -- nascer aqui — em producao ele tambem fica intacto.
    EXECUTE $c$
  COMMENT ON FUNCTION public.auth_subtree_user_ids() IS
    'EPIC-30 E3: pessoas (qualquer chapeu) na subarvore do gestor autenticado, INCLUINDO o proprio gestor como raiz. Base do organograma, do gate de drill-down e de users_subtree_select. DEFINER STABLE.';
    $c$;
  ELSE
    RAISE NOTICE 'migration 20260702222742: public.auth_subtree_user_ids() ja existe — corpo PRESERVADO (ver cabecalho do arquivo)';
  END IF;
END
$do$;

-- ---------------------------------------------------------------------------
-- ACL — identica a de `auth_direct_student_ids` (20260702222743:99-101).
-- O REVOKE aqui e redundante com o do arquivo seguinte de proposito: se este
-- for aplicado sozinho, a funcao nao fica aberta a `anon` nem por um instante.
--
-- Estes seis comandos rodam INCONDICIONALMENTE, e isso e correto: eles operam
-- sobre funcoes que a esta altura existem nos dois terrenos (criadas acima em
-- banco novo, pre-existentes em producao) e a ACL que impoem e exatamente a que
-- `20260702222743` ja impoe — reaplica-la e no-op, e omiti-la deixaria as tres
-- sem executor nenhum num banco reconstruido.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.auth_reachable_student_ids() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.auth_subtree_user_ids()      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.subtree_student_ids(uuid)    FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.auth_reachable_student_ids() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auth_subtree_user_ids()      TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.subtree_student_ids(uuid)    TO authenticated, service_role;

COMMIT;
