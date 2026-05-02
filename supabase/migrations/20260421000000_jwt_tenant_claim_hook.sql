-- =============================================================================
-- Migration: JWT Custom Claim Hook — tenant_id + role no access token
-- =============================================================================
-- Root cause: auth_tenant_id() lê auth.jwt() -> 'custom_claims' ->> 'tenant_id'
-- Sem este hook, custom_claims.tenant_id é NULL → RLS bloqueia todas as queries
-- → tela preta / redirect loop após login.
--
-- Ativação obrigatória no Dashboard após aplicar esta migration:
--   Authentication → Hooks → Add hook → custom_access_token
--   → selecionar public.custom_access_token_hook
--
-- Ref: docs/architecture/SUPABASE_HOOK_SETUP.md
-- =============================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  user_tenant_id uuid;
  user_role text;
BEGIN
  -- Busca tenant_id e role do usuário autenticado
  SELECT tenant_id, role
  INTO user_tenant_id, user_role
  FROM public.users
  WHERE id = (event ->> 'user_id')::uuid;

  -- Injeta no campo claims do evento
  claims := event -> 'claims';

  IF user_tenant_id IS NOT NULL THEN
    claims := jsonb_set(
      claims,
      '{custom_claims}',
      jsonb_build_object(
        'tenant_id', user_tenant_id::text,
        'role',      user_role
      )
    );
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);

EXCEPTION
  WHEN OTHERS THEN
    -- Nunca quebrar o fluxo de auth — log e retorna evento original
    RAISE WARNING 'custom_access_token_hook error: % %', SQLERRM, SQLSTATE;
    RETURN event;
END;
$$;
-- Permissões: apenas supabase_auth_admin pode executar o hook
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
