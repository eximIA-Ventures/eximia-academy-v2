import type { StudyPlanDiagnostic } from "@/lib/analytics/study-plan-projection"
import { ToastProvider } from "@eximia/ui"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { PlanDashboardData } from "../../page"
import { MeuPlanoClient, type PlanHrefs } from "../meu-plano-client"

// ---------------------------------------------------------------------------
// SH-3.3 pivot (2026-07-21, direto do Hugo depois de testar): o dashboard
// "Meu Plano" é agora a tela PADRÃO/inicial — não existe mais uma tela de
// configuração de tela cheia atrás de um "Confirmar meu plano". A máquina
// de estado caiu para 2 telas (dashboard → recalc), e os controles de
// ajuste (dias/sessões/reflexão) vivem inline dentro do painel "Seu plano
// sugerido" do próprio dashboard, revelados pelo toggle "Ajustar plano".
// Estes testes substituem integralmente a suíte anterior (SH-3.1/SH-3.2/
// SH-3.3 config-screen), preservando a MESMA cobertura de comportamento
// (toggle de dia, stepper de sessões, switch de reflexão, reset, fronteira
// de rede) na nova estrutura.
// ---------------------------------------------------------------------------

// Same real-shaped numbers as the SH-2.7 Rinaldo case (progressTarget/reflTarget
// = expectedProgressPct = 33, the SH-2.7 own-pace signal).
const DIAGNOSTIC: StudyPlanDiagnostic = {
  progressNow: 50,
  progressTarget: 33,
  sessionsDoneCount: 7,
  reflDoneCount: 8,
  reflTotal: 41,
  reflNow: (8 / 41) * 100,
  reflTarget: 33,
  daysLeft: 121,
  weeksLeft: 17,
}

const PLAN_DASHBOARD_DATA: PlanDashboardData = {
  courseTitle: "Análise e Solução de Problemas",
  currentChapterTitle: "Análise de causas",
  currentChapterOrder: 4,
  moduleJourney: [
    {
      chapterId: "c1",
      title: "Definição do problema",
      order: 1,
      interactionsExpected: 1,
      reflectionsExpected: 2,
      status: "done",
      suggestedDeadline: "2026-07-28T00:00:00.000Z",
    },
    {
      chapterId: "c4",
      title: "Análise de causas",
      order: 4,
      interactionsExpected: 1,
      reflectionsExpected: 6,
      status: "doing",
      suggestedDeadline: "2026-09-22T00:00:00.000Z",
    },
  ],
  weeklyComparison: {
    weekStart: "2026-09-14T00:00:00.000Z",
    weekEnd: "2026-09-20T23:59:59.000Z",
    planned: { sessions: 6, reflections: 3 },
    realized: { sessions: 2, reflections: 1 },
    situation: "pendente",
  },
  avgMinutesPerSession: 35,
  cumulativeExpected: { sessions: 52, reflections: 26 },
}

// audit fix — deep-links reais (mesma forma que computeStudentComparison
// devolve em nextPendingInteractionHref/nextPendingReflectionHref).
const PLAN_HREFS: PlanHrefs = {
  continueHref: "/courses/course-1/chapters/ch-4?focus=interaction",
  interactionHref: "/courses/course-1/chapters/ch-4?focus=interaction",
  reflectionHref: "/courses/course-1/chapters/ch-4?focus=reflection&slideId=s-9",
}

// sem pendência real: deep-links nulos, só o continue genérico (nunca morto).
const FALLBACK_PLAN_HREFS: PlanHrefs = {
  continueHref: "/courses",
  interactionHref: null,
  reflectionHref: null,
}

const EMPTY_PLAN_DASHBOARD_DATA: PlanDashboardData = {
  courseTitle: null,
  currentChapterTitle: null,
  currentChapterOrder: null,
  moduleJourney: [],
  weeklyComparison: null,
  avgMinutesPerSession: null,
  cumulativeExpected: null,
}

function renderPlan({
  diagnostic = DIAGNOSTIC,
  studentFirstName = "Rinaldo",
  classAvgProgressPct = 68,
  planDashboardData = PLAN_DASHBOARD_DATA,
  planHrefs = PLAN_HREFS,
}: {
  diagnostic?: StudyPlanDiagnostic
  studentFirstName?: string
  classAvgProgressPct?: number | null
  planDashboardData?: PlanDashboardData
  planHrefs?: PlanHrefs
} = {}) {
  return render(
    <ToastProvider>
      <MeuPlanoClient
        diagnostic={diagnostic}
        studentFirstName={studentFirstName}
        classAvgProgressPct={classAvgProgressPct}
        planDashboardData={planDashboardData}
        planHrefs={planHrefs}
      />
    </ToastProvider>,
  )
}

