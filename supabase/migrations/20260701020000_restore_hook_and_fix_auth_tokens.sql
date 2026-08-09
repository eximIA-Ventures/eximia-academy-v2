-- Ensure the REAL custom access token hook is in place (idempotent, standalone).
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE claims jsonb; user_tenant_id uuid; user_role text;
BEGIN
  SELECT tenant_id, role INTO user_tenant_id, user_role
  FROM public.users WHERE id = (event ->> 'user_id')::uuid;
  claims := event -> 'claims';
  IF user_tenant_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{custom_claims}',
      jsonb_build_object('tenant_id', user_tenant_id::text, 'role', user_role));
  END IF;
  RETURN jsonb_set(event, '{claims}', claims);
EXCEPTION WHEN OTHERS THEN RETURN event;
END; $$;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, public;

-- Fix seed users: NULL token fields break GoTrue login ("Database error querying schema").
UPDATE auth.users SET
  confirmation_token          = COALESCE(confirmation_token, ''),
  recovery_token              = COALESCE(recovery_token, ''),
  email_change_token_new      = COALESCE(email_change_token_new, ''),
  email_change                = COALESCE(email_change, ''),
  email_change_token_current  = COALESCE(email_change_token_current, ''),
  phone_change                = COALESCE(phone_change, ''),
  phone_change_token          = COALESCE(phone_change_token, ''),
  reauthentication_token      = COALESCE(reauthentication_token, '')
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change_token_new IS NULL
   OR email_change IS NULL
   OR email_change_token_current IS NULL
   OR phone_change IS NULL
   OR phone_change_token IS NULL
   OR reauthentication_token IS NULL;
