import type { PlanComparisonResponse, PlanDashboardData } from "@/lib/analytics/plan-dashboard-data"
import type { StudyPlanDiagnostic } from "@/lib/analytics/study-plan-projection"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PlanComparisonPanel } from "../plan-comparison-panel"

// ---------------------------------------------------------------------------
// SH-3.3 R7 (Hugo 2026-07-21) — "Comparativo com o Plano" toggle. These tests
// verify the PANEL renders the REAL data it's given (`computeCumulativeExpected`/
// `StudyPlanDiagnostic`/`computeWeeklyComparison` fields, threaded through
// /api/analytics/plan-dashboard) without reimplementing the "planejado ×
// realizado" math — the panel is pure presentation over an already-computed
// payload, never a re-derivation.
//
// R7 correction: R6 (previous round) read Sessões/Reflexões "Realizado" as
// WEEK-SCOPED. Hugo tested and corrected this — those two rows are CUMULATIVE
// since the start of the plan, exactly like "Progresso da trilha" always was.
// `sessionsDoneCount`/`reflDoneCount` (diagnostic) now feed "Realizado";
// `cumulativeExpected` (planDashboardData) feeds "Meu plano". `weeklyComparison`
// still exists on the payload — it now ONLY powers the SEPARATE "Meu plano da
// semana" checklist and "Próximo ajuste sugerido" card, tested further below.
// ---------------------------------------------------------------------------

function mockFetchOnce(body: unknown, ok = true) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(ok ? body : { error: "boom" }),
  })
}

// Named base fixtures (never null) so overrides never need a non-null
// assertion to spread/narrow them.
const BASE_DIAGNOSTIC: StudyPlanDiagnostic = {
  progressNow: 40,
  progressTarget: 60,
  sessionsDoneCount: 7,
  reflDoneCount: 8,
  reflTotal: 41,
  reflNow: 19.5,
  reflTarget: 60,
  daysLeft: 30,
  weeksLeft: 4,
}
const BASE_WEEKLY: NonNullable<PlanDashboardData["weeklyComparison"]> = {
  weekStart: "2026-07-20T00:00:00.000Z",
  weekEnd: "2026-07-26T23:59:59.999Z",
  planned: { sessions: 6, reflections: 3 },
  realized: { sessions: 2, reflections: 1 },
  situation: "pendente",
}
const BASE_PLAN_DATA: PlanDashboardData = {
  courseTitle: "Precificação Estratégica",
  currentChapterTitle: "Módulo de Precificação",
  currentChapterOrder: 2,
  moduleJourney: [],
  weeklyComparison: BASE_WEEKLY,
  avgMinutesPerSession: 12,
  // ~61 dias decorridos (matrícula 2026-05-21 → hoje 2026-07-21), ritmo default
  // (Seg/Qua/Sex, 2 sessões/dia, reflFocus on): round(61/7 * 6) = 52 sessões,
  // round(61/7 * 3) = 26 reflexões — caso real do Rinaldo (dado plausível).
  cumulativeExpected: { sessions: 52, reflections: 26 },
}
const FULL_RESPONSE: PlanComparisonResponse = {
  diagnostic: BASE_DIAGNOSTIC,
  planDashboardData: BASE_PLAN_DATA,
  classAvgProgressPct: 55,
  // JRN-D (Hugo 2026-07-24) — o painel só renderiza a tabela quando há jornada
  // PERSISTIDA; o `cumulativeExpected` acima já vem reancorado em moduleDurations
  // pela API. journeyCourseId direciona o CTA/rota ao /jornada?curso= certo.
  hasJourney: true,
  journeyCourseId: "course-x",
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("PlanComparisonPanel — loading/error/empty degradação", () => {
  it("mostra skeleton enquanto carrega", () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {})) // never resolves
    render(<PlanComparisonPanel continueHref="/courses/next" />)
    expect(screen.getByTestId("plan-comparison-skeleton")).toBeInTheDocument()
  })

  it("fetch falha → estado de erro, nunca quebra a página", async () => {
    mockFetchOnce(null, false)
    render(<PlanComparisonPanel continueHref="/courses/next" />)
    await waitFor(() => expect(screen.getByTestId("plan-comparison-error")).toBeInTheDocument())
  })

  it("sem jornada persistida → estado-convite com CTA 'Montar minha jornada' para /jornada (nunca número fake)", async () => {
    // JRN-D — hasJourney:false dispara o estado-convite honesto.
    mockFetchOnce({
      diagnostic: null,
      planDashboardData: null,
      classAvgProgressPct: null,
      hasJourney: false,
      journeyCourseId: null,
    })
    render(<PlanComparisonPanel continueHref="/courses/next" />)
    await waitFor(() => expect(screen.getByTestId("plan-comparison-cta-empty")).toBeInTheDocument())
    expect(screen.getByTestId("plan-comparison-cta-empty")).toHaveAttribute("href", "/jornada")
    expect(screen.getByTestId("plan-comparison-cta-empty").textContent).toContain(
      "Montar minha jornada",
    )
  })

  it("diagnóstico existe mas SEM jornada persistida → ainda mostra o convite, com ?curso= no CTA", async () => {
    // JRN-D — mesmo com diagnostic/plano computáveis, sem study_plan ativa o
    // painel NÃO inventa "combinado": convida a montar a jornada daquele curso.
    mockFetchOnce({
      ...FULL_RESPONSE,
      hasJourney: false,
      journeyCourseId: "course-x",
    })
    render(<PlanComparisonPanel continueHref="/courses/next" />)
    await waitFor(() =>
      expect(screen.getByTestId("plan-comparison-no-journey")).toBeInTheDocument(),
    )
    expect(screen.getByTestId("plan-comparison-cta-empty")).toHaveAttribute(
      "href",
      "/jornada?curso=course-x",
    )
    expect(screen.queryByTestId("plan-comparison-table")).toBeNull()
  })
})