function openAdjust() {
  fireEvent.click(screen.getByTestId("adjust-toggle"))
}

describe("MeuPlanoClient — o dashboard 'Meu Plano' é a tela padrão (SH-3.3 pivot, AC1/AC2)", () => {
  it("abre DIRETO no dashboard, sem nenhuma tela de configuração antes", () => {
    renderPlan()

    expect(screen.getByRole("heading", { name: "Meu Plano" })).toBeInTheDocument()
    expect(screen.getByText("Oi, Rinaldo.")).toBeInTheDocument()
    // nenhum resquício da tela de config antiga
    expect(screen.queryByText("Seu plano de estudo desta semana")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Confirmar meu plano/ })).not.toBeInTheDocument()
  })

  it("tem breadcrumb '‹ Meu ritmo' no topo levando de volta para /dashboard (fix pós-teste Hugo)", () => {
    renderPlan()

    const backLink = screen.getByTestId("plan-dashboard-back-link")
    expect(backLink).toHaveAttribute("href", "/dashboard")
    expect(backLink).toHaveTextContent("Meu ritmo")
  })

  it("4 stat cards e os 4 painéis com dado real, já na primeira renderização", () => {
    renderPlan()

    expect(screen.getByText("Análise e Solução de Problemas")).toBeInTheDocument()
    expect(screen.getByText("Módulo 4")).toBeInTheDocument()
    expect(screen.getByText("50%")).toBeInTheDocument()
    expect(screen.getByText("turma 68%")).toBeInTheDocument()

    expect(screen.getByText("Seu plano sugerido")).toBeInTheDocument()
    expect(screen.getByText("Sua semana")).toBeInTheDocument()
    expect(screen.getByText("Sua jornada planejada")).toBeInTheDocument()
    expect(screen.getByText("Seu plano x seu realizado")).toBeInTheDocument()

    expect(screen.getByText("Definição do problema")).toBeInTheDocument()
    expect(screen.getByText("Concluído")).toBeInTheDocument()
    expect(screen.getByText("Em andamento")).toBeInTheDocument()
  })
})

describe("MeuPlanoClient — 'Sua semana' navegável + 'Continuar jornada' (audit fix)", () => {
  it("itens do checklist são Links reais com chevron para a próxima ação pendente", () => {
    renderPlan()

    const sessions = screen.getByTestId("week-item-sessions")
    expect(sessions.tagName).toBe("A")
    expect(sessions).toHaveAttribute("href", PLAN_HREFS.interactionHref)

    const reflections = screen.getByTestId("week-item-reflections")
    expect(reflections.tagName).toBe("A")
    expect(reflections).toHaveAttribute("href", PLAN_HREFS.reflectionHref)
  })

  it("sem pendência real, os itens degradam para o continueHref genérico (nunca href morto)", () => {
    renderPlan({ planHrefs: FALLBACK_PLAN_HREFS })

    expect(screen.getByTestId("week-item-sessions")).toHaveAttribute("href", "/courses")
    expect(screen.getByTestId("week-item-reflections")).toHaveAttribute("href", "/courses")
  })

  it("botão 'Continuar jornada' presente no rodapé do painel, apontando para o continueHref", () => {
    renderPlan()

    const cta = screen.getByTestId("continue-journey-cta")
    expect(cta.tagName).toBe("A")
    expect(cta).toHaveAttribute("href", PLAN_HREFS.continueHref)
    expect(cta).toHaveTextContent("Continuar jornada")
  })
})

describe("MeuPlanoClient — hero escuro + 'Manter como está' no dashboard (audit fix)", () => {
  it("hero usa o padrão escuro fixo bg-neutral-900 (nunca token theme-aware) com 'ativo' em verde", () => {
    renderPlan()

    const hero = screen.getByTestId("plan-dashboard-hero")
    expect(hero.className).toContain("bg-neutral-900")
    expect(hero.className).not.toContain("bg-bg-elevated")
    // a palavra "ativo" destacada em verde dentro da frase do hero
    const highlight = hero.querySelector("b.text-semantic-success")
    expect(highlight).not.toBeNull()
    expect(highlight).toHaveTextContent("ativo")
  })

  it("'Manter como está' ao lado de 'Recalcular plano' dispensa o aviso localmente (mesmo handler da Tela 2)", () => {
    renderPlan()

    // com déficit (planned 6 x realized 2), o aviso está visível
    expect(screen.getByText(/abaixo do combinado/)).toBeInTheDocument()

    fireEvent.click(screen.getByTestId("keep-cta"))

    // aviso dispensado localmente; seguimos no dashboard, plano intacto
    expect(screen.queryByText(/abaixo do combinado/)).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Meu Plano" })).toBeInTheDocument()
    expect(screen.getByTestId("stat-ritmo-value")).toHaveTextContent("6")
  })
})

