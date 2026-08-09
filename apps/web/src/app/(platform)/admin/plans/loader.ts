import { getAuthProfile } from "@/lib/auth"
import { hasRole } from "@/lib/role-helpers"
import { getFeatureUsageStats, getMyPlanFeatures, listPlanFeatures } from "./actions"

/**
 * Loader único de "Plano & Cobrança".
 *
 * Extraído de `admin/plans/page.tsx` para que a rota antiga (`/admin/plans`) e a
 * seção do hub (`/admin/configuracoes/plano`) leiam PELA MESMA leitura — nenhuma
 * tela é reescrita, nenhuma query é duplicada. Mesmo padrão de
 * `admin/settings/loader.ts`.
 *
 * O loader NÃO redireciona: cada rota aplica o próprio guard e decide o que
 * fazer com cada `kind`. O ramo `super_admin` (matriz de features + analytics)
 * é o MESMO de antes, decidido pelo CHAPÉU real, nunca pela coluna singular.
 */
export type AdminPlansLoad =
  | { kind: "unauthenticated" }
  | {
      kind: "ok"
      isSuperAdmin: boolean
      planFeatures: Awaited<ReturnType<typeof listPlanFeatures>>["data"] | undefined
      myPlan: string | undefined
      myFeatures:
        | NonNullable<Awaited<ReturnType<typeof getMyPlanFeatures>>["data"]>["features"]
        | undefined
      myUsage: Record<string, number> | undefined
      initialAnalytics: Awaited<ReturnType<typeof getFeatureUsageStats>>["data"] | null
    }

export async function loadAdminPlans(): Promise<AdminPlansLoad> {
  const { user, profile, roles } = await getAuthProfile()
  if (!user || !profile) return { kind: "unauthenticated" }

  // O cast antigo (`profile.role as "admin" | "super_admin"`) existia só para
  // decidir ESTE booleano. Vira chapéu real, sem reintroduzir o eixo singular.
  const isSuperAdmin = hasRole({ roles }, "super_admin")

  // super_admin: load the full feature matrix
  let planFeatures: Awaited<ReturnType<typeof listPlanFeatures>>["data"] | undefined
  if (isSuperAdmin) {
    const result = await listPlanFeatures()
    if (result.data) {
      planFeatures = result.data
    }
  }

  // Both roles: load the current tenant's plan features
  let myPlan: string | undefined
  let myFeatures:
    | NonNullable<Awaited<ReturnType<typeof getMyPlanFeatures>>["data"]>["features"]
    | undefined
  let myUsage: Record<string, number> | undefined

  const myPlanResult = await getMyPlanFeatures()
  if (myPlanResult.data) {
    myPlan = myPlanResult.data.plan
    myFeatures = myPlanResult.data.features
    myUsage = myPlanResult.data.usage
  }

  // super_admin: pre-load analytics
  let initialAnalytics: Awaited<ReturnType<typeof getFeatureUsageStats>>["data"] | null = null
  if (isSuperAdmin) {
    const analyticsResult = await getFeatureUsageStats()
    if (analyticsResult.data) {
      initialAnalytics = analyticsResult.data
    }
  }

  return { kind: "ok", isSuperAdmin, planFeatures, myPlan, myFeatures, myUsage, initialAnalytics }
}
