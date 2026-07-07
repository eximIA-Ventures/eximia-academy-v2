import { StudentInsightsTable } from "@/components/analytics/student-insights-table"
import type { StudentInsightRow } from "@/components/analytics/student-insights-table"
import type { TriageSummary } from "@/lib/student-triage"
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle,
  Settings,
  Sparkles,
  Target,
  Users,
} from "lucide-react"
import Link from "next/link"
import { ManagerDashboardClient } from "./manager-dashboard-client"
import { SummaryCards } from "./summary-cards"
import { TriageCards } from "./triage-cards"
import type { ManagerAnalytics } from "./types"

interface ManagerDashboardProps {
  fullName: string
  data: ManagerAnalytics
  aiDetectionEnabled: boolean
  courses: Array<{ id: string; title: string }>
  socraticKpis?: { avgDepth: number; totalBreakthroughs: number }
  studentDetails?: StudentInsightRow[]
  showSubteam?: boolean
  /**
   * "Meu Time" team-scope panel (drill-down breadcrumb + Hierarquia/Visão
   * Global switch + engagement buckets), rendered right after the hero.
   * Passed as a slot instead of the caller putting it BEFORE
   * <ManagerDashboard> so the "Olá, {nome}" hero always stays the first
   * visual element of the page, including in the "Meu Time" context.
   */
  teamRecortePanel?: React.ReactNode
  /**
   * Teaching plan pace highlights (destaques do plano de ensino), rendered
   * right after the hero (and after teamRecortePanel, when present). Passed
   * as a slot instead of the caller putting it BEFORE <ManagerDashboard> so
   * the "Olá, {nome}" hero always stays the first visual element of the
   * page, regardless of whether highlights exist.
   */
  teachingPlanHighlights?: React.ReactNode
  /**
   * Diretos/Hierarquia + E9 focus, forwarded to <ManagerDashboardClient> so
   * its `/api/analytics/manager` refetch (period/course filter change) stays
   * scoped identically to the server-resolved `data` this component received
   * on first paint. See manager-dashboard-client.tsx for the gap this closes.
   */
  teamViewMode?: "direct" | "hierarchy"
  focusUserId?: string | null
  /**
   * Onda 2 (S7): sumário da triagem canônica (analisados/no ritmo/atenção/sem
   * acesso). Presente APENAS na visão Meu Time (teamRecortePanel presente) —
   * a presença decide se os 4 cards de triagem substituem os KPIs genéricos.
   */
  triageSummary?: TriageSummary
}

