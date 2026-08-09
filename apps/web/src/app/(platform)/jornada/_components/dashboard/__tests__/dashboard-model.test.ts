import type { PlanDashboardData } from "@/lib/analytics/plan-dashboard-data"
import {
  type ModuleJourneyItem,
  type WeeklyComparison,
  computeJourneyCumulativeExpected,
} from "@/lib/analytics/study-plan-dashboard"
import type { StudyPlanDiagnostic } from "@/lib/analytics/study-plan-projection"
import { computeRemainingWindow, moduleEndDatesAnchored } from "@/lib/journey/plan-math"
import type {
  JourneyBaseline,
  JourneyCourseContext,
  JourneyModuleProgress,
  JourneyPlan,
} from "@/lib/journey/types"
import { describe, expect, it } from "vitest"
import { buildDashboardModel, computeSinceJourney } from "../dashboard-model"

const START = "2026-01-01"
const START_MS = new Date(START).getTime()
const DAY = 86_400_000

function progressOf(status: JourneyModuleProgress["status"]): JourneyModuleProgress {
  return {
    status,
    sessionsDone: status === "planned" ? 0 : 1,
    reflectionsDone: 0,
    completedRatio: status === "done" ? 1 : 0,
    // contrato-progresso §2: frozen ⟺ status === "done".
    frozen: status === "done",
  }
}

function mod(
  order: number,
  refl: number,
  status: JourneyModuleProgress["status"] = "planned",
): JourneyCourseContext["modules"][number] {
  return {
    chapterId: `ch${order}`,
    title: `Módulo ${order}`,
    order,
    interactionsExpected: 1,
    reflectionsExpected: refl,
    progress: progressOf(status),
  }
}

function ctx(over: Partial<JourneyCourseContext> = {}): JourneyCourseContext {
  return {
    courseId: "c1",
    courseTitle: "Análise e Solução de Problemas",
    startDate: START,
    finalDeadlineDays: 126,
    managerDeadlineDays: 105,
    modules: [mod(1, 2), mod(2, 4), mod(3, 3)],
    cohortDeadlineDate: "2026-05-07",
    cohortManagerDeadlineDate: "2026-04-16",
    planningAnchorDate: START,
    remainingWindowDays: 126,
    ...over,
  }
}

function plan(over: Partial<JourneyPlan> = {}): JourneyPlan {
  return {
    id: "p1",
    enrollmentId: "e1",
    studentId: "s1",
    courseId: "c1",
    tenantId: "t1",
    status: "active",
    moduleDurations: [15, 20, 15],
    preset: null,
    preferences: { cascade: true, unit: "w" },
    startDate: START,
    finalDeadlineDate: "2026-05-07", // +126d
    managerDeadlineDate: "2026-04-16", // +105d
    recalculatedAt: null,
    createdAt: START,
    updatedAt: START,
    moduleDurationsByChapter: [
      { chapterId: "ch1", days: 15 },
      { chapterId: "ch2", days: 20 },
      { chapterId: "ch3", days: 15 },
    ],
    planningAnchorDate: START,
    baseline: null,
    ...over,
  }
}

function baseline(over: Partial<JourneyBaseline> = {}): JourneyBaseline {
  return {
    capturedAt: START,
    progressPct: 50,
    sessionsDone: 20,
    reflectionsDone: 8,
    completedChapterIds: ["ch1"],
    ...over,
  }
}

function journey(statuses: ModuleJourneyItem["status"][]): ModuleJourneyItem[] {
  return statuses.map((status, i) => ({
    chapterId: `ch${i + 1}`,
    title: `Módulo ${i + 1}`,
    order: i + 1,
    interactionsExpected: 1,
    reflectionsExpected: [2, 4, 3][i] ?? 0,
    status,
    suggestedDeadline: null,
  }))
}

function pdd(over: Partial<PlanDashboardData> = {}): PlanDashboardData {
  return {
    courseTitle: "Análise e Solução de Problemas",
    currentChapterTitle: "Módulo 1",
    currentChapterOrder: 1,
    moduleJourney: journey(["doing", "planned", "planned"]),
    weeklyComparison: null,
    avgMinutesPerSession: null,
    cumulativeExpected: null,
    ...over,
  }
}

