-- `user_roles`: eliminar as duas definições rivais de RLS, fixando a mais estreita
-- como a única canônica — e tornando a versão larga impossível de renascer por
-- reconciliação.
--
-- O PROBLEMA (inventário, achado 4)
-- A mesma tabela tinha DOIS conjuntos de políticas, um em cada lado:
--
--   servidor (de `20260621100000 e1_user_roles`, migration SEM arquivo no repo)
--     ur_self_select      SELECT  user_id = auth.uid()
--     ur_admin_manage     ALL     has_role(auth.uid(),'admin') AND tenant_id = auth_tenant_id()
--                         CHECK   + role = ANY('student','leader','manager','instructor')
--     ur_super_admin_all  ALL     is_super_admin()
--
--   repo (`20260701030000_epic30_user_roles.sql`, nunca registrada, nunca aplicada)
--     user_roles_select   SELECT  tenant_id = auth_tenant_id() OR user_id = auth.uid()
--     user_roles_admin    ALL     auth_user_role() IN ('admin','super_admin')
--
-- **Políticas permissivas de RLS combinam-se por OU.** Aplicar a migration do repo
-- não substituiria nada: as duas larga somariam-se às três estreitas, e ninguém
-- perderia acesso — só se ganharia. Uma reconciliação de rotina alargaria a
-- autorização em silêncio, e o `git diff` não mostraria alargamento nenhum,
-- porque o alargamento está na SOMA, não em qualquer um dos lados.
--
-- QUANTO ALARGARIA, exatamente — as duas são estritamente mais largas:
--
--   `user_roles_select` acrescenta `tenant_id = auth_tenant_id()`: qualquer usuário
--   autenticado passaria a LER a linha de papel de TODO mundo do seu tenant, e não
--   apenas a própria. O organograma de papéis do cliente vira leitura geral.
--
--   `user_roles_admin` é a pior das duas, por DUAS omissões:
--     (i)  não tem predicado de tenant nenhum — um `admin` do tenant A escreveria
--          `user_roles` do tenant B. É travessia de tenant;
--     (ii) não tem `WITH CHECK` restringindo QUAL papel pode ser concedido. A
--          política canônica limita a concessão a `student|leader|manager|instructor`
--          exatamente para impedir que um `admin` conceda `admin` ou `super_admin`.
--          Sem essa lista, um `admin` escreve a própria linha com `role='super_admin'`
--          e escala. `FOR ALL` sem `WITH CHECK` faz o `USING` valer também para a
--          escrita, e `USING` só pergunta quem é o chamador, nunca o que ele grava.
--
-- A DECISÃO: a definição do servidor é a canônica. Ela é a mais estreita nos três
-- eixos (tenant, alcance de leitura, papel concedível) e é a que está em produção
-- há meses. Não há nada a ganhar na versão do repo.
--
-- COMO ISTO IMPEDE A RECONCILIAÇÃO DE ALARGAR — são duas travas, não uma:
--   1. Esta migration DERRUBA os dois nomes largos (`DROP POLICY IF EXISTS`) e
--      recria os três canônicos. Como `20260831110000` > `20260701030000`, num
--      banco reconstruído do zero pelo git, na ordem, esta roda DEPOIS e limpa.
--   2. `20260701030000_epic30_user_roles.sql` foi editada nesta mesma rodada para
--      **não criar mais as duas políticas largas**. Sem isso, a trava 1 protegeria
--      só o replay ordenado — e o cenário do achado 4 é justamente alguém aplicar
--      aquele arquivo SOZINHO, fora de ordem, para "reconciliar". Agora aquele
--      arquivo é inofensivo isolado, e esta migration é a única fonte da RLS.
--
-- POR QUE `has_role` É RECRIADA AQUI
-- As políticas canônicas dependem de `public.has_role(uuid,text)`, que é uma das
-- 16 funções que **só existem no servidor** (achado 9): nenhuma migration do repo a
-- cria. Sem recuperá-la, esta migration seria inaplicável num banco reconstruído do
-- git — e a RLS canônica não poderia ser expressa em git, que é a raiz do problema.
-- `CREATE OR REPLACE` é no-op em produção (o corpo abaixo é cópia fiel do que já
-- está lá, lido de `pg_get_functiondef`) e é criação num banco novo. `CREATE OR
-- REPLACE` **preserva a ACL existente**, então nenhum privilégio muda em produção.
--
-- REVERSÃO
--   DROP POLICY IF EXISTS ur_self_select     ON public.user_roles;
--   DROP POLICY IF EXISTS ur_admin_manage    ON public.user_roles;
--   DROP POLICY IF EXISTS ur_super_admin_all ON public.user_roles;
--   -- e recriar a partir de `20260621100000 e1_user_roles`, se ela reaparecer.

BEGIN;

-- 1. Recupera para o git a função de que a RLS canônica depende.
--    Cópia fiel do corpo em produção, inclusive `SET search_path`.
CREATE OR REPLACE FUNCTION public.has_role(_uid uuid, _role text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _uid AND role = _role
  ) INTO _ok;
  RETURN _ok;
END;
$function$;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Derruba os dois nomes largos. Hoje eles NÃO existem em produção; o
--    `IF EXISTS` é o que torna esta migration a trava contra o dia em que
--    existirem — por replay, por reconciliação, ou por mão humana.
DROP POLICY IF EXISTS user_roles_select ON public.user_roles;
DROP POLICY IF EXISTS user_roles_admin  ON public.user_roles;

-- 3. Reafirma os três canônicos, byte a byte como estão em produção.
--    `DROP` + `CREATE` dentro da transação torna o corpo determinístico: depois
--    desta migration, o que está no banco é exatamente o que está neste arquivo,
--    e não o que sobrou de uma migration sem arquivo.
DROP POLICY IF EXISTS ur_self_select ON public.user_roles;
CREATE POLICY ur_self_select ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS ur_admin_manage ON public.user_roles;
CREATE POLICY ur_admin_manage ON public.user_roles FOR ALL
  USING (
    has_role(auth.uid(), 'admin')
    AND tenant_id = auth_tenant_id()
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    AND tenant_id = auth_tenant_id()
    -- A lista é a trava anti-escalada: um `admin` concede papéis ABAIXO dele,
    -- nunca `admin` nem `super_admin`. Não afrouxar sem entender isto.
    AND role = ANY (ARRAY['student', 'leader', 'manager', 'instructor'])
  );

DROP POLICY IF EXISTS ur_super_admin_all ON public.user_roles;
CREATE POLICY ur_super_admin_all ON public.user_roles FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

COMMIT;
