import { describe, expect, it } from "vitest"
import {
  type ModuleJourneyChapterInput,
  computeCumulativeExpected,
  computeJourneyCumulativeExpected,
  computeModuleJourney,
  computeWeeklyComparison,
  getCalendarWeekRange,
  recalculateWeeklyChoice,
} from "../study-plan-dashboard"
import { DEFAULT_STUDY_PLAN_CHOICE, type StudyPlanChoice } from "../study-plan-projection"

function choice(over: Partial<StudyPlanChoice> = {}): StudyPlanChoice {
  return { ...DEFAULT_STUDY_PLAN_CHOICE, days: [...DEFAULT_STUDY_PLAN_CHOICE.days], ...over }
}

describe("getCalendarWeekRange", () => {
  it("uma quarta-feira retorna a segunda 00:00 até o domingo 23:59 da mesma semana", () => {
    const wednesday = new Date("2026-09-16T14:30:00") // quarta
    const { weekStart, weekEnd } = getCalendarWeekRange(wednesday)
    expect(weekStart.getDay()).toBe(1) // segunda
    expect(weekStart.getDate()).toBe(14)
    expect(weekStart.getHours()).toBe(0)
    expect(weekEnd.getDay()).toBe(0) // domingo
    expect(weekEnd.getDate()).toBe(20)
    expect(weekEnd.getHours()).toBe(23)
  })

  it("um domingo pertence à semana que TERMINA nele (segunda anterior)", () => {
    const sunday = new Date("2026-09-20T09:00:00")
    const { weekStart, weekEnd } = getCalendarWeekRange(sunday)
    expect(weekStart.getDate()).toBe(14)
    expect(weekEnd.getDate()).toBe(20)
  })
})

describe("computeWeeklyComparison", () => {
  const weekStart = new Date("2026-09-14T00:00:00")
  const weekEnd = new Date("2026-09-20T23:59:59")

  it("3 dias x 2 sessões/dia planejado, realizado abaixo → situação pendente", () => {
    const result = computeWeeklyComparison(choice(), 2, 1, weekStart, weekEnd)
    expect(result.planned).toEqual({ sessions: 6, reflections: 3 })
    expect(result.realized).toEqual({ sessions: 2, reflections: 1 })
    expect(result.situation).toBe("pendente")
  })

  it("realizado igual ou acima do planejado em ambos os eixos → cumprido", () => {
    const result = computeWeeklyComparison(choice(), 6, 3, weekStart, weekEnd)
    expect(result.situation).toBe("cumprido")
  })

  it("reflFocus desligado zera reflexões planejadas", () => {
    const result = computeWeeklyComparison(choice({ reflFocus: false }), 6, 0, weekStart, weekEnd)
    expect(result.planned.reflections).toBe(0)
    expect(result.situation).toBe("cumprido")
  })
})

describe("computeCumulativeExpected", () => {
  it("caso real do Rinaldo (SH-3.3 R7): matrícula 2026-05-21, ~61 dias decorridos até 2026-07-21, ritmo default → 52 sessões / 26 reflexões esperadas", () => {
    const elapsedDays =
      (new Date("2026-07-21T00:00:00Z").getTime() - new Date("2026-05-21T00:00:00Z").getTime()) /
      86_400_000
    expect(elapsedDays).toBeCloseTo(61, 5)

    const result = computeCumulativeExpected(choice(), elapsedDays)
    // choice() = DEFAULT_STUDY_PLAN_CHOICE: 3 dias (Seg/Qua/Sex) x 2 sessões/dia =
    // 6/semana, reflFocus on = 3/semana. weeksElapsed = 61/7 ≈ 8.714.
    expect(result.sessions).toBe(52) // round(8.714 * 6)
    expect(result.reflections).toBe(26) // round(8.714 * 3)
  })

  it("0 dias decorridos (matrícula feita agora) → 0 esperado em ambos os eixos", () => {
    const result = computeCumulativeExpected(choice(), 0)
    expect(result).toEqual({ sessions: 0, reflections: 0 })
  })

  it("1 semana exata decorrida → esperado bate com o planejado semanal cru (7 dias)", () => {
    const result = computeCumulativeExpected(choice(), 7)
    expect(result).toEqual({ sessions: 6, reflections: 3 })
  })

  it("reflFocus desligado zera reflexões esperadas cumulativas, sessões seguem normalmente", () => {
    const result = computeCumulativeExpected(choice({ reflFocus: false }), 14)
    expect(result.reflections).toBe(0)
    expect(result.sessions).toBe(12) // 2 semanas x 6/semana
  })

  it("elapsedDays negativo (relógio/dado anômalo) nunca produz esperado negativo", () => {
    const result = computeCumulativeExpected(choice(), -10)
    expect(result).toEqual({ sessions: 0, reflections: 0 })
  })

  it("0 dias escolhidos no ritmo → 0 esperado, mesmo com muito tempo decorrido", () => {
    const result = computeCumulativeExpected(choice({ days: Array(7).fill(false) }), 90)
    expect(result).toEqual({ sessions: 0, reflections: 0 })
  })
})

