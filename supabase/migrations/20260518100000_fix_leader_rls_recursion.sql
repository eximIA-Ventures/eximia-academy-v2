-- Fix: infinite recursion in users RLS
-- Root cause: users_leader_select policy is redundant (users_select already
-- grants tenant-wide SELECT) AND auth helper functions can be inlined by
-- PostgreSQL optimizer, losing SECURITY DEFINER protection.

BEGIN;

-- 1. Drop redundant policy (users_select already covers this)
DROP POLICY IF EXISTS users_leader_select ON users;

-- 2. Recreate auth helpers as PL/pgSQL to prevent inlining
--    PL/pgSQL functions are NEVER inlined, so SECURITY DEFINER is guaranteed.
CREATE OR REPLACE FUNCTION auth_tenant_id() RETURNS UUID AS $$
DECLARE
  _tenant_id UUID;
BEGIN
  SELECT tenant_id INTO _tenant_id FROM users WHERE id = auth.uid();
  RETURN _tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth_user_role() RETURNS TEXT AS $$
DECLARE
  _role TEXT;
BEGIN
  SELECT role INTO _role FROM users WHERE id = auth.uid() AND tenant_id = auth_tenant_id();
  RETURN _role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMIT;
