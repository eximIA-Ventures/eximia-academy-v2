import { StudentDashboard } from "@/components/dashboard/student-dashboard"
import type { JourneyBandDistribution } from "@/components/dashboard/types"
import {
  BAND_LABELS,
  bandIndexForProgress,
  computeStreakDays,
  computeWeekCells,
  currentWeekDayKeys,
  dayKey,
  parseWeeklyPlan,
  pctToNextBand,
  progressToPct,
  relativeDayLabel,
} from "@/lib/dashboard/journey"
import type { createClient } from "@/lib/supabase/server"

interface StudentDashboardPageProps {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  fullName: string
  tenantId?: string | null
}

export async function StudentDashboardPage({
  supabase,
  userId,
  fullName,
  tenantId,
}: StudentDashboardPageProps) {
  const analytics = await fetchStudentAnalytics(supabase, userId, tenantId ?? null)
  return <StudentDashboard fullName={fullName} data={analytics} />
}

// Server-side data fetching for student analytics (RSC pattern - no client fetch)
// PERF: Batch queries — fetch all chapters and sessions in ONE query each,
// then aggregate in JS to eliminate N+1 per-course loops.
async function fetchStudentAnalytics(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  tenantId: string | null,
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

    // 2. Batch: summary counts + all chapters + all sessions in parallel
    const [
      { count: enrolledCourses },
      { count: completedSessions },
      { data: allChapterRows },
      { data: allSessionRows },
      { data: recentSessionRows },
      { data: profileRow },
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
            .select("id, title, order, course_id")
            .in("course_id", courseIds)
            .eq("status", "published")
            .order("order", { ascending: true })
        : Promise.resolve({
            data: [] as Array<{ id: string; title: string; order: number; course_id: string }>,
          }),
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
      // Weekly plan preference (users.profile.weekly_plan)
      supabase
        .from("users")
        .select("profile")
        .eq("id", userId)
        .single(),
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

    // 5. Map recent sessions
    const now = new Date()
    const recentSessions = (recentSessionRows ?? []).map((session) => {
      const chapter = session.chapters as unknown as { title: string }
      return {
        sessionId: session.id,
        chapterTitle: chapter?.title ?? "",
        status: session.status as "active" | "completed",
        completedAt: session.status === "completed" ? session.updated_at : undefined,
        whenLabel: relativeDayLabel(session.created_at, now),
      }
    })

    // 6. Minha Jornada (design v6.1): next step, weekly plan, journey position
    const chapterTitleById = new Map<string, string>()
    for (const ch of allChapters as Array<{ id: string; title?: string }>) {
      if (ch.title) chapterTitleById.set(ch.id, ch.title)
    }

    // Primary course: in progress with most recent access, else most recent
    const sortedCourses = [...courses].sort(
      (a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime(),
    )
    const primaryCourse = sortedCourses.find((c) => c.progress < 100) ?? sortedCourses[0] ?? null

    const nextStep =
      primaryCourse?.continueChapterId != null
        ? {
            chapterId: primaryCourse.continueChapterId,
            chapterTitle: chapterTitleById.get(primaryCourse.continueChapterId) ?? "Próxima sessão",
            courseId: primaryCourse.courseId,
            courseTitle: primaryCourse.title,
          }
        : null

    // Weekly plan + real week activity
    const profile = (profileRow?.profile ?? {}) as Record<string, unknown>
    const weeklyPlan = parseWeeklyPlan(profile.weekly_plan)

    const weekKeys = currentWeekDayKeys(now)
    const weekKeySet = new Set(weekKeys)
    const weekSessions = allSessions
      .filter((s) => weekKeySet.has(dayKey(new Date(s.created_at))))
      .map((s) => ({
        createdAt: s.created_at,
        chapterTitle: chapterTitleById.get(s.chapter_id) ?? null,
      }))

    const sessionsThisWeek = new Set(weekSessions.map((s) => dayKey(new Date(s.createdAt)))).size
    const streakDays = computeStreakDays(
      allSessions.map((s) => s.created_at),
      now,
    )

    const weekDays = weeklyPlan
      ? computeWeekCells({
          plan: weeklyPlan,
          weekSessions,
          nextChapterTitle: nextStep?.chapterTitle ?? null,
          now,
        })
      : []

    // Journey position (band from real progress of the primary course)
    let journey = null
    if (primaryCourse) {
      const pct = Math.round(progressToPct(primaryCourse.progress))
      const bandIndex = bandIndexForProgress(pct)
      journey = {
        bandIndex,
        bandLabel: BAND_LABELS[bandIndex],
        progressPct: pct,
        pctToNextBand: pctToNextBand(pct),
        nextBandLabel: bandIndex < BAND_LABELS.length - 1 ? BAND_LABELS[bandIndex + 1] : null,
        distribution: await fetchClassDistribution(tenantId, primaryCourse.courseId, bandIndex),
      }
    }

    return {
      summary: {
        enrolledCourses: enrolledCourses ?? 0,
        completedSessions: completedSessions ?? 0,
        completedChapters,
      },
      courses,
      recentSessions,
      nextStep,
      weeklyPlan,
      weekDays,
      sessionsThisWeek,
      streakDays,
      journey,
    }
  } catch (error) {
    console.error("Failed to fetch student analytics:", error)
    throw new Error("Failed to load student analytics")
  }
}

/**
 * Aggregated class distribution by journey band for the student's primary course.
 * Uses the service client because RLS (correctly) blocks students from reading
 * other students' enrollments; ONLY counts per band leave this function,
 * never individual rows. Returns null on any failure (the UI omits the block).
 */
async function fetchClassDistribution(
  tenantId: string | null,
  courseId: string,
  yourBandIndex: number,
): Promise<JourneyBandDistribution[] | null> {
  if (!tenantId) return null
  try {
    const { createServiceClient } = await import("@/lib/supabase/service")
    const svc = createServiceClient()
    const { data, error } = await svc
      .from("enrollments")
      .select("progress")
      .eq("course_id", courseId)
      .eq("tenant_id", tenantId)
      .in("status", ["active", "completed"])
      .is("deleted_at", null)

    if (error || !data || data.length === 0) return null

    const counts = [0, 0, 0, 0, 0]
    for (const row of data) {
      counts[bandIndexForProgress(progressToPct(row.progress))]++
    }
    const total = data.length
    return BAND_LABELS.map((label, index) => ({
      label,
      pct: Math.round((counts[index] / total) * 100),
      isYou: index === yourBandIndex,
    }))
  } catch (error) {
    console.error("Failed to aggregate class distribution:", error)
    return null
  }
}
