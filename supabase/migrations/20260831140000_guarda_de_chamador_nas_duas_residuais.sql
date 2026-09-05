-- Guarda de CHAMADOR em `jsonb_profile_merge` e `swap_onboarding_course`.
--
-- O QUE ISTO FECHA, E POR QUE NÃO DAVA PARA FECHAR ANTES
-- `20260831100000` tirou `anon` das duas, mas `authenticated` teve de permanecer:
-- há 11 sítios de aplicação com sessão que dependem delas. Restava o risco que
-- privilégio nenhum alcança: as duas recebem a identidade do alvo **por parâmetro**
-- e não conferem quem está chamando. Um aluno logado qualquer escrevia chave
-- arbitrária no `profile` de outro passando o UUID dele; um gestor de conteúdo de
-- um tenant despublicava o curso de onboarding de outro tenant passando o
-- `tenant_id` dele. Esta migration põe a conferência DENTRO do corpo, que é o
-- único lugar onde ela cabe.
--
-- **Isto muda COMPORTAMENTO, não privilégio.** Por isso o censo abaixo veio antes.
--
-- =============================================================================
-- CENSO DOS CHAMADORES — 13 sítios em `jsonb_profile_merge`, e o veredito de cada
-- =============================================================================
-- (A contagem corrente até aqui dizia 12. São 13: `api/profile/generate/route.ts`
-- tinha escapado. Enumerados um a um, com o argumento `p_user_id` lido no sítio.)
--
--  #  sítio                                                      papel          p_user_id     guarda afeta?
--  1  (platform)/assessments/disc/actions.ts:68                  authenticated  user.id       NÃO (é self)
--  2  (platform)/assessments/big-five/actions.ts:83              authenticated  user.id       NÃO
--  3  (platform)/assessments/career-anchors/actions.ts:68        authenticated  user.id       NÃO
--  4  (platform)/assessments/kolb/actions.ts:45                  authenticated  user.id       NÃO
--  5  (platform)/assessments/multiple-intelligences/actions.ts:67 authenticated user.id       NÃO
--  6  (platform)/assessments/enneagram/actions.ts:51             authenticated  user.id       NÃO
--  7  (platform)/perfil/actions.ts:80                            authenticated  user.id       NÃO
--  8  (platform)/perfil/actions.ts:115                           authenticated  user.id       NÃO
--  9  (platform)/perfil/actions.ts:202                           authenticated  user.id       NÃO
-- 10  (platform)/dashboard/actions.ts:54                         authenticated  user.id       NÃO
-- 11  api/profile/generate/route.ts:82                           authenticated  user.id       NÃO
-- 12  api/assessments/upload/route.ts:167                        service_role   user.id       NÃO (auth.uid() é NULL)
-- 13  lib/profiling.ts:128                                       service_role   studentId     NÃO — ver abaixo
--
-- **O sítio 13 é o único que passa o UUID de OUTRO usuário**, e é exatamente o caso
-- que o briefing mandou procurar. Ele sobrevive porque roda sob `service_role`:
-- `createServiceClient()` (`lib/supabase/service.ts`) monta o cliente com
-- `SUPABASE_SERVICE_ROLE_KEY` e `persistSession: false`, **sem sessão de usuário**,
-- então `auth.uid()` é NULL e a primeira condição da guarda já a desarma. É esse o
-- motivo da condição `auth.uid() IS NOT NULL` — sem ela, o pipeline de perfil de IA
-- quebraria.
--
-- **Nenhum sítio `authenticated` passa o UUID de outro usuário.** Os 11 passam
-- `user.id`, obtido de `auth.getUser()` na mesma função. Não há gestor agindo sobre
-- aluno por esta porta, então não houve condição de parada.
--
-- =============================================================================
-- CENSO DE `swap_onboarding_course` — 1 sítio, e a isenção que ele obrigou
-- =============================================================================
--  1  (platform)/courses/actions.ts:468   authenticated   p_tenant_id = courseData.tenant_id
--
-- Aqui a guarda ingênua (`auth_tenant_id() = p_tenant_id`) **quebraria o
-- super_admin**, e isso foi verificado, não suposto:
--   * `requireCourseManager` (`lib/course-management-guard.ts:104`) aceita os
--     chapéus `instructor`, `admin` **e `super_admin`**;
--   * ele NÃO compara o tenant do usuário com o do curso — devolve o `tenant_id` do
--     perfil e segue;
--   * `auth_tenant_id()` devolve o `users.tenant_id` do próprio chamador, e o
--     `super_admin` tem tenant próprio;
--   * o `p_tenant_id` passado é o do CURSO (`courseData.tenant_id`), não o do usuário.
-- Logo um `super_admin` operando sobre outro tenant — que é o trabalho dele — cairia
-- na guarda. Daí a isenção explícita `NOT is_super_admin()`, que é a mesma travessia
-- que as políticas `*_super_admin` de RLS já concedem em toda a base.
--
-- =============================================================================
-- FORMA DA GUARDA
-- =============================================================================
-- `auth.uid()` continua lendo a claim do JWT da sessão mesmo dentro de uma função
-- `SECURITY DEFINER` — ela não assume a identidade do dono. Três estados, e a
-- guarda trata os três:
--   auth.uid() IS NULL   -> `service_role` ou processo interno   -> PASSA
--   auth.uid() = alvo    -> usuário agindo sobre si              -> PASSA
--   auth.uid() <> alvo   -> usuário agindo sobre outro           -> BARRA (42501)
--
-- `42501` é o mesmo código que o Postgres usa para `permission denied`, então o
-- erro chega ao cliente com a semântica correta em vez de virar um 500 genérico.
--
-- `CREATE OR REPLACE` **preserva a ACL**: o `REVOKE` de `anon` aplicado em
-- `20260831100000` permanece em vigor depois desta migration. Verificado após
-- aplicar, não assumido.
--
-- Os corpos abaixo são os de produção, lidos de `pg_get_functiondef`, com APENAS o
-- bloco de guarda acrescentado no topo. Nenhuma outra linha foi tocada — inclusive
-- o `DEFAULT ''::text` de `p_remove_key`, cuja perda mudaria a assinatura e
-- quebraria os 6 sítios que omitem o argumento.
--
-- REVERSÃO: reaplicar os corpos sem o bloco `IF ... RAISE EXCEPTION ... END IF;`.

