import type { PlanDashboardData } from "@/lib/analytics/plan-dashboard-data"
import type { ModuleJourneyItem, WeeklyComparison } from "@/lib/analytics/study-plan-dashboard"
import type { StudyPlanDiagnostic } from "@/lib/analytics/study-plan-projection"
import type { JourneyCourseContext, JourneyPlan } from "@/lib/journey/types"
import { describe, expect, it } from "vitest"
import { buildDashboardModel } from "../dashboard-model"

const START = "2026-01-01"
const START_MS = new Date(START).getTime()
const DAY = 86_400_000

function mod(order: number, refl: number): JourneyCourseContext["modules"][number] {
  return {
    chapterId: `ch${order}`,
    title: `Módulo ${order}`,
    order,
    interactionsExpected: 1,
    reflectionsExpected: refl,
  }
}

function ctx(): JourneyCourseContext {
  return {
    courseId: "c1",
    courseTitle: "Análise e Solução de Problemas",
    startDate: START,
    finalDeadlineDays: 126,
    managerDeadlineDays: 105,
    modules: [mod(1, 2), mod(2, 4), mod(3, 3)],
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
