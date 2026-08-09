import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * EPIC-JORNADA — Âncora de coorte do teto duro (Hugo, 2026-07-25).
 *
 * Bug real medido em produção: o construtor MOSTRAVA "Disponível até" a partir da
 * data de MATRÍCULA (`context.startDate` ← `leading.startDate` ← `enrollments.
 * created_at`), enquanto `saveJourneyPlan` GRAVAVA a partir de `new Date()`.
 * Aluno matriculado em 2026-05-21, `deadline_days` 180, 65 dias decorridos: a
 * tela prometia 17/nov/2026 e o banco recebia 21/jan/2027. Cada dia de demora do
 * aluno em clicar empurrava o teto duro um dia para frente.
 *
 * Estes testes fixam o relógio no caso real e exercitam a action de verdade
 * (mock só da fronteira Supabase), afirmando sobre o PAYLOAD efetivamente
 * enviado ao banco — não sobre uma reimplementação da aritmética.
 */

/* --------- mocks de fronteira --------- */

let currentClient: unknown = null

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => currentClient),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { cohortDeadlineDate } from "@/lib/journey/plan-math"
import { saveJourneyPlan, updateJourneyPlan } from "../actions"

/* --------- fixtures do caso real --------- */

const STUDENT = "student-1"
const TENANT = "tenant-1"
const COURSE = "course-1"
const ENROLLMENT = "enrollment-1"

/** Hoje, congelado. 65 dias após a matrícula do caso real. */
const TODAY = "2026-07-25"
/** `enrollments.created_at` do caso real medido em produção. */
const ENROLLED_AT = "2026-05-21T09:12:00.000Z"
/** matrícula + 180 — o que o construtor promete na tela. */
const COHORT_CEILING = "2026-11-17"
/** hoje + 180 — o teto inflado que o código antigo gravava. */
const CLICK_CEILING = "2027-01-21"

type Row = Record<string, unknown>

interface Fixture {
  enrollment: Row | null
  course: Row
  chapterCount: number
  existingPlan: Row | null
}

function defaultFixture(over: Partial<Fixture> = {}): Fixture {
  return {
    enrollment: {
      id: ENROLLMENT,
      course_id: COURSE,
      tenant_id: TENANT,
      created_at: ENROLLED_AT,
    },
    course: { deadline_days: 180, manager_deadline_days: null },
    chapterCount: 4,
    existingPlan: null,
    ...over,
  }
}

/** Builder de `chapters`: um Promise real (`select(id,{count,head})` é aguardado
 *  direto, sem `.single()`) com `select`/`eq` encadeáveis por cima. */
function chapterCountBuilder(count: number) {
  const p = Promise.resolve({ data: [], count, error: null }) as Promise<unknown> &
    Record<string, unknown>
  p.select = () => p
  p.eq = () => p
  return p
}

/**
 * Stub Supabase encadeável por tabela. Registra insert/update para os testes
 * afirmarem sobre o que de fato iria para o banco.
 */