BEGIN;

CREATE OR REPLACE FUNCTION public.jsonb_profile_merge(
  p_user_id uuid,
  p_set_key text,
  p_set_value text,
  p_remove_key text DEFAULT ''::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- GUARDA DE CHAMADOR. `auth.uid()` NULL = service_role/processo interno, que
  -- escreve no perfil de terceiro legitimamente (lib/profiling.ts).
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION
      'jsonb_profile_merge: chamador % nao pode escrever no perfil de %',
      auth.uid(), p_user_id
      USING ERRCODE = '42501';
  END IF;

  IF p_remove_key != '' THEN
    UPDATE users
    SET profile = (COALESCE(profile, '{}'::jsonb) || jsonb_build_object(p_set_key, p_set_value::jsonb)) - p_remove_key,
        updated_at = now()
    WHERE id = p_user_id;
  ELSE
    UPDATE users
    SET profile = COALESCE(profile, '{}'::jsonb) || jsonb_build_object(p_set_key, p_set_value::jsonb),
        updated_at = now()
    WHERE id = p_user_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.swap_onboarding_course(
  p_new_course_id uuid,
  p_tenant_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- GUARDA DE CHAMADOR. `super_admin` é isento por desenho: ele opera entre
  -- tenants, e `requireCourseManager` o aceita sem comparar tenants.
  IF auth.uid() IS NOT NULL
     AND NOT is_super_admin()
     AND auth_tenant_id() IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION
      'swap_onboarding_course: chamador do tenant % nao pode operar no tenant %',
      auth_tenant_id(), p_tenant_id
      USING ERRCODE = '42501';
  END IF;

  -- Demote existing onboarding course(s) to regular
  UPDATE courses
  SET type = 'regular', updated_at = NOW()
  WHERE tenant_id = p_tenant_id
    AND type = 'onboarding'
    AND status = 'published'
    AND id != p_new_course_id;

  -- Publish new course
  UPDATE courses
  SET status = 'published', updated_at = NOW()
  WHERE id = p_new_course_id
    AND tenant_id = p_tenant_id;
END;
$function$;

COMMIT;
