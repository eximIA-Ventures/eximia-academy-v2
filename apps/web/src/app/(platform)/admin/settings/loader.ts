import { getAuthProfile, getDbClient, resolveTenantId } from "@/lib/auth"

/**
 * Loader único dos dados de tenant usados pelas telas de configuração.
 *
 * Extraído de `admin/settings/page.tsx` para que a rota antiga (`/admin/settings`)
 * e as seções do hub (`/admin/configuracoes/organizacao` e `.../marca`) leiam
 * PELA MESMA query — nenhuma tela é reescrita e nenhuma query é duplicada.
 *
 * O loader NÃO redireciona: cada rota aplica o próprio guard e decide o que
 * fazer com cada `kind`. Desde a correção de auditoria (rodada 2), AMBAS as
 * rotas decidem pelo MESMO eixo — união de chapéus (`/admin/settings` via
 * `canOpenAdminRoute`, o hub via `hasAnyRole` no `layout.tsx`).
 *
 * Correção de auditoria (rodada 3), BECO MORTO DO SELETOR. Até aqui a resolução
 * de tenant era `profile.role === "super_admin" ? null : profile.tenant_id`, o
 * que para o super_admin dava SEMPRE `null` (e para o admin global também, por
 * `tenant_id` nulo). As três telas caíam então no `TenantRequiredState`, que
 * manda "escolher a empresa no seletor do topo" — só que este loader era o
 * ÚNICO loader administrativo que NUNCA lia o cookie `x-sa-active-tenant` que
 * o seletor grava (`api/admin/switch-tenant/route.ts:33`). A pessoa lia a
 * instrução, executava a instrução, e a tela não mudava nunca.
 *
 * Agora a resolução passa por `resolveTenantId` (`lib/auth.ts:90-98`), o MESMO
 * caminho de `admin/users/loader.ts:51-61`, `admin-dashboard-page.tsx` e
 * `api/admin/audit-log/route.ts:26-32`: tenant próprio -> cookie do seletor ->
 * primeiro tenant do banco. E a leitura usa `getDbClient()` (service client só
 * quando o perfil não tem tenant próprio), senão o RLS de `tenants`
 * (`id = auth_tenant_id()`) devolveria zero linhas para o admin global e o
 * loader estouraria "Falha ao carregar dados do tenant" — trocar um beco morto
 * por um erro 500 não seria correção.
 *
 * Para quem tem `tenant_id` próprio (o caso comum), o comportamento é
 * BYTE-IDÊNTICO: `resolveTenantId` devolve o próprio tenant sem tocar em cookie
 * nem em service client, e `getDbClient()` devolve o mesmo client autenticado
 * de antes.
 */

export interface TenantSettingsData {
  id: string
  name: string
  slug: string
  whitelabelEnabled: boolean
  whitelabelConfig: Record<string, unknown>
  ssoConfigured: boolean
  sessionTimeoutHours: number
  branding: {
    logo_url?: string
    primary_color: string
    secondary_color: string
  }
  settings: {
    max_interactions_per_session: number
    ai_model: string
    features: {
      ai_detection: boolean
      learning_journal: boolean
      certificates: boolean
      analytics_dashboard: boolean
    }
  }
}

export type TenantSettingsLoad =
  | { kind: "unauthenticated" }
  /**
   * NENHUMA empresa resolvível: o perfil não tem tenant próprio, não há cookie
   * de empresa ativa E o banco não devolveu nenhum tenant. Depois da correção
   * do beco morto este é o único caminho que sobra — escolher no seletor passou
   * a FUNCIONAR, então "escolha uma empresa" deixou de ser um estado permanente.
   */
  | { kind: "no-tenant" }
  | { kind: "ok"; tenant: TenantSettingsData }

export async function loadTenantSettings(): Promise<TenantSettingsLoad> {
  const { user, profile } = await getAuthProfile()

  if (!user || !profile) return { kind: "unauthenticated" }

  // Tenant próprio -> cookie `x-sa-active-tenant` (o que o seletor grava) ->
  // primeiro tenant do banco. Mesmo caminho dos demais loaders administrativos.
  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) return { kind: "no-tenant" }

  // Service client SÓ para quem não tem tenant próprio (super_admin / admin
  // global); para todos os demais é o mesmo client autenticado de sempre.
  const supabase = await getDbClient()

  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("id, name, slug, branding, settings, plan, whitelabel_enabled, whitelabel_config")
    .eq("id", tenantId)
    .single()

  if (error || !tenant) {
    throw new Error("Falha ao carregar dados do tenant")
  }

  const branding = (tenant.branding as Record<string, string>) || {}
  const settings = (tenant.settings as Record<string, unknown>) || {}
  const features = (settings.features as Record<string, boolean>) || {}

  return {
    kind: "ok",
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      whitelabelEnabled: !!tenant.whitelabel_enabled,
      whitelabelConfig: (tenant.whitelabel_config as Record<string, unknown>) || {},
      ssoConfigured: !!settings.sso_provider_id,
      sessionTimeoutHours:
        typeof settings.session_timeout_hours === "number" ? settings.session_timeout_hours : 8,
      branding: {
        logo_url: branding.logo_url || undefined,
        primary_color: branding.primary_color || "#2a6ab0",
        secondary_color: branding.secondary_color || "#1e1e1e",
      },
      settings: {
        max_interactions_per_session:
          typeof settings.max_interactions_per_session === "number"
            ? settings.max_interactions_per_session
            : 3,
        ai_model: typeof settings.ai_model === "string" ? settings.ai_model : "claude-sonnet-4-5",
        features: {
          ai_detection: features.ai_detection ?? false,
          learning_journal: features.learning_journal ?? false,
          certificates: features.certificates ?? false,
          analytics_dashboard: features.analytics_dashboard ?? true,
        },
      },
    },
  }
}