function diag(over: Partial<StudyPlanDiagnostic> = {}): StudyPlanDiagnostic {
  return {
    progressNow: 0,
    progressTarget: null,
    sessionsDoneCount: 0,
    reflDoneCount: 0,
    reflTotal: null,
    reflNow: null,
    reflTarget: null,
    daysLeft: 126,
    weeksLeft: 18,
    ...over,
  }
}

function weekly(
  planned: number,
  realized: number,
  situation: WeeklyComparison["situation"],
): WeeklyComparison {
  return {
    weekStart: START,
    weekEnd: START,
    planned: { sessions: planned, reflections: planned },
    realized: { sessions: realized, reflections: realized },
    situation,
  }
}

describe("buildDashboardModel — reancoragem e totais", () => {
  it("reancorra os prazos por módulo em plan.moduleDurations (não no motor)", () => {
    const m = buildDashboardModel({
      plan: plan(),
      context: ctx(),
      planDashboardData: pdd(),
      diagnostic: diag(),
      nowMs: START_MS,
    })
    // módulo 1 termina em start + 15 dias
    expect(m.modules[0].deadlineIso).toBe(new Date(START_MS + 15 * DAY).toISOString().slice(0, 10))
    // módulo 2 termina em start + 35 dias (15 + 20)
    expect(m.modules[1].deadlineIso).toBe(new Date(START_MS + 35 * DAY).toISOString().slice(0, 10))
  })

  it("totalItems = soma(1 conteúdo + 1 interação + N reflexões)", () => {
    const m = buildDashboardModel({
      plan: plan(),
      context: ctx(),
      planDashboardData: pdd(),
      diagnostic: diag(),
      nowMs: START_MS,
    })
    // (1+1+2) + (1+1+4) + (1+1+3) = 4 + 6 + 5 = 15
    expect(m.totalItems).toBe(15)
    expect(m.moduleCount).toBe(3)
  })
})

describe("buildDashboardModel — Leitura da IA (4 estados)", () => {
  it("dia 0: nada realizado → estado day0 com 'Comece por aqui'", () => {
    const m = buildDashboardModel({
      plan: plan(),
      context: ctx(),
      planDashboardData: pdd(),
      diagnostic: diag({ progressNow: 0, sessionsDoneCount: 0 }),
      nowMs: START_MS,
    })
    expect(m.isDayZero).toBe(true)
    expect(m.ai.state).toBe("day0")
    expect(m.ai.actionLabel).toBe("Comece por aqui")
  })

  it("em dia: progresso sem pendência → onpace", () => {
    const m = buildDashboardModel({
      plan: plan(),
      context: ctx(),
      planDashboardData: pdd({ weeklyComparison: weekly(6, 6, "cumprido") }),
      diagnostic: diag({ progressNow: 20, progressTarget: 20, sessionsDoneCount: 6 }),
      nowMs: START_MS + 14 * DAY,
    })
    expect(m.isDayZero).toBe(false)
    expect(m.ai.state).toBe("onpace")
    expect(m.ai.actionLabel).toBe("Próximo passo")
  })

  it("atrás: semana pendente → behind com 'Faça agora'", () => {
    const m = buildDashboardModel({
      plan: plan(),
      context: ctx(),
      planDashboardData: pdd({ weeklyComparison: weekly(6, 3, "pendente") }),
      diagnostic: diag({ progressNow: 12, progressTarget: 20, sessionsDoneCount: 3 }),
      nowMs: START_MS + 14 * DAY,
    })
    expect(m.ai.state).toBe("behind")
    expect(m.ai.actionLabel).toBe("Faça agora")
  })

  it("concluída: 100% → done", () => {
    const m = buildDashboardModel({
      plan: plan(),
      context: ctx(),
      planDashboardData: pdd({ moduleJourney: journey(["done", "done", "done"]) }),
      diagnostic: diag({ progressNow: 100, progressTarget: 90, sessionsDoneCount: 20 }),
      nowMs: START_MS + 60 * DAY,
    })
    expect(m.isCompleted).toBe(true)
    expect(m.ai.state).toBe("done")
    expect(m.ritmo.state).toBe("done")
    expect(m.ritmo.ringPct).toBe(100)
  })
})