describe("MeuPlanoClient — comportamento ultra responsivo (classes declaradas)", () => {
  it("faixa de stat cards: 1 col mobile, 2 no sm, 4 no lg", () => {
    const { container } = renderPlan()

    const statGrid = container.querySelector(".grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4")
    expect(statGrid).not.toBeNull()
  })

  it("tabelas ficam em wrapper overflow-x-auto com min-w interno (não estouram no mobile)", () => {
    const { container } = renderPlan()

    const wrappers = container.querySelectorAll(".overflow-x-auto")
    // jornada planejada + plano x realizado
    expect(wrappers.length).toBeGreaterThanOrEqual(2)
    expect(container.querySelector("table.min-w-\\[520px\\]")).not.toBeNull()
    expect(container.querySelector("table.min-w-\\[420px\\]")).not.toBeNull()
  })

  it("hero empilha no mobile (flex-col) e o CTA é full-width em telas pequenas", () => {
    renderPlan()

    const hero = screen.getByTestId("plan-dashboard-hero")
    expect(hero.querySelector(".flex.flex-col")).not.toBeNull()
    expect(screen.getByTestId("hero-recalc-cta").className).toContain("w-full")
  })
})

describe("MeuPlanoClient — ajuste inline dentro de 'Seu plano sugerido' (SH-3.3 pivot)", () => {
  it("o painel de ajuste começa fechado; 'Ajustar plano' revela os controles no MESMO lugar", () => {
    renderPlan()

    expect(screen.queryByTestId("adjust-panel")).not.toBeInTheDocument()
    expect(screen.getByTestId("adjust-toggle")).toHaveAttribute("aria-expanded", "false")

    openAdjust()

    expect(screen.getByTestId("adjust-panel")).toBeInTheDocument()
    expect(screen.getByTestId("adjust-toggle")).toHaveAttribute("aria-expanded", "true")
    // ainda no dashboard — abrir o ajuste não navega para outro lugar
    expect(screen.getByRole("heading", { name: "Meu Plano" })).toBeInTheDocument()
  })

  it("dia começa com Seg/Qua/Sex marcados (default herdado do mockup)", () => {
    renderPlan()
    openAdjust()

    expect(screen.getByRole("button", { name: /Seg/ })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: /Ter/ })).toHaveAttribute("aria-pressed", "false")
  })

  it("clicar num dia alterna aria-pressed e recalcula o ritmo escolhido ao vivo (stat card)", () => {
    renderPlan()
    expect(screen.getByTestId("stat-ritmo-value")).toHaveTextContent("6")

    openAdjust()
    const terca = screen.getByRole("button", { name: /Ter/ })
    fireEvent.click(terca)

    expect(terca).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByTestId("stat-ritmo-value")).toHaveTextContent("8")
  })

  it("stepper de sessões incrementa/decrementa dentro de 1-5", () => {
    renderPlan()
    openAdjust()

    const plus = screen.getByLabelText("mais sessões")
    const minus = screen.getByLabelText("menos sessões")
    fireEvent.click(plus)
    fireEvent.click(plus)
    fireEvent.click(plus)
    expect(screen.getByLabelText("mais sessões")).toBeDisabled()
    for (let i = 0; i < 6; i++) fireEvent.click(minus)
    expect(screen.getByLabelText("menos sessões")).toBeDisabled()
  })

  it("toggle de reflexão liga/desliga o foco em reflexão", () => {
    renderPlan()
    openAdjust()

    const reflSwitch = screen.getByRole("switch")
    expect(reflSwitch).toHaveAttribute("aria-checked", "true")
    fireEvent.click(reflSwitch)
    expect(reflSwitch).toHaveAttribute("aria-checked", "false")
    expect(screen.getByText("reflexão desligada")).toBeInTheDocument()
  })

  it("'Voltar ao plano sugerido' restaura o default sem fechar o painel nem navegar", () => {
    renderPlan()
    openAdjust()
    fireEvent.click(screen.getByRole("button", { name: /Ter/ }))
    expect(screen.getByRole("button", { name: /Ter/ })).toHaveAttribute("aria-pressed", "true")

    fireEvent.click(screen.getByRole("button", { name: /Voltar ao plano sugerido/ }))

    expect(screen.getByRole("button", { name: /Seg/ })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: /Ter/ })).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByRole("heading", { name: "Meu Plano" })).toBeInTheDocument()
  })

  it("'Concluir ajuste' fecha o painel inline (o dashboard segue sendo a mesma tela)", () => {
    renderPlan()
    openAdjust()
    expect(screen.getByTestId("adjust-panel")).toBeInTheDocument()

    fireEvent.click(screen.getByTestId("adjust-close"))

    expect(screen.queryByTestId("adjust-panel")).not.toBeInTheDocument()
    expect(screen.getByTestId("adjust-toggle")).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByRole("heading", { name: "Meu Plano" })).toBeInTheDocument()
  })
})

