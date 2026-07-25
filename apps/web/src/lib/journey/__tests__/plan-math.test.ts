import { describe, expect, it } from "vitest"
import {
  MIN_DAYS_PER_MODULE,
  alignDurationsToChapters,
  computeRemainingWindow,
  fitRemainingToDeadline,
  fitToDeadline,
  moduleEndDates,
  moduleEndDatesAnchored,
  neutralDurations,
  normalizeDurations,
  normalizeRemainingDurations,
  plannedCompletionDate,
  progressAwareNeutralDurations,
  remainingWindowDaysBetween,
  zoneOf,
} from "../plan-math"
import type { JourneyModuleProgress } from "../types"

// Constantes canônicas da demo (SPEC §2.2/§2.3): 8 módulos, teto 126, meta 105.
const N = 8
const FINAL = 126
const META = 105

// ---------------------------------------------------------------------------
// JRN-E — O ALUNO REAL. Matrícula 77f43ca0-0180-421b-ab08-b2c5febd0b14, ~50% de
// progresso, apurado em 2026-07-25. NÃO é um prefixo: há um BURACO no meio.
//
//   módulo | 0    1    2    3         4    5      6        7
//   estado | done done done INTOCADO  done doing  planned  planned
//
// O módulo 3 tem 4 de 4 reflexões feitas e 0 interações — trabalho real que o
// motor de status ainda chama de "planned" (R3 da story). Todo teste abaixo usa
// este vetor esparso de propósito: um desenho de prefixo passaria por engano.
// ---------------------------------------------------------------------------
const DONE_INDICES = [0, 1, 2, 4]
const LIVE_INDICES = [3, 5, 6, 7]

function progressOf(over: Partial<JourneyModuleProgress> = {}): JourneyModuleProgress {
  return {
    status: "planned",
    sessionsDone: 0,
    reflectionsDone: 0,
    completedRatio: 0,
    frozen: false,
    ...over,
  }
}

/** Os 8 módulos do aluno real, com o buraco no 3. */
function realStudentModules(): { progress: JourneyModuleProgress }[] {
  return [
    { progress: progressOf({ status: "done", frozen: true, completedRatio: 1, sessionsDone: 1 }) },
    { progress: progressOf({ status: "done", frozen: true, completedRatio: 1, sessionsDone: 1 }) },
    { progress: progressOf({ status: "done", frozen: true, completedRatio: 1, sessionsDone: 1 }) },
    // o buraco: 4 de 4 reflexões, 0 interações → "planned", mas ratio > 0
    { progress: progressOf({ status: "planned", reflectionsDone: 4, completedRatio: 4 / 5 }) },
    { progress: progressOf({ status: "done", frozen: true, completedRatio: 1, sessionsDone: 1 }) },
    { progress: progressOf({ status: "doing", completedRatio: 0.2 }) },
    { progress: progressOf() },
    { progress: progressOf() },
  ]
}

const TODAY = "2026-07-25"
/** matrícula 2026-05-21 + 180 dias (o teto de coorte do caso real). */
const COHORT_CEILING = "2026-11-17"

describe("neutralDurations — ponto de partida (SPEC §2.3)", () => {
  it("distribui uniforme: 8 módulos / 126 dias = 15 cada", () => {
    const d = neutralDurations(N, FINAL)
    expect(d).toEqual([15, 15, 15, 15, 15, 15, 15, 15])
    expect(d.reduce((a, b) => a + b, 0)).toBe(120) // 6 dias de folga
  })
  it("nunca abaixo do mínimo", () => {
    expect(neutralDurations(40, 10)).toEqual(Array(40).fill(MIN_DAYS_PER_MODULE))
  })
})

