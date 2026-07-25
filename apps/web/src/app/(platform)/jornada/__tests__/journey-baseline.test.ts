import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * JRN-E — AC-E1.7, a fronteira de ESCRITA da jornada consciente do progresso.
 *
 * Três coisas mudam no que vai para o banco, e cada uma existe por um motivo
 * que já custou caro:
 *
 *  1. `module_durations` vira `[{chapterId, days}]`. Como array posicional puro,
 *     despublicar um capítulo do meio deslizava TODAS as durações seguintes, em
 *     silêncio — o aluno via o próprio plano mudar sem nenhum erro.
 *
 *  2. `baseline` é gravado UMA vez, na primeira confirmação. Se revisar
 *     reescrevesse o ponto de partida, todo o progresso feito DENTRO da jornada
 *     seria reabsorvido como "veio de antes" e o realizado voltaria a zero a
 *     cada revisão.
 *
 *  3. A validação passa a ser `normalizeRemainingDurations`: módulo concluído
 *     grava 0 EXATO mesmo que o cliente mande dias nele. O servidor é a
 *     autoridade sobre o que está concluído, não o navegador.
 *
 * Os testes exercitam a action REAL e afirmam sobre o payload efetivamente
 * enviado ao banco — não sobre uma reimplementação da aritmética.
 */

/* --------- mocks de fronteira --------- */

let currentClient: unknown = null

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => currentClient),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

// O contexto do curso (progresso real + janela) é lido pelo servidor. Aqui ele
// é injetado pronto: o caminho de LEITURA já é provado ponta a ponta contra a
// fronteira Supabase em lib/journey/__tests__/module-progress.test.ts, e este
// arquivo é sobre o que a ESCRITA faz com ele.
vi.mock("@/lib/journey/journey-plan-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/journey/journey-plan-data")>()
  return { ...actual, fetchJourneyCourseContext: vi.fn(async () => currentContext) }
})

import type { JourneyCourseContext, JourneyModuleProgress } from "@/lib/journey/types"
import { saveJourneyPlan, updateJourneyPlan } from "../actions"

/* --------- fixtures do aluno real (0,1,2,4 done · 5 doing · 3,6,7 planned) --------- */

const STUDENT = "student-1"
const TENANT = "tenant-1"
const COURSE = "course-1"
const ENROLLMENT = "enrollment-1"
const TODAY = "2026-07-25"
const ENROLLED_AT = "2026-05-21T09:12:00.000Z"
const COHORT_CEILING = "2026-11-17"
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

const DONE = progressOf({ status: "done", frozen: true, completedRatio: 1, sessionsDone: 1 })

function buildContext(): JourneyCourseContext {
  const progressByIndex: JourneyModuleProgress[] = [
    DONE,
    DONE,
    DONE,
    progressOf({ reflectionsDone: 4, completedRatio: 0.8 }),
    DONE,
    progressOf({ status: "doing", completedRatio: 0.2 }),
    progressOf(),
    progressOf(),
  ]
  return {
    courseId: COURSE,
    courseTitle: "Análise e Solução de Problemas",
    startDate: "2026-05-21",
    finalDeadlineDays: 180,
    managerDeadlineDays: null,
    modules: progressByIndex.map((progress, i) => ({
      chapterId: `ch-${i}`,
      title: `Módulo ${i + 1}`,
      order: i,
      interactionsExpected: 1,
      reflectionsExpected: i === 3 ? 4 : 0,
      progress,
    })),
    cohortDeadlineDate: COHORT_CEILING,
    cohortManagerDeadlineDate: null,
    planningAnchorDate: TODAY,
    remainingWindowDays: 115,
  }
}

let currentContext: JourneyCourseContext | null = null

type Row = Record<string, unknown>

interface Fixture {
  existingPlan: Row | null
  /** simula a migration do JRN-E ainda NÃO aplicada (coluna `baseline` ausente). */
  baselineColumnMissing?: boolean
}

function chapterCountBuilder(count: number) {
  const p = Promise.resolve({ data: [], count, error: null }) as Promise<unknown> &
    Record<string, unknown>
  p.select = () => p
  p.eq = () => p
  return p
}

