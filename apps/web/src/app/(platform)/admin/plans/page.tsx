import { PageHeader } from "@/components/layout/page-header"
import { canOpenAdminRoute } from "@/lib/admin-route-access"
import { getAuthProfile } from "@/lib/auth"
import { redirect } from "next/navigation"
import { loadAdminPlans } from "./loader"
import { PlanStatsGrid } from "./plan-stats-grid"
import { PlansClient } from "./plans-client"

export default async function AdminPlansPage() {
  const { user, profile, roles } = await getAuthProfile()

  if (!user || !profile) return redirect("/login")
  // Guard por CHAPÉU real (regra dura 3): mesmo eixo do middleware. Conjunto
  // permitido INALTERADO.
  if (!canOpenAdminRoute("/admin/plans", roles)) return redirect("/dashboard")

  // Mesma leitura consumida pela seção do hub (`/admin/configuracoes/plano`):
  // um único loader, duas rotas, zero query duplicada.
  const loaded = await loadAdminPlans()
  if (loaded.kind === "unauthenticated") return redirect("/login")

  const { isSuperAdmin, planFeatures, myPlan, myFeatures, myUsage, initialAnalytics } = loaded

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
        backgroundImage="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80"
      />

      {/* Stats (super_admin only) */}
      {isSuperAdmin && (
        <PlanStatsGrid quotaAlertCount={initialAnalytics?.quotaAlerts.length ?? 0} />
      )}

      {/* Client tabs */}
      <PlansClient
        // O client só compara com "super_admin" (é o mesmo booleano acima); o
        // valor sai do CHAPÉU real, não da coluna singular.
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
