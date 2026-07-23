// ---------------------------------------------------------------------------
// EPIC-JORNADA (JRN-C.1, Trilha C) — Builder PURO do view-model do dashboard.
// ---------------------------------------------------------------------------
// Porta as REGRAS da demo aprovada (JARVIS/apps/jornada-demo/app.js: stats(),
// renderAiCard, renderPaceCard) para dados REAIS de produção, REANCORANDO o
// "esperado" no plan.moduleDurations persistido (contrato §6). Zero fabricação:
// todo número sai de um motor real (diagnostic/planDashboardData) ou de uma
// função pura compartilhada (plan-math); onde um valor não é computável, degrada
// para null/estado-vazio explícito — nunca um placeholder silencioso.
//
// SEM I/O e SEM Date.now() escondido: `nowMs` entra por parâmetro (mesma
// disciplina de plan-math.ts). Testável em vitest.
// ---------------------------------------------------------------------------

import type { PlanDashboardData } from "@/lib/analytics/plan-dashboard-data"
import type { ModuleJourneyItem, WeeklyComparison } from "@/lib/analytics/study-plan-dashboard"
import type { StudyPlanDiagnostic } from "@/lib/analytics/study-plan-projection"
import { moduleEndDates } from "@/lib/journey/plan-math"
import type { JourneyCourseContext, JourneyPlan } from "@/lib/journey/types"

const MS_PER_DAY = 86_400_000
const SESSIONS_PER_WEEK = 3 // Seg · Qua · Sex — combinado canônico (SPEC §2.1)

/** Um "run" de texto com ênfase controlada (evita dangerouslySetInnerHTML).
 *  A Leitura da IA usa ênfase RARA (round 13): no máx 1–2 `strong` por estado. */
export interface TextRun {
  t: string
  strong?: boolean
  tone?: "ok" | "warn"
}

export type AiState = "day0" | "onpace" | "behind" | "done"

export interface AiReading {
  state: AiState
  /** ordem: primeiro o que está BOM → depois o que ficou para trás → ação. */
  read: TextRun[]
  actionLabel: string
  action: TextRun[]
}

export type RitmoState = "day0" | "active" | "done"

export interface RitmoView {
  state: RitmoState
  /** "% do combinado" = itens realizados / itens esperados (inteiros). */
  ringPct: number
  ringOnTrack: boolean
  /** itens/semana realizados (null no dia 0). */
  donePerWeek: number | null
  /** itens/semana combinados até aqui (null no dia 0). */
  combinedPerWeek: number | null
  /** frase do necessário/semana mirando meta do gestor → prazo final (round 16). */
  needLabel: string | null
  /** combinado do plano no dia 0 ("~X itens/semana"). */
  dayZeroPacePerWeek: number | null
  /** esta semana: combinado × realizado em SESSÕES (o sinal semanal real que
   *  temos; histórico multi-semana é trabalho futuro — ver dashboard-model.test). */
  weekSessions: { planned: number; realized: number } | null
}

export interface DashModuleRow {
  chapterId: string
  order: number
  title: string
  /** prazo REANCORADO em plan.moduleDurations (o que o ALUNO definiu). */
  deadlineIso: string | null
  interactionsExpected: number
  reflectionsExpected: number
  status: ModuleJourneyItem["status"]
}

export interface DashboardModel {
  courseTitle: string
  moduleCount: number
  totalItems: number
  startDateIso: string
  managerDeadlineIso: string | null
  finalDeadlineIso: string | null
  isDayZero: boolean
  isCompleted: boolean
  /** realizado (%) — diagnostic.progressNow. */
  progressPct: number
  /** esperado (%) — diagnostic.progressTarget (null quando sem deadline). */
  expectedPct: number | null
  sessionsPerWeek: number
  sessionsDone: number
  currentModule: { order: number; title: string; deadlineIso: string | null } | null
  modules: DashModuleRow[]
  weekly: WeeklyComparison | null
  ai: AiReading
  ritmo: RitmoView
}

