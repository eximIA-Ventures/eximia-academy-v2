import { createClient } from "@/lib/supabase/server"
import { formatISO, startOfISOWeek, subDays, subWeeks } from "date-fns"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (profileError) {
    console.error("Failed to fetch profile:", profileError.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }

  if (!profile || profile.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const url = new URL(request.url)
    const period = url.searchParams.get("period") ?? "30d"
    const courseId = url.searchParams.get("courseId")
    const tenantId = profile.tenant_id

    // Period calculation
    const periodStart =
      period === "7d"
        ? subDays(new Date(), 7)
        : period === "30d"
          ? subDays(new Date(), 30)
          : period === "90d"
            ? subDays(new Date(), 90)
            : null

    // Summary: active students (distinct students with completed session in period)
    let activeStudentsQuery = supabase
      .from("sessions")
      .select("student_id")
      .eq("tenant_id", tenantId)
      .eq("status", "completed")

    if (periodStart) {
      activeStudentsQuery = activeStudentsQuery.gte("updated_at", periodStart.toISOString())
    }

    const { data: activeStudentRows } = await activeStudentsQuery

    const activeStudents = new Set(activeStudentRows?.map((r) => r.student_id)).size

    // Total enrolled students
    const { data: totalEnrolledRows } = await supabase
      .from("enrollments")
      .select("student_id")
      .eq("tenant_id", tenantId)
      .in("status", ["active", "completed"])

    const totalEnrolled = new Set(totalEnrolledRows?.map((e) => e.student_id)).size

    // Engagement rate
    const engagementRate =
      totalEnrolled > 0 ? Math.round((activeStudents / totalEnrolled) * 100) : 0

    // Completion rate
    const { count: completedEnrollments } = await supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "completed")

    const { count: totalEnrollments } = await supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("status", ["active", "completed"])

    const completionRate =
      (totalEnrollments ?? 0) > 0
        ? Math.round(((completedEnrollments ?? 0) / (totalEnrollments ?? 1)) * 100)
        : 0

    // Sessions this month (fixed 30-day window)
    const monthStart = subDays(new Date(), 30).toISOString()
    const { count: sessionsThisMonth } = await supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "completed")
      .gte("updated_at", monthStart)

    // Engagement chart: sessions per week, last 12 weeks
    const chartStart = subWeeks(new Date(), 12).toISOString()
    const { data: chartSessions } = await supabase
      .from("sessions")
      .select("updated_at")
      .eq("tenant_id", tenantId)
      .eq("status", "completed")
      .gte("updated_at", chartStart)

    // Group by ISO week
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

    // Course table
    const coursesQuery = courseId
      ? supabase.from("courses").select("id, title").eq("tenant_id", tenantId).eq("id", courseId)
      : supabase.from("courses").select("id, title").eq("tenant_id", tenantId).limit(50)

    const { data: allCourses } = await coursesQuery

    const courseTable = await Promise.all(
      (allCourses ?? []).map(async (course) => {
        // Student count
        const { data: courseEnrollments } = await supabase
          .from("enrollments")
          .select("student_id, status")
          .eq("course_id", course.id)
          .in("status", ["active", "completed"])

        const studentCount = new Set(courseEnrollments?.map((e) => e.student_id)).size
        const courseCompleted = (courseEnrollments ?? []).filter(
          (e) => e.status === "completed",
        ).length
        const courseTotal = (courseEnrollments ?? []).length
        const courseCompletionRate =
          courseTotal > 0 ? Math.round((courseCompleted / courseTotal) * 100) : 0

        // Get chapters for this course
        const { data: courseChapters } = await supabase
          .from("chapters")
          .select("id")
          .eq("course_id", course.id)

        const courseChapterIds = (courseChapters ?? []).map((ch) => ch.id)

        // Get session IDs for analyses
        const { data: courseSessions } = await supabase
          .from("sessions")
          .select("id")
          .in("chapter_id", courseChapterIds.length > 0 ? courseChapterIds : ["__none__"])

        const courseSessionIds = (courseSessions ?? []).map((s) => s.id)

        // Avg reflection depth
        const { data: analysisRows } = await supabase
          .from("analyses")
          .select("metrics, ai_detection")
          .in("session_id", courseSessionIds.length > 0 ? courseSessionIds : ["__none__"])

        let totalDepth = 0
        let depthCount = 0
        let humanCount = 0

        for (const analysis of analysisRows ?? []) {
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

        const avgReflectionDepth =
          depthCount > 0 ? Math.round((totalDepth / depthCount) * 100) / 100 : 0
        const avgAiDetection =
          (analysisRows ?? []).length > 0
            ? Math.round((humanCount / (analysisRows ?? []).length) * 100)
            : 0

        return {
          courseId: course.id,
          title: course.title,
          studentCount,
          completionRate: courseCompletionRate,
          avgReflectionDepth,
          avgAiDetection,
        }
      }),
    )

    return NextResponse.json({
      summary: {
        activeStudents,
        engagementRate,
        completionRate,
        sessionsThisMonth: sessionsThisMonth ?? 0,
      },
      engagementChart,
      courseTable,
    })
  } catch (error) {
    console.error("Manager analytics error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
