import { PLATFORM_LABELS } from "@eximia/shared"
import { BookOpen, GraduationCap, MessageSquare } from "lucide-react"
import { EmptyState } from "./empty-state"
import { ManagerCourseDashboardClient } from "./manager-course-dashboard-client"
import { SummaryCards } from "./summary-cards"
import type { ManagerCourseAnalytics } from "./types"

interface ManagerCourseDashboardProps {
  fullName: string
  data: ManagerCourseAnalytics
  aiDetectionEnabled: boolean
}

export function ManagerCourseDashboard({
  fullName,
  data,
  aiDetectionEnabled,
}: ManagerCourseDashboardProps) {
  const firstName = fullName?.split(" ")[0] ?? ""

  if (data.summary.totalCourses === 0) {
    return (
      <div className="space-y-8">
        <ManagerWelcomeBanner firstName={firstName} />
        <EmptyState
          title="Você ainda nao criou nenhum curso."
          description="Crie seu primeiro curso e comece a ensinar."
          action={{ label: "Criar Curso", href: "/courses/new" }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <ManagerWelcomeBanner firstName={firstName} />

      <SummaryCards
        items={[
          {
            icon: <BookOpen size={20} />,
            label: `Total de ${PLATFORM_LABELS.courses}`,
            value: data.summary.totalCourses,
          },
          {
            icon: <GraduationCap size={20} />,
            label: "Total de Alunos",
            value: data.summary.totalStudents,
          },
          {
            icon: <MessageSquare size={20} />,
            label: "Sessões esta Semana",
            value: data.summary.sessionsThisWeek,
          },
        ]}
      />

      <ManagerCourseDashboardClient initialData={data} aiDetectionEnabled={aiDetectionEnabled} />
    </div>
  )
}

function ManagerWelcomeBanner({ firstName }: { firstName: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-cerrado-800 via-bg-card to-bg-surface p-8 md:p-12">
      <div className="relative z-10 max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-widest text-cerrado-400">
          Painel do Gestor
        </p>
        <h1 className="mt-2 text-3xl font-bold leading-tight text-text-primary md:text-5xl">
          Olá, {firstName}!
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-text-secondary md:text-base">
          Acompanhe o progresso dos seus alunos e gerencie seus cursos.
        </p>
      </div>
      <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-cerrado-600/20 blur-3xl" />
      <div className="absolute -bottom-8 right-32 h-48 w-48 rounded-full bg-accent-gold/10 blur-3xl" />
    </div>
  )
}
