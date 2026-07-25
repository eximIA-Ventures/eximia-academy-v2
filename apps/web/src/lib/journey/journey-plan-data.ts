// ---------------------------------------------------------------------------
// EPIC-JORNADA — Camada de dados SSR (contrato §6). Read-only. REUSA
// fetchLeadingEnrollmentContext e o padrão de query de fetchPlanDashboardData
// (plan-dashboard-data.ts) — não os reescreve. Degrada graciosamente quando a
// jornada não existe OU quando a migration study_plans ainda não foi aplicada.
// ---------------------------------------------------------------------------

import { fetchLeadingEnrollmentContext } from "@/lib/analytics/plan-dashboard-data"
import { countReflectionBlocks } from "@/lib/analytics/reflection-potential"
import {
  computeChapterCompletion,
  computeModuleJourney,
} from "@/lib/analytics/study-plan-dashboard"
import type { getAuthProfile } from "@/lib/auth"
import { logInfraError } from "@/lib/journey/graceful-errors"
import { UNTOUCHED_MODULE_PROGRESS, buildModuleProgress } from "./module-progress"
import {
  alignDurationsToChapters,
  cohortDeadlineDate,
  remainingWindowDaysBetween,
} from "./plan-math"
import type {
  JourneyBaseline,
  JourneyCourseContext,
  JourneyModuleDuration,
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
 * Contexto do curso do aluno (deadlines + módulos ordenados). null na mesma
 * condição que fetchLeadingEnrollmentContext (nenhuma enrollment com deadline
 * computável). Read-only.
 *
 * JRN-D (Hugo 2026-07-24) — `courseId` opcional: ancora o contexto NAQUELE curso
 * (a Jornada opera por-curso agora). Ausente → curso líder (comportamento
 * original, inalterado).
 */
export async function fetchJourneyCourseContext(
  supabase: AuthedSupabase,
  studentId: string,
  courseId?: string,
): Promise<JourneyCourseContext | null> {
  const leading = await fetchLeadingEnrollmentContext(supabase, studentId, courseId)
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

  // Reflexões ESPERADAS (slides com bloco de reflexão) + progresso REAL do
  // aluno. JRN-E: as três leituras abaixo são o que faltava para o construtor
  // saber onde o aluno realmente está.
  const reflectionsByChapter = new Map<string, number>()
  const sessionsDoneByChapter = new Map<string, number>()
  const reflectionsDoneByChapter = new Map<string, number>()
  let sessionRows: { chapter_id: string | null; status: string | null }[] = []

  if (chapterIds.length > 0) {
    const [{ data: slideRows }, sessionsRes, reflectionsRes] = await Promise.all([
      supabase
        .from("chapter_slides")
        .select("chapter_id, text_content")
        .in("chapter_id", chapterIds),
      supabase
        .from("sessions")
        .select("chapter_id, status")
        .eq("student_id", studentId)
        .in("chapter_id", chapterIds),
      supabase
        .from("slide_reflections")
        .select("slide_id, chapter_slides!inner(chapter_id)")
        .eq("student_id", studentId)
        .in("chapter_slides.chapter_id", chapterIds),
    ])

    for (const slide of slideRows ?? []) {
      if (!slide.chapter_id) continue
      if (countReflectionBlocks(slide.text_content) <= 0) continue
      reflectionsByChapter.set(
        slide.chapter_id,
        (reflectionsByChapter.get(slide.chapter_id) ?? 0) + 1,
      )
    }

    sessionRows = (sessionsRes.data ?? []) as typeof sessionRows
    for (const s of sessionRows) {
      // Mesmo predicado `status='completed'` do resto do produto — aqui só
      // CONTANDO por capítulo; quem decide "módulo concluído" é
      // computeChapterCompletion, logo abaixo.
      if (s.status !== "completed" || !s.chapter_id) continue
      sessionsDoneByChapter.set(s.chapter_id, (sessionsDoneByChapter.get(s.chapter_id) ?? 0) + 1)
    }

    for (const row of reflectionsRes.data ?? []) {
      const joined = (row as { chapter_slides?: { chapter_id?: string | null } | null })
        .chapter_slides
      const chapterId = joined?.chapter_id
      if (!chapterId) continue
      reflectionsDoneByChapter.set(chapterId, (reflectionsDoneByChapter.get(chapterId) ?? 0) + 1)
    }
  }

  // Estado por módulo pelo motor EXISTENTE — done/doing/planned NUNCA é
  // rederivado aqui (Artigo IV). O predicado de conclusão é o mesmo que
  // fetchPlanDashboardData usa, agora compartilhado.
  const { completedChapterIds, continueChapterId } = computeChapterCompletion(sessionRows, chapters)
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
  const progressByChapter = buildModuleProgress(
    moduleJourney,
    sessionsDoneByChapter,
    reflectionsDoneByChapter,
  )

  const modules: JourneyModuleMeta[] = chapters.map((ch) => ({
    chapterId: ch.id,
    title: ch.title,
    order: ch.order,
    interactionsExpected: 1,
    reflectionsExpected: reflectionsByChapter.get(ch.id) ?? 0,
    // Fallback honesto (nunca um "done" fabricado) — inalcançável enquanto
    // moduleJourney vier dos MESMOS `chapters`, mas o tipo é obrigatório e não
    // existe um `progress` "vazio" implícito.
    progress: progressByChapter.get(ch.id) ?? UNTOUCHED_MODULE_PROGRESS,
  }))

  // Prazos de coorte em DATA ABSOLUTA, pela mesma aritmética que a escrita usa
  // (cohortDeadlineDate) — a tela e o banco têm de produzir a mesma data.
  const startDate = toIsoDate(leading.startDate)
  const cohortDeadline = cohortDeadlineDate(startDate, finalDeadlineDays)
  const planningAnchorDate = toIsoDate(new Date())

  return {
    courseId: leading.courseId,
    courseTitle: leading.courseTitle,
    startDate,
    finalDeadlineDays,
    managerDeadlineDays,
    modules,
    cohortDeadlineDate: cohortDeadline,
    cohortManagerDeadlineDate:
      managerDeadlineDays != null ? cohortDeadlineDate(startDate, managerDeadlineDays) : null,
    // D2 — o que RESTA é replanejado a partir de HOJE, nunca do passado.
    planningAnchorDate,
    remainingWindowDays: remainingWindowDaysBetween(planningAnchorDate, cohortDeadline),
  }
}

/**
 * JRN-E (D6) — `study_plans.module_durations` passa a guardar
 * `JourneyModuleDuration[]` (ancorado por capítulo). A coluna é `jsonb`, então
 * as duas formas convivem sem DDL, e este parser lê AMBAS:
 *
 * - forma nova (`[{chapterId, days}]`) → verdade ancorada, projetada por
 *   `alignDurationsToChapters` na ordem publicada de HOJE
 * - forma antiga (`number[]` posicional) → lida na posição e RE-ANCORADA nos
 *   capítulos atuais, para que a próxima escrita já saia na forma nova
 *
 * Sem `chapterIdsInOrder` (chamador sem contexto de curso computável) o array
 * ancorado degrada para vazio e a projeção devolve o que foi lido — honesto,
 * nunca uma âncora inventada.
 */
export function parsePersistedDurations(
  raw: unknown,
  chapterIdsInOrder: readonly string[],
): { byChapter: JourneyModuleDuration[]; projected: number[] } {
  const list = Array.isArray(raw) ? raw : []
  const isAnchored = list.some(
    (e) => typeof e === "object" && e !== null && "chapterId" in (e as object),
  )

  if (isAnchored) {
    const byChapter = list
      .filter((e): e is JourneyModuleDuration => typeof e === "object" && e !== null)
      .map((e) => ({ chapterId: String(e.chapterId), days: Number(e.days) }))
      .filter((e) => e.chapterId !== "undefined" && Number.isFinite(e.days))
    return {
      byChapter,
      projected: chapterIdsInOrder.length
        ? alignDurationsToChapters(byChapter, chapterIdsInOrder)
        : byChapter.map((e) => e.days),
    }
  }

  const positional = list.map((d) => (Number.isFinite(Number(d)) ? Number(d) : 0))
  const byChapter = chapterIdsInOrder.map((chapterId, i) => ({
    chapterId,
    days: positional[i] ?? 0,
  }))
  return {
    byChapter,
    projected: chapterIdsInOrder.length ? byChapter.map((e) => e.days) : positional,
  }
}

/** Lê o snapshot do ponto de partida. null quando ausente (jornada anterior ao
 *  JRN-E) ou quando a coluna ainda não existe no banco — nunca fabricado. */
export function parseBaseline(raw: unknown): JourneyBaseline | null {
  if (typeof raw !== "object" || raw === null) return null
  const b = raw as Partial<JourneyBaseline>
  if (typeof b.capturedAt !== "string") return null
  return {
    capturedAt: b.capturedAt,
    progressPct: Number(b.progressPct) || 0,
    sessionsDone: Number(b.sessionsDone) || 0,
    reflectionsDone: Number(b.reflectionsDone) || 0,
    completedChapterIds: Array.isArray(b.completedChapterIds)
      ? b.completedChapterIds.map(String)
      : [],
  }
}

/** Mapeia uma row snake_case de study_plans para o JourneyPlan do contrato.
 *  (supabase.ts ainda não regenerado — row tipada como Record até lá.)
 *
 *  JRN-E — exportada: `actions.ts` usa ESTE mapper em vez de manter um segundo,
 *  para que leitura e escrita nunca divirjam na forma dos campos novos. */
export function mapRowToJourneyPlan(
  row: Record<string, unknown>,
  chapterIdsInOrder: readonly string[] = [],
): JourneyPlan {
  const prefsRaw = (row.preferences ?? {}) as Partial<JourneyPreferences>
  const durations = parsePersistedDurations(row.module_durations, chapterIdsInOrder)
  const startDate = toIsoDate(row.start_date as string)
  return {
    moduleDurationsByChapter: durations.byChapter,
    // Jornada anterior ao JRN-E não tem âncora de replanejamento: degrada para
    // `startDate`, que era a única âncora existente quando ela foi gravada.
    planningAnchorDate: row.recalculated_at ? toIsoDate(row.recalculated_at as string) : startDate,
    baseline: parseBaseline(row.baseline),
    id: String(row.id),
    enrollmentId: String(row.enrollment_id),
    studentId: String(row.student_id),
    courseId: String(row.course_id),
    tenantId: String(row.tenant_id),
    status: row.status as JourneyPlan["status"],
    // PROJEÇÃO derivada da verdade ancorada, na ordem publicada de hoje. Segue
    // `number[]` de propósito: dashboard-model, page.tsx e a API do gestor já
    // consomem esta forma e NÃO mudam por causa da ancoragem.
    moduleDurations: durations.projected,
    preset: (row.preset as number | null) ?? null,
    preferences: {
      cascade: prefsRaw.cascade ?? true,
      unit: prefsRaw.unit ?? "w",
    },
    startDate,
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
 *
 * JRN-D (Hugo 2026-07-24) — `courseId` opcional: quando dado, contexto E jornada
 * ativa são NAQUELE curso (uma jornada ativa por matrícula; course→matrícula é
 * 1:1 por aluno, então `maybeSingle` continua seguro). Ausente → curso líder +
 * a jornada ativa mais recente (comportamento original preservado).
 */
export async function fetchJourneyState(
  supabase: AuthedSupabase,
  studentId: string,
  courseId?: string,
): Promise<{ plan: JourneyPlan | null; context: JourneyCourseContext | null }> {
  const context = await fetchJourneyCourseContext(supabase, studentId, courseId)

  let plan: JourneyPlan | null = null
  try {
    let query = supabase
      .from("study_plans")
      .select("*")
      .eq("student_id", studentId)
      .eq("status", "active")
    // JRN-D — por-curso: filtra a jornada ativa daquele curso. Sem courseId, o
    // aluno pode ter jornadas em cursos distintos; pega a mais recente para não
    // estourar o maybeSingle (comportamento original com ≤1 jornada é idêntico).
    if (courseId) query = query.eq("course_id", courseId)
    else query = query.order("updated_at", { ascending: false }).limit(1)
    const { data, error } = await query.maybeSingle()
    // error (ex.: tabela fora do schema cache / relation ausente) → log server-
    // side para diagnóstico e cai para o fallback (plan:null), a UI não quebra.
    if (error) logInfraError("fetchJourneyState", error)
    // JRN-E — a ordem publicada de HOJE é o que realinha as durações ancoradas
    // por capítulo (um capítulo despublicado não desliza mais os vizinhos).
    else if (data)
      plan = mapRowToJourneyPlan(
        data as Record<string, unknown>,
        (context?.modules ?? []).map((m) => m.chapterId),
      )
  } catch (e) {
    logInfraError("fetchJourneyState:throw", e)
    plan = null
  }

  return { plan, context }
}

/**
 * JRN-D (Hugo 2026-07-24) — conjunto de enrollment_ids do aluno que têm uma
 * jornada ativa persistida, para o hub "Minhas jornadas" marcar CADA card
 * corretamente mesmo com jornadas em múltiplos cursos (fetchJourneyState só
 * traz uma). Fallback gracioso: tabela ausente / erro → Set vazio (nenhum card
 * marcado como ativo, a UI degrada para "sem jornada · monte a sua").
 */
export async function fetchActiveJourneyEnrollmentIds(
  supabase: AuthedSupabase,
  studentId: string,
): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from("study_plans")
      .select("enrollment_id")
      .eq("student_id", studentId)
      .eq("status", "active")
    if (error) {
      logInfraError("fetchActiveJourneyEnrollmentIds", error)
      return new Set()
    }
    return new Set((data ?? []).map((r) => String((r as { enrollment_id: unknown }).enrollment_id)))
  } catch (e) {
    logInfraError("fetchActiveJourneyEnrollmentIds:throw", e)
    return new Set()
  }
}
