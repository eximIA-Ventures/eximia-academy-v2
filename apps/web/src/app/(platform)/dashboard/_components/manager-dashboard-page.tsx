import { ManagerDashboard } from "@/components/dashboard/manager-dashboard"
import { TeachingPlanHighlights } from "@/components/dashboard/teaching-plan-highlights"
import { getStudentDetails } from "@/app/(platform)/instructor/actions"
import { getActiveAreaId } from "@/lib/area-context"
import type { createClient } from "@/lib/supabase/server"

interface ManagerDashboardPageProps {
  supabase: Awaited<ReturnType<typeof createClient>>
  tenantId: string
  fullName: string
}

export async function ManagerDashboardPage({ supabase, tenantId, fullName }: ManagerDashboardPageProps) {
  // Resolve active area for unit-scoped filtering
  const activeAreaId = await getActiveAreaId()

  // Parallelize independent queries (FIX-17 + FIX-16)
  const periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const [{ data: tenant, error: mgrTenantError }, analytics, { data: allCourses }, { data: socraticSessions }, studentDetails] =
    await Promise.all([
      supabase.from("tenants").select("settings").eq("id", tenantId).maybeSingle(),
      fetchManagerAnalytics(supabase, tenantId, activeAreaId),
      supabase.from("courses").select("id, title").eq("tenant_id", tenantId),
      supabase
        .from("sessions")
        .select("analytics")
        .eq("tenant_id", tenantId)
        .not("analytics", "is", null)
        .gte("created_at", periodStart.toISOString()),
      getStudentDetails(tenantId),
    ])
  if (mgrTenantError) console.error("Failed to fetch tenant settings:", mgrTenantError.message)
  const aiDetectionEnabled = isFeatureEnabled(tenant?.settings, "ai_detection")

  // Teaching Plan: compute pace status for active enrollments with deadlines
  const { data: deadlineCourses } = await supabase
    .from("courses")
    .select("id, title, deadline_days")
    .eq("tenant_id", tenantId)
    .not("deadline_days", "is", null)

  type PaceStatus = { studentName: string; courseTitle: string; status: "ahead" | "on_track" | "behind"; progressPct: number; daysLeft: number; daysAhead: number }
  let paceHighlights: PaceStatus[] = []

  if (deadlineCourses && deadlineCourses.length > 0) {
    const courseIds = deadlineCourses.map((c) => c.id)
    const { data: activeEnrollments } = await supabase
      .from("enrollments")
      .select("student_id, course_id, progress, created_at, users!inner(full_name)")
      .eq("tenant_id", tenantId)
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
      const studentName = (e.users as any)?.full_name ?? "—"

      paceHighlights.push({
        studentName,
        courseTitle: courseInfo.title,
        status: pct >= expectedPct ? (pct > expectedPct + 10 ? "ahead" : "on_track") : "behind",
        progressPct: pct,
        daysLeft,
        daysAhead,
      })
    }
    // Sort: behind first, then ahead
    paceHighlights.sort((a, b) => {
      if (a.status === "behind" && b.status !== "behind") return -1
      if (a.status !== "behind" && b.status === "behind") return 1
      return b.daysAhead - a.daysAhead
    })
  }

  // Compute socratic KPIs from sessions with analytics
  type SocraticAnalytics = { depth_reached?: number; breakthrough_moments?: number }
  const socraticData = (socraticSessions ?? []).map((s) => s.analytics as SocraticAnalytics)
  const depths = socraticData.map((a) => a.depth_reached ?? 0).filter((d) => d > 0)
  const avgDepth = depths.length > 0 ? Math.round((depths.reduce((a, b) => a + b, 0) / depths.length) * 10) / 10 : 0
  const totalBreakthroughs = socraticData.reduce((sum, a) => sum + (a.breakthrough_moments ?? 0), 0)

  return (
    <>
      {paceHighlights.length > 0 && (
        <div className="px-6 pb-0 -mb-4">
          <TeachingPlanHighlights highlights={paceHighlights} />
        </div>
      )}
      <ManagerDashboard
        fullName={fullName}
        data={analytics}
        aiDetectionEnabled={aiDetectionEnabled}
        courses={(allCourses ?? []).map((c) => ({ id: c.id, title: c.title }))}
        socraticKpis={{ avgDepth, totalBreakthroughs }}
        studentDetails={studentDetails}
      />
    </>
  )
}

