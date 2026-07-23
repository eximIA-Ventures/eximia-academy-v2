// ---------------------------------------------------------------------------
// EPIC-JORNADA — Camada de dados SSR (contrato §6). Read-only. REUSA
// fetchLeadingEnrollmentContext e o padrão de query de fetchPlanDashboardData
// (plan-dashboard-data.ts) — não os reescreve. Degrada graciosamente quando a
// jornada não existe OU quando a migration study_plans ainda não foi aplicada.
// ---------------------------------------------------------------------------

import { fetchLeadingEnrollmentContext } from "@/lib/analytics/plan-dashboard-data"
import { countReflectionBlocks } from "@/lib/analytics/reflection-potential"
import type { getAuthProfile } from "@/lib/auth"
import type {
  JourneyCourseContext,
  JourneyModuleMeta,
  JourneyPlan,
  JourneyPreferences,
} from "./types"

type AuthedSupabase = Awaited<ReturnType<typeof getAuthProfile>>["supabase"]

function toIsoDate(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value)
  return d.toISOString().slice(0, 10)
}

/** Lê os dois prazos de coorte do curso, defensivo contra a coluna
 *  manager_deadline_days ainda não existir (migration não aplicada). */
async function fetchCourseDeadlines(
  supabase: AuthedSupabase,
  courseId: string,
): Promise<{ finalDeadlineDays: number | null; managerDeadlineDays: number | null }> {
  const withManager = await supabase
    .from("courses")
    .select("deadline_days, manager_deadline_days")
    .eq("id", courseId)
    .maybeSingle()

  if (!withManager.error && withManager.data) {
    const row = withManager.data as {
      deadline_days: number | null
      manager_deadline_days: number | null
    }
    return {
      finalDeadlineDays: row.deadline_days ?? null,
      managerDeadlineDays: row.manager_deadline_days ?? null,
    }
  }

  // Fallback: coluna manager_deadline_days ausente → lê só deadline_days.
  const base = await supabase
    .from("courses")
    .select("deadline_days")
    .eq("id", courseId)
    .maybeSingle()
  const row = (base.data as { deadline_days: number | null } | null) ?? null
  return { finalDeadlineDays: row?.deadline_days ?? null, managerDeadlineDays: null }
}

/**
 * Contexto do curso líder do aluno (deadlines + módulos ordenados). null na
 * mesma condição que fetchLeadingEnrollmentContext (nenhuma enrollment com
 * deadline computável). Read-only.
 */
export async function fetchJourneyCourseContext(
  supabase: AuthedSupabase,
  studentId: string,
): Promise<JourneyCourseContext | null> {
  const leading = await fetchLeadingEnrollmentContext(supabase, studentId)
  if (!leading) return null

  const { finalDeadlineDays, managerDeadlineDays } = await fetchCourseDeadlines(
    supabase,
    leading.courseId,
  )
  if (finalDeadlineDays == null) return null

  const { data: chapterRows } = await supabase
    .from("chapters")
    .select("id, title, order")
    .eq("course_id", leading.courseId)
    .eq("status", "published")
    .order("order", { ascending: true })

  const chapters = chapterRows ?? []
  const chapterIds = chapters.map((ch) => ch.id)

  const reflectionsByChapter = new Map<string, number>()
  if (chapterIds.length > 0) {
    const { data: slideRows } = await supabase
      .from("chapter_slides")
      .select("chapter_id, text_content")
      .in("chapter_id", chapterIds)
    for (const slide of slideRows ?? []) {
      if (!slide.chapter_id) continue
      if (countReflectionBlocks(slide.text_content) <= 0) continue
      reflectionsByChapter.set(
        slide.chapter_id,
        (reflectionsByChapter.get(slide.chapter_id) ?? 0) + 1,
      )
    }
  }

  const modules: JourneyModuleMeta[] = chapters.map((ch) => ({
    chapterId: ch.id,
    title: ch.title,
    order: ch.order,
    interactionsExpected: 1,
    reflectionsExpected: reflectionsByChapter.get(ch.id) ?? 0,
  }))

  return {
    courseId: leading.courseId,
    courseTitle: leading.courseTitle,
    startDate: toIsoDate(leading.startDate),
    finalDeadlineDays,
    managerDeadlineDays,
    modules,
  }
}

/** Mapeia uma row snake_case de study_plans para o JourneyPlan do contrato.
 *  (supabase.ts ainda não regenerado — row tipada como Record até lá.) */
function mapRowToJourneyPlan(row: Record<string, unknown>): JourneyPlan {
  const prefsRaw = (row.preferences ?? {}) as Partial<JourneyPreferences>
  return {
    id: String(row.id),
    enrollmentId: String(row.enrollment_id),
    studentId: String(row.student_id),
    courseId: String(row.course_id),
    tenantId: String(row.tenant_id),
    status: row.status as JourneyPlan["status"],
    moduleDurations: (row.module_durations as number[]) ?? [],
    preset: (row.preset as number | null) ?? null,
    preferences: {
      cascade: prefsRaw.cascade ?? true,
      unit: prefsRaw.unit ?? "w",
    },
    startDate: toIsoDate(row.start_date as string),
    finalDeadlineDate: row.final_deadline_date
      ? toIsoDate(row.final_deadline_date as string)
      : null,
    managerDeadlineDate: row.manager_deadline_date
      ? toIsoDate(row.manager_deadline_date as string)
      : null,
    recalculatedAt: (row.recalculated_at as string | null) ?? null,
    createdAt: (row.created_at as string) ?? "",
    updatedAt: (row.updated_at as string) ?? "",
  }
}

/**
 * Jornada ativa persistida + contexto, para o page.tsx roteador (C). Fallback
 * gracioso: se a tabela study_plans ainda não existir (migration não aplicada),
 * retorna { plan: null, context } sem quebrar — a UI atual continua funcionando.
 */
export async function fetchJourneyState(
  supabase: AuthedSupabase,
  studentId: string,
): Promise<{ plan: JourneyPlan | null; context: JourneyCourseContext | null }> {
  const context = await fetchJourneyCourseContext(supabase, studentId)

  let plan: JourneyPlan | null = null
  try {
    const { data, error } = await supabase
      .from("study_plans")
      .select("*")
      .eq("student_id", studentId)
      .eq("status", "active")
      .maybeSingle()
    // error com code de "relation does not exist" → tabela ausente → fallback
    if (!error && data) plan = mapRowToJourneyPlan(data as Record<string, unknown>)
  } catch {
    plan = null
  }

  return { plan, context }
}
