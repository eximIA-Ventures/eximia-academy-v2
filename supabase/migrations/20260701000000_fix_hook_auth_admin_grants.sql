-- Fix: restore ALL grants the Supabase dashboard applies when enabling a
-- custom access token hook. Lost on db reset / fresh environments, causing
-- "Database error querying schema" (HTTP 500) on login. Reproducible.
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
GRANT ALL ON TABLE public.users TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, public;
