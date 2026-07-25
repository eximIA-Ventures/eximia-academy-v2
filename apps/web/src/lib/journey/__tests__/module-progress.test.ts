import {
  computeChapterCompletion,
  computeModuleJourney,
} from "@/lib/analytics/study-plan-dashboard"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fetchJourneyCourseContext } from "../journey-plan-data"
import { buildModuleProgress } from "../module-progress"
import { computeRemainingWindow, progressAwareNeutralDurations } from "../plan-math"

/**
 * JRN-E — o progresso real do aluno chega ao contexto do construtor.
 *
 * ┌─ O ALUNO REAL, e por que ele derruba qualquer desenho de "prefixo" ────────┐
 * │ Matrícula 77f43ca0-0180-421b-ab08-b2c5febd0b14, ~50%, apurado 2026-07-25:  │
 * │                                                                           │
 * │   módulo | 0    1    2    3         4    5      6        7                │
 * │   estado | done done done INTOCADO  done doing  planned  planned          │
 * │                                                                           │
 * │ O progresso NÃO é um prefixo: há um BURACO no módulo 3. Um teste com       │
 * │ "os N primeiros concluídos" passaria mesmo com o código errado.            │
 * │                                                                           │
 * │ E o módulo 3 tem 4 de 4 reflexões feitas e 0 interações — trabalho real    │
 * │ que o motor de status ainda chama de "planned" (R3 da story). Ele NÃO      │
 * │ trava, mas também não pode pedir tempo cheio.                              │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * Os testes de `fetchJourneyCourseContext` exercitam a função REAL contra um
 * stub da fronteira Supabase — nada da regra done/doing/planned é reimplementado
 * aqui, ela vem de `computeModuleJourney` (Artigo IV).
 */

/* --------- fixtures do caso real --------- */

const STUDENT = "student-1"
const COURSE = "course-1"
const TODAY = "2026-07-25"
const ENROLLED_AT = "2026-05-21T09:12:00.000Z"
/** matrícula + deadline_days(180) — o teto de COORTE, imune ao clique. */
const COHORT_CEILING = "2026-11-17"

const CHAPTERS = Array.from({ length: 8 }, (_, i) => ({
  id: `ch-${i}`,
  title: `Módulo ${i + 1}`,
  order: i,
}))

/** Concluídos: 0,1,2,4. Sessão ATIVA em 5 (→ "doing"). 3,6,7 sem sessão. */
const SESSION_ROWS = [
  { chapter_id: "ch-0", status: "completed" },
  { chapter_id: "ch-1", status: "completed" },
  { chapter_id: "ch-2", status: "completed" },
  { chapter_id: "ch-4", status: "completed" },
  { chapter_id: "ch-5", status: "active" },
]

const REFLECTION_PROMPT = "> Reflexão: o que você faria diferente?"

/** ch-3 tem 4 slides de reflexão (o "4 de 4" do aluno real); ch-6 tem 1. */
const SLIDE_ROWS = [
  ...Array.from({ length: 4 }, (_, i) => ({
    chapter_id: "ch-3",
    text_content: `${REFLECTION_PROMPT} (${i})`,
  })),
  { chapter_id: "ch-6", text_content: REFLECTION_PROMPT },
  { chapter_id: "ch-0", text_content: "slide sem bloco de reflexão" },
]

/** As 4 reflexões que o aluno JÁ respondeu, todas no módulo 3. */
const REFLECTION_ROWS = Array.from({ length: 4 }, (_, i) => ({
  slide_id: `sl-${i}`,
  chapter_slides: { chapter_id: "ch-3" },
}))

const EXPECTED_STATUS = [
  "done",
  "done",
  "done",
  "planned",
  "done",
  "doing",
  "planned",
  "planned",
] as const

/* --------- stub de fronteira Supabase --------- */

interface StubOverrides {
  deadlineDays?: number | null
  managerDeadlineDays?: number | null
  sessions?: { chapter_id: string; status: string }[]
  reflections?: { slide_id: string; chapter_slides: { chapter_id: string } }[]
  chapters?: { id: string; title: string; order: number }[]
}

/** Promise encadeável: `await builder` funciona e todo método devolve ele mesmo. */
function thenable(result: { data: unknown; error: unknown }) {
  const p = Promise.resolve(result) as Promise<unknown> & Record<string, unknown>
  for (const m of ["select", "eq", "in", "is", "neq", "order", "limit"]) {
    p[m] = () => p
  }
  p.maybeSingle = async () => result
  p.single = async () => result
  return p
}