describe("buildDashboardModel — Visão de Ritmo", () => {
  it("anel = realizado/esperado em itens inteiros, clampado a 100", () => {
    const m = buildDashboardModel({
      plan: plan(),
      context: ctx(),
      planDashboardData: pdd({ weeklyComparison: weekly(6, 6, "cumprido") }),
      diagnostic: diag({ progressNow: 20, progressTarget: 20, sessionsDoneCount: 6 }),
      nowMs: START_MS + 14 * DAY,
    })
    // done=round(0.20*15)=3 ; exp=floor(0.20*15)=3 ; ring=min(100,round(3/3*100))=100
    expect(m.ritmo.ringPct).toBe(100)
    expect(m.ritmo.ringOnTrack).toBe(true)
  })

  it("dia 0: anel 0, sem histórico, mostra combinado do plano ~itens/semana", () => {
    const m = buildDashboardModel({
      plan: plan(),
      context: ctx(),
      planDashboardData: pdd(),
      diagnostic: diag(),
      nowMs: START_MS,
    })
    expect(m.ritmo.state).toBe("day0")
    expect(m.ritmo.ringPct).toBe(0)
    expect(m.ritmo.dayZeroPacePerWeek).not.toBeNull()
  })

  it("necessário/semana mira a meta do gestor enquanto ela não passou", () => {
    const m = buildDashboardModel({
      plan: plan(),
      context: ctx(),
      planDashboardData: pdd({ weeklyComparison: weekly(6, 6, "cumprido") }),
      diagnostic: diag({ progressNow: 20, progressTarget: 20, sessionsDoneCount: 6 }),
      nowMs: START_MS + 14 * DAY,
    })
    expect(m.ritmo.needLabel).toContain("meta do gestor")
  })
})

// ===========================================================================
// JRN-E (Trilha E3) — baseline: a jornada mede o DELTA desde a montagem.
// ===========================================================================
// O aluno do lançamento entra com ~50% do curso feito e NENHUMA jornada montada
// (JRN-E §1.2). Se o dashboard contar esses 50% como "realizado", ele nasce
// eternamente adiantado e a Leitura da IA vira elogio automático. Os testes
// abaixo são a prova de que isso não acontece.
// ===========================================================================

/** Aluno real do lançamento: montou a jornada HOJE com 50% do curso já feito. */
const MOUNTED = "2026-03-01"
const MOUNTED_MS = new Date(MOUNTED).getTime()

function midCoursePlan(over: Partial<JourneyPlan> = {}): JourneyPlan {
  return plan({ planningAnchorDate: MOUNTED, baseline: baseline(), ...over })
}

function midCourseCtx(over: Partial<JourneyCourseContext> = {}): JourneyCourseContext {
  return ctx({ planningAnchorDate: MOUNTED, remainingWindowDays: 67, ...over })
}

describe("JRN-E · AC-E3.1 — ponto de partida existe e é SEPARADO", () => {
  it("popula startingPoint a partir do baseline, sem somá-lo ao realizado", () => {
    const m = buildDashboardModel({
      plan: midCoursePlan(),
      context: midCourseCtx(),
      planDashboardData: pdd(),
      diagnostic: diag({ progressNow: 50, sessionsDoneCount: 20, reflDoneCount: 8 }),
      nowMs: MOUNTED_MS,
    })
    expect(m.startingPoint).toEqual({
      progressPct: 50,
      sessionsDone: 20,
      reflectionsDone: 8,
      modulesDone: 1,
      capturedAt: START,
    })
    // o ponto de partida NÃO vira mérito da jornada
    expect(m.sinceJourney).toEqual({ progressPct: 0, sessionsDone: 0, reflectionsDone: 0 })
  })

  it("sem baseline (jornada montada no dia 0), startingPoint é null", () => {
    const m = buildDashboardModel({
      plan: plan(),
      context: ctx(),
      planDashboardData: pdd(),
      diagnostic: diag(),
      nowMs: START_MS,
    })
    expect(m.startingPoint).toBeNull()
  })
})

