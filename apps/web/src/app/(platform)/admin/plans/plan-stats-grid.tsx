import { BarChart3, Crown, Settings2 } from "lucide-react"

/**
 * Os 3 cartões de estatística do topo de "Plano & Cobrança" (super_admin only).
 *
 * Extraído VERBATIM de `plans/page.tsx` (nenhum número, rótulo ou classe mudou)
 * para que a rota antiga e a seção do hub (`/admin/configuracoes/plano`)
 * renderizem o MESMO componente em vez de duas cópias do mesmo JSX.
 */
export function PlanStatsGrid({ quotaAlertCount }: { quotaAlertCount: number }) {
  const stats = [
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
      value: String(quotaAlertCount),
      description: "Tenants com >80% quota",
      color: "accent-gold",
    },
  ]

  return (
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
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
                {stat.description}
              </p>
              <p className="text-xl font-bold text-text-primary">{stat.value}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