function buildSupabase(over: StubOverrides = {}) {
  const chapters = over.chapters ?? CHAPTERS
  const from = (table: string) => {
    switch (table) {
      case "enrollments":
        return thenable({
          data: [
            {
              progress: { percentage: 50 },
              created_at: ENROLLED_AT,
              courses: {
                id: COURSE,
                title: "Análise e Solução de Problemas",
                deadline_days: over.deadlineDays === undefined ? 180 : over.deadlineDays,
                status: "published",
              },
            },
          ],
          error: null,
        })
      case "courses":
        return thenable({
          data: {
            deadline_days: over.deadlineDays === undefined ? 180 : over.deadlineDays,
            manager_deadline_days: over.managerDeadlineDays ?? null,
          },
          error: null,
        })
      case "chapters":
        return thenable({ data: chapters, error: null })
      case "chapter_slides":
        return thenable({ data: SLIDE_ROWS, error: null })
      case "sessions":
        return thenable({ data: over.sessions ?? SESSION_ROWS, error: null })
      case "slide_reflections":
        return thenable({ data: over.reflections ?? REFLECTION_ROWS, error: null })
      default:
        return thenable({ data: null, error: null })
    }
  }
  // biome-ignore lint/suspicious/noExplicitAny: stub de fronteira, tipagem do client real não importa aqui
  return { from } as any
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(`${TODAY}T12:00:00.000Z`))
})

afterEach(() => {
  vi.useRealTimers()
})

/* --------- AC-E1.1 — o progresso chega ao contexto --------- */

describe("fetchJourneyCourseContext — AC-E1.1 (progresso no contexto)", () => {
  it("reproduz EXATAMENTE o vetor de status do aluno real, buraco incluído", async () => {
    const ctx = await fetchJourneyCourseContext(buildSupabase(), STUDENT, COURSE)

    expect(ctx).not.toBeNull()
    expect(ctx?.modules.map((m) => m.progress.status)).toEqual([...EXPECTED_STATUS])
    // o módulo 3 fica VIVO entre concluídos — não é um prefixo
    expect(ctx?.modules[3].progress.frozen).toBe(false)
    expect(ctx?.modules[4].progress.frozen).toBe(true)
  })

  it("frozen ⟺ done, para todos os 8 módulos", async () => {
    const ctx = await fetchJourneyCourseContext(buildSupabase(), STUDENT, COURSE)
    for (const m of ctx?.modules ?? []) {
      expect(m.progress.frozen).toBe(m.progress.status === "done")
    }
  })

  it("as 4 reflexões respondidas do módulo 3 são contadas (R3: esforço reconhecido)", async () => {
    const ctx = await fetchJourneyCourseContext(buildSupabase(), STUDENT, COURSE)
    const mod3 = ctx?.modules[3]

    expect(mod3?.reflectionsExpected).toBe(4)
    expect(mod3?.progress.reflectionsDone).toBe(4)
    expect(mod3?.progress.sessionsDone).toBe(0)
    // 4 feitas de (1 interação + 4 reflexões) esperadas = 0.8 — não trava, mas
    // já não pede tempo cheio.
    expect(mod3?.progress.completedRatio).toBeCloseTo(0.8, 5)
    expect(mod3?.progress.status).toBe("planned")
  })

  it("sessões concluídas são contadas por capítulo", async () => {
    const ctx = await fetchJourneyCourseContext(buildSupabase(), STUDENT, COURSE)
    expect(ctx?.modules[0].progress.sessionsDone).toBe(1)
    expect(ctx?.modules[5].progress.sessionsDone).toBe(0) // ativa, não concluída
    expect(ctx?.modules[7].progress.sessionsDone).toBe(0)
  })
})

/* --------- AC-E1.2 — janela restante no contexto --------- */