export function ManagerDashboard({
  fullName,
  data,
  aiDetectionEnabled,
  courses,
  socraticKpis,
  studentDetails,
  showSubteam = false,
  teamRecortePanel,
  teachingPlanHighlights,
  teamViewMode,
  focusUserId,
  triageSummary,
}: ManagerDashboardProps) {
  const firstName = fullName?.split(" ")[0] ?? ""
  const { summary } = data

  // S11 (Onda 2): visão "Meu Time" (recorte presente) vs admin/unidade. Único
  // discriminador confiável — teamRecortePanel só é montado pelo caminho já
  // gated de manager-team-dashboard-page.tsx.
  const isTeamView = Boolean(teamRecortePanel)

  // Blocos extraídos 1:1 do JSX (movidos, não reescritos) para que as duas
  // ordens de funil (team vs. legada) reusem a MESMA constante — proíbe
  // duplicar markup entre os dois branches do render condicional abaixo.
  const genericKpisBlock = (
    <SummaryCards
      items={[
        {
          icon: <BookOpen size={20} />,
          label: "Cursos",
          value: courses.length,
          iconBg: "bg-cerrado-600/15",
          iconColor: "text-cerrado-600",
        },
        {
          icon: <CheckCircle size={20} />,
          label: "Sessões Concluídas",
          value: summary.sessionsThisMonth,
          iconBg: "bg-semantic-success/15",
          iconColor: "text-semantic-success",
        },
        {
          icon: <Users size={20} />,
          label: "Alunos Ativos",
          value: summary.activeStudents,
          iconBg: "bg-varzea/15",
          iconColor: "text-varzea",
        },
        {
          icon: <Activity size={20} />,
          label: "Engajamento",
          value: `${summary.engagementRate}%`,
          iconBg: "bg-accent-gold/15",
          iconColor: "text-accent-gold",
        },
      ]}
    />
  )

  // Stats: 4 cards de triagem (Meu Time, S7) ou KPIs genéricos (fallback,
  // inclusive admin/unidade). Condicional criado por S7, só reposicionado aqui.
  // C3 (fidelidade ao mockup): visual próprio via <TriageCards>, não mais
  // SummaryCards genérico — grid + ícone circular + número grande colorido
  // com "(pct%)" inline, exatamente como no mockup.
  const triageCardsBlock = triageSummary ? (
    <TriageCards summary={triageSummary} />
  ) : (
    genericKpisBlock
  )

  const quickActionsBlock = (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[
        {
          href: "/courses",
          icon: BookOpen,
          label: "Cursos",
          desc: "Gerenciar conteúdo",
          gradient: "from-cerrado-600/8",
          iconBg: "bg-cerrado-600/15",
          iconColor: "text-cerrado-600",
          hoverRing: "hover:ring-cerrado-600/25",
        },
        {
          href: "/analytics",
          icon: BarChart3,
          label: "Analytics",
          desc: "Métricas detalhadas",
          gradient: "from-accent-gold/8",
          iconBg: "bg-accent-gold/15",
          iconColor: "text-accent-gold",
          hoverRing: "hover:ring-accent-gold/25",
        },
        {
          href: "/admin/users",
          icon: Users,
          label: "Usuários",
          desc: "Gestão de equipe",
          gradient: "from-varzea/8",
          iconBg: "bg-varzea/15",
          iconColor: "text-varzea",
          hoverRing: "hover:ring-varzea/25",
        },
        {
          href: "/admin/settings",
          icon: Settings,
          label: "Configurações",
          desc: "Personalizar",
          gradient: "from-purple-500/8",
          iconBg: "bg-purple-500/15",
          iconColor: "text-purple-400",
          hoverRing: "hover:ring-purple-500/25",
        },
      ].map((a) => {
        const Icon = a.icon
        return (
          <Link key={a.href} href={a.href} className="group">
            <div
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${a.gradient} via-bg-card to-bg-card shadow-card p-5 transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-elevated`}
            >
              <div
                className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${a.iconBg}`}
              >
                <Icon size={20} className={a.iconColor} />
              </div>
              <h3 className="text-sm font-semibold text-text-primary">{a.label}</h3>
              <p className="mt-0.5 text-xs text-text-muted">{a.desc}</p>
            </div>
          </Link>
        )
      })}
    </div>
  )

  const socraticBlock = socraticKpis ? (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">
          Motor Socrático
        </h2>
        <Link
          href="/analytics"
          className="flex items-center gap-1 text-xs text-cerrado-600 hover:text-cerrado-400"
        >
          Ver análise <ArrowRight size={12} />
        </Link>
      </div>
      <SummaryCards
        items={[
          {
            icon: <Target size={20} />,
            label: "Profundidade Média",
            value: `${socraticKpis.avgDepth}/7`,
            iconBg: "bg-purple-500/15",
            iconColor: "text-purple-400",
          },
          {
            icon: <Sparkles size={20} />,
            label: "Breakthroughs",
            value: socraticKpis.totalBreakthroughs,
            iconBg: "bg-accent-gold/15",
            iconColor: "text-accent-gold",
          },
        ]}
      />
    </div>
  ) : null

  const analyticsBlock = (
    <ManagerDashboardClient
      initialData={data}
      aiDetectionEnabled={aiDetectionEnabled}
      courses={courses}
      teamViewMode={teamViewMode}
      focusUserId={focusUserId}
    />
  )

  const studentTableBlock =
    studentDetails && studentDetails.length > 0 ? (
      <StudentInsightsTable
        students={studentDetails}
        showSubteam={showSubteam}
        expandable={false}
        variant="manager"
        canNudge={true}
      />
    ) : null

  // C1: hero legado ("Olá, {nome}" com foto Unsplash), movido para constante
  // 1:1 (não reescrito) pois só é usado no branch NÃO-team (admin/unidade).
  // A visão team (mockup R3) usa o cabeçalho de página "Detalhes dos Alunos"
  // no lugar dele, ver o branch isTeamView abaixo.
  const heroBlock = (
    <section
      className="relative flex min-h-[240px] items-end overflow-hidden rounded-2xl shadow-card"
      style={{ background: "#1a1a1a" }}
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=80')",
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
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-varzea">
          Painel de Gestão
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
          Olá, {firstName}
        </h1>
        <p className="mt-3 text-sm text-white/60 leading-relaxed max-w-lg md:text-base">
          Gerencie cursos, acompanhe o progresso dos alunos e configure sua plataforma.
        </p>
      </div>
    </section>
  )

  return (
    <div className="space-y-6">
      {isTeamView ? (
        <div className="space-y-8">
          {/* C1 (fidelidade ao mockup): cabeçalho de página no lugar do hero,
              só na visão team. h1 (não h2): esta visão não renderiza o hero
              acima, então este é o único título de página. */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-text-primary">
              Detalhes dos Alunos
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              Visão do gestor com recorte, diagnóstico rápido e tabela simplificada.
            </p>
          </div>

          {/* C2 (fidelidade ao mockup): card único agrupando recorte + cards de
              triagem, o mockup os mostra dentro do MESMO container branco. */}
          <section className="space-y-5 rounded-2xl bg-bg-card p-5 shadow-card">
            {teamRecortePanel}
            {triageCardsBlock}
          </section>

          {teachingPlanHighlights}
          {/* S12: heading solto da S11 removido — o subtítulo do próprio card
              ("A tabela vira apoio para investigação individual.") assume esse
              papel (student-insights-table.tsx, variant manager). */}
          {studentTableBlock}
          {/*
            C6 (fidelidade ao mockup): a visão Meu Time termina na tabela.
            analytics do time vive em /analytics (sidebar Gestão do Time),
            decisão de fidelidade ao mockup R3.
          */}

          <div className="h-6" />
        </div>
      ) : (
        <>
          {heroBlock}

          <div className="space-y-8">
            {/* Ordem legada intacta (admin/unidade), byte-a-byte */}
            {teachingPlanHighlights}
            {genericKpisBlock}
            {quickActionsBlock}
            {socraticBlock}
            {analyticsBlock}
            {studentTableBlock}

            <div className="h-6" />
          </div>
        </>
      )}
    </div>
  )
}