describe("fitToDeadline — teto duro (SPEC round 19, proof-teto)", () => {
  it("não altera quando já cabe (Moderado 119d, Intenso 92d)", () => {
    const moderado = [7, 14, 14, 21, 14, 21, 14, 14] // soma 119
    expect(fitToDeadline(moderado, FINAL)).toEqual(moderado)
  })

  it("Tranquilo (×1.3, estouraria 153d) é clampado a EXATAMENTE 126d", () => {
    const tranquilo = [9, 18, 18, 27, 18, 27, 18, 18] // soma 153
    const fit = fitToDeadline(tranquilo, FINAL)
    expect(fit.reduce((a, b) => a + b, 0)).toBe(FINAL)
    expect(Math.min(...fit)).toBeGreaterThanOrEqual(MIN_DAYS_PER_MODULE)
  })

  it("nenhuma entrada estourada ultrapassa o teto e todo módulo >= mínimo", () => {
    for (const scale of [1.1, 1.3, 1.5, 2, 3]) {
      const base = [7, 14, 14, 21, 14, 21, 14, 14].map((d) => Math.round(d * scale))
      const fit = fitToDeadline(base, FINAL)
      expect(fit.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(FINAL)
      expect(Math.min(...fit)).toBeGreaterThanOrEqual(MIN_DAYS_PER_MODULE)
    }
  })

  it("teto menor que o mínimo possível → todos no mínimo", () => {
    expect(fitToDeadline([10, 10, 10], 6)).toEqual([4, 4, 4])
  })
})

describe("normalizeDurations — fronteira de escrita", () => {
  it("lança em comprimento errado", () => {
    expect(() => normalizeDurations([15, 15], N, FINAL)).toThrow()
  })
  it("lança em valor não-numérico", () => {
    // biome-ignore lint/suspicious/noExplicitAny: teste de input inválido
    expect(() => normalizeDurations([15, 15, 15, 15, 15, 15, 15, "x" as any], N, FINAL)).toThrow()
  })
  it("floor + min + clamp ao teto", () => {
    const out = normalizeDurations([1, 30, 30, 30, 30, 30, 30, 30], N, FINAL)
    expect(out.length).toBe(N)
    expect(Math.min(...out)).toBeGreaterThanOrEqual(MIN_DAYS_PER_MODULE)
    expect(out.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(FINAL)
  })
})

describe("moduleEndDates / plannedCompletionDate", () => {
  it("acumula durações a partir de T0 (UTC-estável)", () => {
    const ends = moduleEndDates("2026-01-01", [7, 14])
    expect(ends).toEqual(["2026-01-08", "2026-01-22"])
    expect(plannedCompletionDate("2026-01-01", [7, 14])).toBe("2026-01-22")
  })
})

describe("zoneOf — 3 zonas (SPEC round 16/19)", () => {
  it("green ≤ meta", () => {
    expect(zoneOf(92, META, FINAL)).toBe("green")
    expect(zoneOf(META, META, FINAL)).toBe("green")
  })
  it("amber entre meta e final", () => {
    expect(zoneOf(119, META, FINAL)).toBe("amber")
    expect(zoneOf(FINAL, META, FINAL)).toBe("amber")
  })
  it("red > final (guarda defensiva)", () => {
    expect(zoneOf(153, META, FINAL)).toBe("red")
  })
  it("sem meta: green até o teto, red além", () => {
    expect(zoneOf(119, null, FINAL)).toBe("green")
    expect(zoneOf(127, null, FINAL)).toBe("red")
  })
})

// ===========================================================================
// JRN-E — janela restante e partida consciente do progresso
// ===========================================================================

describe("computeRemainingWindow — AC-E1.2", () => {
  it("o vetor do aluno real produz frozen NÃO-prefixo [0,1,2,4] e vivos [3,5,6,7]", () => {
    const w = computeRemainingWindow(realStudentModules(), TODAY, COHORT_CEILING)
    expect(w.frozenIndices).toEqual(DONE_INDICES)
    expect(w.remainingIndices).toEqual(LIVE_INDICES)
    // o buraco do módulo 3 fica VIVO entre concluídos — é o ponto todo
    expect(w.frozenIndices).not.toContain(3)
    expect(w.remainingIndices).toContain(3)
  })

  it("remainingDays = teto de coorte − hoje (2026-07-25 → 2026-11-17 = 115)", () => {
    const w = computeRemainingWindow(realStudentModules(), TODAY, COHORT_CEILING)
    expect(w.remainingDays).toBe(115)
    expect(w.expired).toBe(false)
    expect(w.anchorDate).toBe(TODAY)
  })

  it("frozen e vivos são disjuntos e cobrem todos os índices (invariante 2)", () => {
    const mods = realStudentModules()
    const w = computeRemainingWindow(mods, TODAY, COHORT_CEILING)
    const all = [...w.frozenIndices, ...w.remainingIndices].sort((a, b) => a - b)
    expect(all).toEqual(mods.map((_, i) => i))
    expect(w.frozenIndices.some((i) => w.remainingIndices.includes(i))).toBe(false)
  })

  it("teto já vencido → remainingDays 0 e expired true (R4)", () => {
    const w = computeRemainingWindow(realStudentModules(), TODAY, "2025-07-09")
    expect(w.remainingDays).toBe(0)
    expect(w.expired).toBe(true)
  })

  it("teto exatamente hoje → 0 dias, mas NÃO vencido", () => {
    const w = computeRemainingWindow(realStudentModules(), TODAY, TODAY)
    expect(w.remainingDays).toBe(0)
    expect(w.expired).toBe(false)
  })

  it("sem teto computável não inventa janela", () => {
    expect(remainingWindowDaysBetween(TODAY, null)).toBe(0)
    expect(computeRemainingWindow(realStudentModules(), TODAY, null).expired).toBe(false)
  })
})

describe("progressAwareNeutralDurations — AC-E1.3 / AC-E1.4", () => {
  it("concluído recebe 0 EXATO; vivo recebe >= mínimo; soma = janela restante", () => {
    const mods = realStudentModules()
    const w = computeRemainingWindow(mods, TODAY, COHORT_CEILING)
    const d = progressAwareNeutralDurations(mods, w)

    expect(d.length).toBe(mods.length)
    for (const i of DONE_INDICES) expect(d[i]).toBe(0)
    for (const i of LIVE_INDICES) expect(d[i]).toBeGreaterThanOrEqual(MIN_DAYS_PER_MODULE)
    // o buraco no meio é planejável de verdade, não um resto
    expect(d[3]).toBeGreaterThanOrEqual(MIN_DAYS_PER_MODULE)
    expect(d.reduce((a, b) => a + b, 0)).toBe(w.remainingDays)
  })

  it("durations[i] === 0 ⟺ módulo frozen (invariante 3)", () => {
    const mods = realStudentModules()
    const w = computeRemainingWindow(mods, TODAY, COHORT_CEILING)
    const d = progressAwareNeutralDurations(mods, w)
    d.forEach((days, i) => expect(days === 0).toBe(mods[i].progress.frozen))
  })

  it("parcial (ratio 0.5) pede metade do tempo de um intocado equivalente", () => {
    const mods = [{ progress: progressOf() }, { progress: progressOf({ completedRatio: 0.5 }) }]
    const w = computeRemainingWindow(mods, TODAY, "2026-09-23") // 60 dias
    const d = progressAwareNeutralDurations(mods, w)

    expect(d[1]).toBeLessThan(d[0])
    expect(d.reduce((a, b) => a + b, 0)).toBe(60)
    // acima do piso obrigatório, o parcial pede EXATAMENTE metade (±1 de arredondamento)
    const acimaDoPiso = (x: number) => x - MIN_DAYS_PER_MODULE
    expect(Math.abs(acimaDoPiso(d[1]) - acimaDoPiso(d[0]) / 2)).toBeLessThanOrEqual(1)
  })

  it("todos os vivos intocados → fatia uniforme (idêntico ao comportamento neutro)", () => {
    const mods = [0, 1, 2, 3].map(() => ({ progress: progressOf() }))
    const w = computeRemainingWindow(mods, TODAY, "2026-11-17") // 115 dias
    const d = progressAwareNeutralDurations(mods, w)
    expect(Math.max(...d) - Math.min(...d)).toBeLessThanOrEqual(1)
    expect(d.reduce((a, b) => a + b, 0)).toBe(115)
  })

  it("janela impossível (vencida) → vivos no mínimo, concluídos ainda em 0 (R4)", () => {
    const mods = realStudentModules()
    const w = computeRemainingWindow(mods, TODAY, "2025-07-09")
    const d = progressAwareNeutralDurations(mods, w)
    for (const i of DONE_INDICES) expect(d[i]).toBe(0)
    for (const i of LIVE_INDICES) expect(d[i]).toBe(MIN_DAYS_PER_MODULE)
  })

  it("curso inteiro concluído → nenhuma duração a distribuir", () => {
    const mods = [0, 1].map(() => ({
      progress: progressOf({ status: "done", frozen: true, completedRatio: 1 }),
    }))
    const w = computeRemainingWindow(mods, TODAY, COHORT_CEILING)
    expect(progressAwareNeutralDurations(mods, w)).toEqual([0, 0])
  })
})

describe("fitRemainingToDeadline / normalizeRemainingDurations — fronteira de escrita", () => {
  const mods = realStudentModules()
  const w = computeRemainingWindow(mods, TODAY, COHORT_CEILING)

  it("clampa só os vivos e preserva 0 nos concluídos", () => {
    const inflado = [50, 50, 50, 50, 50, 50, 50, 50]
    const out = fitRemainingToDeadline(inflado, w)
    for (const i of DONE_INDICES) expect(out[i]).toBe(0)
    expect(LIVE_INDICES.reduce((a, i) => a + out[i], 0)).toBeLessThanOrEqual(w.remainingDays)
  })

  it("cliente que manda dias num módulo CONCLUÍDO tem o valor zerado no servidor", () => {
    const malicioso = [99, 99, 99, 20, 99, 20, 20, 20]
    const out = normalizeRemainingDurations(malicioso, w)
    for (const i of DONE_INDICES) expect(out[i]).toBe(0)
    expect(out.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(w.remainingDays)
  })

  it("lança em comprimento errado", () => {
    expect(() => normalizeRemainingDurations([10, 10], w)).toThrow()
  })

  it("lança em valor não-numérico", () => {
    // biome-ignore lint/suspicious/noExplicitAny: teste de input inválido
    const ruim = [0, 0, 0, 10, 0, 10, 10, "x" as any]
    expect(() => normalizeRemainingDurations(ruim, w)).toThrow()
  })

  it("piso: vivo abaixo do mínimo sobe para MIN_DAYS_PER_MODULE", () => {
    const out = normalizeRemainingDurations([0, 0, 0, 1, 0, 1, 1, 1], w)
    for (const i of LIVE_INDICES) expect(out[i]).toBe(MIN_DAYS_PER_MODULE)
  })
})

describe("moduleEndDatesAnchored — AC-E2.5 (a linha do tempo começa HOJE)", () => {
  it("concluído não ganha data futura fabricada; vivo conta a partir da âncora", () => {
    const mods = realStudentModules()
    const w = computeRemainingWindow(mods, TODAY, COHORT_CEILING)
    const ends = moduleEndDatesAnchored([0, 0, 0, 10, 0, 10, 10, 10], w)

    for (const i of DONE_INDICES) expect(ends[i]).toBeNull()
    expect(ends[3]).toBe("2026-08-04") // 25/jul + 10
    expect(ends[5]).toBe("2026-08-14")
    expect(ends[7]).toBe("2026-09-03")
  })

  it("nenhuma data é anterior à âncora, mesmo com startDate 60 dias no passado", () => {
    const mods = realStudentModules()
    const w = computeRemainingWindow(mods, TODAY, COHORT_CEILING)
    const ends = moduleEndDatesAnchored([0, 0, 0, 4, 0, 4, 4, 4], w)
    for (const iso of ends) {
      if (iso != null) expect(iso >= TODAY).toBe(true)
    }
  })
})

describe("alignDurationsToChapters — AC-E1.5 (fim do array deslizante)", () => {
  const PERSISTED = [
    { chapterId: "a", days: 10 },
    { chapterId: "b", days: 20 },
    { chapterId: "c", days: 30 },
  ]

  it("capítulo do MEIO despublicado: os restantes NÃO deslizam", () => {
    // Com array posicional, "c" herdaria os 20 dias de "b". Aqui mantém 30.
    expect(alignDurationsToChapters(PERSISTED, ["a", "c"])).toEqual([10, 30])
  })

  it("capítulo publicado DEPOIS entra com o mínimo, sem roubar dos existentes", () => {
    expect(alignDurationsToChapters(PERSISTED, ["a", "b", "c", "d"])).toEqual([
      10,
      20,
      30,
      MIN_DAYS_PER_MODULE,
    ])
  })

  it("reordenar capítulos leva a duração JUNTO com o capítulo", () => {
    expect(alignDurationsToChapters(PERSISTED, ["c", "a", "b"])).toEqual([30, 10, 20])
  })

  it("entrada corrompida é ignorada em vez de virar NaN", () => {
    const sujo = [
      { chapterId: "a", days: Number.NaN },
      { chapterId: "b", days: 20 },
    ]
    expect(alignDurationsToChapters(sujo, ["a", "b"])).toEqual([MIN_DAYS_PER_MODULE, 20])
  })
})