describe("computeModuleJourney", () => {
  const chapters: ModuleJourneyChapterInput[] = [
    { chapterId: "c1", title: "Definição do problema", order: 1, reflectionsExpected: 2 },
    { chapterId: "c2", title: "Mapeamento de contexto", order: 2, reflectionsExpected: 3 },
    { chapterId: "c3", title: "Análise de causas", order: 3, reflectionsExpected: 6 },
  ]

  it("marca status done/doing/planned a partir de capítulos concluídos + capítulo atual", () => {
    const result = computeModuleJourney(chapters, new Set(["c1"]), "c2", null, null)
    expect(result.map((m) => m.status)).toEqual(["done", "doing", "planned"])
  })

  it("sem startDate/targetCompletionDate, suggestedDeadline é null (nunca inventa data)", () => {
    const result = computeModuleJourney(chapters, new Set(), null, null, null)
    expect(result.every((m) => m.suggestedDeadline === null)).toBe(true)
  })

  it("com janela real, distribui prazo proporcional ao custo (reflexão pesa 3x mais que interação)", () => {
    const start = new Date("2026-01-01T00:00:00Z")
    const end = new Date("2026-01-11T00:00:00Z") // janela de 10 dias
    const result = computeModuleJourney(chapters, new Set(), null, start, end)
    // custo: c1=1+3*2=7, c2=1+3*3=10, c3=1+3*6=19, total=36
    const c1Days =
      (new Date(result[0].suggestedDeadline as string).getTime() - start.getTime()) / 86_400_000
    expect(c1Days).toBeCloseTo((7 / 36) * 10, 5)
    // último capítulo cai exatamente no fim da janela (custo acumulado = total)
    expect(result[2].suggestedDeadline).toBe(end.toISOString())
  })

  it("interactionsExpected é sempre 1 por capítulo (convenção já usada no resto do repo)", () => {
    const result = computeModuleJourney(chapters, new Set(), null, null, null)
    expect(result.every((m) => m.interactionsExpected === 1)).toBe(true)
  })
})

describe("recalculateWeeklyChoice", () => {
  const weekStart = new Date("2026-09-14T00:00:00")
  const weekEnd = new Date("2026-09-20T23:59:59")

  it("sem déficit, retorna o choice inalterado", () => {
    const c = choice()
    const comparison = computeWeeklyComparison(c, 6, 3, weekStart, weekEnd)
    const result = recalculateWeeklyChoice(c, comparison, 17)
    expect(result).toEqual(c)
  })

  it("com déficit e folga no teto de 5/dia, intensifica sessionsPerDay nos MESMOS dias (sem adicionar dia novo)", () => {
    const c = choice() // 3 dias, 2 sessões/dia = 6/semana
    const comparison = computeWeeklyComparison(c, 4, 3, weekStart, weekEnd) // déficit de 2 sessões
    const result = recalculateWeeklyChoice(c, comparison, 17) // 16 semanas restantes, extra/semana = ceil(2/16)=1
    expect(result.days).toEqual(c.days)
    expect(result.sessionsPerDay).toBeGreaterThan(c.sessionsPerDay)
    expect(result.sessionsPerDay).toBeLessThanOrEqual(5)
  })

  it("quando intensificar estouraria o teto de 5/dia, adiciona 1 dia em vez de violar o teto", () => {
    const c = choice({ sessionsPerDay: 5 }) // já no teto, 3 dias = 15/semana
    const comparison = computeWeeklyComparison(c, 0, 0, weekStart, weekEnd) // déficit de 15 sessões
    const result = recalculateWeeklyChoice(c, comparison, 2) // 1 semana restante → pressão alta
    expect(result.sessionsPerDay).toBe(5)
    expect(result.days.filter(Boolean).length).toBeGreaterThan(c.days.filter(Boolean).length)
  })

  it("0 dias escolhidos retorna o choice inalterado (evita divisão por zero)", () => {
    const c = choice({ days: Array(7).fill(false) })
    const comparison = computeWeeklyComparison(c, 0, 0, weekStart, weekEnd)
    const result = recalculateWeeklyChoice(c, comparison, 17)
    expect(result).toEqual(c)
  })
})

