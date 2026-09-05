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

-- ATENÇÃO — as políticas desta tabela NÃO são definidas aqui.
-- Fonte única: `20260831110000_user_roles_rls_canonica.sql`.
--
-- Este arquivo criava `user_roles_select` e `user_roles_admin`, que NUNCA foram
-- aplicadas em produção (esta migration nunca foi registrada). Produção usa três
-- políticas mais estreitas, vindas de `20260621100000 e1_user_roles` — uma
-- migration que existe só no servidor. As duas definições eram rivais, e como
-- políticas permissivas de RLS combinam-se por **OU**, aplicar este arquivo não
-- substituiria as de produção: somaria-se a elas e **alargaria o acesso em
-- silêncio**. `user_roles_select` daria a qualquer usuário do tenant a leitura
-- dos papéis de todos; `user_roles_admin`, sem predicado de tenant e sem
-- `WITH CHECK`, permitiria escrita entre tenants e concessão de `super_admin`
-- por um `admin`.
--
-- Foram removidas daqui para que aplicar este arquivo — sozinho, fora de ordem,
-- ou numa reconciliação de rotina — não possa mais alargar nada. A tabela nasce
-- com RLS ligada e sem política (negação total, falha fechada) até
-- `20260831110000` definir a RLS canônica.
--
-- Ver o cabeçalho daquele arquivo para o raciocínio completo. Inventário: achado 4.
-- Seed real hats from each user's primary role
INSERT INTO public.user_roles (user_id, tenant_id, role)
SELECT id, tenant_id, role FROM public.users WHERE tenant_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;
