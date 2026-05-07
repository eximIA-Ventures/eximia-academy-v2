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
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative flex min-h-[240px] items-end overflow-hidden rounded-2xl shadow-card" style={{ background: "#1a1a1a" }}>
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=80')" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(90deg, #1a1a1a 0%, rgba(26,26,26,0.85) 35%, rgba(26,26,26,0.2) 70%, transparent 100%)",
          }}
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
        <SummaryCards
          items={[
            { icon: <BookOpen size={20} />, label: "Cursos", value: courses.length, iconBg: "bg-cerrado-600/15", iconColor: "text-cerrado-600" },
            { icon: <CheckCircle size={20} />, label: "Sessões Concluídas", value: summary.sessionsThisMonth, iconBg: "bg-semantic-success/15", iconColor: "text-semantic-success" },
            { icon: <Users size={20} />, label: "Alunos Ativos", value: summary.activeStudents, iconBg: "bg-varzea/15", iconColor: "text-varzea" },
            { icon: <Activity size={20} />, label: "Engajamento", value: `${summary.engagementRate}%`, iconBg: "bg-accent-gold/15", iconColor: "text-accent-gold" },
          ]}
        />

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { href: "/courses", icon: BookOpen, label: "Cursos", desc: "Gerenciar conteúdo", gradient: "from-cerrado-600/8", iconBg: "bg-cerrado-600/15", iconColor: "text-cerrado-600", hoverRing: "hover:ring-cerrado-600/25" },
            { href: "/analytics", icon: BarChart3, label: "Analytics", desc: "Métricas detalhadas", gradient: "from-accent-gold/8", iconBg: "bg-accent-gold/15", iconColor: "text-accent-gold", hoverRing: "hover:ring-accent-gold/25" },
            { href: "/admin/users", icon: Users, label: "Usuários", desc: "Gestão de equipe", gradient: "from-varzea/8", iconBg: "bg-varzea/15", iconColor: "text-varzea", hoverRing: "hover:ring-varzea/25" },
            { href: "/admin/settings", icon: Settings, label: "Configurações", desc: "Personalizar", gradient: "from-purple-500/8", iconBg: "bg-purple-500/15", iconColor: "text-purple-400", hoverRing: "hover:ring-purple-500/25" },
          ].map((a) => {
            const Icon = a.icon
            return (
              <Link key={a.href} href={a.href} className="group">
                <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${a.gradient} via-bg-card to-bg-card shadow-card p-5 transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-elevated`}>
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
              <Link href="/analytics" className="flex items-center gap-1 text-xs text-cerrado-600 hover:text-cerrado-400">
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
