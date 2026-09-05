-- Bootstrap do primeiro `super_admin` num ambiente novo.
--
-- Faxina 2026-09, decisao D13 de `docs/faxina-2026-09/00-decisoes.md`.
--
-- =============================================================================
-- O PROBLEMA (o ovo e a galinha do self-service)
-- =============================================================================
-- Todo o cadastro de empresa depende de `profile.role === 'super_admin'`
-- (`api/admin/tenants/route.ts:20-22`) e de `is_super_admin()`
-- (`20260209000000:49-63`, que exige `role='super_admin' AND status='active' AND
-- deleted_at IS NULL`). NENHUMA migration cria um super_admin. O unico lugar do
-- repositorio que cria um e `supabase/seed.sql:45` (`super@a.com` / `123456`),
-- que roda em `supabase db reset` LOCAL e nunca num projeto Supabase hospedado.
--
-- Resultado num ambiente novo — que e exatamente o ambiente que M0 e o replay do
-- zero existem para viabilizar: o app sobe, o login funciona, e NAO HA CAMINHO
-- PELA INTERFACE para criar a primeira empresa. Sem isto, o self-service e uma
-- porta sem chave.
--
-- =============================================================================
-- AS DUAS FORMAS DE BOOTSTRAP (as duas, de proposito)
-- =============================================================================
-- FORMA A — parametro de banco (equivalente ao env `BOOTSTRAP_SUPER_ADMIN_EMAIL`)
--
--     ALTER DATABASE postgres SET app.bootstrap_super_admin_email = 'hugo@exemplo.com';
--     -- (reconectar; vale para toda sessao nova daquele banco)
--
--   O gatilho le `current_setting('app.bootstrap_super_admin_email', true)`. O
--   segundo argumento `true` faz a funcao devolver NULL em vez de levantar
--   `42704` quando o parametro nao existe — sem ele, o gatilho quebraria TODO
--   signup em qualquer banco que nao tivesse configurado o parametro. Este e o
--   detalhe que transforma "conveniencia de bootstrap" em "cadastro fora do ar".
--
-- FORMA B — tabela `public.bootstrap_super_admins` (a pratica no Supabase hospedado)
--
--     INSERT INTO public.bootstrap_super_admins (email, motivo)
--     VALUES ('hugo@exemplo.com', 'bootstrap do ambiente de staging');
--
--   Existe porque num projeto Supabase gerenciado nao ha como injetar variavel
--   de ambiente do processo dentro do Postgres: o `ALTER DATABASE` da forma A
--   exige acesso que nem sempre se tem, enquanto um INSERT no SQL Editor sempre
--   se tem. So `service_role` escreve nela (RLS abaixo) — se `authenticated`
--   pudesse escrever, qualquer usuario se auto-promoveria a dono da plataforma.
--
-- QUANDO A PESSOA JA TEM CONTA (o gatilho so pega signup NOVO):
--
--     SELECT public.promover_super_admin('hugo@exemplo.com');   -- devolve true/false
--
--   Rodar no SQL Editor, com a `service_role`/`postgres`. Idempotente.
--
-- =============================================================================
-- POR QUE PROMOVER, E NAO "CRIAR O USUARIO"
-- =============================================================================
-- Nao ha como criar credencial de login por SQL sem forjar linha em `auth.users`
-- (o que `supabase/seed.sql` faz, e que so e aceitavel num banco local
-- descartavel). O fluxo correto e: a conta nasce pelo Auth, e o gatilho a
-- PROMOVE no mesmo instante. Zero senha em migration.
--
-- ATENCAO AO QUE "NASCE PELO AUTH" SIGNIFICA AQUI. **O app NAO tem tela de
-- cadastro**: `grep -rn signUp apps/web/src` devolve zero, nao existe rota
-- `signup`/`cadastro`/`registrar`, e `login-form.tsx` so oferece
-- `signInWithPassword`, `signInWithOAuth` (Google) e `signInWithSSO`. Num
-- ambiente Supabase novo, o INSERT que dispara `trg_bootstrap_super_admin` vem
-- de um destes caminhos, e nao de uma tela deste repositorio:
--   * Supabase Dashboard -> Authentication -> Users -> "Add user" (com senha);
--   * primeiro login por Google/SSO, se o provider estiver configurado.
-- Fora deles, use `promover_super_admin` (abaixo) depois de a conta existir.
-- O passo a passo operacional esta em `docs/faxina-2026-09/07-guia-easypanel.md`
-- §7.3.
--
-- =============================================================================
-- O QUE A PROMOCAO ESCREVE, E POR QUE NAS DUAS TABELAS
-- =============================================================================
-- `public.users`      -> role='super_admin', tenant_id=NULL, status='active',
--                        deleted_at=NULL. As quatro condicoes de `is_super_admin()`,
--                        mais o CHECK `users_super_admin_tenant_check`
--                        (20260209000000:13-18), que EXIGE tenant_id NULL para
--                        super_admin.
-- `public.user_roles` -> o chapeu, porque `getAuthProfile` embute
--                        `user_roles!user_roles_user_id_fkey(role)` e a UI decide
--                        por chapeu (`hasAnyRole`), nao pela coluna singular.
--                        Gravar so em `users` daria um super_admin que
--                        `is_super_admin()` aceita e a interface nao mostra.
--                        Ordem importa: `user_roles.user_id` tem FK para
--                        `users.id`.
-- Nao ha `handle_new_user` neste banco (verificado: zero gatilhos em `auth.users`
-- em todas as migrations) — quem materializa `public.users` hoje e o codigo do
-- convite (`api/admin/users/invite-user.ts`). Este gatilho nao duplica esse
-- caminho: ele so age para os e-mails explicitamente declarados aqui, e usa
-- `ON CONFLICT` para conviver com uma linha que aquele caminho ja tenha criado.
--
-- REVERSAO:
--   DROP TRIGGER IF EXISTS trg_bootstrap_super_admin ON auth.users;
--   DROP FUNCTION IF EXISTS public.trg_bootstrap_super_admin();
--   DROP FUNCTION IF EXISTS public.promover_super_admin(text);
--   DROP TABLE IF EXISTS public.bootstrap_super_admins;
-- (nao rebaixa quem ja foi promovido — isso e ato deliberado, feito a mao)