// EPIC-JORNADA (JRN-D) — esperado cumulativo derivado da JORNADA persistida
// (moduleDurations do aluno), não do ritmo semanal default.
describe("computeJourneyCumulativeExpected", () => {
  const START = "2026-01-01T00:00:00.000Z"
  const DAY = 86_400_000
  const startMs = new Date(START).getTime()
  const mods = (refl: number[]) =>
    refl.map((r) => ({ interactionsExpected: 1, reflectionsExpected: r }))

  it("dia 0 (nada decorrido) → 0 sessões, 0 reflexões", () => {
    expect(computeJourneyCumulativeExpected([15, 15], mods([2, 4]), START, startMs)).toEqual({
      sessions: 0,
      reflections: 0,
    })
  })

  it("ao fim do 1º módulo → 1 interação e as reflexões daquele módulo, 2º ainda em 0", () => {
    const now = startMs + 15 * DAY
    expect(computeJourneyCumulativeExpected([15, 15], mods([2, 4]), START, now)).toEqual({
      sessions: 1,
      reflections: 2,
    })
  })

  it("passado o fim de todos os módulos → soma total (todos os itens esperados)", () => {
    const now = startMs + 100 * DAY
    expect(computeJourneyCumulativeExpected([15, 15], mods([2, 4]), START, now)).toEqual({
      sessions: 2,
      reflections: 6,
    })
  })

  it("crédito PARCIAL proporcional dentro da janela do módulo (metade → metade dos itens)", () => {
    // 2 módulos de 10 dias; no dia 15 o M1 está 100% e o M2 na metade (0.5).
    const now = startMs + 15 * DAY
    // sessions = 1 + 0.5 = 1.5 → round 2; reflections = 0 + 0.5*4 = 2.
    expect(computeJourneyCumulativeExpected([10, 10], mods([0, 4]), START, now)).toEqual({
      sessions: 2,
      reflections: 2,
    })
  })

  it("durações vazias ou startDate inválido → 0/0 (degradação honesta, sem NaN)", () => {
    expect(computeJourneyCumulativeExpected([], [], START, startMs + 100 * DAY)).toEqual({
      sessions: 0,
      reflections: 0,
    })
    expect(
      computeJourneyCumulativeExpected([15], mods([2]), "not-a-date", startMs + 100 * DAY),
    ).toEqual({ sessions: 0, reflections: 0 })
  })

  it("nunca decresce com o tempo (monotônico) e nunca ultrapassa o total", () => {
    const durations = [7, 7, 7, 7]
    const meta = mods([1, 2, 3, 4])
    const totalRefl = 1 + 2 + 3 + 4
    let prevSessions = 0
    let prevRefl = 0
    for (let d = 0; d <= 40; d += 4) {
      const r = computeJourneyCumulativeExpected(durations, meta, START, startMs + d * DAY)
      expect(r.sessions).toBeLessThanOrEqual(4)
      expect(r.reflections).toBeLessThanOrEqual(totalRefl)
      // arredondamento de uma sequência não-decrescente permanece não-decrescente.
      expect(r.sessions).toBeGreaterThanOrEqual(prevSessions)
      expect(r.reflections).toBeGreaterThanOrEqual(prevRefl)
      prevSessions = r.sessions
      prevRefl = r.reflections
    }
  })
})
