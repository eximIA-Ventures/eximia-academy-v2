-- Recupera para o git as 4 funções que existiam APENAS no servidor e que as
-- migrations de 2026-08-31 passaram a NOMEAR sem que nada as definisse.
--
-- =============================================================================
-- ESTE DEFEITO FOI INTRODUZIDO POR ESTA RODADA, NÃO HERDADO
-- =============================================================================
-- `20260831130000` revoga `EXECUTE` destas quatro. Num banco reconstruído a
-- partir do git — staging, CI, cliente novo — elas **não existem**, e
-- `REVOKE EXECUTE ON FUNCTION public.<nome>(...)` sobre função inexistente
-- **aborta a migration** com `42883 function does not exist`. Ou seja: ao
-- corrigir segurança em produção, tornamos a sequência de migrations
-- inaplicável em terreno virgem.
--
-- É a mesma forma do defeito que esta auditoria corrigiu no dia anterior (o par
-- de migrations da Aprendizagem do Time, em que cada uma só funcionava no
-- terreno que a outra não produzia). A diferença é que aquele foi herdado e este
-- é nosso, feito hoje, no ato de endurecer o banco. Fica registrado como tal.
--
-- =============================================================================
-- POR QUE DEFINIR, E NÃO APENAS CONDICIONAR O REVOKE
-- =============================================================================
-- O caminho barato seria embrulhar cada `REVOKE` num `IF EXISTS`. Foi recusado:
-- um condicional que CALA quando não encontra é exatamente o `IF NOT EXISTS` que
-- custou a esta casa três tabelas com 931 linhas invisíveis. A migration passaria
-- verde em terreno virgem **sem ter endurecido coisa alguma**, e o verde diria
-- "endureci" quando o correto seria "não havia o que endurecer, e a função vai
-- nascer depois com o ACL padrão aberto".
--
-- Definir resolve os dois problemas de uma vez: a sequência passa a ser
-- aplicável em terreno virgem **e** o `REVOKE` seguinte tem sobre o que agir,
-- de modo que o banco reconstruído nasce com o mesmo endurecimento da produção.
-- Também fecha, para estas quatro, o achado 9 do inventário (16 funções só do
-- servidor).
--
-- =============================================================================
-- ORDEM, E POR QUE A VERSÃO É ANTERIOR À DA REVOGAÇÃO
-- =============================================================================
-- `20260831125000` < `20260831130000`. Num replay ordenado, define e só então
-- revoga. Em produção, onde as quatro já existem, `CREATE OR REPLACE` é no-op
-- semântico (os corpos abaixo foram lidos de `pg_get_functiondef` no servidor e
-- reproduzidos verbatim) e **preserva a ACL**, de modo que a revogação já
-- aplicada permanece em vigor mesmo se este arquivo for aplicado sozinho e fora
-- de ordem.
--
-- =============================================================================
-- O QUE ESTE ARQUIVO **NÃO** RESOLVE — declarado, não escondido
-- =============================================================================
-- Ele versiona as FUNÇÕES, que é o que as migrations de 31/08 nomeiam. Não
-- versiona:
--   * os 3 GATILHOS que as usam (`trg_manager_groups_parent_guard @ manager_groups`,
--     `user_roles_recompute_primary @ user_roles`, `trg_users_reports_to_guard @ users`);
--   * as colunas só do servidor de que os corpos dependem em tempo de EXECUÇÃO
--     (`users.reports_to`, `manager_groups.parent_group_id` — achado 9);
--   * as outras 12 funções só do servidor.
-- Criar os gatilhos aqui exigiria essas colunas, que nenhuma migration cria — o
-- que puxaria o achado 9 inteiro para dentro desta correção. **Recorte declarado:
-- esta migration torna a sequência APLICÁVEL em terreno virgem; ela não torna o
-- banco reconstruído FUNCIONALMENTE equivalente à produção.** Isso é o achado 9,
-- e é trabalho próprio.
-- Nota técnica: em `plpgsql` o corpo não é resolvido na criação, só analisado
-- sintaticamente — por isso estas quatro CRIAM sem erro num banco onde
-- `users.reports_to` e as funções auxiliares ainda não existem.
--
-- REVERSÃO: `DROP FUNCTION IF EXISTS public.<nome>(...);` — mas só faz sentido
-- num banco onde elas não deveriam existir. Em produção, nunca.

