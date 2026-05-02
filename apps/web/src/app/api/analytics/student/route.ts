import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
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

  if (!profile || profile.role !== "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    // Summary: enrolled courses count
    const { count: enrolledCourses } = await supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("student_id", user.id)
      .in("status", ["active", "completed"])

    // Summary: completed sessions count
    const { count: completedSessions } = await supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("student_id", user.id)
      .eq("status", "completed")

    // Summary: completed chapters (distinct chapters with a completed session)
    const { data: completedChapterRows } = await supabase
      .from("sessions")
      .select("chapter_id")
      .eq("student_id", user.id)
      .eq("status", "completed")

    const completedChapters = new Set(completedChapterRows?.map((r) => r.chapter_id)).size

    // Courses: enrollments with course data
    const { data: enrollmentRows } = await supabase
      .from("enrollments")
      .select("id, course_id, progress, courses(id, title)")
      .eq("student_id", user.id)
      .in("status", ["active", "completed"])

    // For each course, get lastAccessedAt (MAX session created_at) and continueChapterId
    const courses = await Promise.all(
      (enrollmentRows ?? []).map(async (enrollment) => {
        const course = enrollment.courses as unknown as { id: string; title: string }

        // Filter by course chapters
        const { data: courseChapters } = await supabase
          .from("chapters")
          .select("id, order")
          .eq("course_id", course.id)
          .eq("status", "published")
          .order("order", { ascending: true })

        const courseChapterIds = (courseChapters ?? []).map((ch) => ch.id)

        // Get sessions for this course specifically
        const { data: courseSessions } = await supabase
          .from("sessions")
          .select("created_at, chapter_id, status")
          .eq("student_id", user.id)
          .in("chapter_id", courseChapterIds.length > 0 ? courseChapterIds : ["__none__"])
          .order("created_at", { ascending: false })

        // Fallback to enrollment created_at if no sessions
        let lastAccessed: string | null = null
        if (courseSessions && courseSessions.length > 0) {
          lastAccessed = courseSessions[0].created_at
        }

        // continueChapterId: active session chapter or next chapter without completed session
        const activeSession = courseSessions?.find((s) => s.status === "active")
        let continueChapterId: string | null = null

        if (activeSession) {
          continueChapterId = activeSession.chapter_id
        } else {
          const completedChapterIdsInCourse = new Set(
            courseSessions?.filter((s) => s.status === "completed").map((s) => s.chapter_id) ?? [],
          )
          const nextChapter = (courseChapters ?? []).find(
            (ch) => !completedChapterIdsInCourse.has(ch.id),
          )
          continueChapterId = nextChapter?.id ?? null
        }

        // Parse progress - stored as jsonb, may be number or object
        const rawProgress = enrollment.progress
        const progress =
          typeof rawProgress === "number"
            ? rawProgress
            : typeof rawProgress === "object" && rawProgress !== null && "percentage" in rawProgress
              ? (rawProgress as { percentage: number }).percentage
              : 0

        return {
          courseId: course.id,
          title: course.title,
          progress,
          lastAccessedAt: lastAccessed ?? "",
          continueChapterId,
        }
      }),
    )

    // Recent sessions: last 5
    const { data: recentSessionRows } = await supabase
      .from("sessions")
      .select("id, chapter_id, status, created_at, updated_at, chapters(title)")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5)

    const recentSessions = (recentSessionRows ?? []).map((session) => {
      const chapter = session.chapters as unknown as { title: string }
      return {
        sessionId: session.id,
        chapterTitle: chapter?.title ?? "",
        status: session.status as "active" | "completed",
        completedAt: session.status === "completed" ? session.updated_at : undefined,
      }
    })

    return NextResponse.json({
      summary: {
        enrolledCourses: enrolledCourses ?? 0,
        completedSessions: completedSessions ?? 0,
        completedChapters,
      },
      courses,
      recentSessions,
    })
  } catch (error) {
    console.error("Student analytics error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
