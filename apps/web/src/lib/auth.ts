import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { cookies } from "next/headers"
import { cache } from "react"

/**
 * Cached auth + profile lookup. React cache() deduplicates across
 * layout and page in the same server render (FIX-05 + FIX-18).
 *
 * Epic 11: super_admin has tenant_id = NULL, so the tenants JOIN
 * returns null gracefully (LEFT JOIN via Supabase FK select).
 */
export const getAuthProfile = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user)
    return {
      user: null,
      profile: null,
      roles: [] as string[],
      hasSubordinates: false,
      hasEnrollment: false,
      error: null,
      supabase,
    }

  // E1: real hats. `user_roles` tem 2 FKs p/ users (user_id e granted_by); o
  // embed aponta a FK user_id, senao PostgREST recusa. Mantido como UMA string
  // literal: supabase-js so infere o tipo do select sobre literais; uma string
  // concatenada colapsa para GenericStringError e quebra o `next build`.
  const { data: profile, error } = await supabase
    .from("users")
    .select(
      "full_name, role, tenant_id, onboarding_completed, tenants(id, name, slug, branding, settings, whitelabel_enabled, whitelabel_config), user_roles!user_roles_user_id_fkey(role)",
    )
    .eq("id", user.id)
    .single()

  // roles[]: union of hats. Fallback to [profile.role] only when user_roles is
  // empty (defensive pre-backfill). Derived hats power available contexts, not
  // the singular profile.role.
  const rawRoles = (profile as { user_roles?: { role: string }[] } | null)?.user_roles ?? []
  const roles: string[] = rawRoles.map((r) => r.role)
  const effectiveRoles = roles.length > 0 ? roles : profile?.role ? [profile.role] : []

  // hasSubordinates (E2): does anyone report to this user? (head-only count, cheap,
  // under RLS — RLS-deny degrades to false, i.e. hides the manager context).
  const { count: subCount } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("reports_to", user.id)

  // hasEnrollment: is the person actually a student? (sustains "Minha Trilha").
  // Column is `student_id` (cravada em E0/E4/E5 seed/E6).
  const { count: enrCount } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("student_id", user.id)

  return {
    user,
    profile,
    roles: effectiveRoles,
    hasSubordinates: (subCount ?? 0) > 0,
    hasEnrollment: (enrCount ?? 0) > 0,
    error,
    supabase,
  }
})

/**
 * Resolve tenant ID for admin/super_admin with null tenant_id.
 * Falls back to cookie "x-sa-active-tenant", then first tenant in DB.
 */
/**
 * Returns a Supabase client that bypasses RLS for admin/super_admin with null tenant_id.
 * For normal users, returns the standard auth-scoped client.
 */
export async function getDbClient() {
  const { profile, supabase } = await getAuthProfile()
  if (profile && !profile.tenant_id) {
    return createServiceClient()
  }
  return supabase
}

/**
 * Ordenação CANÔNICA e TOTAL da lista de empresas.
 *
 * Correção de auditoria (rodada 5), A EMPRESA EXIBIDA NÃO ERA A EMPRESA EDITADA.
 * O cabeçalho do painel mostra `allTenants[0]` de uma query `.order("name")`
 * (`(platform)/layout.tsx`), enquanto o fallback de `resolveTenantId` fazia
 * `.select("id").limit(1)` SEM `order` nenhum — ordem indefinida no Postgres.
 * Para o admin global que ainda não clicou no seletor (nenhum cookie
 * `x-sa-active-tenant`), os dois podiam apontar para empresas DIFERENTES: ele
 * lia "Empresa A" no topo e gravava na empresa B nas 5 seções do hub. Isso é
 * corrupção de dado de cliente, não estética.
 *
 * `name` sozinho não basta: dois tenants homônimos deixariam o desempate para o
 * banco de novo. `id` (PK, único) fecha a ordem, tornando-a total e portanto
 * determinística.
 *
 * O helper existe para que o cabeçalho e o fallback usem literalmente a MESMA
 * regra — duas cópias da ordenação voltariam a divergir na primeira edição.
 */
export function orderedTenantQuery<T extends { order: (column: string) => T }>(query: T): T {
  return query.order("name").order("id")
}

/**
 * Resolve o tenant ativo: tenant próprio -> cookie do seletor -> primeira
 * empresa pela ordem canônica (a MESMA que o cabeçalho usa para escolher o que
 * exibir por default).
 *
 * Por que não devolver `null` sem escolha explícita: quem chega aqui sem tenant
 * próprio e sem cookie é o admin global, e este resolvedor é lido por ~50 telas
 * (inclusive `/courses` e `/materiais`, fora do mundo admin). Devolver `null`
 * apagaria acesso que existe hoje (W4) e transformaria um desalinhamento
 * silencioso num vazio generalizado. A cura é fazer o default COINCIDIR com o
 * que a tela anuncia, não remover o default.
 */
export async function resolveTenantId(profileTenantId: string | null): Promise<string | null> {
  if (profileTenantId) return profileTenantId
  const cookieStore = await cookies()
  const fromCookie = cookieStore.get("x-sa-active-tenant")?.value
  if (fromCookie) return fromCookie
  const svc = createServiceClient()
  const { data } = await orderedTenantQuery(svc.from("tenants").select("id")).limit(1)
  return data?.[0]?.id ?? null
}
