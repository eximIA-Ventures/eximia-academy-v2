-- Contenção: retirar `EXECUTE` de `anon` nas três RPC `SECURITY DEFINER` que
-- ESCREVEM e recebem a identidade do alvo por parâmetro sem conferir o chamador.
--
-- POR QUE ISTO É NECESSÁRIO
-- `anon` é a chave pública do site, distribuída no bundle do navegador. As três
-- funções abaixo são `SECURITY DEFINER` (rodam como o dono, contornando RLS),
-- escrevem, e nenhuma delas contém `auth.uid()`, `auth_user_role()`,
-- `auth_tenant_id()` ou `is_super_admin()` no corpo. Consequência medida em
-- 2026-08-31 contra produção: um `GET /rest/v1/rpc/lgpd_soft_delete_user` com a
-- chave anon devolve `25006 cannot execute UPDATE in a read-only transaction` —
-- erro emitido de DENTRO do corpo. O PostgREST resolveu a função, `anon` foi
-- autorizado, o corpo rodou até a primeira escrita, e só a transação
-- somente-leitura do verbo `GET` o barrou. A barreira era o verbo HTTP, não a
-- permissão. Por `POST`, um estranho sem login apagaria (soft-delete) qualquer
-- usuário cujo UUID conhecesse.
--
-- Ninguém concedeu esse acesso: ele vem do `DEFAULT ACL` do Supabase
-- (`pg_default_acl`, tipo `f`), e é por isso que procurar `GRANT ... TO anon` no
-- repositório não encontra nada e o conjunto parece fechado.
--
-- POR QUE `PUBLIC` **E** `anon`, e não um dos dois
-- A ACL medida antes desta migration era, nas três:
--     =X/postgres  postgres=X/postgres  anon=X/postgres
--     authenticated=X/postgres  service_role=X/postgres
-- O primeiro item (`=X/postgres`) é `PUBLIC` com EXECUTE, do qual `anon`
-- herdaria mesmo após um `REVOKE ... FROM anon`; o terceiro é uma concessão
-- NOMINAL a `anon`, que sobrevive a um `REVOKE ... FROM PUBLIC`. Revogar só um
-- dos dois deixa a porta aberta e produz a aparência de conserto. Nomear os dois
-- é o padrão já estabelecido nesta casa em
-- `20260702222743_auth_direct_student_ids.sql`, `20260703010000` e
-- `20260718120000` — que o aplicaram aos helpers `auth_*`, que apenas LEEM. As
-- três que ESCREVEM ficaram de fora. Esta migration estende o padrão existente
-- ao conjunto que sempre foi o mais perigoso.
--
-- ESCOPO DELIBERADO: `authenticated` sai de UMA das três, não das três
-- Levantamento dos chamadores no repositório (`grep` por `rpc(` + inspeção do
-- cliente em cada sítio), antes de revogar:
--
--   lgpd_soft_delete_user  — chamador ÚNICO: `serviceClient` (`service_role`) em
--     `apps/web/src/app/api/privacy/delete/route.ts:100`. Nenhum chamador com
--     sessão de usuário. Logo `authenticated` também sai: um aluno logado não
--     tem por que apagar outro por UUID, e nada legítimo quebra.
--
--   jsonb_profile_merge  — 10 chamadores com sessão (`createClient()` +
--     `auth.getUser()`), nos fluxos de assessments, perfil e dashboard, mais 2
--     com `service_role`. `authenticated` é caminho LEGÍTIMO e PERMANECE.
--
--   swap_onboarding_course — chamador com sessão em
--     `apps/web/src/app/(platform)/courses/actions.ts:468`, atrás de
--     `requireContentRole`. `authenticated` é legítimo e PERMANECE.
--
-- O risco residual em `authenticated` para essas duas (um usuário logado
-- qualquer ainda alcança outro por UUID) NÃO se fecha por privilégio sem
-- derrubar funcionalidade real: fecha-se conferindo o chamador DENTRO do corpo.
-- Isso muda o corpo da função e é registrado como recomendação separada, não
-- executado aqui — esta migration mexe só em privilégio.
--
-- `service_role` mantém EXECUTE nas três (concessão nominal, intocada), que é o
-- caminho pelo qual as rotas de servidor legitimamente as chamam.
--
-- REVERSÃO
--   GRANT EXECUTE ON FUNCTION public.lgpd_soft_delete_user(uuid)  TO anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.jsonb_profile_merge(uuid,text,text,text) TO anon;
--   GRANT EXECUTE ON FUNCTION public.swap_onboarding_course(uuid,uuid)        TO anon;

BEGIN;

-- 1. lgpd_soft_delete_user — anula sessions.student_id, marca enrollments.deleted_at
--    e users.deleted_at do usuário passado. Só service_role deve alcançá-la.
REVOKE EXECUTE ON FUNCTION public.lgpd_soft_delete_user(uuid)
  FROM PUBLIC, anon, authenticated;

-- 2. jsonb_profile_merge — escreve/remove chave arbitrária em users.profile.
--    `authenticated` permanece: é o caminho dos assessments e do perfil.
REVOKE EXECUTE ON FUNCTION public.jsonb_profile_merge(uuid, text, text, text)
  FROM PUBLIC, anon;

-- 3. swap_onboarding_course — despromove o curso de onboarding do tenant e publica
--    outro. `authenticated` permanece: é o caminho de `publishCourseWithSwap`.
REVOKE EXECUTE ON FUNCTION public.swap_onboarding_course(uuid, uuid)
  FROM PUBLIC, anon;

-- Reafirma o caminho legítimo. É redundante com a ACL atual e existe de
-- propósito: um `CREATE OR REPLACE FUNCTION` futuro preserva a ACL, mas se
-- alguém recriar a função com `DROP` + `CREATE`, ela renasce com o DEFAULT ACL —
-- e estas linhas documentam qual acesso é intencional.
GRANT EXECUTE ON FUNCTION public.lgpd_soft_delete_user(uuid)                TO service_role;
GRANT EXECUTE ON FUNCTION public.jsonb_profile_merge(uuid, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.swap_onboarding_course(uuid, uuid)          TO authenticated, service_role;

COMMIT;

-- O PostgREST guarda a lista de RPC alcançáveis em cache; sem isto a mudança de
-- privilégio só apareceria no próximo reload do serviço.
NOTIFY pgrst, 'reload schema';