BEGIN;

-- ===========================================================================
-- 1. A lista (forma B)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.bootstrap_super_admins (
  email      text PRIMARY KEY,
  motivo     text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bootstrap_super_admins_email_normalizado CHECK (email = lower(TRIM(email))),
  CONSTRAINT bootstrap_super_admins_email_formato     CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

COMMENT ON TABLE public.bootstrap_super_admins IS
  'E-mails que viram super_admin ao se cadastrar. So service_role escreve. Bootstrap de ambiente novo (faxina 2026-09, D13).';
COMMENT ON COLUMN public.bootstrap_super_admins.email IS
  'Sempre em minusculas e sem espacos (CHECK). A comparacao no gatilho e por lower(email).';

ALTER TABLE public.bootstrap_super_admins ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy para `anon`/`authenticated`: com RLS ligada e sem policy, a
-- tabela e invisivel e imutavel para eles (falha fechada). `service_role` ja
-- contorna RLS; a policy existe para deixar a intencao escrita.
DROP POLICY IF EXISTS bootstrap_super_admins_service ON public.bootstrap_super_admins;
CREATE POLICY bootstrap_super_admins_service ON public.bootstrap_super_admins
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.bootstrap_super_admins FROM PUBLIC, anon, authenticated;
GRANT  ALL ON TABLE public.bootstrap_super_admins TO service_role;

-- ===========================================================================
-- 2. A promocao, isolada e chamavel a mao
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.promover_super_admin(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _email text := lower(TRIM(COALESCE(p_email, '')));
  _uid   uuid;
  _nome  text;
BEGIN
  IF _email = '' THEN
    RETURN false;
  END IF;

  SELECT au.id,
         COALESCE(
           NULLIF(TRIM(au.raw_user_meta_data ->> 'full_name'), ''),
           NULLIF(TRIM(au.raw_user_meta_data ->> 'name'), ''),
           split_part(au.email, '@', 1)
         )
    INTO _uid, _nome
    FROM auth.users au
   WHERE lower(au.email) = _email
   ORDER BY au.created_at
   LIMIT 1;

  IF _uid IS NULL THEN
    RAISE WARNING 'promover_super_admin: nenhum auth.users com e-mail %', _email;
    RETURN false;
  END IF;

  INSERT INTO public.users (id, tenant_id, email, full_name, role, status)
  VALUES (_uid, NULL, _email, _nome, 'super_admin', 'active')
  ON CONFLICT (id) DO UPDATE
    SET role       = 'super_admin',
        tenant_id  = NULL,           -- CHECK users_super_admin_tenant_check
        status     = 'active',
        deleted_at = NULL,
        updated_at = now();

  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (_uid, NULL, 'super_admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN true;
END;
$function$;

COMMENT ON FUNCTION public.promover_super_admin(text) IS
  'Promove a super_admin um e-mail que JA tem conta em auth.users (users + user_roles). Idempotente. So service_role executa.';

REVOKE EXECUTE ON FUNCTION public.promover_super_admin(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.promover_super_admin(text) TO service_role;

-- ===========================================================================
-- 3. O gatilho em auth.users
-- ===========================================================================
-- FAIL-OPEN DELIBERADO: qualquer erro dentro da promocao e capturado e vira
-- WARNING. Um gatilho em `auth.users` que levanta DERRUBA O CADASTRO INTEIRO —
-- trocar "nao consegui promover o super_admin" por "ninguem consegue se
-- cadastrar" seria um remedio pior que a doenca. O caminho de recuperacao existe
-- e e explicito: `SELECT public.promover_super_admin('...')`.
CREATE OR REPLACE FUNCTION public.trg_bootstrap_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _alvo  text := lower(TRIM(COALESCE(current_setting('app.bootstrap_super_admin_email', true), '')));
  _email text := lower(TRIM(COALESCE(NEW.email, '')));
BEGIN
  IF _email = '' THEN
    RETURN NEW;
  END IF;

  IF _email = _alvo
     OR EXISTS (SELECT 1 FROM public.bootstrap_super_admins b WHERE b.email = _email)
  THEN
    BEGIN
      PERFORM public.promover_super_admin(_email);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'trg_bootstrap_super_admin: falha ao promover % (%): %', _email, SQLSTATE, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_bootstrap_super_admin ON auth.users;
CREATE TRIGGER trg_bootstrap_super_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.trg_bootstrap_super_admin();

-- ===========================================================================
-- 4. Retroativo — quem ja tem conta e ja esta na lista/parametro
-- ===========================================================================
-- No momento em que esta migration roda a tabela esta vazia e o parametro quase
-- certamente nao existe, entao isto e no-op. Existe para o caso de a migration
-- ser reaplicada depois de a lista ter sido preenchida.
DO $$
DECLARE
  _e    text;
  _alvo text := lower(TRIM(COALESCE(current_setting('app.bootstrap_super_admin_email', true), '')));
BEGIN
  FOR _e IN
    SELECT email FROM public.bootstrap_super_admins
    UNION
    SELECT _alvo WHERE _alvo <> ''
  LOOP
    PERFORM public.promover_super_admin(_e);
  END LOOP;
END $$;

COMMIT;