describe("JRN-E · AC-E3.2 — realizado é DELTA (lifetime − baseline, piso 0)", () => {
  it("progressNow 62 com baseline 50 → 12 pontos desde a montagem", () => {
    const m = buildDashboardModel({
      plan: midCoursePlan(),
      context: midCourseCtx(),
      planDashboardData: pdd(),
      diagnostic: diag({ progressNow: 62, sessionsDoneCount: 26, reflDoneCount: 11 }),
      nowMs: MOUNTED_MS + 14 * DAY,
    })
    expect(m.sinceJourney?.progressPct).toBe(12)
    expect(m.sinceJourney?.sessionsDone).toBe(6)
    expect(m.sinceJourney?.reflectionsDone).toBe(3)
    // o lifetime continua disponível como ESTADO do curso, não como mérito
    expect(m.progressPct).toBe(62)
  })

  it("piso 0: lifetime menor que o baseline nunca vira delta negativo", () => {
    expect(
      computeSinceJourney({ progressNow: 40, sessionsDoneCount: 3, reflDoneCount: 0 }, baseline()),
    ).toEqual({
      progressPct: 0,
      sessionsDone: 0,
      reflectionsDone: 0,
    })
  })
})

describe("JRN-E · AC-E3.3 — dia 0 volta a existir para quem monta no meio", () => {
  it("aluno de 50% que acabou de montar a jornada é dia 0, não 'adiantado'", () => {
    const m = buildDashboardModel({
      plan: midCoursePlan(),
      context: midCourseCtx(),
      planDashboardData: pdd(),
      diagnostic: diag({
        progressNow: 50,
        progressTarget: 55,
        sessionsDoneCount: 20,
        reflDoneCount: 8,
      }),
      nowMs: MOUNTED_MS,
    })
    expect(m.isDayZero).toBe(true)
    expect(m.ai.state).toBe("day0")
    expect(m.ritmo.state).toBe("day0")
    expect(m.ritmo.ringPct).toBe(0)
    expect(m.ritmo.ringOnTrack).toBe(false)
  })
})

describe("JRN-E · o caso REAL: 50% de ponto de partida e nada feito desde então", () => {
  it("aparece PARADO, nunca adiantado — e a leitura da IA diz isso", () => {
    const m = buildDashboardModel({
      plan: midCoursePlan(),
      context: midCourseCtx(),
      planDashboardData: pdd({ weeklyComparison: weekly(3, 0, "pendente") }),
      diagnostic: diag({
        progressNow: 50,
        progressTarget: 60,
        sessionsDoneCount: 20,
        reflDoneCount: 8,
      }),
      nowMs: MOUNTED_MS + 14 * DAY,
    })
    expect(m.sinceJourney).toEqual({ progressPct: 0, sessionsDone: 0, reflectionsDone: 0 })
    expect(m.ritmo.ringOnTrack).toBe(false)
    expect(m.ritmo.ringPct).toBe(0)
    const read = m.ai.read.map((r) => r.t).join("")
    expect(read).toContain("nada foi registrado ainda")
    // ponto de partida citado como CONTEXTO, jamais como conquista da jornada
    expect(read).toContain("ponto de partida")
    expect(read).not.toContain("em dia")
  })

  it("com 1 item feito em 14 dias fica ATRÁS do combinado (33%), não em 100%", () => {
    const m = buildDashboardModel({
      plan: midCoursePlan(),
      context: midCourseCtx(),
      planDashboardData: pdd({ weeklyComparison: weekly(3, 1, "pendente") }),
      diagnostic: diag({
        progressNow: 51,
        progressTarget: 60,
        sessionsDoneCount: 21,
        reflDoneCount: 8,
      }),
      nowMs: MOUNTED_MS + 14 * DAY,
    })
    expect(m.isDayZero).toBe(false)
    expect(m.ritmo.ringOnTrack).toBe(false)
    expect(m.ritmo.ringPct).toBeLessThan(100)
  })

  it("PROVA DO CONTRASTE: os MESMOS números sem baseline mentiriam 'em dia' (100%)", () => {
    const semBaseline = buildDashboardModel({
      plan: plan({ planningAnchorDate: MOUNTED, baseline: null }),
      context: midCourseCtx(),
      planDashboardData: pdd({ weeklyComparison: weekly(3, 1, "pendente") }),
      diagnostic: diag({
        progressNow: 51,
        progressTarget: 60,
        sessionsDoneCount: 21,
        reflDoneCount: 8,
      }),
      nowMs: MOUNTED_MS + 14 * DAY,
    })
    // 29 itens lifetime contra ~3 combinados na jornada = anel cheio, mérito falso.
    expect(semBaseline.ritmo.ringPct).toBe(100)
    expect(semBaseline.ritmo.ringOnTrack).toBe(true)
  })
})

