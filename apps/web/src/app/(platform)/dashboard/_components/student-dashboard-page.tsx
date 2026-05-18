import { StudentDashboard } from "@/components/dashboard/student-dashboard"
import type { createClient } from "@/lib/supabase/server"

interface StudentDashboardPageProps {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  fullName: string
}

export async function StudentDashboardPage({
  supabase,
  userId,
  fullName,
}: StudentDashboardPageProps) {
  const analytics = await fetchStudentAnalytics(supabase, userId)
  return <StudentDashboard fullName={fullName} data={analytics} />
}

// Server-side data fetching for student analytics (RSC pattern - no client fetch)
// PERF: Batch queries — fetch all chapters and sessions in ONE query each,
// then aggregate in JS to eliminate N+1 per-course loops.
async function fetchStudentAnalytics(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  try {
    // 1. Fetch enrollments with course data (single query)
    const { data: enrollmentRows } = await supabase
      .from("enrollments")
      .select("id, course_id, progress, created_at, courses(id, title)")
      .eq("student_id", userId)
      .in("status", ["active", "completed"])

    const enrollments = (enrollmentRows ?? []).filter((e) => e.courses != null)
    const courseIds = enrollments.map((e) => {
      const course = e.courses as unknown as { id: string; title: string }
      return course.id
    })

    // 2. Batch: summary counts + all chapters + all sessions + certificates in parallel
    const [
      { count: enrolledCourses },
      { count: completedSessions },
      { data: allChapterRows },
      { data: allSessionRows },
      { data: recentSessionRows },
      { data: certificateRows },
    ] = await Promise.all([
      // Summary: enrolled courses count
      supabase
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .eq("student_id", userId)
        .in("status", ["active", "completed"]),
      // Summary: completed sessions count
      supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("student_id", userId)
        .eq("status", "completed"),
      // ALL published chapters for all enrolled courses (batch)
      courseIds.length > 0
        ? supabase
            .from("chapters")
            .select("id, order, course_id")
            .in("course_id", courseIds)
            .eq("status", "published")
            .order("order", { ascending: true })
        : Promise.resolve({ data: [] as Array<{ id: string; order: number; course_id: string }> }),
      // ALL sessions for this student across all chapters (batch)
      courseIds.length > 0
        ? supabase
            .from("sessions")
            .select("created_at, chapter_id, status")
            .eq("student_id", userId)
        : Promise.resolve({
            data: [] as Array<{ created_at: string; chapter_id: string; status: string }>,
          }),
      // Recent sessions (5 most recent) with chapter title
      supabase
        .from("sessions")
        .select("id, chapter_id, status, created_at, updated_at, chapters(title)")
        .eq("student_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
      // Certificates earned by this student
      supabase
        .from("certificates")
        .select("id, enrollment_id, course_title, verification_code, issued_at")
        .eq("user_id", userId)
        .order("issued_at", { ascending: false }),
    ])

    const allChapters = allChapterRows ?? []
    const allSessions = allSessionRows ?? []

    // 3. Build lookup maps for JS-side aggregation
    // Group chapters by course_id
    const chaptersByCourse = new Map<string, Array<{ id: string; order: number }>>()
    for (const ch of allChapters) {
      const list = chaptersByCourse.get(ch.course_id) ?? []
      list.push({ id: ch.id, order: ch.order })
      chaptersByCourse.set(ch.course_id, list)
    }

    // Build set of all chapter IDs per course for session filtering
    const chapterIdToCourse = new Map<string, string>()
    for (const ch of allChapters) {
      chapterIdToCourse.set(ch.id, ch.course_id)
    }

    // Group sessions by course_id (via chapter mapping)
    const sessionsByCourse = new Map<
      string,
      Array<{ created_at: string; chapter_id: string; status: string }>
    >()
    const completedChapterIds = new Set<string>()
    for (const session of allSessions) {
      const courseId = chapterIdToCourse.get(session.chapter_id)
      if (courseId) {
        const list = sessionsByCourse.get(courseId) ?? []
        list.push(session)
        sessionsByCourse.set(courseId, list)
      }
      if (session.status === "completed") {
        completedChapterIds.add(session.chapter_id)
      }
    }

    const completedChapters = completedChapterIds.size

    // 4. Aggregate per-course data in JS (no more N+1)
    const courses = enrollments.map((enrollment) => {
      const course = enrollment.courses as unknown as { id: string; title: string }
      const courseChapters = chaptersByCourse.get(course.id) ?? []
      const courseSessions = (sessionsByCourse.get(course.id) ?? []).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )

      // lastAccessedAt: most recent session or enrollment date
      const lastAccessedAt = courseSessions[0]?.created_at ?? enrollment.created_at ?? ""

      // continueChapterId: active session or next unfinished chapter
      const activeSession = courseSessions.find((s) => s.status === "active")
      let continueChapterId: string | null = null

      if (activeSession) {
        continueChapterId = activeSession.chapter_id
      } else {
        const courseCompletedIds = new Set(
          courseSessions.filter((s) => s.status === "completed").map((s) => s.chapter_id),
        )
        const nextChapter = courseChapters.find((ch) => !courseCompletedIds.has(ch.id))
        continueChapterId = nextChapter?.id ?? null
      }

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
        lastAccessedAt,
        continueChapterId,
      }
    })

    // 5. Map certificates
    const certificates = (certificateRows ?? []).map((cert) => ({
      id: cert.id as string,
      enrollmentId: cert.enrollment_id as string,
      courseTitle: cert.course_title as string,
      verificationCode: cert.verification_code as string,
      issuedAt: cert.issued_at as string,
    }))

    // 6. Map recent sessions
    const recentSessions = (recentSessionRows ?? []).map((session) => {
      const chapter = session.chapters as unknown as { title: string }
      return {
        sessionId: session.id,
        chapterTitle: chapter?.title ?? "",
        status: session.status as "active" | "completed",
        completedAt: session.status === "completed" ? session.updated_at : undefined,
      }
    })

    return {
      summary: {
        enrolledCourses: enrolledCourses ?? 0,
        completedSessions: completedSessions ?? 0,
        completedChapters,
      },
      courses,
      recentSessions,
      certificates,
    }
  } catch (error) {
    console.error("Failed to fetch student analytics:", error)
    throw new Error("Failed to load student analytics")
  }
}