describe("fetchJourneyCourseContext — AC-E1.2 (janela restante)", () => {
  it("teto de coorte = matrícula + deadline_days, e a âncora do que resta é HOJE", async () => {
    const ctx = await fetchJourneyCourseContext(buildSupabase(), STUDENT, COURSE)

    expect(ctx?.startDate).toBe("2026-05-21")
    expect(ctx?.cohortDeadlineDate).toBe(COHORT_CEILING)
    expect(ctx?.planningAnchorDate).toBe(TODAY)
    expect(ctx?.remainingWindowDays).toBe(115)
    // o teto NÃO é hoje + 180 (seria o teto furável por procrastinação)
    expect(ctx?.cohortDeadlineDate).not.toBe("2027-01-21")
  })

  it("sem meta do gestor (o caso REAL nos dois tenants) degrada para null — R5", async () => {
    const ctx = await fetchJourneyCourseContext(buildSupabase(), STUDENT, COURSE)
    expect(ctx?.managerDeadlineDays).toBeNull()
    expect(ctx?.cohortManagerDeadlineDate).toBeNull()
  })

  it("com meta do gestor, ela também é ancorada na matrícula", async () => {
    const ctx = await fetchJourneyCourseContext(
      buildSupabase({ managerDeadlineDays: 120 }),
      STUDENT,
      COURSE,
    )
    expect(ctx?.cohortManagerDeadlineDate).toBe("2026-09-18") // 2026-05-21 + 120
  })

  it("a janela derivada do contexto real produz frozen [0,1,2,4] e vivos [3,5,6,7]", async () => {
    const ctx = await fetchJourneyCourseContext(buildSupabase(), STUDENT, COURSE)
    const w = computeRemainingWindow(
      ctx?.modules ?? [],
      ctx?.planningAnchorDate ?? TODAY,
      ctx?.cohortDeadlineDate ?? null,
    )
    expect(w.frozenIndices).toEqual([0, 1, 2, 4])
    expect(w.remainingIndices).toEqual([3, 5, 6, 7])
    expect(w.remainingDays).toBe(115)
  })

  it("ponta a ponta: a partida do construtor zera os concluídos e usa a janela inteira", async () => {
    const ctx = await fetchJourneyCourseContext(buildSupabase(), STUDENT, COURSE)
    const w = computeRemainingWindow(
      ctx?.modules ?? [],
      ctx?.planningAnchorDate ?? TODAY,
      ctx?.cohortDeadlineDate ?? null,
    )
    const durations = progressAwareNeutralDurations(ctx?.modules ?? [], w)

    expect(durations[0]).toBe(0)
    expect(durations[4]).toBe(0)
    expect(durations[3]).toBeGreaterThanOrEqual(4)
    expect(durations.reduce((a, b) => a + b, 0)).toBe(115)
    // o módulo 3, com 80% do trabalho feito, pede MENOS que os intocados 6 e 7
    expect(durations[3]).toBeLessThan(durations[6])
  })

  it("curso sem deadline computável continua degradando para null (comportamento antigo)", async () => {
    const ctx = await fetchJourneyCourseContext(
      buildSupabase({ deadlineDays: null }),
      STUDENT,
      COURSE,
    )
    expect(ctx).toBeNull()
  })

  it("curso sem capítulos publicados não quebra", async () => {
    const ctx = await fetchJourneyCourseContext(buildSupabase({ chapters: [] }), STUDENT, COURSE)
    expect(ctx?.modules).toEqual([])
    expect(ctx?.remainingWindowDays).toBe(115)
  })
})

/* --------- buildModuleProgress puro --------- */

