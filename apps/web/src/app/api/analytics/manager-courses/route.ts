import { createClient } from "@/lib/supabase/server"
import { subDays } from "date-fns"
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

    // Get manager's courses
    const { data: managerCourses } = await supabase
      .from("courses")
      .select("id, title, status")
      .eq("created_by", user.id)
      .eq("tenant_id", tenantId)

    const managerCourseIds = (managerCourses ?? []).map((c) => c.id)

    if (managerCourseIds.length === 0) {
      return NextResponse.json({
        summary: { totalCourses: 0, totalStudents: 0, sessionsThisWeek: 0 },
        courses: [],
        studentMetrics: courseId ? [] : undefined,
      })
    }

    // Summary: total courses
    const totalCourses = managerCourseIds.length

    // Summary: total students (distinct students with active/completed enrollment)
    const { data: enrollmentRows } = await supabase
      .from("enrollments")
      .select("student_id")
      .in("course_id", managerCourseIds)
      .in("status", ["active", "completed"])

    const totalStudents = new Set(enrollmentRows?.map((e) => e.student_id)).size

    // Summary: sessions this week (fixed 7-day window, not affected by period filter)
    const weekStart = subDays(new Date(), 7).toISOString()

    // Get chapters for manager's courses
    const { data: managerChapters } = await supabase
      .from("chapters")
      .select("id, course_id")
      .in("course_id", managerCourseIds)

    const managerChapterIds = (managerChapters ?? []).map((ch) => ch.id)

    const { count: sessionsThisWeek } = await supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .in("chapter_id", managerChapterIds.length > 0 ? managerChapterIds : ["__none__"])
      .gte("updated_at", weekStart)

    // Courses with metrics
    const courses = await Promise.all(
      (managerCourses ?? []).map(async (course) => {
        // Student count per course
        const { data: courseEnrollments } = await supabase
          .from("enrollments")
          .select("student_id, status")
          .eq("course_id", course.id)
          .in("status", ["active", "completed"])

        const studentCount = new Set(courseEnrollments?.map((e) => e.student_id)).size
        const completedCount = (courseEnrollments ?? []).filter(
          (e) => e.status === "completed",
        ).length
        const totalCount = (courseEnrollments ?? []).length
        const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

        // Session count per course
        const courseChapterIds = (managerChapters ?? [])
          .filter((ch) => ch.course_id === course.id)
          .map((ch) => ch.id)

        const { count: sessionCount } = await supabase
          .from("sessions")
          .select("id", { count: "exact", head: true })
          .in("chapter_id", courseChapterIds.length > 0 ? courseChapterIds : ["__none__"])

        return {
          courseId: course.id,
          title: course.title,
          studentCount,
          completionRate,
          sessionCount: sessionCount ?? 0,
          status: course.status,
        }
      }),
    )

    // Student metrics (when courseId is provided)
    let studentMetrics:
      | Array<{
          studentId: string
          name: string
          progress: number
          sessionCount: number
          lastActivity: string
          aiDetectionFlags: Array<{ verdict: string; confidence: string }>
        }>
      | undefined

    if (courseId && managerCourseIds.includes(courseId)) {
      const { data: courseEnrollments } = await supabase
        .from("enrollments")
        .select("student_id, progress, users(id, full_name)")
        .eq("course_id", courseId)
        .in("status", ["active", "completed"])

      const courseChapterIds = (managerChapters ?? [])
        .filter((ch) => ch.course_id === courseId)
        .map((ch) => ch.id)

      studentMetrics = await Promise.all(
        (courseEnrollments ?? []).map(async (enrollment) => {
          const student = enrollment.users as unknown as { id: string; full_name: string }

          // Session count for this student in this course
          const { count: studentSessionCount } = await supabase
            .from("sessions")
            .select("id", { count: "exact", head: true })
            .eq("student_id", enrollment.student_id)
            .eq("status", "completed")
            .in("chapter_id", courseChapterIds.length > 0 ? courseChapterIds : ["__none__"])

          // Last activity
          const { data: lastSession } = await supabase
            .from("sessions")
            .select("created_at")
            .eq("student_id", enrollment.student_id)
            .in("chapter_id", courseChapterIds.length > 0 ? courseChapterIds : ["__none__"])
            .order("created_at", { ascending: false })
            .limit(1)

          // AI detection flags (most recent analysis per student)
          const { data: recentAnalysis } = await supabase
            .from("analyses")
            .select("ai_detection, session_id")
            .in(
              "session_id",
              await supabase
                .from("sessions")
                .select("id")
                .eq("student_id", enrollment.student_id)
                .in("chapter_id", courseChapterIds.length > 0 ? courseChapterIds : ["__none__"])
                .then((r) => (r.data ?? []).map((s) => s.id)),
            )
            .order("created_at", { ascending: false })
            .limit(1)

          const aiDetection = recentAnalysis?.[0]?.ai_detection as
            | { verdict: string; confidence: string }
            | undefined
          const aiDetectionFlags = aiDetection ? [aiDetection] : []

          const rawProgress = enrollment.progress
          const progress =
            typeof rawProgress === "number"
              ? rawProgress
              : typeof rawProgress === "object" &&
                  rawProgress !== null &&
                  "percentage" in rawProgress
                ? (rawProgress as { percentage: number }).percentage
                : 0

          return {
            studentId: enrollment.student_id,
            name: student?.full_name ?? "",
            progress,
            sessionCount: studentSessionCount ?? 0,
            lastActivity: lastSession?.[0]?.created_at ?? "",
            aiDetectionFlags,
          }
        }),
      )
    }

    return NextResponse.json({
      summary: {
        totalCourses,
        totalStudents,
        sessionsThisWeek: sessionsThisWeek ?? 0,
      },
      courses,
      studentMetrics,
    })
  } catch (error) {
    console.error("Manager analytics error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
