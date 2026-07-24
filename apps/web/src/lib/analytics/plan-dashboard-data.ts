// ---------------------------------------------------------------------------
// plan-dashboard-data — SSR data fetch for "Meu Plano" (SH-3.3), shared
// ---------------------------------------------------------------------------
// Extracted VERBATIM (no logic change) from `meu-plano/page.tsx`, SH-3.3
// (Hugo 2026-07-21), so a SECOND caller — the "Comparativo com o Plano"
// toggle's API route (`/api/analytics/plan-dashboard`) — can reuse the exact
// same real data instead of re-querying/reimplementing it. `meu-plano/page.tsx`
// re-exports `PlanDashboardData` from here so existing imports (`from
// "../page"`) keep working unchanged.
//
// SCOPE BOUNDARY: read-only, no side effects. Every field is either real
// (queried here) or explicitly null when the underlying data isn't computable
// — never a fabricated placeholder (same contract as the original).
// ---------------------------------------------------------------------------

import { countReflectionBlocks } from "@/lib/analytics/reflection-potential"
import {
  type CumulativeExpected,
  type ModuleJourneyItem,
  type WeeklyComparison,
  computeCumulativeExpected,
  computeModuleJourney,
  computeWeeklyComparison,
  getCalendarWeekRange,
} from "@/lib/analytics/study-plan-dashboard"
import type { StudyPlanChoice, StudyPlanDiagnostic } from "@/lib/analytics/study-plan-projection"
import type { getAuthProfile } from "@/lib/auth"
import type { StudentHomeSubject } from "@/types/analytics"

/** Real data for the "Meu Plano" ACTIVE dashboard (Tela 1) — SH-3.3. Every
 *  field is either real (queried below) or explicitly null when the
 *  underlying data isn't computable — never a fabricated placeholder. */
export interface PlanDashboardData {
  courseTitle: string | null
  currentChapterTitle: string | null
  currentChapterOrder: number | null
  moduleJourney: ModuleJourneyItem[]
  weeklyComparison: WeeklyComparison | null
  /** Real average (createdAt→completedAt) of the trail's completed sessions,
   *  in minutes — NOT the mockup's illustrative "~35 min". Null when no
   *  completed session has both timestamps yet (never fabricated). */
  avgMinutesPerSession: number | null
  /**
   * SH-3.3 R7 (Hugo 2026-07-21) — "quanto já deveria ter sido realizado,
   * cumulativamente" (sessões/reflexões), dado o ritmo do `choice` e os dias
   * decorridos desde `leading.startDate`. Null only when `leading` is null
   * (nenhuma matrícula com deadline computável) — degrada como o resto do
   * arquivo, nunca fabrica um número.
   */
  cumulativeExpected: CumulativeExpected | null
}

/** Parse the enrollment `progress` json/number into a plain percentage (same
 *  shape as student-dashboard-page.tsx's `progressPctOf`, duplicated here per
 *  the codebase's existing convention rather than importing a page module). */
function progressPctOf(rawProgress: unknown): number {
  if (typeof rawProgress === "number") return rawProgress
  if (typeof rawProgress === "object" && rawProgress !== null && "percentage" in rawProgress) {
    return (rawProgress as { percentage: number }).percentage
  }
  return 0
}

export interface LeadingEnrollmentContext {
  courseId: string
  courseTitle: string
  daysLeft: number
  startDate: Date
  targetCompletionDate: Date
}

type AuthedSupabase = Awaited<ReturnType<typeof getAuthProfile>>["supabase"]

/**
 * Finds the student's LEADING enrollment (highest progress %, same tie-break
 * concept `computeBehindAndProgress`/`expectedPctByStudent` already use — see
 * SH-2.7 Dev Notes) and derives real days-left + course identity from its
 * deadline. Read-only, isolated: does NOT touch engagement-triage.ts/
 * area-gestor.ts. Returns null when no active enrollment has a computable
 * `deadline_days` (AC6 — the whole plan dashboard degrades from this single
 * point, never a fabricated course/deadline).
 *
 * EPIC-JORNADA (JRN-D, Hugo 2026-07-24) — optional `courseId`: when provided,
 * the context is anchored to THAT course's enrollment instead of the
 * highest-progress one (the Jornada operates per-course now). Absent/undefined
 * → the original leading behavior, byte-identical for every existing caller.
 * Returns null when the requested course has no enrollment with a computable
 * deadline (same honest degradation as the leading path).
 */