// Server-side data fetching for manager analytics (RSC pattern)
// PERF: Batch all course-table queries — fetch ALL enrollments, chapters,
// sessions, and analyses in ONE query each, then aggregate in JS.
async function fetchManagerAnalytics(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  areaId?: string | null,
) {
  try {
    const { subDays, subWeeks, startOfISOWeek, formatISO } = await import("date-fns")

    const monthStart = subDays(new Date(), 30).toISOString()

    // When an area is active, restrict all metrics to courses in that area
    let areaCourseIds: string[] | null = null
    if (areaId) {
      const { data: areaCourses } = await supabase
        .from("courses")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("area_id", areaId)
      areaCourseIds = (areaCourses ?? []).map((c) => c.id)
      if (areaCourseIds.length === 0) {
        // No courses in this area — return empty analytics
        return {
          summary: { activeStudents: 0, engagementRate: 0, completionRate: 0, sessionsThisMonth: 0 },
          engagementChart: [],
          courseTable: [],
        }
      }
    }

    // Helper: build an enrollment query with optional area-scoped course filter
    function applyAreaFilter<T extends { in: (col: string, vals: string[]) => T }>(
      query: T,
    ): T {
      if (areaCourseIds) {
        return query.in("course_id", areaCourseIds)
      }
      return query
    }

    // Active students
    let activeStudentQuery = supabase
      .from("sessions")
      .select("student_id")
      .eq("tenant_id", tenantId)
      .eq("status", "completed")
      .gte("updated_at", monthStart)
    if (areaCourseIds) {
      // sessions link to courses via chapters; filter by chapter_id from area courses
      const { data: areaChapters } = await supabase
        .from("chapters")
        .select("id")
        .in("course_id", areaCourseIds)
      const areaChapterIds = (areaChapters ?? []).map((ch) => ch.id)
      if (areaChapterIds.length > 0) {
        activeStudentQuery = activeStudentQuery.in("chapter_id", areaChapterIds)
      } else {
        activeStudentQuery = activeStudentQuery.in("chapter_id", ["__none__"])
      }
    }
    const { data: activeStudentRows } = await activeStudentQuery

    const activeStudents = new Set(activeStudentRows?.map((r) => r.student_id)).size

    // Total enrolled
    let totalEnrolledQuery = supabase
      .from("enrollments")
      .select("student_id")
      .eq("tenant_id", tenantId)
      .in("status", ["active", "completed"])
    totalEnrolledQuery = applyAreaFilter(totalEnrolledQuery)
    const { data: totalEnrolledRows } = await totalEnrolledQuery

    const totalEnrolled = new Set(totalEnrolledRows?.map((e) => e.student_id)).size
    const engagementRate =
      totalEnrolled > 0 ? Math.round((activeStudents / totalEnrolled) * 100) : 0

    // Completion rate
    let completedQuery = supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "completed")
    completedQuery = applyAreaFilter(completedQuery)
    const { count: completedEnrollments } = await completedQuery

    let totalQuery = supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("status", ["active", "completed"])
    totalQuery = applyAreaFilter(totalQuery)
    const { count: totalEnrollments } = await totalQuery

    const completionRate =
      (totalEnrollments ?? 0) > 0
        ? Math.round(((completedEnrollments ?? 0) / (totalEnrollments ?? 1)) * 100)
        : 0

    // Sessions this month
    let sessionsMonthQuery = supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "completed")
      .gte("updated_at", monthStart)
    if (areaCourseIds) {
      const { data: areaChapters2 } = await supabase
        .from("chapters")
        .select("id")
        .in("course_id", areaCourseIds)
      const areaChapterIds2 = (areaChapters2 ?? []).map((ch) => ch.id)
      if (areaChapterIds2.length > 0) {
        sessionsMonthQuery = sessionsMonthQuery.in("chapter_id", areaChapterIds2)
      } else {
        sessionsMonthQuery = sessionsMonthQuery.in("chapter_id", ["__none__"])
      }
    }
    const { count: sessionsThisMonth } = await sessionsMonthQuery

    // Engagement chart: sessions per week, last 12 weeks
    const chartStart = subWeeks(new Date(), 12).toISOString()
    let chartQuery = supabase
      .from("sessions")
      .select("updated_at")
      .eq("tenant_id", tenantId)
      .eq("status", "completed")
      .gte("updated_at", chartStart)
    if (areaCourseIds) {
      const { data: areaChapters3 } = await supabase
        .from("chapters")
        .select("id")
        .in("course_id", areaCourseIds)
      const areaChapterIds3 = (areaChapters3 ?? []).map((ch) => ch.id)
      if (areaChapterIds3.length > 0) {
        chartQuery = chartQuery.in("chapter_id", areaChapterIds3)
      } else {
        chartQuery = chartQuery.in("chapter_id", ["__none__"])
      }
    }
    const { data: chartSessions } = await chartQuery

    const weekMap = new Map<string, number>()
    for (const session of chartSessions ?? []) {
      if (!session.updated_at) continue
      const weekKey = formatISO(startOfISOWeek(new Date(session.updated_at)), {
        representation: "date",
      })
      weekMap.set(weekKey, (weekMap.get(weekKey) ?? 0) + 1)
    }

    const engagementChart = Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, sessions]) => ({ week, sessions }))

    // Batch all course-table queries
    let coursesQuery = supabase
      .from("courses")
      .select("id, title")
      .eq("tenant_id", tenantId)
      .limit(50)
    if (areaId) {
      coursesQuery = coursesQuery.eq("area_id", areaId)
    }
    const { data: allCourses } = await coursesQuery

    const courseList = allCourses ?? []
    const courseIds = courseList.map((c) => c.id)

    // Early return if no courses — skip batch queries entirely
    if (courseIds.length === 0) {
      return {
        summary: {
          activeStudents,
          engagementRate,
          completionRate,
          sessionsThisMonth: sessionsThisMonth ?? 0,
        },
        engagementChart,
        courseTable: [],
      }
    }

    // Batch: all enrollments, chapters for all courses in parallel
    const [{ data: allEnrollmentRows }, { data: allChapterRows }] = await Promise.all([
      supabase
        .from("enrollments")
        .select("course_id, student_id, status")
        .in("course_id", courseIds)
        .in("status", ["active", "completed"]),
      supabase
        .from("chapters")
        .select("id, course_id")
        .in("course_id", courseIds),
    ])

    const allEnrollments = allEnrollmentRows ?? []
    const allChapters = allChapterRows ?? []

    // Build chapter-to-course map and collect all chapter IDs
    const chapterIdToCourse = new Map<string, string>()
    for (const ch of allChapters) {
      chapterIdToCourse.set(ch.id, ch.course_id)
    }
    const allChapterIds = allChapters.map((ch) => ch.id)

    // Batch: all sessions for all chapters, then all analyses for those sessions
    const { data: allSessionRows } = allChapterIds.length > 0
      ? await supabase
          .from("sessions")
          .select("id, chapter_id")
          .in("chapter_id", allChapterIds)
      : { data: [] as Array<{ id: string; chapter_id: string }> }

    const allSessions = allSessionRows ?? []
    const allSessionIds = allSessions.map((s) => s.id)

    const { data: allAnalysisRows } = allSessionIds.length > 0
      ? await supabase
          .from("analyses")
          .select("session_id, metrics, ai_detection")
          .in("session_id", allSessionIds)
      : { data: [] as Array<{ session_id: string; metrics: unknown; ai_detection: unknown }> }

    const allAnalyses = allAnalysisRows ?? []

    // Build lookup maps for JS-side aggregation
    // Enrollments grouped by course_id
    const enrollmentsByCourse = new Map<string, Array<{ student_id: string; status: string }>>()
    for (const e of allEnrollments) {
      const list = enrollmentsByCourse.get(e.course_id) ?? []
      list.push({ student_id: e.student_id, status: e.status })
      enrollmentsByCourse.set(e.course_id, list)
    }

    // Sessions grouped by course_id (via chapter mapping)
    const sessionIdToCourse = new Map<string, string>()
    for (const s of allSessions) {
      const courseId = chapterIdToCourse.get(s.chapter_id)
      if (courseId) sessionIdToCourse.set(s.id, courseId)
    }

    // Analyses grouped by course_id (via session -> chapter -> course mapping)
    const analysesByCourse = new Map<string, Array<{ metrics: unknown; ai_detection: unknown }>>()
    for (const a of allAnalyses) {
      const courseId = sessionIdToCourse.get(a.session_id)
      if (courseId) {
        const list = analysesByCourse.get(courseId) ?? []
        list.push({ metrics: a.metrics, ai_detection: a.ai_detection })
        analysesByCourse.set(courseId, list)
      }
    }

    // Aggregate per-course metrics in JS (no more N+1)
    const courseTable = courseList.map((course) => {
      const courseEnrollments = enrollmentsByCourse.get(course.id) ?? []
      const studentCount = new Set(courseEnrollments.map((e) => e.student_id)).size
      const courseCompleted = courseEnrollments.filter((e) => e.status === "completed").length
      const courseTotal = courseEnrollments.length
      const courseCompletionRate =
        courseTotal > 0 ? Math.round((courseCompleted / courseTotal) * 100) : 0

      const courseAnalyses = analysesByCourse.get(course.id) ?? []
      let totalDepth = 0
      let depthCount = 0
      let humanCount = 0

      for (const analysis of courseAnalyses) {
        const metrics = analysis.metrics as Record<string, unknown> | null
        const quality = metrics?.quality as Record<string, unknown> | null
        const depth = quality?.depth_of_thought as number | undefined
        if (typeof depth === "number") {
          totalDepth += depth
          depthCount++
        }
        const aiDetection = analysis.ai_detection as Record<string, unknown> | null
        if (aiDetection?.verdict === "likely_human") {
          humanCount++
        }
      }

      return {
        courseId: course.id,
        title: course.title,
        studentCount,
        completionRate: courseCompletionRate,
        avgReflectionDepth:
          depthCount > 0 ? Math.round((totalDepth / depthCount) * 100) / 100 : 0,
        avgAiDetection:
          courseAnalyses.length > 0
            ? Math.round((humanCount / courseAnalyses.length) * 100)
            : 0,
      }
    })

    return {
      summary: {
        activeStudents,
        engagementRate,
        completionRate,
        sessionsThisMonth: sessionsThisMonth ?? 0,
      },
      engagementChart,
      courseTable,
    }
  } catch (error) {
    console.error("Failed to fetch manager analytics:", error)
    throw new Error("Failed to load manager analytics")
  }
}

/** Check if a feature flag is enabled in tenant settings (FIX-15) */
function isFeatureEnabled(settings: unknown, feature: string): boolean {
  if (!settings || typeof settings !== "object") return false
  const s = settings as Record<string, unknown>
  if (!s.features || typeof s.features !== "object") return false
  const features = s.features as Record<string, unknown>
  return features[feature] === true
}