function buildSupabase(fx: Fixture) {
  const writes: { insert: Row | null; update: Row | null } = { insert: null, update: null }

  const from = (table: string) => {
    if (table === "chapters") return chapterCountBuilder(8)
    let pendingInsert: Row | null = null
    let pendingUpdate: Row | null = null
    let selectedColumns = ""

    const builder: Record<string, unknown> = {
      select: (cols?: string) => {
        if (typeof cols === "string") selectedColumns = cols
        return builder
      },
      eq: () => builder,
      order: () => builder,
      limit: () => builder,
      insert: (payload: Row) => {
        pendingInsert = payload
        writes.insert = payload
        return builder
      },
      update: (payload: Row) => {
        pendingUpdate = payload
        writes.update = payload
        return builder
      },
      maybeSingle: async () => {
        if (table === "enrollments") {
          return {
            data: {
              id: ENROLLMENT,
              course_id: COURSE,
              tenant_id: TENANT,
              created_at: ENROLLED_AT,
              status: "active",
              progress: { percentage: 50 },
            },
            error: null,
          }
        }
        if (table === "courses") {
          return { data: { deadline_days: 180, manager_deadline_days: null }, error: null }
        }
        if (table === "study_plans") {
          // A migration não aplicada faz o select COM `baseline` falhar; o
          // fallback lê só as colunas antigas.
          if (fx.baselineColumnMissing && selectedColumns.includes("baseline")) {
            return {
              data: null,
              error: { code: "42703", message: "column study_plans.baseline does not exist" },
            }
          }
          return { data: fx.existingPlan, error: null }
        }
        return { data: null, error: null }
      },
      single: async () => {
        if (table === "users") return { data: { role: "student", tenant_id: TENANT }, error: null }
        if (table === "study_plans") {
          const written = pendingInsert ?? { ...(fx.existingPlan ?? {}), ...(pendingUpdate ?? {}) }
          return {
            data: {
              id: "plan-1",
              enrollment_id: ENROLLMENT,
              student_id: STUDENT,
              course_id: COURSE,
              tenant_id: TENANT,
              status: "active",
              start_date: TODAY,
              module_durations: [],
              preset: null,
              preferences: {},
              final_deadline_date: null,
              manager_deadline_date: null,
              ...written,
            },
            error: null,
          }
        }
        return { data: null, error: null }
      },
    }
    return builder
  }

  currentClient = {
    auth: { getUser: async () => ({ data: { user: { id: STUDENT } } }) },
    from,
  }
  return writes
}

/** O que o construtor manda: 0 nos concluídos, dias nos vivos. */
const INPUT = {
  enrollmentId: ENROLLMENT,
  moduleDurations: [0, 0, 0, 25, 0, 30, 30, 30],
  preset: null,
  preferences: { cascade: true, unit: "w" as const },
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(`${TODAY}T12:00:00.000Z`))
  currentContext = buildContext()
})

afterEach(() => {
  vi.useRealTimers()
  currentClient = null
  currentContext = null
})

/* --------- testes --------- */

describe("durações ancoradas por capítulo (D6 / AC-E1.5)", () => {
  it("grava [{chapterId, days}], não mais um array posicional", async () => {
    const writes = buildSupabase({ existingPlan: null })

    const res = await saveJourneyPlan(INPUT)

    expect(res.ok).toBe(true)
    const durations = writes.insert?.module_durations as { chapterId: string; days: number }[]
    expect(Array.isArray(durations)).toBe(true)
    expect(durations).toHaveLength(8)
    expect(durations[0]).toEqual({ chapterId: "ch-0", days: 0 })
    expect(durations.map((d) => d.chapterId)).toEqual([
      "ch-0",
      "ch-1",
      "ch-2",
      "ch-3",
      "ch-4",
      "ch-5",
      "ch-6",
      "ch-7",
    ])
  })

  it("módulo concluído grava 0 EXATO e vivo grava >= 4, com buraco no meio", async () => {
    const writes = buildSupabase({ existingPlan: null })

    await saveJourneyPlan(INPUT)

    const durations = writes.insert?.module_durations as { chapterId: string; days: number }[]
    for (const i of DONE_INDICES) expect(durations[i].days).toBe(0)
    for (const i of LIVE_INDICES) expect(durations[i].days).toBeGreaterThanOrEqual(4)
    // o buraco (módulo 3) é planejável, não é um resto
    expect(durations[3].days).toBeGreaterThan(0)
  })

  it("cliente que manda dias num módulo CONCLUÍDO tem o valor descartado", async () => {
    const writes = buildSupabase({ existingPlan: null })

    await saveJourneyPlan({ ...INPUT, moduleDurations: [99, 99, 99, 25, 99, 30, 30, 30] })

    const durations = writes.insert?.module_durations as { chapterId: string; days: number }[]
    for (const i of DONE_INDICES) expect(durations[i].days).toBe(0)
  })

  it("a soma dos vivos nunca ultrapassa a janela que RESTA (115 dias)", async () => {
    const writes = buildSupabase({ existingPlan: null })

    await saveJourneyPlan({ ...INPUT, moduleDurations: [0, 0, 0, 90, 0, 90, 90, 90] })

    const durations = writes.insert?.module_durations as { chapterId: string; days: number }[]
    expect(durations.reduce((a, d) => a + d.days, 0)).toBeLessThanOrEqual(115)
  })
})