describe("JRN-E · AC-E3.4 — ritmo não infla", () => {
  it("1 dia de jornada mede o dia, não os 50% que vieram antes", () => {
    const m = buildDashboardModel({
      plan: midCoursePlan(),
      context: midCourseCtx(),
      planDashboardData: pdd({ weeklyComparison: weekly(3, 1, "pendente") }),
      diagnostic: diag({
        progressNow: 51,
        progressTarget: 60,
        sessionsDoneCount: 21,
        reflDoneCount: 8,
      }),
      nowMs: MOUNTED_MS + 1 * DAY,
    })
    // 1 item em 1 dia = 7 itens/semana. Com o lifetime (29 itens), seriam 203.
    expect(m.ritmo.donePerWeek).toBe(7)
  })

  it("as semanas contam da ÂNCORA, não do T0 da matrícula", () => {
    const m = buildDashboardModel({
      plan: midCoursePlan(),
      context: midCourseCtx(),
      planDashboardData: pdd({ weeklyComparison: weekly(3, 2, "pendente") }),
      diagnostic: diag({
        progressNow: 55,
        progressTarget: 60,
        sessionsDoneCount: 22,
        reflDoneCount: 8,
      }),
      nowMs: MOUNTED_MS + 14 * DAY,
    })
    // 2 itens desde a montagem ÷ 2 semanas de jornada = 1,0/semana.
    // Ancorado na matrícula (59 dias antes), o mesmo aluno "faria" 0,2/semana
    // com 30 itens lifetime — dois números diferentes, e só um é honesto.
    expect(m.ritmo.donePerWeek).toBe(1)
  })
})

describe("JRN-E · AC-E3.5 — prazos reancorados, frozen NÃO-prefixo", () => {
  const HOLE_CTX = ctx({
    planningAnchorDate: MOUNTED,
    // buraco no meio: 0 e 2 concluídos, 1 e 3 vivos (JRN-E R1).
    modules: [mod(1, 2, "done"), mod(2, 4, "planned"), mod(3, 3, "done"), mod(4, 1, "planned")],
    remainingWindowDays: 67,
  })
  const HOLE_PLAN = midCoursePlan({ moduleDurations: [0, 30, 0, 30] })
  const HOLE_PDD = pdd({
    moduleJourney: [
      {
        chapterId: "ch1",
        title: "Módulo 1",
        order: 1,
        interactionsExpected: 1,
        reflectionsExpected: 2,
        status: "done",
        suggestedDeadline: "2026-09-09",
      },
      {
        chapterId: "ch2",
        title: "Módulo 2",
        order: 2,
        interactionsExpected: 1,
        reflectionsExpected: 4,
        status: "doing",
        suggestedDeadline: null,
      },
      {
        chapterId: "ch3",
        title: "Módulo 3",
        order: 3,
        interactionsExpected: 1,
        reflectionsExpected: 3,
        status: "done",
        suggestedDeadline: "2026-09-09",
      },
      {
        chapterId: "ch4",
        title: "Módulo 4",
        order: 4,
        interactionsExpected: 1,
        reflectionsExpected: 1,
        status: "planned",
        suggestedDeadline: null,
      },
    ],
  })

  it("módulo concluído não ganha data futura fabricada (deadlineIso null)", () => {
    const m = buildDashboardModel({
      plan: HOLE_PLAN,
      context: HOLE_CTX,
      planDashboardData: HOLE_PDD,
      diagnostic: diag({ progressNow: 55, sessionsDoneCount: 22, reflDoneCount: 8 }),
      nowMs: MOUNTED_MS + 7 * DAY,
    })
    expect(m.modules.map((r) => r.frozen)).toEqual([true, false, true, false])
    expect(m.modules[0].deadlineIso).toBeNull()
    expect(m.modules[2].deadlineIso).toBeNull()
    // nem mesmo o suggestedDeadline do motor vaza para um módulo concluído
    expect(m.modules[0].status).toBe("done")
    // os vivos são datados a partir da ÂNCORA (hoje), nunca do passado
    expect(m.modules[1].deadlineIso).toBe(
      new Date(MOUNTED_MS + 30 * DAY).toISOString().slice(0, 10),
    )
    expect(m.modules[3].deadlineIso).toBe(
      new Date(MOUNTED_MS + 60 * DAY).toISOString().slice(0, 10),
    )
  })

  it("REUSO, não duplicação: as datas são exatamente moduleEndDatesAnchored(computeRemainingWindow(...))", () => {
    const m = buildDashboardModel({
      plan: HOLE_PLAN,
      context: HOLE_CTX,
      planDashboardData: HOLE_PDD,
      diagnostic: diag({ progressNow: 55, sessionsDoneCount: 22, reflDoneCount: 8 }),
      nowMs: MOUNTED_MS + 7 * DAY,
    })
    const canonical = moduleEndDatesAnchored(
      HOLE_PLAN.moduleDurations,
      computeRemainingWindow(
        HOLE_CTX.modules,
        HOLE_CTX.planningAnchorDate,
        HOLE_CTX.cohortDeadlineDate,
      ),
    )
    expect(m.modules.map((r) => r.deadlineIso)).toEqual(canonical)
  })

  it("REUSO, não duplicação: o combinado é computeJourneyCumulativeExpected com os frozen zerados", () => {
    const nowMs = MOUNTED_MS + 14 * DAY
    const m = buildDashboardModel({
      plan: HOLE_PLAN,
      context: HOLE_CTX,
      planDashboardData: HOLE_PDD,
      diagnostic: diag({ progressNow: 55, sessionsDoneCount: 22, reflDoneCount: 8 }),
      nowMs,
    })
    const window = computeRemainingWindow(
      HOLE_CTX.modules,
      HOLE_CTX.planningAnchorDate,
      HOLE_CTX.cohortDeadlineDate,
    )
    const frozen = new Set(window.frozenIndices)
    const canonical = computeJourneyCumulativeExpected(
      HOLE_PLAN.moduleDurations,
      HOLE_CTX.modules.map((mm, i) =>
        frozen.has(i)
          ? { interactionsExpected: 0, reflectionsExpected: 0 }
          : {
              interactionsExpected: mm.interactionsExpected,
              reflectionsExpected: mm.reflectionsExpected,
            },
      ),
      HOLE_CTX.planningAnchorDate,
      nowMs,
    )
    const combinedUnits = canonical.sessions + canonical.reflections
    expect(m.ritmo.combinedPerWeek).toBe(Math.round((combinedUnits / 2) * 10) / 10)
  })
})