BEGIN;

-- --------------------------------------------------------------------------
-- recompute_primary_role
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_primary_role(_uid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _primary text;
BEGIN
  SELECT role
  INTO _primary
  FROM user_roles
  WHERE user_id = _uid
  ORDER BY CASE role
    WHEN 'super_admin' THEN 1
    WHEN 'admin'       THEN 2
    WHEN 'manager'     THEN 3
    WHEN 'instructor'  THEN 4
    WHEN 'leader'      THEN 5
    WHEN 'student'     THEN 6
    ELSE 9
  END
  LIMIT 1;

  -- Se a ultima linha de user_roles foi removida, _primary fica NULL.
  -- Preserva o ultimo papel conhecido em vez de violar o CHECK/NOT NULL de users.role:
  -- so atualiza quando ha um papel resolvido.
  IF _primary IS NOT NULL THEN
    UPDATE users SET role = _primary WHERE id = _uid AND role IS DISTINCT FROM _primary;
  END IF;
END;
$function$;

-- --------------------------------------------------------------------------
-- trg_recompute_primary_role
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_recompute_primary_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recompute_primary_role(OLD.user_id);
    RETURN OLD;
  ELSE
    PERFORM recompute_primary_role(NEW.user_id);
    RETURN NEW;
  END IF;
END;
$function$;

-- --------------------------------------------------------------------------
-- users_reports_to_guard
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.users_reports_to_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _cur     uuid;
  _depth   int := 0;
  _tenant  uuid;
  _author  uuid := auth.uid();
  _priv    boolean;
  _reaches_new_parent boolean := false;  -- autor alcanca o novo pai (novo pai in subarvore)
  _reaches_old_target boolean := false;  -- autor alcancava o no editado (alvo in subarvore)
BEGIN
  -- service-role/seed (auth.uid() NULL), super_admin e admin: passam direto pela
  -- AUTORIZACAO por subarvore. A validacao ESTRUTURAL abaixo vale para todos.
  _priv := (_author IS NULL) OR is_super_admin() OR has_role(_author, 'admin');

  -- ===== Validacao estrutural (todos os autores) =====
  IF NEW.reports_to IS NOT NULL THEN
    IF NEW.reports_to = NEW.id THEN
      RAISE EXCEPTION 'reports_to cycle: user % cannot report to itself', NEW.id
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT tenant_id INTO _tenant FROM users WHERE id = NEW.reports_to;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'reports_to target % does not exist', NEW.reports_to
        USING ERRCODE = 'foreign_key_violation';
    END IF;
    IF _tenant IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'reports_to must stay in the same tenant'
        USING ERRCODE = 'check_violation';
    END IF;

    -- Sobe a partir do novo pai: detecta ciclo, profundidade, e (de graca) se o
    -- autor e ancestral do novo pai => novo pai esta na subarvore do autor.
    _cur := NEW.reports_to;
    WHILE _cur IS NOT NULL LOOP
      _depth := _depth + 1;
      IF _cur = NEW.id THEN
        RAISE EXCEPTION 'reports_to cycle detected for user %', NEW.id
          USING ERRCODE = 'check_violation';
      END IF;
      IF _author IS NOT NULL AND _cur = _author THEN
        _reaches_new_parent := true;
      END IF;
      IF _depth > 10 THEN  -- MAX_ORG_DEPTH (coerente com as CTEs de E3)
        RAISE EXCEPTION 'reports_to chain too deep (>10) at user %', NEW.id
          USING ERRCODE = 'check_violation';
      END IF;
      SELECT reports_to INTO _cur FROM users WHERE id = _cur;
    END LOOP;
  END IF;

  -- ===== Autorizacao por subarvore (apenas autor NAO privilegiado) =====
  IF NOT _priv THEN
    -- so manager mexe em reports_to; qualquer outro papel: negado.
    IF NOT has_role(_author, 'manager') THEN
      RAISE EXCEPTION 'not authorized to change reports_to'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Defesa em profundidade: o autor (manager) so escreve no proprio tenant.
    -- A arvore e mono-tenant (reports_to cross-tenant ja foi rejeitado acima),
    -- mas revalidar o tenant do AUTOR fecha o invariante por construcao, custo zero.
    IF auth_tenant_id() IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'manager cannot change reports_to outside own tenant'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- manager nao destaca no para raiz (remover da hierarquia = admin-only).
    IF NEW.reports_to IS NULL THEN
      RAISE EXCEPTION 'manager cannot set reports_to to NULL (root is admin-only)'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- novo pai deve ser o proprio autor OU um descendente dele.
    IF NOT (NEW.reports_to = _author OR _reaches_new_parent) THEN
      RAISE EXCEPTION 'manager can only reparent within own subtree (new parent out of reach)'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF TG_OP = 'UPDATE' THEN
      -- o no editado ja devia estar na subarvore do autor (via estado OLD).
      IF OLD.reports_to IS NULL THEN
        RAISE EXCEPTION 'manager cannot move a root node'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
      _cur := OLD.reports_to; _depth := 0;
      WHILE _cur IS NOT NULL LOOP
        _depth := _depth + 1;
        IF _cur = _author THEN _reaches_old_target := true; EXIT; END IF;
        IF _depth > 10 THEN EXIT; END IF;
        SELECT reports_to INTO _cur FROM users WHERE id = _cur;
      END LOOP;
      IF NOT (OLD.reports_to = _author OR _reaches_old_target) THEN
        RAISE EXCEPTION 'manager can only move nodes already in own subtree'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    ELSE
      -- INSERT de pessoas e fluxo de admin; manager nao cria usuarios.
      RAISE EXCEPTION 'manager cannot insert users (admin-only)'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- --------------------------------------------------------------------------
-- manager_groups_parent_guard
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.manager_groups_parent_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _cur     uuid;
  _depth   int := 0;
  _tenant  uuid;
BEGIN
  -- NULL = time-raiz: nada a validar (e nada a checar de ciclo).
  IF NEW.parent_group_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- auto-referência direta.
  IF NEW.parent_group_id = NEW.id THEN
    RAISE EXCEPTION 'manager_groups cycle: group % cannot be its own parent', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  -- pai deve existir e ser do MESMO tenant.
  SELECT tenant_id INTO _tenant FROM manager_groups WHERE id = NEW.parent_group_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'parent_group_id target % does not exist', NEW.parent_group_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF _tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'parent_group_id must stay in the same tenant'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Sobe a partir do novo pai: detecta ciclo (chegar de volta em NEW.id) e
  -- profundidade excessiva. A árvore é mono-tenant (validado acima).
  _cur := NEW.parent_group_id;
  WHILE _cur IS NOT NULL LOOP
    _depth := _depth + 1;
    IF _cur = NEW.id THEN
      RAISE EXCEPTION 'manager_groups cycle detected for group %', NEW.id
        USING ERRCODE = 'check_violation';
    END IF;
    IF _depth > 10 THEN  -- MAX_TEAM_DEPTH (coerente com as CTEs de escopo)
      RAISE EXCEPTION 'manager_groups tree too deep (>10) at group %', NEW.id
        USING ERRCODE = 'check_violation';
    END IF;
    SELECT parent_group_id INTO _cur FROM manager_groups WHERE id = _cur;
  END LOOP;

  RETURN NEW;
END;
$function$;

COMMIT;
