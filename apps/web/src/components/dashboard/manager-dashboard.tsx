import { StudentInsightsTable } from "@/components/analytics/student-insights-table"
import type { StudentInsightRow } from "@/components/analytics/student-insights-table"
import { Activity, ArrowRight, BarChart3, BookOpen, CheckCircle, Settings, Sparkles, Target, Users } from "lucide-react"
import Link from "next/link"
import { ManagerDashboardClient } from "./manager-dashboard-client"
import { SummaryCards } from "./summary-cards"
import type { ManagerAnalytics } from "./types"

interface ManagerDashboardProps {
  fullName: string
  data: ManagerAnalytics
  aiDetectionEnabled: boolean
  courses: Array<{ id: string; title: string }>
  socraticKpis?: { avgDepth: number; totalBreakthroughs: number }
  studentDetails?: StudentInsightRow[]
}

export function ManagerDashboard({
  fullName,
  data,
  aiDetectionEnabled,
  courses,
  socraticKpis,
  studentDetails,
}: ManagerDashboardProps) {
  const firstName = fullName?.split(" ")[0] ?? ""
  const { summary } = data

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
          style={{
            background: "linear-gradient(90deg, rgba(15,15,15,0.97) 0%, rgba(15,15,15,0.85) 35%, rgba(15,15,15,0.3) 65%, transparent 100%)",
          }}
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
        <SummaryCards
          items={[
            { icon: <BookOpen size={20} />, label: "Cursos", value: courses.length, iconBg: "bg-accent-blue-mid/15", iconColor: "text-accent-blue-mid" },
            { icon: <CheckCircle size={20} />, label: "Sessões Concluídas", value: summary.sessionsThisMonth, iconBg: "bg-semantic-success/15", iconColor: "text-semantic-success" },
            { icon: <Users size={20} />, label: "Alunos Ativos", value: summary.activeStudents, iconBg: "bg-accent-teal/15", iconColor: "text-accent-teal" },
            { icon: <Activity size={20} />, label: "Engajamento", value: `${summary.engagementRate}%`, iconBg: "bg-accent-gold/15", iconColor: "text-accent-gold" },
          ]}
        />

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { href: "/courses", icon: BookOpen, label: "Cursos", desc: "Gerenciar conteúdo", gradient: "from-accent-blue-mid/8", iconBg: "bg-accent-blue-mid/15", iconColor: "text-accent-blue-mid", hoverRing: "hover:ring-accent-blue-mid/25" },
            { href: "/analytics", icon: BarChart3, label: "Analytics", desc: "Métricas detalhadas", gradient: "from-accent-gold/8", iconBg: "bg-accent-gold/15", iconColor: "text-accent-gold", hoverRing: "hover:ring-accent-gold/25" },
            { href: "/admin/users", icon: Users, label: "Usuários", desc: "Gestão de equipe", gradient: "from-accent-teal/8", iconBg: "bg-accent-teal/15", iconColor: "text-accent-teal", hoverRing: "hover:ring-accent-teal/25" },
            { href: "/admin/settings", icon: Settings, label: "Configurações", desc: "Personalizar", gradient: "from-purple-500/8", iconBg: "bg-purple-500/15", iconColor: "text-purple-400", hoverRing: "hover:ring-purple-500/25" },
          ].map((a) => {
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

        {/* Socratic KPIs */}
        {socraticKpis && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">Motor Socrático</h2>
              <Link href="/analytics" className="flex items-center gap-1 text-xs text-accent-blue-mid hover:text-accent-blue-light">
                Ver análise <ArrowRight size={12} />
              </Link>
            </div>
            <SummaryCards
              items={[
                { icon: <Target size={20} />, label: "Profundidade Média", value: `${socraticKpis.avgDepth}/7`, iconBg: "bg-purple-500/15", iconColor: "text-purple-400" },
                { icon: <Sparkles size={20} />, label: "Breakthroughs", value: socraticKpis.totalBreakthroughs, iconBg: "bg-accent-gold/15", iconColor: "text-accent-gold" },
              ]}
            />
          </div>
        )}

        {/* Charts & Table */}
        <ManagerDashboardClient initialData={data} aiDetectionEnabled={aiDetectionEnabled} courses={courses} />

        {/* Student Insights */}
        {studentDetails && studentDetails.length > 0 && (
          <StudentInsightsTable students={studentDetails} />
        )}

        <div className="h-6" />
      </div>
    </div>
  )
}