describe("JRN-E · AC-E3.6 — a Leitura da IA não mente com baseline não-nulo", () => {
  const cases = [
    {
      name: "day0",
      diagnostic: diag({ progressNow: 50, sessionsDoneCount: 20, reflDoneCount: 8 }),
      weekly: null,
      expected: "day0",
    },
    {
      name: "onpace",
      diagnostic: diag({
        progressNow: 55,
        progressTarget: 60,
        sessionsDoneCount: 22,
        reflDoneCount: 8,
      }),
      weekly: weekly(3, 3, "cumprido"),
      expected: "onpace",
    },
    {
      name: "behind",
      diagnostic: diag({
        progressNow: 55,
        progressTarget: 60,
        sessionsDoneCount: 22,
        reflDoneCount: 8,
      }),
      weekly: weekly(3, 1, "pendente"),
      expected: "behind",
    },
    {
      name: "done",
      diagnostic: diag({ progressNow: 100, sessionsDoneCount: 40, reflDoneCount: 20 }),
      weekly: null,
      expected: "done",
    },
  ] as const

  for (const c of cases) {
    it(`estado ${c.name}: nenhuma contagem anterior ao baseline é creditada à jornada`, () => {
      const m = buildDashboardModel({
        plan: midCoursePlan(),
        context: midCourseCtx(),
        planDashboardData: pdd({
          weeklyComparison: c.weekly,
          ...(c.expected === "done" ? { moduleJourney: journey(["done", "done", "done"]) } : {}),
        }),
        diagnostic: c.diagnostic,
        nowMs: MOUNTED_MS + 14 * DAY,
      })
      expect(m.ai.state).toBe(c.expected)
      const read = m.ai.read.map((r) => r.t).join("")
      // 20 sessões vieram ANTES da jornada: nunca aparecem como feitas nela.
      expect(read).not.toMatch(/\b2[0-9] sess/)
      expect(read).not.toContain("22 sessões feitas")
      if (c.expected === "onpace" || c.expected === "behind") {
        // o delta real (2 sessões) é o que a leitura pode citar
        expect(read).toContain("2 sessões feitas")
      }
    })
  }
})
