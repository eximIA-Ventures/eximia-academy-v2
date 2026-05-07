import { PageHeader } from "@/components/layout/page-header"
import { getAuthProfile } from "@/lib/auth"
import { BarChart3, Crown, Settings2 } from "lucide-react"
import { redirect } from "next/navigation"
import { getFeatureUsageStats, getMyPlanFeatures, listPlanFeatures } from "./actions"
import { PlansClient } from "./plans-client"

export default async function AdminPlansPage() {
  const { user, profile } = await getAuthProfile()

  if (!user || !profile) return redirect("/login")
  if (!["admin", "super_admin"].includes(profile.role)) return redirect("/dashboard")

  const role = profile.role as "admin" | "super_admin"
  const isSuperAdmin = role === "super_admin"

  // ---------------------------------------------------------------------------
  // Load data based on role
  // ---------------------------------------------------------------------------

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
  let myFeatures: NonNullable<Awaited<ReturnType<typeof getMyPlanFeatures>>["data"]>["features"] | undefined
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

  // ---------------------------------------------------------------------------
  // Stats cards (super_admin only)
  // ---------------------------------------------------------------------------

  const stats = isSuperAdmin
    ? [
        {
          icon: Settings2,
          title: "Features",
          value: "21",
          description: "Total de features configuradas",
          color: "cerrado-600",
        },
        {
          icon: Crown,
          title: "Planos",
          value: "3",
          description: "Essencial, Standard, Premium",
          color: "varzea",
        },
        {
          icon: BarChart3,
          title: "Alertas",
          value: String(initialAnalytics?.quotaAlerts.length ?? 0),
          description: "Tenants com >80% quota",
          color: "accent-gold",
        },
      ]
    : null

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        section="Administração"
        title={isSuperAdmin ? "Gestão de Planos" : "Seu Plano"}
        description={
          isSuperAdmin
            ? "Configure features por plano e análise a adoção de recursos."
            : "Visualize as features incluídas no seu plano e solicite upgrades."
        }
        accent="gold"
        backgroundImage="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80"
      />

      {/* Stats (super_admin only) */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.title}
                className="flex items-center gap-4 rounded-2xl bg-bg-card p-4 shadow-card"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-${stat.color}/15`}
                >
                  <Icon size={20} className={`text-${stat.color}`} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">{stat.description}</p>
                  <p className="text-xl font-bold text-text-primary">{stat.value}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Client tabs */}
      <PlansClient
        role={role}
        planFeatures={planFeatures}
        myPlan={myPlan}
        myFeatures={myFeatures}
        myUsage={myUsage}
        initialAnalytics={initialAnalytics}
      />
    </div>
  )
}
