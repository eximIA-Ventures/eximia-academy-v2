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
import {
  type ModuleJourneyItem,
  type WeeklyComparison,
  computeJourneyCumulativeExpected,
} from "@/lib/analytics/study-plan-dashboard"
import type { StudyPlanDiagnostic } from "@/lib/analytics/study-plan-projection"
import { computeRemainingWindow, moduleEndDatesAnchored } from "@/lib/journey/plan-math"
import type { JourneyBaseline, JourneyCourseContext, JourneyPlan } from "@/lib/journey/types"

const MS_PER_DAY = 86_400_000
const SESSIONS_PER_WEEK = 3 // Seg · Qua · Sex — combinado canônico (SPEC §2.1)

// ---------------------------------------------------------------------------
// JRN-E (Trilha E3) — baseline: a jornada mede o DELTA desde a montagem.
// ---------------------------------------------------------------------------
// Decisão D3 do Hugo (2026-07-25): "combinado × realizado" é o que aconteceu
// DESDE que o aluno montou a jornada. O progresso anterior existe, é mostrado à
// parte como PONTO DE PARTIDA, e nunca é somado ao mérito do plano — senão o
// aluno que entra com 50% nasce eternamente adiantado e a Leitura da IA vira
// elogio automático.
// ---------------------------------------------------------------------------

/** JRN-E — fotografia do progresso no instante da montagem. Contexto, nunca
 *  mérito: não entra em nenhum número de desempenho da jornada. */
export interface JourneyStartingPoint {
  progressPct: number
  sessionsDone: number
  reflectionsDone: number
  modulesDone: number
  capturedAt: string
}

/** JRN-E — o que foi feito DEPOIS da montagem. É este o "realizado". */
export interface SinceJourney {
  progressPct: number
  sessionsDone: number
  reflectionsDone: number
}

/**
 * Delta = lifetime − baseline, com piso 0 (contrato-progresso §8, fórmula
 * literal). `progressNow`/`sessionsDoneCount`/`reflDoneCount` são LIFETIME por
 * documentação do próprio motor (study-plan-projection.ts:47/56-59); sem esta
 * subtração o dashboard credita à jornada trabalho anterior a ela existir.
 * Pura e exportada para ser testável isoladamente.
 */
export function computeSinceJourney(
  diagnostic: Pick<StudyPlanDiagnostic, "progressNow" | "sessionsDoneCount" | "reflDoneCount">,
  baseline: JourneyBaseline | null,
): SinceJourney {
  return {
    progressPct: Math.max(0, diagnostic.progressNow - (baseline?.progressPct ?? 0)),
    sessionsDone: Math.max(0, diagnostic.sessionsDoneCount - (baseline?.sessionsDone ?? 0)),
    reflectionsDone: Math.max(0, diagnostic.reflDoneCount - (baseline?.reflectionsDone ?? 0)),
  }
}

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
  /** JRN-E — "% do combinado" DESDE A MONTAGEM: itens realizados na jornada /
   *  itens que a jornada pediu até agora. Item = 1 sessão ou 1 reflexão (as duas
   *  contagens reais do diagnóstico, comparadas contra o mesmo par que
   *  `computeJourneyCumulativeExpected` devolve). */
  ringPct: number
  ringOnTrack: boolean
  /** itens/semana realizados DESDE a âncora (null no dia 0). */
  donePerWeek: number | null
  /** itens/semana combinados desde a âncora (null no dia 0). */
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
  /** prazo REANCORADO na âncora de planejamento (o que o ALUNO definiu, a partir
   *  de HOJE). `null` em módulo concluído: concluído não tem prazo futuro. */
  deadlineIso: string | null
  interactionsExpected: number
  reflectionsExpected: number
  status: ModuleJourneyItem["status"]
  /** JRN-E — módulo já concluído: não consome janela futura nem pede tempo.
   *  Opcional no TIPO apenas para não quebrar fixtures fora do território E3
   *  (ver Change Log da JRN-E); `buildDashboardModel` SEMPRE popula. */
  frozen?: boolean
}