function buildSupabase(fx: Fixture) {
  const writes: { insert: Row | null; update: Row | null } = { insert: null, update: null }

  const from = (table: string) => {
    if (table === "chapters") return chapterCountBuilder(fx.chapterCount)
    let pendingInsert: Row | null = null
    let pendingUpdate: Row | null = null

    const builder: Record<string, unknown> = {
      select: () => builder,
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
        if (table === "enrollments") return { data: fx.enrollment, error: null }
        if (table === "courses") return { data: fx.course, error: null }
        if (table === "study_plans") return { data: fx.existingPlan, error: null }
        return { data: null, error: null }
      },
      single: async () => {
        if (table === "users") {
          return { data: { role: "student", tenant_id: TENANT }, error: null }
        }
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

const INPUT = {
  enrollmentId: ENROLLMENT,
  moduleDurations: [10, 10, 10, 10],
  preset: null,
  preferences: { cascade: true, unit: "w" as const },
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(`${TODAY}T12:00:00.000Z`))
})

afterEach(() => {
  vi.useRealTimers()
  currentClient = null
})

/* --------- testes --------- */

describe("teto duro ancorado na coorte (matrícula), não no clique", () => {
  it("grava final_deadline_date = matrícula + deadline_days (caso real de produção)", async () => {
    const writes = buildSupabase(defaultFixture())

    const res = await saveJourneyPlan(INPUT)

    expect(res.ok).toBe(true)
    expect(writes.insert?.final_deadline_date).toBe(COHORT_CEILING)
    // o teto inflado pelo relógio do clique é exatamente o que não pode voltar
    expect(writes.insert?.final_deadline_date).not.toBe(CLICK_CEILING)
  })

  it("ancora também a meta do gestor na matrícula", async () => {
    const writes = buildSupabase(
      defaultFixture({ course: { deadline_days: 180, manager_deadline_days: 120 } }),
    )

    await saveJourneyPlan(INPUT)

    // 2026-05-21 + 120 dias
    expect(writes.insert?.manager_deadline_date).toBe("2026-09-18")
  })

  it("o que o banco grava é a MESMA data que o construtor mostra", async () => {
    const writes = buildSupabase(defaultFixture())

    await saveJourneyPlan(INPUT)

    // `context.startDate` do construtor = created_at truncado (journey-plan-data
    // `toIsoDate`); o rótulo "Disponível até" é essa âncora + finalDeadlineDays.
    const shownByBuilder = cohortDeadlineDate(ENROLLED_AT.slice(0, 10), 180)
    expect(writes.insert?.final_deadline_date).toBe(shownByBuilder)
  })

  it("start_date continua sendo hoje — só o TETO é da coorte", async () => {
    const writes = buildSupabase(defaultFixture())

    await saveJourneyPlan(INPUT)

    expect(writes.insert?.start_date).toBe(TODAY)
    expect(writes.insert?.final_deadline_date).not.toBe(
      cohortDeadlineDate(TODAY, 180), // seria o bug
    )
  })

  it("curso sem deadline_days grava os dois prazos nulos (degradação preservada)", async () => {
    const writes = buildSupabase(
      defaultFixture({ course: { deadline_days: null, manager_deadline_days: null } }),
    )

    const res = await saveJourneyPlan(INPUT)

    expect(res.ok).toBe(true)
    expect(writes.insert?.final_deadline_date).toBeNull()
    expect(writes.insert?.manager_deadline_date).toBeNull()
  })
})

describe("revisar a jornada não move o teto", () => {
  it("update 40 dias depois mantém o mesmo final_deadline_date", async () => {
    const writes = buildSupabase(
      defaultFixture({
        existingPlan: { id: "plan-1", start_date: TODAY, final_deadline_date: COHORT_CEILING },
      }),
    )

    // o aluno reabre e revisa muito depois de ter montado a jornada
    vi.setSystemTime(new Date("2026-09-03T12:00:00.000Z"))
    const res = await updateJourneyPlan({ ...INPUT, moduleDurations: [20, 20, 20, 20] })

    expect(res.ok).toBe(true)
    expect(writes.update?.final_deadline_date).toBe(COHORT_CEILING)
    // e a revisão não reescreve o start_date original
    expect(writes.update?.start_date).toBeUndefined()
  })
})

describe("borda: teto de coorte já vencido", () => {
  it("grava o teto real no passado, sem estender e sem explodir", async () => {
    const writes = buildSupabase(
      defaultFixture({
        enrollment: {
          id: ENROLLMENT,
          course_id: COURSE,
          tenant_id: TENANT,
          created_at: "2025-01-10T00:00:00.000Z",
        },
      }),
    )

    const res = await saveJourneyPlan(INPUT)

    expect(res.ok).toBe(true)
    // 2025-01-10 + 180 — vencido há mais de um ano, e é essa a verdade gravada
    expect(writes.insert?.final_deadline_date).toBe("2025-07-09")
    expect(new Date(String(writes.insert?.final_deadline_date)).getTime()).toBeLessThan(Date.now())
  })

  it("matrícula sem created_at legível cai para hoje em vez de gravar data inválida", async () => {
    const writes = buildSupabase(
      defaultFixture({
        enrollment: { id: ENROLLMENT, course_id: COURSE, tenant_id: TENANT, created_at: null },
      }),
    )

    const res = await saveJourneyPlan(INPUT)

    expect(res.ok).toBe(true)
    expect(writes.insert?.final_deadline_date).toBe(cohortDeadlineDate(TODAY, 180))
    expect(String(writes.insert?.final_deadline_date)).not.toContain("Invalid")
  })
})