/** itens de um módulo = 1 conteúdo + 1 interação + N reflexões (SPEC §2.1). */
function itemsOfModule(m: { interactionsExpected: number; reflectionsExpected: number }): number {
  return 1 + m.interactionsExpected + m.reflectionsExpected
}

function fmtDatePtBR(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
}

/** semanas decorridas desde o início (≥ 0). */
function elapsedWeeks(startIso: string, nowMs: number): number {
  const startMs = new Date(startIso).getTime()
  return Math.max(0, (nowMs - startMs) / MS_PER_DAY / 7)
}

/** semanas até uma data-alvo a partir de now (pode ser ≤ 0 se já passou). */
function weeksUntil(targetIso: string | null, nowMs: number): number | null {
  if (!targetIso) return null
  return (new Date(targetIso).getTime() - nowMs) / MS_PER_DAY / 7
}

/**
 * Monta o view-model completo do dashboard a partir dos motores reais + do
 * plano persistido. Reancorra os prazos por módulo em `plan.moduleDurations`.
 */
export function buildDashboardModel(input: {
  plan: JourneyPlan
  context: JourneyCourseContext
  planDashboardData: PlanDashboardData
  diagnostic: StudyPlanDiagnostic
  nowMs: number
}): DashboardModel {
  const { plan, context, planDashboardData, diagnostic, nowMs } = input

  const courseTitle = context.courseTitle || planDashboardData.courseTitle || "Sua jornada"
  const moduleCount = context.modules.length
  const totalItems = context.modules.reduce((sum, m) => sum + itemsOfModule(m), 0)

  // Prazos REANCORADOS: datas de fim por módulo a partir do que o aluno definiu.
  const reanchored =
    plan.moduleDurations.length > 0 ? moduleEndDates(plan.startDate, plan.moduleDurations) : []

  // Zip moduleJourney (ordem = chapter.order) com o prazo reancorado por índice.
  // Fallback ao suggestedDeadline do motor quando o comprimento não casa.
  const journey = planDashboardData.moduleJourney
  const modules: DashModuleRow[] = journey.map((it, i) => ({
    chapterId: it.chapterId,
    order: it.order,
    title: it.title,
    deadlineIso: reanchored[i] ?? it.suggestedDeadline,
    interactionsExpected: it.interactionsExpected,
    reflectionsExpected: it.reflectionsExpected,
    status: it.status,
  }))

  const progressPct = diagnostic.progressNow
  const expectedPct = diagnostic.progressTarget
  const sessionsDone = diagnostic.sessionsDoneCount
  const isCompleted =
    progressPct >= 100 || (modules.length > 0 && modules.every((m) => m.status === "done"))
  // Dia 0 honesto: nada realizado ainda (nenhuma sessão, progresso zero).
  const isDayZero = !isCompleted && sessionsDone <= 0 && progressPct <= 0

  // Módulo atual: order/título do motor; prazo reancorado por match de order.
  const currentModule =
    planDashboardData.currentChapterOrder != null
      ? {
          order: planDashboardData.currentChapterOrder,
          title: planDashboardData.currentChapterTitle ?? "",
          deadlineIso:
            modules.find((m) => m.order === planDashboardData.currentChapterOrder)?.deadlineIso ??
            null,
        }
      : null

  const ai = buildAiReading({
    isDayZero,
    isCompleted,
    weekly: planDashboardData.weeklyComparison,
    modules,
    currentModule,
    sessionsDone,
    moduleCount,
    finalDeadlineIso: plan.finalDeadlineDate,
    managerDeadlineIso: plan.managerDeadlineDate,
    nowMs,
  })

  const ritmo = buildRitmo({
    isDayZero,
    isCompleted,
    progressPct,
    expectedPct,
    totalItems,
    startIso: plan.startDate,
    managerDeadlineIso: plan.managerDeadlineDate,
    finalDeadlineIso: plan.finalDeadlineDate,
    weekly: planDashboardData.weeklyComparison,
    nowMs,
  })

  return {
    courseTitle,
    moduleCount,
    totalItems,
    startDateIso: plan.startDate,
    managerDeadlineIso: plan.managerDeadlineDate,
    finalDeadlineIso: plan.finalDeadlineDate,
    isDayZero,
    isCompleted,
    progressPct,
    expectedPct,
    sessionsPerWeek: SESSIONS_PER_WEEK,
    sessionsDone,
    currentModule,
    modules,
    weekly: planDashboardData.weeklyComparison,
    ai,
    ritmo,
  }
}