export interface DashboardModel {
  courseTitle: string
  moduleCount: number
  totalItems: number
  startDateIso: string
  managerDeadlineIso: string | null
  finalDeadlineIso: string | null
  /** JRN-E — dia 0 do DELTA: nada realizado DESDE a montagem. Um aluno que
   *  chegou com 50% e não avançou nada desde então é dia 0, não "adiantado". */
  isDayZero: boolean
  isCompleted: boolean
  /** progresso do CURSO (%) — diagnostic.progressNow, lifetime. É estado, não
   *  mérito da jornada: o mérito está em `sinceJourney.progressPct`. */
  progressPct: number
  /** esperado (%) — diagnostic.progressTarget (null quando sem deadline). */
  expectedPct: number | null
  sessionsPerWeek: number
  /** sessões concluídas no CURSO (lifetime). O que a jornada produziu está em
   *  `sinceJourney.sessionsDone`. */
  sessionsDone: number
  // --- JRN-E, aditivo ------------------------------------------------------
  // Opcionais no TIPO (nunca na prática: `buildDashboardModel` sempre popula).
  // Motivo registrado no Change Log da JRN-E: torná-los obrigatórios forçaria
  // editar `_components/hub/__tests__/journey-shell.test.tsx`, que o AC-G2 exige
  // INALTERADO e está fora do território da Trilha E3.
  /** Ponto de partida — exibido À PARTE, jamais somado ao realizado. */
  startingPoint?: JourneyStartingPoint | null
  /** O realizado da jornada: lifetime − baseline, piso 0. */
  sinceJourney?: SinceJourney
  /** Âncora do planejamento do que resta (ISO). */
  anchorDateIso?: string
  /** Dias corridos desde a âncora (≥ 0). */
  daysSinceAnchor?: number
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

  // --- JRN-E: baseline, delta e âncora -------------------------------------
  const baseline = plan.baseline ?? null
  const sinceJourney = computeSinceJourney(diagnostic, baseline)
  const startingPoint: JourneyStartingPoint | null = baseline
    ? {
        progressPct: baseline.progressPct,
        sessionsDone: baseline.sessionsDone,
        reflectionsDone: baseline.reflectionsDone,
        modulesDone: baseline.completedChapterIds.length,
        capturedAt: baseline.capturedAt,
      }
    : null
  const anchorDateIso = plan.planningAnchorDate
  const daysSinceAnchor = Math.max(
    0,
    Math.floor((nowMs - new Date(anchorDateIso).getTime()) / MS_PER_DAY),
  )

  // Janela restante e prazos reancorados: as DUAS funções canônicas da Trilha E1
  // (contrato-progresso §5), consumidas, nunca reimplementadas aqui. A âncora é
  // a do planejamento do que resta (D2 — o que falta começa hoje), não o T0 da
  // matrícula; módulo frozen sai com `null`, porque concluído não tem prazo
  // futuro e fabricar uma data para ele seria mentir na timeline (AC-E3.5).
  const window = computeRemainingWindow(
    context.modules,
    plan.planningAnchorDate,
    context.cohortDeadlineDate,
  )
  const reanchored =
    plan.moduleDurations.length > 0 ? moduleEndDatesAnchored(plan.moduleDurations, window) : []

  // `frozen` ⟺ `status === "done"` (contrato-progresso §2): a flag vem do
  // contrato; o fallback por chapterId aplica a MESMA equivalência sobre o
  // status do motor canônico (computeModuleJourney) quando o zip por índice não
  // casa. Nenhuma regra nova de conclusão nasce nesta camada (Artigo IV).
  const frozenByChapter = new Map(context.modules.map((m) => [m.chapterId, m.progress.frozen]))

  // Zip moduleJourney (ordem = chapter.order) com o prazo reancorado por índice.
  // Fallback ao suggestedDeadline do motor quando o comprimento não casa.
  const journey = planDashboardData.moduleJourney
  const modules: DashModuleRow[] = journey.map((it, i) => {
    const frozen = frozenByChapter.get(it.chapterId) ?? it.status === "done"
    return {
      chapterId: it.chapterId,
      order: it.order,
      title: it.title,
      deadlineIso: frozen ? null : (reanchored[i] ?? it.suggestedDeadline),
      interactionsExpected: it.interactionsExpected,
      reflectionsExpected: it.reflectionsExpected,
      status: it.status,
      frozen,
    }
  })