describe("PlanComparisonPanel — tabela MEU PLANO | REALIZADO | COMO ESTOU | AÇÃO", () => {
  it("renderiza as 3 linhas reais (sessões, reflexões, progresso), Realizado CUMULATIVO batendo com a Visão detalhada", async () => {
    mockFetchOnce(FULL_RESPONSE)
    render(<PlanComparisonPanel continueHref="/courses/next" />)
    await waitFor(() => expect(screen.getByTestId("plan-comparison-table")).toBeInTheDocument())

    // caso real do Rinaldo: Realizado = subject.interactions/.reflections (7 e 8),
    // os MESMOS números que "Interações realizadas"/"Reflexões realizadas" mostram
    // na aba Visão detalhada — não mais 0, não mais um recorte semanal.
    const sessionsRow = screen.getByTestId("plan-row-sessions")
    expect(sessionsRow.textContent).toContain("52") // meu plano (cumulativo esperado)
    expect(sessionsRow.textContent).toContain("7") // realizado (lifetime, == Visão detalhada)
    expect(sessionsRow.textContent).toContain("Pendente")

    const reflectionsRow = screen.getByTestId("plan-row-reflections")
    expect(reflectionsRow.textContent).toContain("26")
    expect(reflectionsRow.textContent).toContain("8")

    const progressRow = screen.getByTestId("plan-row-progress")
    expect(progressRow.textContent).toContain("60%") // meta
    expect(progressRow.textContent).toContain("40%") // realizado
  })

  it("rótulo é 'Sessões' puro (SH-3.3 R6), nunca 'Sessões (interações)' — o dado é só contagem de sessão, não de interação", async () => {
    mockFetchOnce(FULL_RESPONSE)
    render(<PlanComparisonPanel continueHref="/courses/next" />)
    await waitFor(() => expect(screen.getByTestId("plan-row-sessions")).toBeInTheDocument())
    expect(screen.getByTestId("plan-row-sessions").textContent).toContain("Sessões")
    expect(screen.getByTestId("plan-row-sessions").textContent).not.toContain("interações")
  })

  it("Sessões/Reflexões e Progresso da trilha NÃO mostram qualificador de janela (R7 — nenhuma linha é mais semanal)", async () => {
    mockFetchOnce(FULL_RESPONSE)
    render(<PlanComparisonPanel continueHref="/courses/next" />)
    await waitFor(() => expect(screen.getByTestId("plan-comparison-table")).toBeInTheDocument())
    expect(screen.queryByTestId("plan-row-sessions-realized-qualifier")).toBeNull()
    expect(screen.queryByTestId("plan-row-reflections-realized-qualifier")).toBeNull()
    expect(screen.queryByTestId("plan-row-progress-realized-qualifier")).toBeNull()
  })

  it("nenhuma menção a 'esta semana'/janela semanal na tabela (a legenda antiga da R6 foi removida)", async () => {
    mockFetchOnce(FULL_RESPONSE)
    render(<PlanComparisonPanel continueHref="/courses/next" />)
    await waitFor(() => expect(screen.getByTestId("plan-comparison-table")).toBeInTheDocument())
    expect(screen.queryByTestId("plan-comparison-window-note")).toBeNull()
    expect(screen.getByTestId("plan-comparison-table").textContent).not.toContain("esta semana")
  })

  it("sem cumulativeExpected (sem matrícula com deadline computável) → linhas Sessões/Reflexões OMITIDAS, só Progresso", async () => {
    mockFetchOnce({
      ...FULL_RESPONSE,
      planDashboardData: { ...BASE_PLAN_DATA, cumulativeExpected: null },
    })
    render(<PlanComparisonPanel continueHref="/courses/next" />)
    await waitFor(() => expect(screen.getByTestId("plan-comparison-table")).toBeInTheDocument())
    expect(screen.queryByTestId("plan-row-sessions")).toBeNull()
    expect(screen.queryByTestId("plan-row-reflections")).toBeNull()
    expect(screen.getByTestId("plan-row-progress")).toBeInTheDocument()
  })

  it("progresso CUMPRIDO (realizado >= meta) → chip 'Cumprido'", async () => {
    mockFetchOnce({
      ...FULL_RESPONSE,
      diagnostic: { ...BASE_DIAGNOSTIC, progressNow: 70, progressTarget: 60 },
    })
    render(<PlanComparisonPanel continueHref="/courses/next" />)
    await waitFor(() => expect(screen.getByTestId("plan-row-progress")).toBeInTheDocument())
    expect(screen.getByTestId("plan-row-progress").textContent).toContain("Cumprido")
  })

  it("sem meta de progresso (progressTarget null) → chip 'Sem meta definida', nunca um falso 'Pendente'", async () => {
    mockFetchOnce({
      ...FULL_RESPONSE,
      diagnostic: { ...BASE_DIAGNOSTIC, progressTarget: null, reflTarget: null },
    })
    render(<PlanComparisonPanel continueHref="/courses/next" />)
    await waitFor(() => expect(screen.getByTestId("plan-row-progress")).toBeInTheDocument())
    expect(screen.getByTestId("plan-row-progress").textContent).toContain("Sem meta definida")
    expect(screen.getByTestId("plan-row-progress").textContent).toContain("—")
  })

  it("reflexões OMITIDAS quando esperado cumulativo e realizado são ambos 0", async () => {
    mockFetchOnce({
      ...FULL_RESPONSE,
      diagnostic: { ...BASE_DIAGNOSTIC, reflDoneCount: 0 },
      planDashboardData: {
        ...BASE_PLAN_DATA,
        cumulativeExpected: { sessions: 52, reflections: 0 },
      },
    })
    render(<PlanComparisonPanel continueHref="/courses/next" />)
    await waitFor(() => expect(screen.getByTestId("plan-comparison-table")).toBeInTheDocument())
    expect(screen.queryByTestId("plan-row-reflections")).toBeNull()
  })

  it("ação por linha usa interactionHref/reflectionHref reais quando fornecidos (deep-link real, não genérico)", async () => {
    mockFetchOnce(FULL_RESPONSE)
    render(
      <PlanComparisonPanel
        continueHref="/courses/next"
        interactionHref="/courses/c1/chapters/ch1?focus=interaction"
        reflectionHref="/courses/c1/chapters/ch1?focus=reflection&slideId=sl1"
      />,
    )
    await waitFor(() => expect(screen.getByTestId("plan-action-sessions")).toBeInTheDocument())
    expect(screen.getByTestId("plan-action-sessions")).toHaveAttribute(
      "href",
      "/courses/c1/chapters/ch1?focus=interaction",
    )
    expect(screen.getByTestId("plan-action-reflections")).toHaveAttribute(
      "href",
      "/courses/c1/chapters/ch1?focus=reflection&slideId=sl1",
    )
  })

  it("sem interactionHref/reflectionHref → ação degrada pro continueHref genérico", async () => {
    mockFetchOnce(FULL_RESPONSE)
    render(<PlanComparisonPanel continueHref="/courses/next" />)
    await waitFor(() => expect(screen.getByTestId("plan-action-sessions")).toBeInTheDocument())
    expect(screen.getByTestId("plan-action-sessions")).toHaveAttribute("href", "/courses/next")
  })
})