export async function fetchLeadingEnrollmentContext(
  supabase: AuthedSupabase,
  studentId: string,
  courseId?: string,
): Promise<LeadingEnrollmentContext | null> {
  const { data: rows } = await supabase
    .from("enrollments")
    .select("progress, created_at, courses!inner(id, title, deadline_days, status)")
    .eq("student_id", studentId)
    .in("status", ["active", "completed"])
    .is("deleted_at", null)
    .neq("courses.status", "archived")

  if (!rows || rows.length === 0) return null

  const withDeadline = rows
    .map((row) => {
      const course = row.courses as unknown as {
        id: string
        title: string
        deadline_days: number | null
      }
      return {
        progress: progressPctOf(row.progress),
        createdAt: row.created_at as string,
        courseId: course?.id ?? null,
        courseTitle: course?.title ?? null,
        deadlineDays: course?.deadline_days ?? null,
      }
    })
    .filter((row) => row.deadlineDays != null && row.deadlineDays > 0 && row.courseId != null)

  if (withDeadline.length === 0) return null

  // JRN-D — courseId given: anchor to THAT course's row; null when it has no
  // computable deadline. Otherwise: leading = highest progress (original path).
  const leading = courseId
    ? withDeadline.find((row) => row.courseId === courseId)
    : withDeadline.reduce((max, row) => (row.progress > max.progress ? row : max))
  if (!leading) return null
  const startDate = new Date(leading.createdAt)
  const elapsedDays = Math.max(0, (Date.now() - startDate.getTime()) / 86_400_000)
  const daysLeft = Math.max(0, Math.round((leading.deadlineDays as number) - elapsedDays))
  const targetCompletionDate = new Date(
    startDate.getTime() + (leading.deadlineDays as number) * 86_400_000,
  )

  return {
    courseId: leading.courseId as string,
    courseTitle: leading.courseTitle ?? "",
    daysLeft,
    startDate,
    targetCompletionDate,
  }
}

/**
 * Real data for the "Meu Plano" ACTIVE dashboard (Tela 1) + "Recalcular"
 * (Tela 2) — SH-3.3 §3.2/§3.3 of the architecture doc. Both queries here are
 * READ-ONLY over already-existing tables (`chapters`/`chapter_slides`/
 * `sessions`/`slide_reflections`) — zero new table, zero migration. When
 * `leading` is null (no computable deadline) or the course has zero
 * chapters, every field degrades to null/[] explicitly (AC6) — the caller
 * never fabricates a course/module/comparison.
 */
export async function fetchPlanDashboardData(
  supabase: AuthedSupabase,
  studentId: string,
  leading: LeadingEnrollmentContext | null,
  choice: StudyPlanChoice,
): Promise<PlanDashboardData> {
  const empty: PlanDashboardData = {
    courseTitle: null,
    currentChapterTitle: null,
    currentChapterOrder: null,
    moduleJourney: [],
    weeklyComparison: null,
    avgMinutesPerSession: null,
    cumulativeExpected: null,
  }
  if (!leading) return empty

  // SH-3.3 R7 — elapsedDays desde o início da matrícula líder (mesma fórmula de
  // `fetchLeadingEnrollmentContext` acima / `computeBehindAndProgress`), não
  // depende de capítulos — computado ANTES do early-return de curso vazio.
  const elapsedDays = Math.max(0, (Date.now() - leading.startDate.getTime()) / 86_400_000)
  const cumulativeExpected = computeCumulativeExpected(choice, elapsedDays)

  const { data: chapterRows } = await supabase
    .from("chapters")
    .select("id, title, order")
    .eq("course_id", leading.courseId)
    .eq("status", "published")
    .order("order", { ascending: true })

  const chapters = chapterRows ?? []
  if (chapters.length === 0) {
    return { ...empty, courseTitle: leading.courseTitle, cumulativeExpected }
  }

  const chapterIds = chapters.map((ch) => ch.id)

  const [{ data: slideRows }, { data: sessionRows }] = await Promise.all([
    supabase.from("chapter_slides").select("chapter_id, text_content").in("chapter_id", chapterIds),
    supabase
      .from("sessions")
      .select("chapter_id, status, created_at, completed_at")
      .eq("student_id", studentId)
      .in("chapter_id", chapterIds),
  ])

  const durationsMinutes = (sessionRows ?? [])
    .filter((s) => s.status === "completed" && s.completed_at)
    .map(
      (s) =>
        (new Date(s.completed_at as string).getTime() -
          new Date(s.created_at as string).getTime()) /
        60_000,
    )
    .filter((minutes) => minutes > 0)
  const avgMinutesPerSession =
    durationsMinutes.length > 0
      ? Math.round(durationsMinutes.reduce((a, b) => a + b, 0) / durationsMinutes.length)
      : null

  // Reflection count per chapter — real, reuses countReflectionBlocks (§3.3,
  // "reuso direto de countReflectionPossibleSlides, só agrupado por capítulo").
  const reflectionsByChapter = new Map<string, number>()
  for (const slide of slideRows ?? []) {
    if (!slide.chapter_id) continue
    if (countReflectionBlocks(slide.text_content) <= 0) continue
    reflectionsByChapter.set(
      slide.chapter_id,
      (reflectionsByChapter.get(slide.chapter_id) ?? 0) + 1,
    )
  }

  // Same completed/continue predicate as api/analytics/student/route.ts.
  const completedChapterIds = new Set(
    (sessionRows ?? []).filter((s) => s.status === "completed").map((s) => s.chapter_id),
  )
  const activeSession = (sessionRows ?? []).find((s) => s.status === "active")
  const continueChapterId = activeSession
    ? activeSession.chapter_id
    : (chapters.find((ch) => !completedChapterIds.has(ch.id))?.id ?? null)

  const moduleJourney = computeModuleJourney(
    chapters.map((ch) => ({
      chapterId: ch.id,
      title: ch.title,
      order: ch.order,
      reflectionsExpected: reflectionsByChapter.get(ch.id) ?? 0,
    })),
    completedChapterIds,
    continueChapterId,
    leading.startDate,
    leading.targetCompletionDate,
  )

  const currentChapter =
    chapters.find((ch) => ch.id === continueChapterId) ?? chapters[chapters.length - 1] ?? null

  // "Realizado da semana" — same status='completed' predicate computeMetricBlock
  // already uses (§3.2 "regra de não-duplicação"), filtered to THIS week + course.
  const { weekStart, weekEnd } = getCalendarWeekRange(new Date())
  const realizedSessionsThisWeek = (sessionRows ?? []).filter(
    (s) =>
      s.status === "completed" &&
      new Date(s.created_at as string) >= weekStart &&
      new Date(s.created_at as string) <= weekEnd,
  ).length

  const { data: reflectionRows } = await supabase
    .from("slide_reflections")
    .select("created_at, slide_id, chapter_slides!inner(chapter_id)")
    .eq("student_id", studentId)
    .in("chapter_slides.chapter_id", chapterIds)
  const realizedReflectionsThisWeek = (reflectionRows ?? []).filter((r) => {
    const t = new Date(r.created_at as string)
    return t >= weekStart && t <= weekEnd
  }).length

  const weeklyComparison = computeWeeklyComparison(
    choice,
    realizedSessionsThisWeek,
    realizedReflectionsThisWeek,
    weekStart,
    weekEnd,
  )

  return {
    courseTitle: leading.courseTitle,
    currentChapterTitle: currentChapter?.title ?? null,
    currentChapterOrder: currentChapter?.order ?? null,
    moduleJourney,
    weeklyComparison,
    avgMinutesPerSession,
    cumulativeExpected,
  }
}

