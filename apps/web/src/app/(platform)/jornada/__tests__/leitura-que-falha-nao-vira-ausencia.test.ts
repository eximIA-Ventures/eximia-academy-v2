import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// ===========================================================================
// LOOP-0c, formas E→NEGA e E→VAZIO dentro da Jornada (achados meus, além dos
// da tabela — mesma classe, mesmo dono).
//
//  1. `resolveEnrollmentContext` lê `enrollments` com `const { data } = ...`:
//     o erro nunca é desestruturado. Uma falha de leitura (RLS, timeout, blip)
//     deixa `enrollment` nulo e a action responde ao ALUNO "Matrícula não
//     encontrada" — a mesma frase que ele veria se a matrícula realmente não
//     existisse. O aluno conclui que perdeu a matrícula; a verdade é que não
//     conseguimos verificar.
//
//  2. A contagem de capítulos publicados usa `const { count } = ...` e depois
//     `count ?? 0`. Se a contagem falhar, o curso passa a ter ZERO módulos
//     para a validação da jornada, sem um único sinal.
//
// Em ambos, o par legítimo continua tendo de valer: matrícula que de fato não
// existe segue dizendo "não encontrada", e curso lido com sucesso segue
// salvando. Sem esses controles, um "erro sempre" passaria na metade de cima.
// ===========================================================================

let currentClient: unknown = null

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => currentClient) }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/journey/journey-plan-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/journey/journey-plan-data")>()
  return { ...actual, fetchJourneyCourseContext: vi.fn(async () => null) }
})

import { saveJourneyPlan } from "../actions"

type Row = Record<string, unknown>

const STUDENT = "student-1"
const TENANT = "tenant-1"
const COURSE = "course-1"
const ENROLLMENT = "enrollment-1"

const ERRO_DE_LEITURA = { code: "57014", message: "canceling statement due to statement timeout" }

interface Cenario {
  /** `enrollments` falha na leitura (diferente de não existir). */
  enrollmentIlegivel?: boolean
  /** A matrícula genuinamente não existe. */
  semMatricula?: boolean
  /** A contagem de `chapters` falha. */
  contagemIlegivel?: boolean
}

function chapterCountBuilder(cenario: Cenario) {
  const resposta = cenario.contagemIlegivel
    ? { data: null, count: null, error: ERRO_DE_LEITURA }
    : { data: [], count: 8, error: null }
  const p = Promise.resolve(resposta) as Promise<unknown> & Record<string, unknown>
  p.select = () => p
  p.eq = () => p
  return p
}

function montarSupabase(cenario: Cenario) {
  const escritas: { insert: Row | null } = { insert: null }

  const from = (table: string) => {
    if (table === "chapters") return chapterCountBuilder(cenario)
    let pendingInsert: Row | null = null

    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      limit: () => builder,
      insert: (payload: Row) => {
        pendingInsert = payload
        escritas.insert = payload
        return builder
      },
      update: () => builder,
      maybeSingle: async () => {
        if (table === "enrollments") {
          if (cenario.enrollmentIlegivel) return { data: null, error: ERRO_DE_LEITURA }
          if (cenario.semMatricula) return { data: null, error: null }
          return {
            data: {
              id: ENROLLMENT,
              course_id: COURSE,
              tenant_id: TENANT,
              created_at: "2026-05-21T09:12:00.000Z",
              status: "active",
              progress: { percentage: 50 },
            },
            error: null,
          }
        }
        if (table === "courses") {
          return { data: { deadline_days: 180, manager_deadline_days: null }, error: null }
        }
        if (table === "study_plans") return { data: null, error: null }
        return { data: null, error: null }
      },
      single: async () => {
        if (table === "users") return { data: { role: "student", tenant_id: TENANT }, error: null }
        if (table === "study_plans") {
          return {
            data: {
              id: "plan-1",
              enrollment_id: ENROLLMENT,
              student_id: STUDENT,
              course_id: COURSE,
              tenant_id: TENANT,
              status: "active",
              start_date: "2026-07-25",
              module_durations: [],
              preset: null,
              preferences: {},
              final_deadline_date: null,
              manager_deadline_date: null,
              ...(pendingInsert ?? {}),
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
  return escritas
}

const ENTRADA = {
  enrollmentId: ENROLLMENT,
  moduleDurations: [10, 10, 10, 10, 10, 10, 10, 10],
  preset: null,
  preferences: { cascade: false, unit: "d" as const },
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  currentClient = null
})

describe("Jornada — falha de leitura não pode virar 'não existe'", () => {
  it("`enrollments` ilegível NÃO diz ao aluno que a matrícula não foi encontrada", async () => {
    montarSupabase({ enrollmentIlegivel: true })

    const r = await saveJourneyPlan(ENTRADA)

    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).not.toMatch(/não encontrada/i)
    expect(r.error).toMatch(/não foi possível|tente novamente/i)
  })

  it("controle positivo — matrícula que de fato não existe continua dizendo isso", async () => {
    montarSupabase({ semMatricula: true })

    const r = await saveJourneyPlan(ENTRADA)

    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toMatch(/não encontrada/i)
  })
})

describe("Jornada — contagem de módulos ilegível não pode virar 'curso com zero módulos'", () => {
  it("falha ao contar `chapters` interrompe o salvamento em vez de assumir zero", async () => {
    montarSupabase({ contagemIlegivel: true })

    const r = await saveJourneyPlan(ENTRADA)

    expect(r.ok).toBe(false)
  })

  it("controle positivo — contagem legível salva normalmente", async () => {
    const escritas = montarSupabase({})

    const r = await saveJourneyPlan(ENTRADA)

    expect(r.ok).toBe(true)
    expect(escritas.insert).not.toBeNull()
  })
})