  // O "combinado" da jornada é o que a jornada PEDIU: módulo já concluído não
  // pede nada. Zeramos a expectativa dos frozen e entregamos ao motor canônico
  // `computeJourneyCumulativeExpected` (study-plan-dashboard.ts:204) — mesma
  // fórmula do comparativo da home, ancorada aqui em `anchorDateIso`. Nenhuma
  // aritmética de "esperado até agora" é reimplementada nesta camada.
  const frozenSet = new Set(window.frozenIndices)
  const journeyModules = context.modules.map((m, i) =>
    frozenSet.has(i)
      ? { interactionsExpected: 0, reflectionsExpected: 0 }
      : {
          interactionsExpected: m.interactionsExpected,
          reflectionsExpected: m.reflectionsExpected,
        },
  )
  const combined = computeJourneyCumulativeExpected(
    plan.moduleDurations,
    journeyModules,
    anchorDateIso,
    nowMs,
  )
  const combinedUnits = combined.sessions + combined.reflections
  const doneUnits = sinceJourney.sessionsDone + sinceJourney.reflectionsDone
  const journeyTotalUnits = journeyModules.reduce(
    (sum, m) => sum + m.interactionsExpected + m.reflectionsExpected,
    0,
  )

  const progressPct = diagnostic.progressNow
  const expectedPct = diagnostic.progressTarget
  const sessionsDone = diagnostic.sessionsDoneCount
  const isCompleted =
    progressPct >= 100 || (modules.length > 0 && modules.every((m) => m.status === "done"))
  // Dia 0 honesto (JRN-E/AC-E3.3): nada realizado DESDE A MONTAGEM. Com o
  // lifetime, o aluno que monta a jornada no meio do curso nunca teria dia 0 —
  // ele abriria o dashboard com mérito que a jornada não produziu.
  const isDayZero = !isCompleted && sinceJourney.sessionsDone <= 0 && sinceJourney.progressPct <= 0

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
    // JRN-E/AC-E3.6: a Leitura da IA fala do que a JORNADA produziu. Passar o
    // lifetime aqui creditaria ao plano as sessões feitas antes dele existir.
    sessionsDone: sinceJourney.sessionsDone,
    startingPoint,
    daysSinceAnchor,
    moduleCount,
    finalDeadlineIso: plan.finalDeadlineDate,
    managerDeadlineIso: plan.managerDeadlineDate,
    nowMs,
  })

  const ritmo = buildRitmo({
    isDayZero,
    isCompleted,
    doneUnits,
    combinedUnits,
    journeyTotalUnits,
    anchorIso: anchorDateIso,
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
    startingPoint,
    sinceJourney,
    anchorDateIso,
    daysSinceAnchor,
  }
}

// --- Leitura da IA (4 estados, regras da demo) -----------------------------