// --- Leitura da IA (4 estados, regras da demo) -----------------------------

function buildAiReading(a: {
  isDayZero: boolean
  isCompleted: boolean
  weekly: WeeklyComparison | null
  modules: DashModuleRow[]
  currentModule: { order: number; title: string; deadlineIso: string | null } | null
  sessionsDone: number
  moduleCount: number
  finalDeadlineIso: string | null
  managerDeadlineIso: string | null
  nowMs: number
}): AiReading {
  const first = a.modules[0]
  const sessLabel = a.sessionsDone === 1 ? "sessão feita" : "sessões feitas"

  if (a.isDayZero) {
    // zona (round 16): verde ≤ meta · âmbar entre meta e final.
    const zoneClause = zoneClauseOf(a.finalDeadlineIso, a.managerDeadlineIso, a.nowMs)
    return {
      state: "day0",
      read: [
        { t: `Sua jornada está de pé: ${a.moduleCount} módulos até ` },
        { t: fmtDatePtBR(a.finalDeadlineIso), strong: true },
        {
          t: `${zoneClause}, no ritmo de ${SESSIONS_PER_WEEK} sessões por semana. Comece pequeno, a primeira sessão é a que mais conta.`,
        },
      ],
      actionLabel: "Comece por aqui",
      action: first
        ? [
            { t: "Estude o conteúdo de " },
            { t: `"${first.title}"`, strong: true },
            { t: ", o primeiro item da sua jornada." },
          ]
        : [{ t: "Abra o primeiro módulo da sua jornada." }],
    }
  }

  if (a.isCompleted) {
    return {
      state: "done",
      read: [
        { t: `Que jornada. Você concluiu os ${a.moduleCount} módulos` },
        { t: " — do combinado ao realizado.", tone: "ok" },
      ],
      actionLabel: "E agora",
      action: [
        { t: "Revisite suas " },
        { t: "reflexões", strong: true },
        { t: ", elas são o registro do que você aprendeu." },
      ],
    }
  }

  // "atrás": a semana corrente está pendente (déficit de sessão/reflexão).
  const behind = a.weekly != null && a.weekly.situation === "pendente"
  if (behind && a.weekly) {
    const gapSessions = Math.max(0, a.weekly.planned.sessions - a.weekly.realized.sessions)
    const gapRefl = Math.max(0, a.weekly.planned.reflections - a.weekly.realized.reflections)
    const what =
      gapRefl > 0
        ? `${gapRefl} ${gapRefl === 1 ? "reflexão" : "reflexões"} desta semana`
        : `${gapSessions} ${gapSessions === 1 ? "sessão" : "sessões"} desta semana`
    return {
      state: "behind",
      read: [
        { t: `Sua presença conta: ${a.sessionsDone} ${sessLabel}. ` },
        { t: `Ficou para trás ${what}`, tone: "warn" },
        { t: ", e é isso que separa você do combinado. Dá para recuperar hoje." },
      ],
      actionLabel: "Faça agora",
      action: a.currentModule
        ? [
            { t: "Retome o " },
            { t: `Módulo ${a.currentModule.order}`, strong: true },
            {
              t: `${a.currentModule.title ? ` · ${a.currentModule.title}` : ""}. São uns 10 minutos.`,
            },
          ]
        : [{ t: "Volte à sua próxima ação pendente. São uns 10 minutos." }],
    }
  }

  // "em dia" (default)
  return {
    state: "onpace",
    read: [
      { t: "Você está " },
      { t: "em dia", tone: "ok" },
      {
        t: `: ${a.sessionsDone} ${sessLabel}, nenhum item para trás.${
          a.currentModule
            ? ` O Módulo ${a.currentModule.order} fecha em ${fmtDatePtBR(a.currentModule.deadlineIso)}, siga no mesmo passo.`
            : ""
        }`,
      },
    ],
    actionLabel: "Próximo passo",
    action: a.currentModule
      ? [
          { t: "Siga no " },
          { t: `Módulo ${a.currentModule.order}`, strong: true },
          { t: `${a.currentModule.title ? ` · ${a.currentModule.title}` : ""}.` },
        ]
      : [{ t: "Continue de onde parou na sua jornada." }],
  }
}

