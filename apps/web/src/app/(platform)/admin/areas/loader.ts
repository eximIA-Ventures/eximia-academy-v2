import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { getTenantConfig } from "@/lib/tenant"

/**
 * Loader único das unidades/áreas do tenant, com as contagens de usuários e
 * cursos por linha.
 *
 * Extraído de `admin/areas/page.tsx` para que a rota antiga (`/admin/areas`,
 * que segue VIVA e liberada para `manager`) e a seção do hub
 * (`/admin/configuracoes/unidades`) leiam pela MESMA query.
 *
 * O gate do módulo `units` continua sendo parte da leitura (é o que decide se a
 * tela mostra a lista ou o upsell), mas o loader não redireciona nem renderiza:
 * cada rota aplica o próprio guard e decide o que fazer com cada `kind`.
 */

export interface AreaWithCounts {
  id: string
  name: string
  slug: string
  description: string | null
  created_at: string
  user_count: number
  course_count: number
}

export type AdminAreasLoad =
  | { kind: "unauthenticated" }
  /** Tenant sem o módulo `units` no plano: a tela mostra o upsell. */
  | { kind: "module-disabled" }
  | { kind: "ok"; areas: AreaWithCounts[] }

export async function loadAdminAreas(): Promise<AdminAreasLoad> {
  const { user, profile, supabase } = await getAuthProfile()
  if (!user || !profile) return { kind: "unauthenticated" }

  const tenantConfig = getTenantConfig()
  const enabledModules = tenantConfig.modules ?? []
  if (!enabledModules.includes("units")) return { kind: "module-disabled" }

  const tenantId = await resolveTenantId(profile.tenant_id)

  // Service role apenas quando o admin não tem tenant próprio (cross-tenant).
  let areasClient = supabase
  if (!profile.tenant_id) {
    const { createServiceClient } = await import("@/lib/supabase/service")
    areasClient = createServiceClient()
  }

  const { data: areas } = await areasClient
    .from("areas")
    .select("id, name, slug, description, created_at")
    .eq("tenant_id", tenantId)
    .order("name")

  const areaIds = (areas ?? []).map((a) => a.id)
  const userCounts: Record<string, number> = {}
  const courseCounts: Record<string, number> = {}

  if (areaIds.length > 0) {
    const [{ data: userAreaRows }, { data: courseRows }] = await Promise.all([
      areasClient.from("user_areas").select("area_id").in("area_id", areaIds),
      areasClient.from("courses").select("area_id").in("area_id", areaIds),
    ])
    for (const r of userAreaRows ?? []) {
      userCounts[r.area_id] = (userCounts[r.area_id] ?? 0) + 1
    }
    for (const r of courseRows ?? []) {
      if (r.area_id) courseCounts[r.area_id] = (courseCounts[r.area_id] ?? 0) + 1
    }
  }

  return {
    kind: "ok",
    areas: (areas ?? []).map((a) => ({
      ...a,
      user_count: userCounts[a.id] ?? 0,
      course_count: courseCounts[a.id] ?? 0,
    })),
  }
}