describe("MeuPlanoClient — 'Recalcular plano' (Tela 2, SH-3.3 AC3/AC5, preservado)", () => {
  it("abre a Tela 2 a partir do dashboard e o botão voltar retorna ao dashboard preservando o estado", () => {
    renderPlan()
    fireEvent.click(screen.getByTestId("recalc-cta"))

    expect(screen.getByRole("heading", { name: "Recalcular plano" })).toBeInTheDocument()
    expect(screen.getByTestId("recalc-auto")).toBeInTheDocument()
    expect(screen.getByTestId("recalc-keep")).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText("Voltar para Meu Plano"))
    expect(screen.getByRole("heading", { name: "Meu Plano" })).toBeInTheDocument()
    expect(screen.getByText("Análise e Solução de Problemas")).toBeInTheDocument()
  })

  it("'Recalcular automaticamente' aumenta o ritmo (sessionsPerWeek) e volta ao dashboard", () => {
    renderPlan()
    expect(screen.getByTestId("stat-ritmo-value")).toHaveTextContent("6")

    fireEvent.click(screen.getByTestId("recalc-cta"))
    fireEvent.click(screen.getByTestId("recalc-auto"))

    expect(screen.getByRole("heading", { name: "Meu Plano" })).toBeInTheDocument()
    // default era 3 dias x 2 sessões = 6/semana; com déficit de 4 (planned 6 - realized 2),
    // o motor intensifica sessionsPerDay — o "Ritmo escolhido" deixa de ser 6.
    expect(screen.getByTestId("stat-ritmo-value")).not.toHaveTextContent("6")
  })

  it("'Manter como está' não altera o plano e volta ao dashboard", () => {
    renderPlan()
    fireEvent.click(screen.getByTestId("recalc-cta"))
    fireEvent.click(screen.getByTestId("recalc-keep"))

    expect(screen.getByRole("heading", { name: "Meu Plano" })).toBeInTheDocument()
  })
})

describe("MeuPlanoClient — degradação graciosa do dashboard (SH-3.3 AC6, preservado)", () => {
  it("sem matrícula líder/capítulos/sessões da semana, os blocos mostram estado vazio explícito", () => {
    renderPlan({ planDashboardData: EMPTY_PLAN_DASHBOARD_DATA, classAvgProgressPct: null })

    expect(screen.getByRole("heading", { name: "Meu Plano" })).toBeInTheDocument()
    expect(screen.getByText("Sem trilha vinculada")).toBeInTheDocument()
    expect(screen.getByText(/Ainda não há capítulos suficientes na sua trilha/)).toBeInTheDocument()
    expect(
      screen.getByText(/Sem sessões registradas nesta semana ainda — volte depois/),
    ).toBeInTheDocument()
    expect(screen.getByText("sem média de turma")).toBeInTheDocument()
  })

  it("sem dias escolhidos, o stat 'Ritmo escolhido' degrada para 'nenhum dia escolhido' (sem crash)", () => {
    renderPlan()
    openAdjust()
    for (const label of ["Seg", "Qua", "Sex"]) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(label) }))
    }

    expect(screen.getByTestId("stat-ritmo-value")).toHaveTextContent("0")
    expect(screen.getByText("nenhum dia escolhido")).toBeInTheDocument()
  })
})

describe("MeuPlanoClient — fronteira de rede (SH-3.3 AC4, crítico, preservado)", () => {
  it("ajustar plano + concluir ajuste + recalcular automaticamente + manter como está — NENHUM chama fetch/POST", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    renderPlan()

    openAdjust()
    fireEvent.click(screen.getByRole("button", { name: /Ter/ }))
    fireEvent.click(screen.getByTestId("adjust-close"))
    expect(fetchSpy).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId("recalc-cta"))
    fireEvent.click(screen.getByTestId("recalc-auto"))
    expect(fetchSpy).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId("recalc-cta"))
    fireEvent.click(screen.getByTestId("recalc-keep"))
    expect(fetchSpy).not.toHaveBeenCalled()

    // audit fix — o "Manter como está" do dashboard também é 100% local
    fireEvent.click(screen.getByTestId("keep-cta"))
    expect(fetchSpy).not.toHaveBeenCalled()

    fetchSpy.mockRestore()
  })
})
