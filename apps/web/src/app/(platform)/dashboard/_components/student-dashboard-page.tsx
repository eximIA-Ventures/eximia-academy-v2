import { StudentDashboard } from "@/components/dashboard/student-dashboard"
import type { StudentTrailData, TrailCourseStep } from "@/components/dashboard/trail-progress-card"
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
    // INCIDENT FIX (2026-07-01): hide archived courses and soft-deleted
    // enrollments so a course that was duplicated + archived never resurfaces
    // in "Seus Cursos". `courses!inner` drops rows whose course is missing,
    // and `courses.status=neq.archived` (filter on the embedded resource)
    // drops rows pointing at an archived course; `deleted_at` IS NULL drops
    // soft-removed enrollments.
    const { data: enrollmentRows } = await supabase
      .from("enrollments")
      .select("id, course_id, status, progress, created_at, courses!inner(id, title, status)")
      .eq("student_id", userId)
      .in("status", ["active", "completed"])
      .is("deleted_at", null)
      .neq("courses.status", "archived")

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
      { data: trailEnrollRows },
    ] = await Promise.all([
      // Summary: enrolled courses count — must match the visible course list,
      // so apply the same archived/soft-delete filters as query #1.
      supabase
        .from("enrollments")
        .select("id, courses!inner(status)", { count: "exact", head: true })
        .eq("student_id", userId)
        .in("status", ["active", "completed"])
        .is("deleted_at", null)
        .neq("courses.status", "archived"),
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
      // Fases 1A/1B — ALL the student's trails: live enrollments carrying a
      // trail_id (trail assignment stamps trail_id on the enrollment).
      supabase
        .from("enrollments")
        .select("trail_id")
        .eq("student_id", userId)
        .not("trail_id", "is", null)
        .in("status", ["active", "completed"])
        .is("deleted_at", null),
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

    // 4.5 — Fases 1A/1B (Hugo 2026-07-15): as trilhas do aluno. Round 2
    // condicional (2 queries em paralelo, batch por .in — sem N+1); status por
    // curso reusa as enrollments do round 1; recência reusa o lastAccessedAt já
    // agregado em `courses`. Qualquer falha degrada para [] — o dashboard sem
    // trilha fica EXATAMENTE como antes.
    const trailIds = [
      ...new Set(
        (trailEnrollRows ?? [])
          .map((r) => r.trail_id as string | null)
          .filter((id): id is string => Boolean(id)),
      ),
    ]
    let trails: StudentTrailData[] = []
    if (trailIds.length > 0) {
      try {
        trails = await fetchStudentTrails(supabase, trailIds, enrollments, courses)
      } catch (trailError) {
        console.error("Failed to fetch student trails (degrading to none):", trailError)
        trails = []
      }
    }

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
      trails,
    }
  } catch (error) {
    console.error("Failed to fetch student analytics:", error)
    throw new Error("Failed to load student analytics")
  }
}

/** Parse the enrollment `progress` json/number into a plain percentage. */
function progressPctOf(rawProgress: unknown): number {
  if (typeof rawProgress === "number") return rawProgress
  if (typeof rawProgress === "object" && rawProgress !== null && "percentage" in rawProgress) {
    return (rawProgress as { percentage: number }).percentage
  }
  return 0
}