/** cláusula de zona da conclusão vs meta/final (round 16). Defensiva: sem
 *  deadlines, retorna string vazia. */
function zoneClauseOf(finalIso: string | null, managerIso: string | null, _nowMs: number): string {
  if (!finalIso) return ""
  if (managerIso) return ", dentro da meta do seu gestor"
  return ", dentro do prazo do curso"
}

// --- Visão de Ritmo --------------------------------------------------------

function buildRitmo(r: {
  isDayZero: boolean
  isCompleted: boolean
  progressPct: number
  expectedPct: number | null
  totalItems: number
  startIso: string
  managerDeadlineIso: string | null
  finalDeadlineIso: string | null
  weekly: WeeklyComparison | null
  nowMs: number
}): RitmoView {
  const doneItems = Math.round((r.progressPct / 100) * r.totalItems)
  const expItems = r.expectedPct != null ? Math.floor((r.expectedPct / 100) * r.totalItems) : 0
  const ringPct = expItems > 0 ? Math.min(100, Math.round((doneItems / expItems) * 100)) : 100
  const ringOnTrack = ringPct >= 100

  const weekSessions = r.weekly
    ? { planned: r.weekly.planned.sessions, realized: r.weekly.realized.sessions }
    : null

  if (r.isDayZero) {
    // combinado do plano: total de itens ÷ semanas planejadas (start→meta/final).
    const planWeeks =
      weeksUntil(r.managerDeadlineIso ?? r.finalDeadlineIso, new Date(r.startIso).getTime()) ?? null
    const dayZeroPacePerWeek = planWeeks && planWeeks > 0 ? round1(r.totalItems / planWeeks) : null
    return {
      state: "day0",
      ringPct: 0,
      ringOnTrack: false,
      donePerWeek: null,
      combinedPerWeek: null,
      needLabel: null,
      dayZeroPacePerWeek,
      weekSessions,
    }
  }

  if (r.isCompleted) {
    return {
      state: "done",
      ringPct: 100,
      ringOnTrack: true,
      donePerWeek: null,
      combinedPerWeek: null,
      needLabel: null,
      dayZeroPacePerWeek: null,
      weekSessions,
    }
  }

  const wksElapsed = elapsedWeeks(r.startIso, r.nowMs)
  const donePerWeek = wksElapsed > 0 ? round1(doneItems / wksElapsed) : null
  const combinedPerWeek = wksElapsed > 0 ? round1(expItems / wksElapsed) : null

  // necessário/semana: mira a META do gestor enquanto não passou; depois o final.
  const remaining = Math.max(0, r.totalItems - doneItems)
  const metaW = weeksUntil(r.managerDeadlineIso, r.nowMs)
  const finalW = weeksUntil(r.finalDeadlineIso, r.nowMs)
  let needLabel: string | null = null
  if (metaW != null && metaW > 0) {
    needLabel = `para a meta do gestor (${fmtDatePtBR(r.managerDeadlineIso)}): ${round1(remaining / metaW)}/semana`
  } else if (finalW != null && finalW > 0) {
    needLabel = `para o prazo final (${fmtDatePtBR(r.finalDeadlineIso)}): ${round1(remaining / finalW)}/semana`
  } else if (r.finalDeadlineIso) {
    needLabel = `o prazo final (${fmtDatePtBR(r.finalDeadlineIso)}) chegou — ajuste em "Revisar jornada"`
  }

  return {
    state: "active",
    ringPct,
    ringOnTrack,
    donePerWeek,
    combinedPerWeek,
    needLabel,
    dayZeroPacePerWeek: null,
    weekSessions,
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Formatação pt-BR de data curta — exportada para os componentes de UI. */
export function formatJourneyDate(iso: string | null): string {
  return fmtDatePtBR(iso)
}