describe("PlanComparisonPanel — 'Meu plano da semana' checklist", () => {
  it("sessões pendentes (realizado < planejado) → item NÃO concluído", async () => {
    mockFetchOnce(FULL_RESPONSE)
    render(<PlanComparisonPanel continueHref="/courses/next" />)
    await waitFor(() => expect(screen.getByTestId("plan-weekly-checklist")).toBeInTheDocument())
    expect(screen.getByTestId("plan-weekly-checklist").textContent).toContain("2 de 6 combinadas")
  })

  it("sessões cumpridas (realizado >= planejado) → item concluído", async () => {
    mockFetchOnce({
      ...FULL_RESPONSE,
      planDashboardData: {
        ...BASE_PLAN_DATA,
        weeklyComparison: {
          ...BASE_WEEKLY,
          realized: { sessions: 6, reflections: 3 },
        },
      },
    })
    render(<PlanComparisonPanel continueHref="/courses/next" />)
    await waitFor(() => expect(screen.getByTestId("plan-weekly-checklist")).toBeInTheDocument())
    expect(screen.getByTestId("plan-weekly-checklist").textContent).toContain("6 de 6 combinadas")
  })
})

describe("PlanComparisonPanel — 'Próximo ajuste sugerido'", () => {
  it("situação pendente → copy de sugestão de recálculo", async () => {
    mockFetchOnce(FULL_RESPONSE)
    render(<PlanComparisonPanel continueHref="/courses/next" />)
    await waitFor(() => expect(screen.getByTestId("plan-suggested-adjustment")).toBeInTheDocument())
    expect(screen.getByTestId("plan-suggested-adjustment").textContent).toContain(
      "abaixo do combinado",
    )
  })

  it("situação cumprida → copy de reconhecimento, sem alarmismo", async () => {
    mockFetchOnce({
      ...FULL_RESPONSE,
      planDashboardData: {
        ...BASE_PLAN_DATA,
        weeklyComparison: {
          ...BASE_WEEKLY,
          situation: "cumprido",
        },
      },
    })
    render(<PlanComparisonPanel continueHref="/courses/next" />)
    await waitFor(() => expect(screen.getByTestId("plan-suggested-adjustment")).toBeInTheDocument())
    expect(screen.getByTestId("plan-suggested-adjustment").textContent).toContain("em dia")
  })

  it("'Revisar jornada' navega para /jornada?curso= do curso (nunca duplica recalculateWeeklyChoice)", async () => {
    // JRN-D — "Recalcular plano" virou "Revisar jornada" apontando à rota real.
    mockFetchOnce(FULL_RESPONSE)
    render(<PlanComparisonPanel continueHref="/courses/next" />)
    await waitFor(() => expect(screen.getByTestId("plan-suggested-recalc")).toBeInTheDocument())
    expect(screen.getByTestId("plan-suggested-recalc")).toHaveAttribute(
      "href",
      "/jornada?curso=course-x",
    )
    expect(screen.getByTestId("plan-suggested-recalc").textContent).toContain("Revisar jornada")
  })

  it("'Manter como está' dispensa o card localmente, sem fetch/navegação", async () => {
    mockFetchOnce(FULL_RESPONSE)
    render(<PlanComparisonPanel continueHref="/courses/next" />)
    await waitFor(() => expect(screen.getByTestId("plan-suggested-keep")).toBeInTheDocument())
    fireEvent.click(screen.getByTestId("plan-suggested-keep"))
    expect(screen.queryByTestId("plan-suggested-adjustment")).toBeNull()
  })
})
