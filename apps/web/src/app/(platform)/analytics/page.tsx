import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard"
import { PageHeader } from "@/components/layout/page-header"
import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import type { AggregateAnalyticsResponse, SessionAnalyticsJsonb } from "@/types/analytics"
import { redirect } from "next/navigation"

const DEPTH_LABELS = [
  "Repetição superficial",
  "Compreensão básica",
  "Aplicação",
  "Análise",
  "Questionamento",
  "Síntese",
  "Insight original",
]

function buildEmptyResponse(): AggregateAnalyticsResponse {
  return {
    summary: {
      totalSessions: 0,
      avgDepth: 0,
      avgBreakthroughsPerSession: 0,
      aiDetectionRate: 0,
      deltaDepth: null,
      deltaBreakthroughs: null,
    },
    depthDistribution: DEPTH_LABELS.map((label, i) => ({ level: i + 1, count: 0, label })),
    kolbTeam: [],
    cognitivePatterns: [],
    emotionalJourney: [],
    alerts: [],
    divergenceTable: [],
  }
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams
  const initialAreaId = params.areaId
  const { user, profile, supabase } = await getAuthProfile()

  if (!user || !profile) return redirect("/login")
  if (!["manager", "admin", "instructor", "super_admin"].includes(profile.role)) return redirect("/dashboard")

  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) return redirect("/dashboard")

  // Always use service client — RLS blocks instructors/managers from seeing student sessions
  const { createServiceClient } = await import("@/lib/supabase/service")
  const db = createServiceClient()

  // Parallel fetch: sessions (for summary), courses, areas
  const periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [sessionsResult, { data: courses }, { data: areas }] = await Promise.all([
    db
      .from("sessions")
      .select("id, analytics, created_at, student_id, status, turn_number, chapter_id")
      .eq("tenant_id", tenantId)
      .gte("created_at", periodStart.toISOString()),
    db.from("courses").select("id, title").eq("tenant_id", tenantId).neq("status", "archived").order("title"),
    db.from("areas").select("id, name").eq("tenant_id", tenantId).order("name"),
  ])

  const sessions = sessionsResult.data
  if (sessionsResult.error) {
    console.error("[analytics] Sessions query error:", sessionsResult.error.message)
  }
  console.log(`[analytics] tenant=${tenantId}, sessions=${sessions?.length ?? 0}, courses=${courses?.length ?? 0}, areas=${areas?.length ?? 0}`)

  let initialData: AggregateAnalyticsResponse

  if (sessions && sessions.length > 0) {
    const totalSessions = sessions.length
    // Filter to sessions that actually have analytics data (non-null and non-empty)
    const withAnalytics = sessions.filter((s) => s.analytics && Object.keys(s.analytics as Record<string, unknown>).length > 0)
    const analyticsData = withAnalytics.map((s) => s.analytics as SessionAnalyticsJsonb)

    const depths = analyticsData.map((a) => a.depth_reached ?? 0).filter((d) => d > 0)
    const avgDepth = depths.length > 0 ? depths.reduce((a, b) => a + b, 0) / depths.length : 0

    const breakthroughs = analyticsData.map((a) => a.breakthrough_moments ?? 0)
    const totalBreakthroughs = breakthroughs.reduce((a, b) => a + b, 0)
    const avgBreakthroughsPerSession = totalSessions > 0 ? totalBreakthroughs / totalSessions : 0

    const aiLikelyCount = analyticsData.filter(
      (a) => a.ai_detection?.verdict === "likely_ai",
    ).length
    const aiDetectionRate = totalSessions > 0 ? aiLikelyCount / totalSessions : 0

    const depthDist = Array(7).fill(0) as number[]
    for (const a of analyticsData) {
      const d = a.depth_reached ?? 0
      if (d >= 1 && d <= 7) depthDist[Math.round(d) - 1]++
    }

    // Count completed vs active sessions as basic engagement metric
    const completedSessions = sessions.filter((s) => s.status === "completed").length
    const uniqueStudents = new Set(sessions.map((s) => s.student_id)).size

    initialData = {
      summary: {
        totalSessions,
        avgDepth: Math.round(avgDepth * 10) / 10,
        avgBreakthroughsPerSession: Math.round(avgBreakthroughsPerSession * 10) / 10,
        aiDetectionRate: Math.round(aiDetectionRate * 1000) / 10,
        deltaDepth: null,
        deltaBreakthroughs: null,
      },
      depthDistribution: DEPTH_LABELS.map((label, i) => ({ level: i + 1, count: depthDist[i], label })),
      kolbTeam: [],
      cognitivePatterns: [],
      emotionalJourney: [],
      alerts: [],
      divergenceTable: [],
    }
  } else {
    initialData = buildEmptyResponse()
  }

  // --- Fetch reflection stats per module ---
  const { data: allCourses } = await db.from("courses").select("id").eq("tenant_id", tenantId).neq("status", "archived")
  const courseIdsAll = (allCourses ?? []).map((c) => c.id)
  let moduleStats: Array<{
    chapterTitle: string
    chapterOrder: number
    totalSlides: number
    reflectionCount: number
    studentCount: number
    totalStudents: number
    avgWordCount: number
    missingStudents: string[]
  }> = []

  if (courseIdsAll.length > 0) {
    const { data: chapters } = await db
      .from("chapters")
      .select("id, title, \"order\"")
      .in("course_id", courseIdsAll)
      .order("order")

    const chapterIds = (chapters ?? []).map((c) => c.id)

    if (chapterIds.length > 0) {
      const [
        { data: slides },
        { data: reflections },
        { data: students },
      ] = await Promise.all([
        db.from("chapter_slides").select("id, chapter_id").in("chapter_id", chapterIds),
        db.from("slide_reflections").select("student_id, slide_id, response").eq("tenant_id", tenantId),
        db.from("users").select("id, full_name").eq("tenant_id", tenantId).eq("role", "student"),
      ])

      const slideToChapter = new Map<string, string>()
      const slidesPerChapter = new Map<string, number>()
      for (const s of slides ?? []) {
        slideToChapter.set(s.id, s.chapter_id)
        slidesPerChapter.set(s.chapter_id, (slidesPerChapter.get(s.chapter_id) ?? 0) + 1)
      }

      const studentNames = new Map((students ?? []).map((s) => [s.id, s.full_name ?? "—"]))
      const allStudentIds = new Set((students ?? []).map((s) => s.id))

      // Group reflections by chapter
      const reflByChapter = new Map<string, Array<{ studentId: string; wordCount: number }>>()
      for (const r of reflections ?? []) {
        const chapterId = r.slide_id ? slideToChapter.get(r.slide_id) : null
        if (!chapterId) continue
        const list = reflByChapter.get(chapterId) ?? []
        list.push({ studentId: r.student_id, wordCount: (r.response ?? "").split(/\s+/).length })
        reflByChapter.set(chapterId, list)
      }

      moduleStats = (chapters ?? []).map((ch) => {
        const chReflections = reflByChapter.get(ch.id) ?? []
        const participatingStudents = new Set(chReflections.map((r) => r.studentId))
        const missingIds = [...allStudentIds].filter((id) => !participatingStudents.has(id))
        const totalWords = chReflections.reduce((sum, r) => sum + r.wordCount, 0)

        return {
          chapterTitle: ch.title,
          chapterOrder: (ch as any).order ?? 0,
          totalSlides: slidesPerChapter.get(ch.id) ?? 0,
          reflectionCount: chReflections.length,
          studentCount: participatingStudents.size,
          totalStudents: allStudentIds.size,
          avgWordCount: chReflections.length > 0 ? Math.round(totalWords / chReflections.length) : 0,
          missingStudents: missingIds.map((id) => studentNames.get(id) ?? "—"),
        }
      })
    }
  }

  const totalReflections = moduleStats.reduce((sum, m) => sum + m.reflectionCount, 0)

  return (
    <div className="space-y-8">
      <PageHeader
        section="Analytics Socrático"
        title="Visão Geral"
        description="Métricas de profundidade, breakthroughs e detecção de IA da turma."
        accent="blue"
        backgroundImage="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80"
      />

      <AnalyticsDashboard
        initialData={initialData}
        courses={(courses ?? []).map((c) => ({ id: c.id, title: c.title }))}
        areas={(areas ?? []).map((a) => ({ id: a.id, name: a.name }))}
        initialAreaId={initialAreaId}
        moduleStats={moduleStats}
        totalReflections={totalReflections}
        totalStudents={moduleStats[0]?.totalStudents ?? 0}
      />
    </div>
  )
}