describe("âncora do replanejamento (D2 / AC-E1.7)", () => {
  it("grava recalculated_at = planningAnchorDate (hoje), sem tocar no teto de coorte", async () => {
    const writes = buildSupabase({ existingPlan: null })

    await saveJourneyPlan(INPUT)

    expect(writes.insert?.recalculated_at).toBe(TODAY)
    // o teto continua ancorado na MATRÍCULA, não em hoje
    expect(writes.insert?.final_deadline_date).toBe(COHORT_CEILING)
    expect(writes.insert?.start_date).toBe(TODAY)
  })
})

describe("baseline — o ponto de partida (D3 / AC-E1.7)", () => {
  it("a PRIMEIRA confirmação grava a fotografia do progresso", async () => {
    const writes = buildSupabase({ existingPlan: null })

    await saveJourneyPlan(INPUT)

    const baseline = writes.insert?.baseline as {
      capturedAt: string
      progressPct: number
      sessionsDone: number
      reflectionsDone: number
      completedChapterIds: string[]
    }
    expect(baseline).toBeDefined()
    expect(baseline.progressPct).toBe(50)
    expect(baseline.sessionsDone).toBe(4) // 4 módulos concluídos, 1 sessão cada
    expect(baseline.reflectionsDone).toBe(4) // as 4 do módulo 3
    // o conjunto congelado é esparso, não um prefixo
    expect(baseline.completedChapterIds).toEqual(["ch-0", "ch-1", "ch-2", "ch-4"])
    expect(baseline.capturedAt).toBe(`${TODAY}T12:00:00.000Z`)
  })

  it("REVISAR não sobrescreve o baseline — o capturedAt original sobrevive", async () => {
    const original = {
      capturedAt: "2026-07-25T12:00:00.000Z",
      progressPct: 50,
      sessionsDone: 4,
      reflectionsDone: 4,
      completedChapterIds: ["ch-0", "ch-1", "ch-2", "ch-4"],
    }
    const writes = buildSupabase({
      existingPlan: { id: "plan-1", start_date: TODAY, baseline: original },
    })

    // o aluno revisa 40 dias depois, já com mais progresso
    vi.setSystemTime(new Date("2026-09-03T12:00:00.000Z"))
    const res = await updateJourneyPlan(INPUT)

    expect(res.ok).toBe(true)
    // a chave `baseline` sequer aparece no update — o ponto de partida é imutável
    expect(Object.hasOwn(writes.update ?? {}, "baseline")).toBe(false)
    expect(res.ok && res.plan.baseline?.capturedAt).toBe(original.capturedAt)
  })

  it("jornada preexistente SEM baseline (anterior ao JRN-E) ganha um na próxima escrita", async () => {
    const writes = buildSupabase({
      existingPlan: { id: "plan-1", start_date: TODAY, baseline: null },
    })

    await updateJourneyPlan(INPUT)

    expect(writes.update?.baseline).toBeDefined()
  })

  it("migration NÃO aplicada: salva sem baseline em vez de quebrar o aluno", async () => {
    const writes = buildSupabase({ existingPlan: null, baselineColumnMissing: true })

    const res = await saveJourneyPlan(INPUT)

    expect(res.ok).toBe(true)
    expect(Object.hasOwn(writes.insert ?? {}, "baseline")).toBe(false)
    // e o resto da escrita segue íntegro
    expect(writes.insert?.recalculated_at).toBe(TODAY)
    expect(writes.insert?.final_deadline_date).toBe(COHORT_CEILING)
  })
})

describe("degradação: curso sem contexto computável", () => {
  it("cai na régua antiga e ainda grava, sem baseline e sem ancoragem", async () => {
    currentContext = null
    const writes = buildSupabase({ existingPlan: null })

    const res = await saveJourneyPlan({
      ...INPUT,
      moduleDurations: [10, 10, 10, 10, 10, 10, 10, 10],
    })

    expect(res.ok).toBe(true)
    // array posicional, como antes — nada de âncora inventada
    expect(writes.insert?.module_durations).toEqual([10, 10, 10, 10, 10, 10, 10, 10])
    expect(Object.hasOwn(writes.insert ?? {}, "baseline")).toBe(false)
  })
})
