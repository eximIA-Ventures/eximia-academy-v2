import { MODULE_DEFINITIONS } from "@eximia/shared"
import { Building2, Layers, Users, Activity } from "lucide-react"

const stats = [
  { label: "Tenants Ativos", value: "—", icon: Building2 },
  { label: "Usuários Totais", value: "—", icon: Users },
  { label: "Módulos Disponíveis", value: String(Object.keys(MODULE_DEFINITIONS).length), icon: Layers },
  { label: "Uptime", value: "—", icon: Activity },
]

export default function CentralDashboard() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">eximIA Academy — Central</h1>
          <p className="text-text-muted mt-1">Gestão de tenants, m��dulos e licenças</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-white/[0.06] bg-bg-card p-5"
            >
              <div className="flex items-center gap-3">
                <stat.icon size={20} className="text-accent-blue-light" />
                <span className="text-sm text-text-muted">{stat.label}</span>
              </div>
              <p className="mt-3 text-2xl font-bold">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Modules catalog */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Catálogo de Módulos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.values(MODULE_DEFINITIONS).map((mod) => (
              <div
                key={mod.id}
                className="rounded-xl border border-white/[0.06] bg-bg-card p-5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{mod.name}</h3>
                  {mod.core ? (
                    <span className="rounded-full bg-accent-blue-mid/20 px-2 py-0.5 text-[10px] font-semibold text-accent-blue-light">
                      CORE
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                      ADD-ON
                    </span>
                  )}
                </div>
                <p className="text-sm text-text-muted">{mod.description}</p>
                <p className="text-xs text-text-muted/60">
                  {mod.routes.length} rotas · {mod.apiRoutes.length} API routes
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Placeholder sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-white/[0.06] bg-bg-card p-6">
            <h2 className="text-lg font-semibold mb-2">Tenants</h2>
            <p className="text-sm text-text-muted">
              Gestão de clientes, branding, módulos habilitados e status de deploy.
            </p>
            <p className="text-xs text-text-muted/40 mt-4">Em construção — conectar com API de gestão</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-bg-card p-6">
            <h2 className="text-lg font-semibold mb-2">Licenças & Billing</h2>
            <p className="text-sm text-text-muted">
              Controle de módulos por tenant, histórico de ativação e faturamento.
            </p>
            <p className="text-xs text-text-muted/40 mt-4">Em construção — definir modelo de billing</p>
          </div>
        </div>
      </div>
    </div>
  )
}
