import { StudentDashboard } from "@/components/dashboard/student-dashboard"
import type { StudentTrailData, TrailCourseStep } from "@/components/dashboard/trail-progress-card"
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
import { previewArtifactFor } from "@/lib/onboarding/preview"
import { resolveOnboarding } from "@/lib/onboarding/resolve"
import { MODAL_SESSION_COOKIE } from "@/lib/onboarding/session"
import type { PendingArtifact } from "@/lib/onboarding/types"
import type { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"

interface StudentDashboardPageProps {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  fullName: string
  tenantId?: string | null
  /** `users.role`. Vai só até `resolveOnboarding()`, que o usa para qualificar
   *  o gate de `onboardingCompleted` — o redirect do layout que esse gate
   *  espelha é `role === "student"` e só. */
  role?: string | null
  /** `(platform)/layout.tsx` redireciona quem não completou o onboarding
   *  inicial; sem este gate a pessoa tomaria dois onboardings em sequência. */
  onboardingCompleted?: boolean
  /** Valor cru de `?onboarding=` (modo demonstração). */
  onboardingPreview?: string | null
}

export async function StudentDashboardPage({
  supabase,
  userId,
  fullName,
  tenantId,
  role = null,
  onboardingCompleted = false,
  onboardingPreview = null,
}: StudentDashboardPageProps) {
  const [analytics, onboarding] = await Promise.all([
    fetchStudentAnalytics(supabase, userId, tenantId ?? null),
    resolveHomeOnboarding({
      supabase,
      userId,
      tenantId: tenantId ?? null,
      role,
      onboardingCompleted,
      onboardingPreview,
    }),
  ])
  return (
    <StudentDashboard
      fullName={fullName}
      data={analytics}
      onboarding={onboarding}
      onboardingPreview={Boolean(onboardingPreview)}
    />
  )
}

/**
 * A resolução do anúncio é SERVER-SIDE, e o componente cliente só recebe o
 * artefato pronto. O cliente nunca decide elegibilidade: janela, público e
 * ativo vivem na RLS, coorte e supressões vivem em `resolveOnboarding()`, e o
 * kill switch precisa valer no PRÓXIMO request — nada disso sobrevive a uma
 * flag lida do bundle.
 *
 * Fail-open é requisito duro aqui: as tabelas do onboarding ainda NÃO existem
 * neste banco. Erro de leitura vira `null` (nada aparece), nunca exceção — a
 * home do aluno não pode quebrar por causa de uma feature que ainda nem foi
 * ligada. `resolveOnboarding()` já garante isso internamente; o `catch` abaixo
 * é a segunda rede, para `cookies()` ou qualquer coisa fora dele.
 */
async function resolveHomeOnboarding({
  supabase,
  userId,
  tenantId,
  role,
  onboardingCompleted,
  onboardingPreview,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  tenantId: string | null
  role: string | null
  onboardingCompleted: boolean
  onboardingPreview: string | null
}): Promise<PendingArtifact | null> {
  try {
    // Modo demonstração: NÃO consulta o banco e NÃO grava linha. É por isso
    // que ele funciona com as tabelas inexistentes.
    if (onboardingPreview) {
      const artifact = previewArtifactFor(onboardingPreview)
      return artifact?.kind === "announcement" ? artifact : null
    }

    const cookieStore = await cookies()
    return await resolveOnboarding(supabase, {
      userId,
      tenantId,
      role,
      onboardingCompleted,
      surface: "home",
      pathname: "/dashboard",
      viewAsStudent: cookieStore.get("x-view-as-student")?.value === "true",
      isPreview: false,
      modalShownThisSession: cookieStore.get(MODAL_SESSION_COOKIE)?.value === "1",
    })
  } catch (error) {
    console.error("Failed to resolve onboarding announcement (degrading to none):", error)
    return null
  }
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
      { data: profileRow },
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
      // Minha Jornada v6.1, weekly plan preference (users.profile.weekly_plan)
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

    // 7. Minha Jornada (design v6.1): next step, weekly plan, journey position
    const chapterTitleById = new Map<string, string>()
    for (const ch of allChapters as Array<{ id: string; title?: string }>) {
      if (ch.title) chapterTitleById.set(ch.id, ch.title)
    }

    // Primary course: in progress with most recent access, else most recent.
    // Com trilha ativa, o curso primário tende a ser o curso atual da trilha
    // (mesma fonte de recência), mantendo o próximo passo coerente com o hero.
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
      certificates,
      trails,
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

/**
 * Aggregated class distribution by journey band for the student's primary course.
 * Uses the service client because RLS (correctly) blocks students from reading
 * other students' enrollments; ONLY counts per band leave this function,
 * never individual rows (LGPD-safe: no PII, no per-student data).
 * Returns null on any failure (the UI omits the block).
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