function buildAiReading(a: {
  isDayZero: boolean
  isCompleted: boolean
  weekly: WeeklyComparison | null
  modules: DashModuleRow[]
  currentModule: { order: number; title: string; deadlineIso: string | null } | null
  /** JRN-E — sessões feitas DESDE a montagem (delta), nunca o lifetime. */
  sessionsDone: number
  startingPoint: JourneyStartingPoint | null
  daysSinceAnchor: number
  moduleCount: number
  finalDeadlineIso: string | null
  managerDeadlineIso: string | null
  nowMs: number
}): AiReading {
  // O primeiro passo é o primeiro módulo NÃO concluído — quem chega no meio do
  // curso não é mandado de volta ao módulo 1 (JRN-E).
  const first = a.modules.find((m) => m.frozen !== true && m.status !== "done") ?? a.modules[0]
  const sessLabel = a.sessionsDone === 1 ? "sessão feita" : "sessões feitas"

  if (a.isDayZero) {
    // zona (round 16): verde ≤ meta · âmbar entre meta e final.
    const zoneClause = zoneClauseOf(a.finalDeadlineIso, a.managerDeadlineIso, a.nowMs)
    // Ênfase RARA (round 13): 1 `strong` (o teto) + no máximo 1 `warn`.
    const read: TextRun[] = []
    if (a.startingPoint) {
      read.push({
        t: `Você chega com ${Math.round(a.startingPoint.progressPct)}% do curso concluído — esse é o seu ponto de partida, não avanço desta jornada. `,
      })
    }
    read.push({ t: `Sua jornada está de pé: ${a.moduleCount} módulos até ` })
    read.push({ t: fmtDatePtBR(a.finalDeadlineIso), strong: true })
    read.push({ t: `${zoneClause}, no ritmo de ${SESSIONS_PER_WEEK} sessões por semana.` })
    if (a.daysSinceAnchor >= 7) {
      // Honestidade acima de conforto: parado é parado, não "adiantado".
      read.push({
        t: ` Faz ${a.daysSinceAnchor} dias que você montou a jornada e nada foi registrado ainda.`,
        tone: "warn",
      })
      read.push({ t: " A primeira sessão é a que mais conta." })
    } else {
      read.push({ t: " Comece pequeno, a primeira sessão é a que mais conta." })
    }
    return {
      state: "day0",
      read,
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
    // Com baseline, "sua presença" é a da JORNADA. Zero sessões desde a
    // montagem não vira elogio disfarçado: vira o fato.
    const presence =
      a.sessionsDone > 0
        ? `Sua presença conta: ${a.sessionsDone} ${sessLabel}. `
        : "Desde que você montou a jornada, nenhuma sessão foi registrada. "
    return {
      state: "behind",
      read: [
        { t: presence },
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
        t: `${a.sessionsDone > 0 ? `: ${a.sessionsDone} ${sessLabel}, nenhum item para trás.` : ": nenhum item para trás nesta jornada."}${
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
  /** realizado DESDE a montagem, em itens reais (sessões + reflexões). */
  doneUnits: number
  /** combinado da jornada até agora, do motor canônico
   *  `computeJourneyCumulativeExpected` ancorado em `anchorIso`. */
  combinedUnits: number
  /** o que a jornada pede no total (frozen já excluídos). */
  journeyTotalUnits: number
  /** âncora do planejamento do que resta — NÃO o T0 da matrícula (AC-E3.4). */
  anchorIso: string
  managerDeadlineIso: string | null
  finalDeadlineIso: string | null
  weekly: WeeklyComparison | null
  nowMs: number
}): RitmoView {
  const ringPct =
    r.combinedUnits > 0 ? Math.min(100, Math.round((r.doneUnits / r.combinedUnits) * 100)) : 100
  const ringOnTrack = ringPct >= 100

  const weekSessions = r.weekly
    ? { planned: r.weekly.planned.sessions, realized: r.weekly.realized.sessions }
    : null

  if (r.isDayZero) {
    // combinado do plano: o que a jornada pede ÷ semanas da âncora até meta/final.
    const planWeeks =
      weeksUntil(r.managerDeadlineIso ?? r.finalDeadlineIso, new Date(r.anchorIso).getTime()) ??
      null
    const dayZeroPacePerWeek =
      planWeeks && planWeeks > 0 ? round1(r.journeyTotalUnits / planWeeks) : null
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

  // AC-E3.4 — semanas contadas da ÂNCORA, não do T0 da matrícula: dividir o
  // trabalho lifetime por ~0 semana de jornada inflava o ritmo em ~2x no
  // primeiro dia de quem monta a jornada no meio do curso.
  const wksElapsed = elapsedWeeks(r.anchorIso, r.nowMs)
  const donePerWeek = wksElapsed > 0 ? round1(r.doneUnits / wksElapsed) : null
  const combinedPerWeek = wksElapsed > 0 ? round1(r.combinedUnits / wksElapsed) : null

  // necessário/semana: mira a META do gestor enquanto não passou; depois o final.
  const remaining = Math.max(0, r.journeyTotalUnits - r.doneUnits)
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