/**
 * SH-3.3 R5 (Hugo 2026-07-21) — assembles the real `StudyPlanDiagnostic` from
 * the student's own "Meu ritmo" subject block + their leading enrollment
 * context. Extracted from `meu-plano/page.tsx` (was inline there) so the
 * "Comparativo com o Plano" toggle's API route builds the SAME diagnostic —
 * one formula, two callers, never two.
 */
export function buildStudyPlanDiagnostic(
  subject: StudentHomeSubject,
  leading: LeadingEnrollmentContext | null,
): StudyPlanDiagnostic {
  return {
    progressNow: subject.progressPct,
    progressTarget: subject.expectedProgressPct ?? null,
    sessionsDoneCount: subject.interactions,
    reflDoneCount: subject.reflections,
    reflTotal: subject.reflectionsMax ?? null,
    reflNow:
      subject.reflectionsMax && subject.reflectionsMax > 0
        ? (subject.reflections / subject.reflectionsMax) * 100
        : null,
    reflTarget: subject.expectedProgressPct ?? null,
    daysLeft: leading?.daysLeft ?? null,
    weeksLeft: leading ? Math.max(1, Math.round(leading.daysLeft / 7)) : null,
  }
}

/** Response shape of `/api/analytics/plan-dashboard` — the same real data
 *  `/meu-plano` reads, packaged for the "Comparativo com a Jornada" toggle. */
export interface PlanComparisonResponse {
  diagnostic: StudyPlanDiagnostic | null
  planDashboardData: PlanDashboardData | null
  classAvgProgressPct: number | null
  /**
   * EPIC-JORNADA (JRN-D, Hugo 2026-07-24) — há jornada PERSISTIDA (study_plans)
   * para o curso? Quando true, `planDashboardData.cumulativeExpected` já vem
   * REANCORADO em `plan.moduleDurations` (não no ritmo semanal default). Quando
   * false, o painel mostra o estado-convite honesto (nunca um número fake).
   */
  hasJourney: boolean
  /** Curso da jornada/contexto, para o CTA "Montar minha jornada" apontar ao
   *  /jornada?curso= certo. null quando não há contexto computável. */
  journeyCourseId: string | null
}