describe("buildModuleProgress — AC-E1.6 (zero reimplementação de status)", () => {
  /** Constrói a cadeia REAL: predicado → motor de status → progresso. */
  function chain(sessions = SESSION_ROWS, reflExpected = new Map([["ch-3", 4]])) {
    const { completedChapterIds, continueChapterId } = computeChapterCompletion(sessions, CHAPTERS)
    const journey = computeModuleJourney(
      CHAPTERS.map((ch) => ({
        chapterId: ch.id,
        title: ch.title,
        order: ch.order,
        reflectionsExpected: reflExpected.get(ch.id) ?? 0,
      })),
      completedChapterIds,
      continueChapterId,
      new Date(ENROLLED_AT),
      new Date(COHORT_CEILING),
    )
    return { journey, completedChapterIds, continueChapterId }
  }

  it("o status vem PRONTO do motor existente — nunca é rederivado aqui", () => {
    const { journey } = chain()
    const progress = buildModuleProgress(journey, new Map(), new Map())
    expect(CHAPTERS.map((ch) => progress.get(ch.id)?.status)).toEqual([...EXPECTED_STATUS])
  })

  it('"done" força completedRatio 1, mesmo com 1 de 5 perguntas feitas (R2)', () => {
    const { journey } = chain(SESSION_ROWS, new Map([["ch-0", 4]]))
    const progress = buildModuleProgress(journey, new Map([["ch-0", 1]]), new Map())
    // 1 de 5 esperados seria 0.2 — mas a regra `done` do produto manda
    expect(progress.get("ch-0")?.completedRatio).toBe(1)
    expect(progress.get("ch-0")?.frozen).toBe(true)
  })

  it("denominador 0 → ratio 0 (não inventa 1 e não trava um módulo não medido)", () => {
    // `computeModuleJourney` fixa interactionsExpected em 1, então o denominador
    // zero não é alcançável pela cadeia real. O item é montado à mão AQUI para
    // exercitar a guarda diretamente, em vez de fingir que a cadeia a produz.
    const semNadaEsperado = [
      {
        chapterId: "ch-x",
        title: "Módulo sem nada esperado",
        order: 0,
        interactionsExpected: 0,
        reflectionsExpected: 0,
        status: "planned" as const,
        suggestedDeadline: null,
      },
    ]
    const progress = buildModuleProgress(semNadaEsperado, new Map([["ch-x", 3]]), new Map())
    expect(progress.get("ch-x")?.completedRatio).toBe(0)
    expect(progress.get("ch-x")?.frozen).toBe(false)
  })

  it("ratio nunca passa de 1, mesmo com mais trabalho do que o esperado", () => {
    const { journey } = chain()
    const progress = buildModuleProgress(journey, new Map([["ch-7", 9]]), new Map([["ch-7", 9]]))
    expect(progress.get("ch-7")?.completedRatio).toBe(1)
    // ratio 1 NÃO trava: só `status === "done"` congela
    expect(progress.get("ch-7")?.frozen).toBe(false)
  })

  it("capítulo sem contagem lida entra zerado, não indefinido", () => {
    const { journey } = chain()
    const progress = buildModuleProgress(journey, new Map(), new Map())
    expect(progress.get("ch-6")).toEqual({
      status: "planned",
      sessionsDone: 0,
      reflectionsDone: 0,
      completedRatio: 0,
      frozen: false,
    })
  })
})

/* --------- computeChapterCompletion: paridade da extração --------- */

describe("computeChapterCompletion — extração verbatim do predicado", () => {
  const inline = (sessions: { chapter_id: string | null; status: string | null }[]) => {
    // A fórmula que vivia inline em plan-dashboard-data.ts:228-234, reproduzida
    // AQUI (só no teste) para provar que a extração não mudou comportamento.
    const completed = new Set(
      sessions.filter((s) => s.status === "completed").map((s) => s.chapter_id),
    )
    const active = sessions.find((s) => s.status === "active")
    return active ? active.chapter_id : (CHAPTERS.find((ch) => !completed.has(ch.id))?.id ?? null)
  }

  it("mesmo continueChapterId do código original — sessão ativa vence", () => {
    expect(computeChapterCompletion(SESSION_ROWS, CHAPTERS).continueChapterId).toBe(
      inline(SESSION_ROWS),
    )
    expect(computeChapterCompletion(SESSION_ROWS, CHAPTERS).continueChapterId).toBe("ch-5")
  })

  it("sem sessão ativa cai no primeiro capítulo pendente (o buraco, ch-3)", () => {
    const semAtiva = SESSION_ROWS.filter((s) => s.status !== "active")
    expect(computeChapterCompletion(semAtiva, CHAPTERS).continueChapterId).toBe("ch-3")
    expect(computeChapterCompletion(semAtiva, CHAPTERS).continueChapterId).toBe(inline(semAtiva))
  })

  it("borda preservada: sessão ativa com chapter_id nulo devolve null, não o pendente", () => {
    const comNulo = [{ chapter_id: null, status: "active" }]
    expect(computeChapterCompletion(comNulo, CHAPTERS).continueChapterId).toBeNull()
    expect(computeChapterCompletion(comNulo, CHAPTERS).continueChapterId).toBe(inline(comNulo))
  })

  it("concluídos são exatamente os capítulos com sessão completed", () => {
    const { completedChapterIds } = computeChapterCompletion(SESSION_ROWS, CHAPTERS)
    expect([...completedChapterIds].sort()).toEqual(["ch-0", "ch-1", "ch-2", "ch-4"])
  })
})
