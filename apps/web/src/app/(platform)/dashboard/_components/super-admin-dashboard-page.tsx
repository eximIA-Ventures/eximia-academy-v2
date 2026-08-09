import { createServiceClient } from "@/lib/supabase/service"
import { Building2, MessageSquare, Puzzle, Users } from "lucide-react"
import Link from "next/link"
import { GrowthChart } from "./growth-chart"

interface SuperAdminDashboardPageProps {
  fullName: string
}

export async function SuperAdminDashboardPage({ fullName }: SuperAdminDashboardPageProps) {
  const supabase = createServiceClient()

  // Parallel fetch all aggregate data
  const [{ data: tenants }, { data: allUsers }, { data: allSessions }] = await Promise.all([
    supabase.from("tenants").select("id, name, slug, created_at").order("name"),
    supabase.from("users").select("id, tenant_id, created_at"),
    supabase.from("sessions").select("id, status, created_at"),
  ])

  const tenantCount = tenants?.length ?? 0
  const totalUsers = allUsers?.length ?? 0
  const firstName = fullName?.split(" ")[0] ?? ""

  // Sessions last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const recentSessions = (allSessions ?? []).filter((s) => new Date(s.created_at) >= thirtyDaysAgo)
  const completedSessions = recentSessions.filter((s) => s.status === "completed").length
  const activeSessions = recentSessions.filter(
    (s) => s.status === "active" || s.status === "in_progress",
  ).length

  // Whitelabel = tenants count, percentage calculation
  const whitelabelPct = tenantCount > 0 ? Math.round((tenantCount / tenantCount) * 100) : 0

  // Growth data: last 6 months
  const now = new Date()
  const monthLabels: string[] = []
  const monthKeys: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthLabels.push(d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""))
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }

  // Cumulative counts per month
  const growthData = monthKeys.map((key, idx) => {
    const endOfMonth = new Date(`${key}-01`)
    endOfMonth.setMonth(endOfMonth.getMonth() + 1)

    const usersUpTo = (allUsers ?? []).filter((u) => new Date(u.created_at) < endOfMonth).length
    const tenantsUpTo = (tenants ?? []).filter((t) => new Date(t.created_at) < endOfMonth).length

    return {
      month: monthLabels[idx].charAt(0).toUpperCase() + monthLabels[idx].slice(1),
      usuarios: usersUpTo,
      empresas: tenantsUpTo,
    }
  })

  const stats = [
    {
      icon: Building2,
      label: "EMPRESAS",
      value: tenantCount,
      subtitle: `${tenantCount} ativas \u00b7 0 inativas`,
      iconBg: "bg-blue-500/15",
      iconColor: "text-blue-500",
    },
    {
      icon: Users,
      label: "USUARIOS",
      value: totalUsers,
      subtitle: "Ver por papel",
      subtitleLink: "/admin/users",
      iconBg: "bg-varzea/15",
      iconColor: "text-varzea",
    },
    {
      icon: MessageSquare,
      label: "SESSOES (30D)",
      value: recentSessions.length,
      subtitle: `${completedSessions} concluidas \u00b7 ${activeSessions} ativas`,
      iconBg: "bg-purple-500/15",
      iconColor: "text-purple-500",
    },
    {
      icon: Puzzle,
      label: "WHITELABEL",
      value: tenantCount,
      subtitle: `${whitelabelPct}% das empresas`,
      iconBg: "bg-accent-gold/15",
      iconColor: "text-accent-gold",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section
        className="relative flex min-h-[200px] items-end overflow-hidden rounded-2xl shadow-card"
        style={{ background: "#1a1a1a" }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80')",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, #1a1a1a 0%, rgba(26,26,26,0.85) 35%, rgba(26,26,26,0.2) 70%, transparent 100%)",
          }}
        />
        <div className="relative z-10 w-full px-8 pb-7">
          {/* RODADA 10 (A3) — o eyebrow saía em `text-cerrado-400`: o laranja da
              Plataforma de Aprendizagem dentro do mundo VIOLETA. Agora é a cor
              do 4º mundo.
              POR QUE NÃO `--world-accent` AQUI: aquele token é TEMA-DEPENDENTE
              (parada 700 no claro, para ser legível sobre a barra creme), e
              este herói tem fundo ESCURO FIXO (#1a1a1a) nos dois temas — usar o
              token deixaria um violeta escuro sobre preto no tema claro. Parada
              constante, medida sobre #1a1a1a: 5.53:1 (AA). */}
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-super-400">
            Super Admin
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
            Ola, {firstName}
          </h1>
          <p className="mt-3 text-sm text-white/60 leading-relaxed max-w-lg md:text-base">
            Visao geral de todas as empresas na plataforma.
          </p>
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="rounded-2xl bg-bg-card shadow-card p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted mb-3">
                {stat.label}
              </p>
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${stat.iconBg}`}
                >
                  <Icon size={22} className={stat.iconColor} />
                </div>
                <p className="text-3xl font-bold text-text-primary">{stat.value}</p>
              </div>
              <div className="mt-2">
                {stat.subtitleLink ? (
                  <Link
                    href={stat.subtitleLink}
                    className="text-xs text-text-muted underline underline-offset-2 hover:text-text-secondary"
                  >
                    {stat.subtitle}
                  </Link>
                ) : (
                  <p className="text-xs text-text-muted">{stat.subtitle}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Growth Chart */}
      <GrowthChart data={growthData} />

      {/* Tenant List */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">Empresas Cadastradas</h2>
          {/* RODADA 12 (E4) — o link de ação da lista e o avatar de cada linha
              saíam em `cerrado-600` (medido `rgb(222,97,41)`) dentro do mundo
              VIOLETA. Sobre `bg-app`/`bg-card`, que MUDAM com o tema, o token
              certo é `--world-accent` (parada escura no claro, clara no
              escuro) — não o `--world-accent-on-dark` do herói acima, que é
              constante porque o fundo dele é #1a1a1a fixo. */}
          <Link
            href="/admin/tenants"
            className="text-xs font-medium text-[var(--world-accent)] hover:opacity-80"
          >
            Ver todas
          </Link>
        </div>
        <div className="space-y-2">
          {(tenants ?? []).slice(0, 5).map((tenant) => {
            const initials = tenant.name
              .split(" ")
              .map((w: string) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()
            const userCount = (allUsers ?? []).filter((u) => u.tenant_id === tenant.id).length
            return (
              <Link key={tenant.id} href={`/admin/tenants/${tenant.id}`} className="group block">
                <div className="flex items-center gap-4 rounded-2xl bg-bg-card shadow-card p-4 transition-all group-hover:shadow-elevated">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--world-accent)_10%,transparent)] text-sm font-bold text-[var(--world-accent)]">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary">{tenant.name}</p>
                    <p className="text-xs text-text-muted">/{tenant.slug}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-text-muted">
                    <Users size={12} />
                    {userCount}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
