-- EPIC-30 multi-hat table (user_roles) — applied manually in prod, never
-- versioned. Recreated here so fresh environments match. getAuthProfile embeds
-- user_roles!user_roles_user_id_fkey(role); without it PostgREST errors.
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid,
  role text NOT NULL,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT user_roles_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT user_roles_unique UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_roles_select ON public.user_roles;
CREATE POLICY user_roles_select ON public.user_roles FOR SELECT
  USING (tenant_id = auth_tenant_id() OR user_id = auth.uid());
DROP POLICY IF EXISTS user_roles_admin ON public.user_roles;
CREATE POLICY user_roles_admin ON public.user_roles FOR ALL
  USING (auth_user_role() IN ('admin','super_admin'));
-- Seed real hats from each user's primary role
INSERT INTO public.user_roles (user_id, tenant_id, role)
SELECT id, tenant_id, role FROM public.users WHERE tenant_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;
