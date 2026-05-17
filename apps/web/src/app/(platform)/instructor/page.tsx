import { PageHeader } from "@/components/layout/page-header"
import { StudentInsightsTable } from "@/components/analytics/student-insights-table"
import { TeachingPlanHighlights } from "@/components/dashboard/teaching-plan-highlights"
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import { BarChart3, BookOpen, ClipboardList, GraduationCap, Lock, MessageSquare, Users } from "lucide-react"
import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getAuthProfile } from "@/lib/auth"
import { getActiveAreaId } from "@/lib/area-context"
import { createServiceClient } from "@/lib/supabase/service"
import { getInstructorDashboardData, getRecentReflections, getStudentDetails } from "./actions"
import { ExportStudentsButton, ExportReflectionsButton } from "./_components/export-buttons"

export default async function InstructorDashboardPage() {
  const { user, profile } = await getAuthProfile()

  if (!user || !profile) return redirect("/login")
  if (profile.role !== "instructor") return redirect("/dashboard")

  // "View as student" mode — redirect to student dashboard
  const viewAsStudent = (await cookies()).get("x-view-as-student")?.value === "true"
  if (viewAsStudent) return redirect("/dashboard")

  const activeAreaId = await getActiveAreaId()

  const [data, studentDetails, reflectionsData] = await Promise.all([
    getInstructorDashboardData(user.id, profile.tenant_id, activeAreaId),
    getStudentDetails(profile.tenant_id, activeAreaId),
    getRecentReflections(profile.tenant_id, activeAreaId),
  ])
  const firstName = profile.full_name?.split(" ")[0] ?? ""

  // Teaching Plan: compute pace highlights
  const service = createServiceClient()
  const { data: deadlineCourses } = await service
    .from("courses")
    .select("id, title, deadline_days")
    .eq("tenant_id", profile.tenant_id)
    .not("deadline_days", "is", null)

  type PaceStatus = { studentName: string; courseTitle: string; status: "ahead" | "on_track" | "behind"; progressPct: number; daysLeft: number; daysAhead: number }
  let paceHighlights: PaceStatus[] = []

  if (deadlineCourses && deadlineCourses.length > 0) {
    const courseIds = deadlineCourses.map((c) => c.id)
    const { data: activeEnrollments } = await service
      .from("enrollments")
      .select("student_id, course_id, progress, created_at, users!inner(full_name)")
      .eq("tenant_id", profile.tenant_id)
      .eq("status", "active")
      .in("course_id", courseIds)

    const now = Date.now()
    const deadlineMap = new Map(deadlineCourses.map((c) => [c.id, { title: c.title, days: c.deadline_days as number }]))

    for (const e of activeEnrollments ?? []) {
      const courseInfo = deadlineMap.get(e.course_id)
      if (!courseInfo) continue
      const enrolled = new Date(e.created_at).getTime()
      const deadlineMs = enrolled + courseInfo.days * 86400000
      const elapsed = Math.max(0, (now - enrolled) / 86400000)
      const expectedPct = Math.min(100, Math.round((elapsed / courseInfo.days) * 100))
      const pct = (e.progress as any)?.percentage ?? 0
      const daysLeft = Math.max(0, Math.ceil((deadlineMs - now) / 86400000))
      const daysAhead = Math.round(((pct - expectedPct) / 100) * courseInfo.days)

      paceHighlights.push({
        studentName: (e.users as any)?.full_name ?? "—",
        courseTitle: courseInfo.title,
        status: pct >= expectedPct ? (pct > expectedPct + 10 ? "ahead" : "on_track") : "behind",
        progressPct: pct,
        daysLeft,
        daysAhead,
      })
    }
    paceHighlights.sort((a, b) => {
      if (a.status === "behind" && b.status !== "behind") return -1
      if (a.status !== "behind" && b.status === "behind") return 1
      return b.daysAhead - a.daysAhead
    })
  }

  return (
    <div className="space-y-8">
      <PageHeader
        section="Painel do Instrutor"
        title={firstName ? `Ola, ${firstName}` : "Bem-vindo"}
        description="Acompanhe seus cursos, alunos e metricas de desempenho."
        accent="teal"
        backgroundImage="https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=1200&q=80"
      />

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-4 rounded-2xl bg-bg-card p-5 shadow-card">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cerrado-600/15">
            <BookOpen size={24} className="text-cerrado-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-text-primary">{data.courses.length}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">Meus Cursos</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl bg-bg-card p-5 shadow-card">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-varzea/15">
            <Users size={24} className="text-varzea" />
          </div>
          <div>
            <p className="text-2xl font-bold text-text-primary">{data.students.totalStudents}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">Total Alunos</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl bg-bg-card p-5 shadow-card">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-gold/15">
            <BarChart3 size={24} className="text-accent-gold" />
          </div>
          <div>
            <p className="text-2xl font-bold text-text-primary">{data.analytics.sessionsThisWeek}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">Sessões esta Semana</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl bg-bg-card p-5 shadow-card">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-semantic-success/15">
            <GraduationCap size={24} className="text-semantic-success" />
          </div>
          <div>
            <p className="text-2xl font-bold text-text-primary">{data.analytics.completionRate}%</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">Taxa de Conclusão</p>
          </div>
        </div>
      </div>

      {/* Teaching Plan Highlights */}
      {paceHighlights.length > 0 && (
        <TeachingPlanHighlights highlights={paceHighlights} />
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Meus Cursos */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-text-primary">Meus Cursos</h2>
              <div className="flex items-center gap-3">
                <Link
                  href="/courses/new"
                  className="text-sm font-medium text-accent-gold hover:text-accent-gold-dark"
                >
                  + Criar Curso
                </Link>
                <Link
                  href="/courses"
                  className="text-sm text-cerrado-600 hover:text-cerrado-400"
                >
                  Ver todos
                </Link>
              </div>
            </div>
            {data.courses.length === 0 ? (
              <p className="py-8 text-center text-sm text-text-muted">
                Você ainda não criou nenhum curso.
              </p>
            ) : (
              <div className="space-y-3">
                {data.courses.map((course) => (
                  <Link
                    key={course.id}
                    href={`/courses/${course.id}`}
                    className="group flex items-center justify-between rounded-xl shadow-card bg-bg-card p-3.5 transition-all hover:-translate-y-0.5 hover:ring-cerrado-600/20 hover:shadow-elevated"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {course.title}
                      </p>
                      <p className="text-xs text-text-muted">
                        {course.enrollmentCount}{" "}
                        {course.enrollmentCount === 1 ? "aluno" : "alunos"}
                      </p>
                    </div>
                    <Badge
                      variant={course.status === "published" ? "success" : "draft"}
                      badgeSize="sm"
                    >
                      {course.status === "published" ? "Publicado" : "Rascunho"}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Meus Alunos */}
        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 text-lg font-bold text-text-primary">Meus Alunos</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-text-primary">{data.students.totalStudents}</p>
                <p className="text-xs text-text-muted">Total</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-varzea">{data.students.activeThisWeek}</p>
                <p className="text-xs text-text-muted">Ativos (7d)</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-accent-gold">{data.students.avgProgress}%</p>
                <p className="text-xs text-text-muted">Progresso</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Interações */}
        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 text-lg font-bold text-text-primary">Modos de Interação</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Quiz", desc: "Múltipla escolha e V/F", icon: ClipboardList, color: "text-cerrado-600", bg: "bg-cerrado-600/15" },
                { label: "Cenário", desc: "Casos reais", icon: BookOpen, color: "text-amber-500", bg: "bg-amber-500/15" },
                { label: "Atividade", desc: "Entregas avaliadas", icon: GraduationCap, color: "text-purple-400", bg: "bg-purple-500/15" },
                { label: "Socrático", desc: "Diálogo com IA", icon: Users, color: "text-varzea", bg: "bg-varzea/15" },
              ].map((mode) => {
                const Icon = mode.icon
                return (
                  <div key={mode.label} className="flex items-center gap-3 rounded-xl bg-bg-surface shadow-card p-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${mode.bg}`}>
                      <Icon size={16} className={mode.color} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-text-primary">{mode.label}</p>
                      <p className="text-[10px] text-text-muted">{mode.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Analytics Resumido */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-text-primary">Analytics Resumido</h2>
              <Link
                href="/analytics"
                className="text-sm text-cerrado-600 hover:text-cerrado-400"
              >
                Ver detalhes
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-text-primary">
                  {data.analytics.sessionsThisWeek}
                </p>
                <p className="text-xs text-text-muted">Sessões (7d)</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-semantic-success">
                  {data.analytics.completionRate}%
                </p>
                <p className="text-xs text-text-muted">Conclusão</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-accent-gold">
                  {data.analytics.avgScore > 0 ? data.analytics.avgScore : "—"}
                </p>
                <p className="text-xs text-text-muted">Nota Media</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reflexões Recentes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare size={18} />
              Reflexões Recentes
            </CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-sm text-text-muted">
                {reflectionsData.total} {reflectionsData.total === 1 ? "reflexão" : "reflexões"} no total
              </span>
              <ExportReflectionsButton reflections={reflectionsData.recent} />
            </div>
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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text-primary">Alunos</h2>
        <ExportStudentsButton students={studentDetails} />
      </div>
      <StudentInsightsTable students={studentDetails} />
    </div>
  )
}
