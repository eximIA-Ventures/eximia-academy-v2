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
  if (role === "super_admin") {
    const cookieStore = await cookies()
    const activeTenantId = cookieStore.get("x-sa-active-tenant")?.value
    if (!activeTenantId) redirect("/super-admin/tenants")
    resolvedTenantId = activeTenantId
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
    { href: "/courses", icon: BookOpen, label: "Cursos", desc: "Gerenciar conteúdo", gradient: "from-accent-blue-mid/8", iconBg: "bg-accent-blue-mid/15", iconColor: "text-accent-blue-mid", hoverRing: "hover:ring-accent-blue-mid/25" },
    { href: "/analytics", icon: BarChart3, label: "Analytics", desc: "Métricas e relatórios", gradient: "from-accent-gold/8", iconBg: "bg-accent-gold/15", iconColor: "text-accent-gold", hoverRing: "hover:ring-accent-gold/25" },
    { href: "/admin/users", icon: Users, label: "Usuários", desc: "Gestão de equipe", gradient: "from-accent-teal/8", iconBg: "bg-accent-teal/15", iconColor: "text-accent-teal", hoverRing: "hover:ring-accent-teal/25" },
    { href: "/admin/settings", icon: Settings, label: "Configurações", desc: "Personalizar plataforma", gradient: "from-purple-500/8", iconBg: "bg-purple-500/15", iconColor: "text-purple-400", hoverRing: "hover:ring-purple-500/25" },
  ]

  return (
    <div className="-m-6 space-y-6">
      {/* Hero */}
      <section className="relative flex min-h-[280px] items-end overflow-hidden bg-bg-app px-6 pb-8 pt-16 sm:px-8 md:px-10">
        <div
          className="absolute inset-y-0 right-0 w-[70%] bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=80')" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(90deg, rgba(15,15,15,0.97) 0%, rgba(15,15,15,0.85) 35%, rgba(15,15,15,0.3) 65%, transparent 100%)" }}
        />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-bg-app to-transparent" />
        <div className="relative z-10 w-full">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-teal">Painel de Gestão</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
            Olá, {firstName}
          </h1>
          <p className="mt-3 text-sm text-text-secondary leading-relaxed max-w-lg md:text-base">
            Gerencie cursos, acompanhe o progresso dos alunos e configure sua plataforma.
          </p>
        </div>
      </section>

      <div className="px-6 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { icon: BookOpen, label: "Cursos", value: courseCount ?? 0, iconBg: "bg-accent-blue-mid/15", iconColor: "text-accent-blue-mid" },
            { icon: MessageSquare, label: "Sessões Concluídas", value: sessionCount ?? 0, iconBg: "bg-accent-gold/15", iconColor: "text-accent-gold" },
            { icon: Users, label: "Usuários", value: userCount ?? 0, iconBg: "bg-accent-teal/15", iconColor: "text-accent-teal" },
          ].map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="rounded-2xl bg-bg-card ring-1 ring-white/[0.06] p-5">
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
                <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${a.gradient} via-bg-card to-bg-card ring-1 ring-white/[0.06] p-5 transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)] ${a.hoverRing}`}>
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
                    <tr className="border-b border-white/[0.06]">
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
                      <tr key={i} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]">
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
