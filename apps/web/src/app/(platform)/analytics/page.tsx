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
    reflections: Array<{ studentName: string; slideOrder: number; response: string; createdAt: string }>
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
        db.from("chapter_slides").select("id, chapter_id, \"order\"").in("chapter_id", chapterIds),
        db.from("slide_reflections").select("student_id, slide_id, response, created_at").eq("tenant_id", tenantId),
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

      // Group reflections by chapter — include full text for display
      const slideOrderMap = new Map<string, number>()
      for (const s of slides ?? []) {
        slideOrderMap.set(s.id, (s as any).order ?? 0)
      }

      const reflByChapter = new Map<string, Array<{ studentId: string; wordCount: number; slideOrder: number; response: string; createdAt: string }>>()
      for (const r of reflections ?? []) {
        const chapterId = r.slide_id ? slideToChapter.get(r.slide_id) : null
        if (!chapterId) continue
        const list = reflByChapter.get(chapterId) ?? []
        list.push({
          studentId: r.student_id,
          wordCount: (r.response ?? "").split(/\s+/).length,
          slideOrder: r.slide_id ? slideOrderMap.get(r.slide_id) ?? 0 : 0,
          response: (r.response ?? "").slice(0, 500),
          createdAt: r.created_at,
        })
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
          reflections: chReflections.map((r) => ({
            studentName: studentNames.get(r.studentId) ?? "—",
            slideOrder: r.slideOrder,
            response: r.response,
            createdAt: r.createdAt,
          })),
        }
      })
    }
  }

  const totalReflections = moduleStats.reduce((sum, m) => sum + m.reflectionCount, 0)

  // --- Student roster with risk assessment ---
  const chapterIdsForRoster = moduleStats.length > 0 ? (await db.from("chapters").select("id").in("course_id", courseIdsAll)).data?.map((c) => c.id) ?? [] : []

  const allStudentsData = await db.from("users").select("id, full_name, email").eq("tenant_id", tenantId).eq("role", "student").order("full_name")
  const allStudentsList = allStudentsData.data ?? []

  const [
    { data: allSessionsRoster },
    { data: allReflectionsRoster },
    { data: allUserAreas },
  ] = await Promise.all([
    db.from("sessions").select("student_id, status, chapter_id, created_at").eq("tenant_id", tenantId),
    db.from("slide_reflections").select("student_id").eq("tenant_id", tenantId),
    db.from("user_areas").select("user_id, areas(name)").eq("areas.tenant_id", tenantId),
  ])

  const now = Date.now()
  const areaByUser = new Map<string, string>()
  for (const ua of allUserAreas ?? []) {
    const areaName = (ua.areas as any)?.name
    if (areaName) areaByUser.set(ua.user_id, areaName)
  }

  const rosterStudents = allStudentsList.map((student) => {
    const mySessions = (allSessionsRoster ?? []).filter((s) => s.student_id === student.id)
    const myReflections = (allReflectionsRoster ?? []).filter((r) => r.student_id === student.id)
    const completedSessions = mySessions.filter((s) => s.status === "completed").length
    const completedChapterIds = new Set(mySessions.filter((s) => s.status === "completed").map((s) => s.chapter_id))
    const completedChapters = [...completedChapterIds].filter((id) => chapterIdsForRoster.includes(id)).length

    let lastActivityDate: string | null = null
    let daysSinceLastActivity: number | null = null
    if (mySessions.length > 0) {
      const dates = mySessions.map((s) => new Date(s.created_at).getTime())
      const latest = Math.max(...dates)
      lastActivityDate = new Date(latest).toISOString()
      daysSinceLastActivity = Math.floor((now - latest) / 86400000)
    }

    let risk: "on_track" | "at_risk" | "inactive" | "never_accessed" = "never_accessed"
    if (mySessions.length === 0) {
      risk = "never_accessed"
    } else if (daysSinceLastActivity !== null && daysSinceLastActivity > 14) {
      risk = "inactive"
    } else if (daysSinceLastActivity !== null && daysSinceLastActivity > 5) {
      risk = "at_risk"
    } else {
      risk = "on_track"
    }

    return {
      id: student.id,
      name: student.full_name ?? "—",
      email: student.email ?? "",
      areaName: areaByUser.get(student.id) ?? null,
      totalSessions: mySessions.length,
      completedSessions,
      reflectionsCount: myReflections.length,
      lastActivityDate,
      daysSinceLastActivity,
      completedChapters,
      totalChapters: chapterIdsForRoster.length,
      risk,
    }
  })

  // --- Unit comparison stats ---
  const areasList = areas ?? []
  const unitStats = areasList.map((area) => {
    const areaStudentIds = (allUserAreas ?? []).filter((ua) => (ua.areas as any)?.name === area.name).map((ua) => ua.user_id)
    const areaStudents = new Set(areaStudentIds)
    const areaSessions = (allSessionsRoster ?? []).filter((s) => areaStudents.has(s.student_id))
    const areaReflections = (allReflectionsRoster ?? []).filter((r) => areaStudents.has(r.student_id))
    const completed = areaSessions.filter((s) => s.status === "completed").length
    const thirtyDaysAgo = now - 30 * 86400000
    const activeStudents = new Set(areaSessions.filter((s) => new Date(s.created_at).getTime() > thirtyDaysAgo).map((s) => s.student_id)).size
    const completionPossible = areaStudents.size * chapterIdsForRoster.length
    const completionPct = completionPossible > 0 ? Math.round((completed / completionPossible) * 100) : 0

    return {
      areaName: area.name,
      totalStudents: areaStudents.size,
      activeStudents,
      completedSessions: completed,
      totalSessions: areaSessions.length,
      reflectionCount: areaReflections.length,
      avgSessionsPerStudent: areaStudents.size > 0 ? Math.round((areaSessions.length / areaStudents.size) * 10) / 10 : 0,
      completionPct,
    }
  })

  // --- Usage tab data: sessions by week, module access, interaction modes, funnel ---
  const allSessions = allSessionsRoster ?? []

  // Sessions by week (last 12 weeks)
  const sessionsByWeek: Array<{ week: string; count: number }> = []
  for (let i = 11; i >= 0; i--) {
    const weekStart = new Date(now - (i + 1) * 7 * 86400000)
    const weekEnd = new Date(now - i * 7 * 86400000)
    const count = allSessions.filter((s) => {
      const t = new Date(s.created_at).getTime()
      return t >= weekStart.getTime() && t < weekEnd.getTime()
    }).length
    const label = `${weekStart.getDate()}/${weekStart.getMonth() + 1}`
    sessionsByWeek.push({ week: label, count })
  }

  // Module access ranking (include course_id for client-side filtering)
  const chapterDetails = await db.from("chapters").select("id, title, \"order\", interaction_type, course_id").in("course_id", courseIdsAll).order("order")
  const chaptersMap = new Map((chapterDetails.data ?? []).map((c) => [c.id, c]))

  const moduleAccess = (chapterDetails.data ?? []).map((ch) => {
    const chSessions = allSessions.filter((s) => s.chapter_id === ch.id)
    return {
      chapterTitle: ch.title,
      chapterOrder: (ch as any).order ?? 0,
      courseId: ch.course_id,
      sessionCount: chSessions.length,
      completedCount: chSessions.filter((s) => s.status === "completed").length,
      studentCount: new Set(chSessions.map((s) => s.student_id)).size,
    }
  })

  // Interaction mode breakdown
  const modeCounts = new Map<string, number>()
  for (const s of allSessions) {
    const ch = chaptersMap.get(s.chapter_id)
    const mode = (ch as any)?.interaction_type ?? "socratic_dialogue"
    modeCounts.set(mode, (modeCounts.get(mode) ?? 0) + 1)
  }
  const modeLabels: Record<string, string> = { socratic_dialogue: "Socrático", quiz: "Quiz", scenario: "Cenário", assignment: "Atividade" }
  const interactionModes = [...modeCounts.entries()].map(([mode, count]) => ({
    mode,
    label: modeLabels[mode] ?? mode,
    count,
  })).sort((a, b) => b.count - a.count)

  // Progress funnel
  const progressFunnel = (chapterDetails.data ?? []).map((ch) => {
    const studentsReached = new Set(allSessions.filter((s) => s.chapter_id === ch.id).map((s) => s.student_id)).size
    return {
      chapterTitle: ch.title,
      chapterOrder: (ch as any).order ?? 0,
      courseId: ch.course_id,
      studentsReached,
      totalStudents: allStudentsList.length,
    }
  })

  // --- Learning tab: depth by week, words per module, unit depth comparison ---

  // Depth by week (last 8 weeks)
  const depthByWeek: Array<{ week: string; avgDepth: number; sessions: number }> = []
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(now - (i + 1) * 7 * 86400000)
    const weekEnd = new Date(now - i * 7 * 86400000)
    const weekSessions = allSessions.filter((s) => {
      const t = new Date(s.created_at).getTime()
      return t >= weekStart.getTime() && t < weekEnd.getTime() && s.analytics && (s.analytics as any).depth_reached
    })
    const depths = weekSessions.map((s) => (s.analytics as any).depth_reached as number)
    const avg = depths.length > 0 ? Math.round((depths.reduce((a, b) => a + b, 0) / depths.length) * 10) / 10 : 0
    depthByWeek.push({ week: `${weekStart.getDate()}/${weekStart.getMonth() + 1}`, avgDepth: avg, sessions: weekSessions.length })
  }

  // Words per module (avg reflection length per chapter)
  const wordsPerModule = moduleStats.map((m) => ({
    chapterTitle: m.chapterTitle,
    chapterOrder: m.chapterOrder,
    avgWords: m.avgWordCount,
    reflectionCount: m.reflectionCount,
  })).sort((a, b) => b.avgWords - a.avgWords)

  // Depth comparison by unit
  const unitDepthComparison = (areas ?? []).map((area) => {
    const areaStudentIds = new Set((allUserAreas ?? []).filter((ua) => (ua.areas as any)?.name === area.name).map((ua) => ua.user_id))
    const allAreaSessions = allSessions.filter((s) => areaStudentIds.has(s.student_id))
    const sessionsWithDepth = allAreaSessions.filter((s) => s.analytics && (s.analytics as any).depth_reached)
    const depths = sessionsWithDepth.map((s) => (s.analytics as any).depth_reached as number)
    const avgDepth = depths.length > 0 ? Math.round((depths.reduce((a, b) => a + b, 0) / depths.length) * 10) / 10 : 0
    const areaReflections = (allReflectionsRoster ?? []).filter((r) => areaStudentIds.has(r.student_id))
    const completedSessions = allAreaSessions.filter((s) => s.status === "completed").length
    return {
      areaName: area.name,
      avgDepth,
      sessionsAnalyzed: allAreaSessions.length,
      completedSessions,
      reflectionCount: areaReflections.length,
      studentCount: areaStudentIds.size,
    }
  })

  // Heatmap: student × module (for Alunos tab)
  const studentModuleHeatmap = allStudentsList.slice(0, 50).map((student) => {
    const mySessions = allSessions.filter((s) => s.student_id === student.id)
    const modules = (chapterDetails.data ?? []).map((ch) => {
      const chSessions = mySessions.filter((s) => s.chapter_id === ch.id)
      const completed = chSessions.some((s) => s.status === "completed")
      const started = chSessions.length > 0
      return { chapterTitle: ch.title, status: completed ? "completed" : started ? "started" : "none" as "completed" | "started" | "none" }
    })
    return { studentName: student.full_name ?? "—", modules }
  })

  const moduleNames = (chapterDetails.data ?? []).map((ch) => ch.title)

  return (
    <div className="space-y-8">
      <PageHeader
        section="Analytics"
        title="Visão Geral"
        description="Uso da plataforma, aprendizagem e desempenho dos alunos."
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
        rosterStudents={rosterStudents}
        totalChapters={chapterIdsForRoster.length}
        unitStats={unitStats}
        sessionsByWeek={sessionsByWeek}
        moduleAccess={moduleAccess}
        interactionModes={interactionModes}
        progressFunnel={progressFunnel}
        depthByWeek={depthByWeek}
        wordsPerModule={wordsPerModule}
        unitDepthComparison={unitDepthComparison}
        studentModuleHeatmap={studentModuleHeatmap}
        moduleNames={moduleNames}
      />
    </div>
  )
}
