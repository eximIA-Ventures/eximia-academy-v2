import { loadAdminPlans } from "@/app/(platform)/admin/plans/loader"
import { PlanStatsGrid } from "@/app/(platform)/admin/plans/plan-stats-grid"
import { PlansClient } from "@/app/(platform)/admin/plans/plans-client"
import { redirect } from "next/navigation"
import { SectionHeader } from "../_components/section-header"

export default async function ConfiguracoesPlanoPage() {
  // Guard admin-tier já aplicado no `layout.tsx` do hub (união de chapéus) —
  // o MESMO conjunto de `ADMIN_ROUTE_ROLES["/admin/plans"]`. A rota antiga
  // `/admin/plans` segue VIVA e sem redirect.
  const loaded = await loadAdminPlans()
  if (loaded.kind === "unauthenticated") redirect("/login")

  const { isSuperAdmin, planFeatures, myPlan, myFeatures, myUsage, initialAnalytics } = loaded

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Plano & Cobrança"
        description={
          isSuperAdmin
            ? "Configure features por plano e acompanhe a adoção de recursos."
            : "Visualize as features incluídas no seu plano e solicite upgrades."
        }
      />

      {/* Exatamente os mesmos componentes da tela antiga. */}
      {isSuperAdmin && (
        <PlanStatsGrid quotaAlertCount={initialAnalytics?.quotaAlerts.length ?? 0} />
      )}

      <PlansClient
        role={isSuperAdmin ? "super_admin" : "admin"}
        planFeatures={planFeatures}
        myPlan={myPlan}
        myFeatures={myFeatures}
        myUsage={myUsage}
        initialAnalytics={initialAnalytics}
      />
    </div>
  )
}
