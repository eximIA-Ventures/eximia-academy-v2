import { getRecentReflections, getStudentDetails } from "@/app/(platform)/instructor/actions"
import { StudentInsightsTable } from "@/components/analytics/student-insights-table"
import type { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import { BarChart3, BookOpen, MessageSquare, Settings, Users } from "lucide-react"
import { cookies } from "next/headers"
import Link from "next/link"
import { redirect } from "next/navigation"

interface AdminDashboardPageProps {
  supabase: Awaited<ReturnType<typeof createClient>>
  role: "admin" | "super_admin"
  tenantId: string | null
  fullName: string
}

export async function AdminDashboardPage({ supabase, role, tenantId, fullName }: AdminDashboardPageProps) {
  let resolvedTenantId = tenantId as string
  if (!tenantId) {
    const cookieStore = await cookies()
    const activeTenantId = cookieStore.get("x-sa-active-tenant")?.value
    if (activeTenantId) {
      resolvedTenantId = activeTenantId
    } else {
      const { data: tenants } = await supabase.from("tenants").select("id").limit(1)
      if (tenants && tenants.length > 0) {
        resolvedTenantId = tenants[0].id
      } else {
        return <div className="p-8 text-text-muted">Nenhum tenant encontrado.</div>
      }
    }
  }

  const [
    { count: courseCount },
    { count: sessionCount },
    { count: userCount },
    studentDetails,
    reflectionsData,
  ] = await Promise.all([
    supabase.from("courses").select("id", { count: "exact", head: true }).eq("tenant_id", resolvedTenantId),
    supabase.from("sessions").select("id", { count: "exact", head: true }).eq("tenant_id", resolvedTenantId).eq("status", "completed"),
    supabase.from("users").select("id", { count: "exact", head: true }).eq("tenant_id", resolvedTenantId),
    getStudentDetails(resolvedTenantId),
    getRecentReflections(resolvedTenantId),
  ])

  const firstName = fullName?.split(" ")[0] ?? ""

  const quickActions = [
    { href: "/courses", icon: BookOpen, label: "Cursos", desc: "Gerenciar conteúdo", gradient: "from-cerrado-600/8", iconBg: "bg-cerrado-600/15", iconColor: "text-cerrado-600", hoverRing: "hover:ring-cerrado-600/25" },
    { href: "/analytics", icon: BarChart3, label: "Analytics", desc: "Métricas e relatórios", gradient: "from-accent-gold/8", iconBg: "bg-accent-gold/15", iconColor: "text-accent-gold", hoverRing: "hover:ring-accent-gold/25" },
    { href: "/admin/users", icon: Users, label: "Usuários", desc: "Gestão de equipe", gradient: "from-varzea/8", iconBg: "bg-varzea/15", iconColor: "text-varzea", hoverRing: "hover:ring-varzea/25" },
    { href: "/admin/settings", icon: Settings, label: "Configurações", desc: "Personalizar plataforma", gradient: "from-purple-500/8", iconBg: "bg-purple-500/15", iconColor: "text-purple-400", hoverRing: "hover:ring-purple-500/25" },
  ]

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative flex min-h-[240px] items-end overflow-hidden rounded-2xl shadow-card" style={{ background: "#1a1a1a" }}>
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=80')" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(90deg, #1a1a1a 0%, rgba(26,26,26,0.85) 35%, rgba(26,26,26,0.2) 70%, transparent 100%)" }}
        />
        <div className="relative z-10 w-full px-8 pb-7">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-varzea">Painel de Gestão</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
            Olá, {firstName}
          </h1>
          <p className="mt-3 text-sm text-white/60 leading-relaxed max-w-lg md:text-base">
            Gerencie cursos, acompanhe o progresso dos alunos e configure sua plataforma.
          </p>
        </div>
      </section>

      <div className="space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { icon: BookOpen, label: "Cursos", value: courseCount ?? 0, iconBg: "bg-cerrado-600/15", iconColor: "text-cerrado-600" },
            { icon: MessageSquare, label: "Sessões Concluídas", value: sessionCount ?? 0, iconBg: "bg-accent-gold/15", iconColor: "text-accent-gold" },
            { icon: Users, label: "Usuários", value: userCount ?? 0, iconBg: "bg-varzea/15", iconColor: "text-varzea" },
          ].map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="rounded-2xl bg-bg-card shadow-card p-5">
                <div className="flex items-center gap-4">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${stat.iconBg}`}>
                    <Icon size={20} className={stat.iconColor} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">{stat.label}</p>
                    <p className="text-2xl font-bold text-text-primary">{stat.value}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {quickActions.map((a) => {
            const Icon = a.icon
            return (
              <Link key={a.href} href={a.href} className="group">
                <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${a.gradient} via-bg-card to-bg-card shadow-card p-5 transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-elevated ${a.hoverRing}`}>
                  <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${a.iconBg}`}>
                    <Icon size={20} className={a.iconColor} />
                  </div>
                  <h3 className="text-sm font-semibold text-text-primary">{a.label}</h3>
                  <p className="mt-0.5 text-xs text-text-muted">{a.desc}</p>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Reflexões Recentes */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare size={18} />
                Reflexões Recentes
              </CardTitle>
              <span className="text-sm text-text-muted">
                {reflectionsData.total} {reflectionsData.total === 1 ? "reflexão" : "reflexões"} no total
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {reflectionsData.recent.length === 0 ? (
              <p className="py-8 text-center text-sm text-text-muted">
                Nenhuma reflexão registrada ainda.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">Aluno</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">Capítulo</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-text-muted">Slide</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">Resposta</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-text-muted">IA</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reflectionsData.recent.map((ref, i) => (
                      <tr key={i} className=" transition-colors hover:bg-bg-hover">
                        <td className="px-4 py-3 text-text-primary font-medium text-xs">{ref.studentName}</td>
                        <td className="px-4 py-3 text-text-secondary text-xs truncate max-w-[200px]">{ref.chapterTitle}</td>
                        <td className="px-4 py-3 text-center text-text-primary text-xs">{ref.slideOrder}</td>
                        <td className="px-4 py-3 text-text-secondary text-xs max-w-[300px]">
                          <span className="line-clamp-2">{ref.response.length > 100 ? `${ref.response.slice(0, 100)}...` : ref.response}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block h-2 w-2 rounded-full ${ref.hasAiResponse ? "bg-semantic-success" : "bg-neutral-500"}`} title={ref.hasAiResponse ? "Respondida pela IA" : "Sem resposta da IA"} />
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-text-muted">
                          {new Date(ref.createdAt).toLocaleDateString("pt-BR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Student Insights Table */}
        <StudentInsightsTable students={studentDetails} />
      </div>
    </div>
  )
}
