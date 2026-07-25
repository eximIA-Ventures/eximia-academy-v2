// ---------------------------------------------------------------------------
// study-plan-dashboard — pure calculation engine for the "Meu Plano" ACTIVE
// dashboard + recalculate flow (SH-3.3, Hugo 2026-07-21)
// ---------------------------------------------------------------------------
// Sibling module to `study-plan-projection.ts` (NOT an edit of it — the SH-3.3
// story explicitly keeps that engine untouched). Ports the derivations from
// `docs/architecture/meu-plano-arquitetura-implementacao.md` §3.2 ("Planejado
// × Realizado" da semana) and §3.3 ("Sua jornada planejada" por módulo) into
// pure, testable functions. `recalculateWeeklyChoice` is a SIMPLIFIED,
// client-state-only version of the architecture's §3.4 formula (no
// `target_completion_date`-anchored persistence, no "at-risk" server state —
// those belong to the future Fatia 4/persistence slice).
//
// SCOPE BOUNDARY (SH-3.3): every function here is PURE — no fetch, no DB, no
// side effects. All real rows (chapters/slides/sessions/reflections) are
// queried server-side in `meu-plano/page.tsx` and passed in as plain data.
// ---------------------------------------------------------------------------

import type { StudyPlanChoice } from "./study-plan-projection"

/**
 * Illustrative cost weights from architecture §3.3 — a reflection costs 3x an
 * interaction (Rice: ~45min/reflection vs. a simple read). NOT a validated
 * number, same honesty status as `PT_PER_SESSION` in study-plan-projection.ts.
 */
export const INTERACTION_COST = 1
export const REFLECTION_COST = 3

const DAY_MS = 86_400_000

export type ModuleStatus = "done" | "doing" | "planned"

export interface ModuleJourneyChapterInput {
  chapterId: string
  title: string
  order: number
  /** Count of this chapter's slides that have ≥1 reflection prompt (real, from `countReflectionBlocks`). */
  reflectionsExpected: number
}

export interface ModuleJourneyItem {
  chapterId: string
  title: string
  order: number
  interactionsExpected: number
  reflectionsExpected: number
  status: ModuleStatus
  /** ISO date string, or null when `startDate`/`targetCompletionDate` aren't computable (never fabricated). */
  suggestedDeadline: string | null
}

/**
 * §3.3 — per-chapter journey: 1 interaction expected/chapter (convention already
 * used by `interactionsMax` elsewhere), real reflection count from the chapter's
 * slides, status derived from completed sessions (same predicate as
 * `api/analytics/student/route.ts`'s `completedChapters`/`continueChapterId`),
 * and a suggested deadline distributed proportionally to each chapter's COST
 * (reflection weighs REFLECTION_COST× an interaction) across the course window.
 */
export function computeModuleJourney(
  chapters: ModuleJourneyChapterInput[],
  completedChapterIds: ReadonlySet<string>,
  continueChapterId: string | null,
  startDate: Date | null,
  targetCompletionDate: Date | null,
): ModuleJourneyItem[] {
  const withCost = chapters.map((ch) => ({
    ...ch,
    cost: INTERACTION_COST * 1 + REFLECTION_COST * ch.reflectionsExpected,
  }))
  const totalCost = withCost.reduce((sum, ch) => sum + ch.cost, 0)
  const canProject = startDate != null && targetCompletionDate != null && totalCost > 0
  const totalMs = canProject
    ? (targetCompletionDate as Date).getTime() - (startDate as Date).getTime()
    : 0

  let cumulative = 0
  return withCost.map((ch) => {
    cumulative += ch.cost
    const status: ModuleStatus = completedChapterIds.has(ch.chapterId)
      ? "done"
      : ch.chapterId === continueChapterId
        ? "doing"
        : "planned"
    const suggestedDeadline = canProject
      ? new Date((startDate as Date).getTime() + (cumulative / totalCost) * totalMs).toISOString()
      : null
    return {
      chapterId: ch.chapterId,
      title: ch.title,
      order: ch.order,
      interactionsExpected: 1,
      reflectionsExpected: ch.reflectionsExpected,
      status,
      suggestedDeadline,
    }
  })
}

/** Forma de linha de `sessions` que o predicado de conclusão consome. Mantida em
 *  snake_case DE PROPÓSITO: é a linha crua do banco que os dois chamadores já
 *  têm em mãos, então a extração abaixo é verbatim, sem camada de mapeamento
 *  onde um bug pudesse se esconder. */
export interface ChapterSessionRow {
  chapter_id: string | null
  status: string | null
}

export interface ChapterCompletion {
  /** Capítulos com ≥1 sessão `status='completed'`. */
  completedChapterIds: Set<string>
  /** Capítulo do "continuar": a sessão ativa se houver, senão o primeiro capítulo
   *  ainda não concluído na ordem. null quando não há nada pendente. */
  continueChapterId: string | null
}