// Fases 1A/1B — as trilhas do aluno para o dashboard (hero de retomada + card
// completo/grid compacto). Round 2 do fetch: learning_trails + trail_courses
// buscados em BATCH (.in sobre todas as trilhas, 2 queries no total — sem N+1).
// O estado por curso deriva das enrollments JÁ buscadas no round 1; o destino
// de continuação e a recência reusam o que JÁ foi agregado em `courses`.
// Retorna ordenado por atividade recente (mais recente primeiro).
async function fetchStudentTrails(
  supabase: Awaited<ReturnType<typeof createClient>>,
  trailIds: string[],
  enrollments: Array<{ course_id: string; status?: string; progress: unknown }>,
  aggregatedCourses: Array<{
    courseId: string
    continueChapterId: string | null
    lastAccessedAt: string
  }>,
): Promise<StudentTrailData[]> {
  const [{ data: trailRows }, { data: trailCourseRows }] = await Promise.all([
    supabase
      .from("learning_trails")
      .select("id, title, description, is_sequential, is_mandatory, status")
      .in("id", trailIds),
    supabase
      .from("trail_courses")
      .select("trail_id, course_id, order, courses!inner(id, title, status)")
      .in("trail_id", trailIds)
      .neq("courses.status", "archived")
      .order("order", { ascending: true }),
  ])

  const enrollByCourse = new Map(enrollments.map((e) => [e.course_id, e]))
  const aggByCourse = new Map(aggregatedCourses.map((c) => [c.courseId, c]))

  // Agrupa trail_courses por trilha (a query já veio ordenada por `order`).
  const coursesByTrail = new Map<string, NonNullable<typeof trailCourseRows>>()
  for (const tc of trailCourseRows ?? []) {
    const list = coursesByTrail.get(tc.trail_id as string) ?? []
    list.push(tc)
    coursesByTrail.set(tc.trail_id as string, list)
  }

  const out: StudentTrailData[] = []
  for (const trailRow of trailRows ?? []) {
    // Só trilha ATIVA aparece no dashboard (draft/archived nunca surgem).
    if (trailRow.status !== "active") continue
    const trailCourses = coursesByTrail.get(trailRow.id as string) ?? []
    if (trailCourses.length === 0) continue

    const isSequential = Boolean(trailRow.is_sequential)

    // Curso atual = primeiro não concluído, na ordem da trilha.
    const completedFlags = trailCourses.map(
      (tc) => enrollByCourse.get(tc.course_id)?.status === "completed",
    )
    const rawCurrentIndex = completedFlags.findIndex((done) => !done)
    const currentIndex = rawCurrentIndex === -1 ? null : rawCurrentIndex

    const steps: TrailCourseStep[] = trailCourses.map((tc, i) => {
      const course = tc.courses as unknown as { id: string; title: string }
      const enrollment = enrollByCourse.get(tc.course_id)
      const state: TrailCourseStep["state"] = completedFlags[i]
        ? "completed"
        : i === currentIndex
          ? "active"
          : isSequential
            ? "locked"
            : "available"
      return {
        courseId: tc.course_id as string,
        title: course?.title ?? "",
        state,
        progressPct: Math.round(progressPctOf(enrollment?.progress)),
      }
    })

    const completedCount = completedFlags.filter(Boolean).length
    const progressPct = Math.round((completedCount / trailCourses.length) * 100)

    // Destino inteligente: capítulo de continuação do curso ATUAL (já agregado
    // no round 1); sem enrollment/capítulo → a página do curso; 100% → a trilha.
    const currentStep = currentIndex !== null ? steps[currentIndex] : null
    const continueChapterId = currentStep
      ? (aggByCourse.get(currentStep.courseId)?.continueChapterId ?? null)
      : null
    const continueHref = currentStep
      ? continueChapterId
        ? `/courses/${currentStep.courseId}/chapters/${continueChapterId}`
        : `/courses/${currentStep.courseId}`
      : `/trails/${trailRow.id}`

    // Recência da trilha = atividade mais recente entre os cursos dela
    // (lastAccessedAt já agregado: última sessão ou data do enrollment).
    const lastActivityAt = trailCourses.reduce((max, tc) => {
      const at = aggByCourse.get(tc.course_id as string)?.lastAccessedAt ?? ""
      return at > max ? at : max
    }, "")

    out.push({
      trailId: trailRow.id as string,
      title: trailRow.title as string,
      description: (trailRow.description as string | null) ?? null,
      isMandatory: Boolean(trailRow.is_mandatory),
      progressPct,
      currentIndex,
      currentCourseTitle: currentStep?.title ?? null,
      currentCoursePct: currentStep?.progressPct ?? 0,
      continueHref,
      lastActivityAt,
      courses: steps,
    })
  }

  // Mais recente primeiro (o componente destaca o índice 0).
  out.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
  return out
}
