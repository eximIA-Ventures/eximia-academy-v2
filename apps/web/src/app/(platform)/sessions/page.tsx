import { getAuthProfile } from "@/lib/auth"
import { PageHeader } from "@/components/layout/page-header"
import { redirect } from "next/navigation"
import { SessionsDashboardClient } from "./sessions-dashboard-client"

export const metadata = {
  title: "Minhas Sessões",
}

interface SessionRow {
  id: string
  status: string
  turn_number: number
  analytics: Record<string, unknown> | null
  created_at: string
  updated_at: string
  completed_at: string | null
  chapters: {
    id: string
    title: string
    courses: { id: string; title: string } | null
  } | null
}

export default async function SessionsPage() {
  const { user, profile, supabase } = await getAuthProfile()

  if (!user || !profile) return redirect("/login")

  const { data: sessions } = await supabase
    .from("sessions")
    .select(
      "id, status, turn_number, analytics, created_at, updated_at, completed_at, chapters(id, title, courses(id, title))",
    )
    .eq("student_id", user.id)
    .order("updated_at", { ascending: false })

  const rows = (sessions ?? []) as unknown as SessionRow[]

  const total = rows.length
  const completed = rows.filter((s) => s.status === "completed").length
  const analytics = rows
    .map((s) => s.analytics as { depth_reached?: number; breakthrough_moments?: number } | null)
    .filter(Boolean)
  const avgDepth =
    analytics.length > 0
      ? +(
          analytics.reduce((sum, a) => sum + (a?.depth_reached ?? 0), 0) / analytics.length
        ).toFixed(1)
      : 0
  const breakthroughs = analytics.reduce(
    (sum, a) => sum + (a?.breakthrough_moments ?? 0),
    0,
  )

  const serializedSessions = rows.map((s) => ({
    id: s.id,
    status: s.status as "active" | "completed" | "abandoned",
    turnNumber: s.turn_number,
    depthReached: (s.analytics as { depth_reached?: number } | null)?.depth_reached ?? 0,
    breakthroughs:
      (s.analytics as { breakthrough_moments?: number } | null)?.breakthrough_moments ?? 0,
    courseId: s.chapters?.courses?.id ?? "",
    courseTitle: s.chapters?.courses?.title ?? "Curso removido",
    chapterId: s.chapters?.id ?? "",
    chapterTitle: s.chapters?.title ?? "Capítulo removido",
    createdAt: s.created_at,
    updatedAt: s.updated_at,
    completedAt: s.completed_at,
  }))

  return (
    <div className="space-y-8">
      <PageHeader
        section="Aprendizado"
        title="Minhas Sessoes"
        description="Acompanhe seu historico de dialogos pedagogicos socraticos."
        backgroundImage="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=80"
      />

      <SessionsDashboardClient
        sessions={serializedSessions}
        stats={{ total, completed, avgDepth, breakthroughs }}
        userRole={profile.role}
      />
    </div>
  )
}