/**
 * EPIC-JORNADA (JRN-E, 2026-07-25) — predicado `completed`/`continue`,
 * EXTRAÍDO VERBATIM de `plan-dashboard-data.ts` (era inline lá, linhas 228-234)
 * para virar a fonte única dos DOIS chamadores que hoje precisam dele:
 *   1. `fetchPlanDashboardData` (o dashboard de /meu-plano e a API do gestor)
 *   2. `fetchJourneyCourseContext` (o progresso que alimenta o construtor da Jornada)
 *
 * Mesma disciplina que `buildStudyPlanDiagnostic` já documenta: *uma fórmula,
 * dois chamadores, nunca duas* (Constitution, Artigo IV — No Invention). Sem
 * esta extração, o construtor teria que reimplementar "o que conta como módulo
 * concluído" e divergiria silenciosamente do dashboard.
 *
 * Nenhuma mudança de comportamento: inclusive a borda em que existe sessão
 * ativa com `chapter_id` nulo é preservada (devolve null, NÃO cai no primeiro
 * capítulo pendente), exatamente como o código original fazia.
 */
export function computeChapterCompletion(
  sessions: readonly ChapterSessionRow[],
  chaptersInOrder: ReadonlyArray<{ id: string }>,
): ChapterCompletion {
  const completedChapterIds = new Set<string>()
  for (const s of sessions) {
    if (s.status === "completed" && s.chapter_id != null) completedChapterIds.add(s.chapter_id)
  }
  const activeSession = sessions.find((s) => s.status === "active")
  const continueChapterId = activeSession
    ? activeSession.chapter_id
    : (chaptersInOrder.find((ch) => !completedChapterIds.has(ch.id))?.id ?? null)
  return { completedChapterIds, continueChapterId }
}

export interface WeeklyComparison {
  weekStart: string
  weekEnd: string
  planned: { sessions: number; reflections: number }
  realized: { sessions: number; reflections: number }
  situation: "cumprido" | "pendente"
}

/**
 * §3.2 — calendar week (Monday 00:00 → Sunday 23:59), same "no explicit
 * timezone conversion" simplicity the rest of the codebase already uses
 * (`Date.now()` direct). `days` is Monday-first (index 0 = Monday), matching
 * `WEEKDAY_LABELS`/`StudyPlanChoice.days`.
 */
export function getCalendarWeekRange(now: Date): { weekStart: Date; weekEnd: Date } {
  const day = now.getDay() // 0=Sun..6=Sat
  const mondayOffset = day === 0 ? -6 : 1 - day
  const weekStart = new Date(now)
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(weekStart.getDate() + mondayOffset)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)
  return { weekStart, weekEnd }
}

/**
 * §3.2 — planned comes from the CURRENT `choice` (chosenDays × sessionsPerDay,
 * reflFocus ? chosenDays : 0 — identical formula to `computeStudyPlanProjection`,
 * not reimplemented differently). Realized is passed in as real counts (server
 * already scoped/filtered the `sessions`/`slide_reflections` rows by course +
 * week + `status='completed'`, same predicate `computeMetricBlock` uses).
 */
export function computeWeeklyComparison(
  choice: StudyPlanChoice,
  realizedSessions: number,
  realizedReflections: number,
  weekStart: Date,
  weekEnd: Date,
): WeeklyComparison {
  const chosenDays = choice.days.filter(Boolean).length
  const plannedSessions = chosenDays * choice.sessionsPerDay
  const plannedReflections = choice.reflFocus ? chosenDays : 0
  const situation: WeeklyComparison["situation"] =
    realizedSessions >= plannedSessions && realizedReflections >= plannedReflections
      ? "cumprido"
      : "pendente"
  return {
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    planned: { sessions: plannedSessions, reflections: plannedReflections },
    realized: { sessions: realizedSessions, reflections: realizedReflections },
    situation,
  }
}

export interface CumulativeExpected {
  sessions: number
  reflections: number
}

/**
 * SH-3.3 R7 (Hugo 2026-07-21) — "quanto já deveria ter sido realizado,
 * CUMULATIVAMENTE, até este ponto do período", dado o ritmo semanal do
 * `choice` e os dias decorridos desde o início do plano/matrícula
 * (`elapsedDays`, mesmo formato de `computeBehindAndProgress` em
 * engagement-triage.ts — `(now - createdAt) / 86_400_000`). Hugo corrigiu a
 * R6 anterior (`computeWeeklyComparison`/`getCalendarWeekRange`), que limitava
 * "Meu Plano"/"Realizado" à semana-calendário atual: a leitura certa é
 * cumulativa desde o início, não semanal. Função DISTINTA de
 * `computeWeeklyComparison` (que continua calculando só a semana corrente,
 * usada pelo checklist "Meu plano da semana" e pelo card de ajuste sugerido) —
 * nenhuma das duas reimplementa a outra.
 */
export function computeCumulativeExpected(
  choice: StudyPlanChoice,
  elapsedDays: number,
): CumulativeExpected {
  const chosenDays = choice.days.filter(Boolean).length
  const plannedSessionsPerWeek = chosenDays * choice.sessionsPerDay
  const plannedReflectionsPerWeek = choice.reflFocus ? chosenDays : 0
  const weeksElapsed = Math.max(0, elapsedDays) / 7
  return {
    sessions: Math.round(weeksElapsed * plannedSessionsPerWeek),
    reflections: Math.round(weeksElapsed * plannedReflectionsPerWeek),
  }
}

