-- =============================================================================
-- has_role(uuid, text) — recuperada para ANTES do primeiro uso (replay do zero)
-- =============================================================================
--
-- POR QUE ESTA MIGRATION EXISTE
--   `20260703003114_fix_manager_privacy_gates.sql` cria policies que chamam
--   `has_role(auth.uid(), 'instructor')`. A função só entrou no git em
--   `20260831110000_user_roles_rls_canonica.sql` — dois meses DEPOIS do uso —
--   porque em produção ela já existia (criada à mão). Num banco novo o replay
--   parava aqui com `42883: function has_role(uuid, unknown) does not exist`.
--   Descoberto no primeiro `supabase db push` de verdade, no projeto
--   `eximia-academy-multi`, em 2026-09-08 (docs/faxina-2026-09/09-encerramento.md).
--
-- O QUE FAZ
--   Cria a função com o MESMO corpo de 20260831110000 (que a reafirma com
--   `CREATE OR REPLACE` mais tarde — no-op semântico). Em produção, onde ela já
--   existe, este arquivo também é no-op: `to_regprocedure` encontra a função e
--   nada é executado, preservando corpo e ACL como estão lá.
--
-- REVERSÃO
--   Nenhuma necessária: 20260831110000 continua sendo a dona canônica do corpo.
-- =============================================================================

DO $do$
BEGIN
  IF to_regprocedure('public.has_role(uuid, text)') IS NULL THEN
    CREATE FUNCTION public.has_role(_uid uuid, _role text)
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
  ELSE
    RAISE NOTICE 'has_role(uuid, text) ja existe — nada a fazer (replay sobre banco povoado)';
  END IF;
END
$do$;
