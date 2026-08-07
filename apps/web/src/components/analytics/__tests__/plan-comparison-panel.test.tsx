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

  it("diagnóstico existe mas SEM jornada persistida → ainda mostra o convite, CTA para /jornada (hub, sem ?curso=)", async () => {
    // JRN-D — mesmo com diagnostic/plano computáveis, sem study_plan ativa o
    // painel NÃO inventa "combinado": convida a montar a jornada. D11 (Hugo) — o
    // CTA de entrada aponta ao hub /jornada (sem ?curso=), nunca pula pro curso.
    mockFetchOnce({
      ...FULL_RESPONSE,
      hasJourney: false,
      journeyCourseId: "course-x",
    })
    render(<PlanComparisonPanel continueHref="/courses/next" />)
    await waitFor(() =>
      expect(screen.getByTestId("plan-comparison-no-journey")).toBeInTheDocument(),
    )
    expect(screen.getByTestId("plan-comparison-cta-empty")).toHaveAttribute("href", "/jornada")
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

  // 2026-08-07 (Hugo) — SH-3.3 R7 SUPERADA NESTE PONTO. A rodada de 21/07/2026
  // fixou este rótulo em "Sessões" puro e rejeitou explicitamente a palavra
  // "interações" aqui, com a razão declarada "o dado é só contagem de sessão,
  // não de interação". Em 07/08/2026 o cliente da Academy pediu exatamente o
  // rótulo que aquela rodada barrou, e o Senhor decidiu aplicar: feedback direto
  // de cliente prevalece sobre a leitura interna de 21/07. O rótulo passa a ser
  // "Interações".
  //
  // O que a R7 decidiu e CONTINUA de pé é a FORMA, não a palavra: o rótulo é uma
  // palavra pura, nunca um composto com qualificador entre parênteses —
  // "Interações (sessões)" seria a mesma poluição que a R7 barrou em
  // "Sessões (interações)". Por isso a segunda asserção troca de alvo mas não de
  // propósito.
  //
  // Registro da decisão: POP-FIX-001, run
  // 2026-08-07-academy-manager-dashboard-copy-fixes, STATE.md campo `decisoes`.
  it("rótulo é 'Interações' puro (Hugo 2026-08-07, supera SH-3.3 R7), nunca 'Sessões' nem composto com parênteses", async () => {
    mockFetchOnce(FULL_RESPONSE)
    render(<PlanComparisonPanel continueHref="/courses/next" />)
    await waitFor(() => expect(screen.getByTestId("plan-row-sessions")).toBeInTheDocument())
    expect(screen.getByTestId("plan-row-sessions").textContent).toContain("Interações")
    expect(screen.getByTestId("plan-row-sessions").textContent).not.toContain("Sessões")
    expect(screen.getByTestId("plan-row-sessions").textContent).not.toMatch(/Interações\s*\(/)
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

  it("'Revisar jornada' navega para /jornada (hub, sem ?curso=) — nunca duplica recalculateWeeklyChoice", async () => {
    // JRN-D — "Recalcular plano" virou "Revisar jornada" apontando à rota real.
    // D11 (Hugo) — CTA de entrada cai no hub /jornada (seleção de curso), nunca
    // pula direto pro curso, mesmo com 1 matrícula.
    mockFetchOnce(FULL_RESPONSE)
    render(<PlanComparisonPanel continueHref="/courses/next" />)
    await waitFor(() => expect(screen.getByTestId("plan-suggested-recalc")).toBeInTheDocument())
    expect(screen.getByTestId("plan-suggested-recalc")).toHaveAttribute("href", "/jornada")
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

// ---------------------------------------------------------------------------
// TESTE VERMELHO — POP-FIX-001, run 2026-08-07-academy-manager-dashboard-copy-fixes
// Passo 2 (Identificar o Problema). Itens 3 e 4 de 4 do `00-criterio.md`:
//
//   item 3 · :315-319 (desktop) e :352-354 (mobile)   "Minha jornada" → "Meu Plano"
//   item 4 · :228                                     label "Sessões" → "Interações"
//
// Ambas as asserções são ESCOPADAS ao testid `plan-comparison-table`, e não ao
// painel inteiro, de propósito: "jornada" aparece em mais 5 pontos do painel
// (CTA "Montar minha jornada", "Minha semana na jornada", "Revisar jornada"...)
// que estão FORA da cerca de escopo declarada no `01-definicao.md`. Um
// `queryByText` solto no painel varreria os cinco e transformaria a correção de
// 2 linhas numa reescrita de vocabulário do arquivo todo.
//
// COLISÃO REGISTRADA E RESOLVIDA: o item 4 contradizia de frente o teste vivo
// "rótulo é 'Sessões' puro (SH-3.3 R6/R7)" acima neste mesmo arquivo, que
// congelava a decisão OPOSTA com razão declarada ("o dado é só contagem de
// sessão, não de interação"). Os dois não podiam ficar verdes ao mesmo tempo.
// Escalado ao Senhor, que decidiu em 2026-08-07: aplicar mesmo assim, feedback
// direto de cliente prevalece sobre a leitura interna de 21/07. O teste antigo
// foi ATUALIZADO no lugar (ver a nota longa nele, acima), e não removido — a
// forma que a R7 protegia (rótulo puro, sem parêntese) segue testada.
// Ver `02-modo-de-falha.md`, seção "Colisão com decisão congelada".
// ---------------------------------------------------------------------------

describe("PlanComparisonPanel — vocabulário pedido pelo cliente (POP-FIX-001, itens 3 e 4)", () => {
  it("item 3 · o cabeçalho da coluna do plano lê 'Meu Plano', e 'Minha jornada' não sobra na tabela", async () => {
    mockFetchOnce(FULL_RESPONSE)
    render(<PlanComparisonPanel continueHref="/courses/next" />)
    await waitFor(() => expect(screen.getByTestId("plan-comparison-table")).toBeInTheDocument())

    const table = screen.getByTestId("plan-comparison-table")
    expect(table.textContent).toContain("Meu Plano")
    expect(table.textContent).not.toMatch(/minha jornada/i)
  })

  it("item 3 · o mini-cabeçalho mobile acompanha o desktop (minúsculo no markup, maiúsculo por CSS)", async () => {
    // O mobile mantém o padrão do arquivo: o texto vai minúsculo no DOM e sobe
    // para caixa alta via `uppercase`, para não duplicar o mesmo texto nas
    // queries do desktop. Logo o esperado aqui é "meu plano", não "Meu Plano".
    mockFetchOnce(FULL_RESPONSE)
    render(<PlanComparisonPanel continueHref="/courses/next" />)
    await waitFor(() => expect(screen.getByTestId("plan-comparison-table")).toBeInTheDocument())

    expect(screen.getByTestId("plan-comparison-table").textContent).toContain("meu plano")
  })

  it("item 4 · a linha do indicador lê 'Interações', nunca 'Sessões'", async () => {
    mockFetchOnce(FULL_RESPONSE)
    render(<PlanComparisonPanel continueHref="/courses/next" />)
    await waitFor(() => expect(screen.getByTestId("plan-row-sessions")).toBeInTheDocument())

    const row = screen.getByTestId("plan-row-sessions")
    expect(row.textContent).toContain("Interações")
    expect(row.textContent).not.toContain("Sessões")
  })

  it("item 4 · os números da linha seguem os mesmos (é troca de rótulo, não de dado)", async () => {
    mockFetchOnce(FULL_RESPONSE)
    render(<PlanComparisonPanel continueHref="/courses/next" />)
    await waitFor(() => expect(screen.getByTestId("plan-row-sessions")).toBeInTheDocument())

    const row = screen.getByTestId("plan-row-sessions")
    expect(row.textContent).toContain("52") // planejado cumulativo
    expect(row.textContent).toContain("7") // realizado lifetime
  })
})