/**
 * EPIC-JORNADA (JRN-D, Hugo 2026-07-24) — "quanto já deveria ter sido realizado,
 * CUMULATIVAMENTE, até este ponto" derivado da JORNADA PERSISTIDA (os prazos por
 * módulo que o ALUNO definiu), não mais do ritmo semanal `DEFAULT_STUDY_PLAN_CHOICE`.
 * Fonte do "combinado" muda; a forma (`CumulativeExpected`) é REUSADA — o
 * comparativo da home (`buildPlanRows` em plan-comparison-panel.tsx) consome o
 * mesmo shape sem mudar.
 *
 * Regra: cada módulo i tem janela [início_i, fim_i) na timeline (início_i =
 * startDate + soma das durações anteriores; fim_i = início_i + durations[i]).
 * A fração decorrida da janela do módulo (clamp 0..1) pondera os itens ESPERADOS
 * daquele módulo — 1 interação/módulo (convenção SH-3.x) e N reflexões reais.
 * Somado e arredondado, dá o esperado cumulativo suave até agora. DISTINTA de
 * `computeCumulativeExpected` (semanal): nenhuma reimplementa a outra. PURA,
 * `nowMs` por parâmetro (sem Date.now() escondido), testável.
 */
export function computeJourneyCumulativeExpected(
  moduleDurations: number[],
  modules: ReadonlyArray<{ interactionsExpected: number; reflectionsExpected: number }>,
  startDateIso: string,
  nowMs: number,
): CumulativeExpected {
  const startMs = new Date(startDateIso).getTime()
  if (Number.isNaN(startMs) || moduleDurations.length === 0) {
    return { sessions: 0, reflections: 0 }
  }
  let sessions = 0
  let reflections = 0
  let cursorMs = startMs
  for (let i = 0; i < moduleDurations.length; i++) {
    const durationDays = Math.max(0, moduleDurations[i] ?? 0)
    const windowMs = durationDays * DAY_MS
    const meta = modules[i]
    const interactions = meta?.interactionsExpected ?? 1
    const refl = meta?.reflectionsExpected ?? 0
    // fração decorrida da janela do módulo (0 antes de começar, 1 após o fim).
    const fraction =
      windowMs > 0
        ? Math.min(1, Math.max(0, (nowMs - cursorMs) / windowMs))
        : nowMs >= cursorMs
          ? 1
          : 0
    sessions += fraction * interactions
    reflections += fraction * refl
    cursorMs += windowMs
  }
  return { sessions: Math.round(sessions), reflections: Math.round(reflections) }
}

/**
 * §3.4 (simplified, client-state-only) — "Recalcular automaticamente".
 * Redistributes this week's deficit across the remaining weeks by intensifying
 * the ALREADY-chosen days first (P1: implementation intention is anchored to
 * specific days, changing habit's days costs more than intensifying it), and
 * only adds a new day when the per-day teto (5 sessions/day, the same cap
 * `meu-plano-client.tsx` already enforces) would be exceeded. Pure, local
 * state only — no `target_completion_date` persistence, no "at-risk" server
 * state (those are the future Fatia 4, out of this story's scope).
 */
export function recalculateWeeklyChoice(
  choice: StudyPlanChoice,
  weeklyComparison: WeeklyComparison,
  weeksLeft: number | null,
): StudyPlanChoice {
  const deficitSessions = Math.max(
    0,
    weeklyComparison.planned.sessions - weeklyComparison.realized.sessions,
  )
  const chosenDays = choice.days.filter(Boolean).length
  if (deficitSessions <= 0 || chosenDays === 0) return choice

  const weeksRemaining = weeksLeft != null ? Math.max(1, weeksLeft - 1) : 1
  const extraPerWeek = Math.ceil(deficitSessions / weeksRemaining)
  const rawSessionsPerDay = choice.sessionsPerDay + Math.ceil(extraPerWeek / chosenDays)

  if (rawSessionsPerDay <= 5) {
    return { ...choice, sessionsPerDay: rawSessionsPerDay }
  }

  // Teto de 5/dia estourado: absorve o excedente adicionando o dia não-escolhido
  // mais próximo dos dias já ativos, em vez de violar o teto do produto.
  const selectedIdx: number[] = []
  const unselectedIdx: number[] = []
  choice.days.forEach((on, i) => (on ? selectedIdx : unselectedIdx).push(i))
  const nextDays = [...choice.days]
  if (unselectedIdx.length > 0 && selectedIdx.length > 0) {
    const nearest = unselectedIdx.reduce((best, idx) => {
      const dist = Math.min(...selectedIdx.map((s) => Math.abs(s - idx)))
      const bestDist = Math.min(...selectedIdx.map((s) => Math.abs(s - best)))
      return dist < bestDist ? idx : best
    }, unselectedIdx[0])
    nextDays[nearest] = true
  }
  return { ...choice, sessionsPerDay: 5, days: nextDays }
}
