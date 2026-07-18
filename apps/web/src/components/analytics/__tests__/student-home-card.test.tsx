import type { ComparableMetricBlock, StudentHomeIndicators } from "@/types/analytics"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { StudentHomeCard } from "../student-home-card"

const INDICATORS: StudentHomeIndicators = {
  subject: {
    lastAccessDays: 1,
    ritmoDisplay: "no_ritmo",
    progressPct: 72,
    engagement: 14,
    interactions: 6,
    reflections: 2,
    lastCompletedLabel: "Módulo 2: Definir o Problema · 80%",
  },
  reference: {
    lastAccessAvgDays: 4,
    ritmoEmDiaPct: 58,
    progressAvgPct: 55,
    engagementAvg: 9,
    interactionsAvg: 4,
    reflectionsAvg: 1,
  },
}

function block(over: Partial<ComparableMetricBlock>): ComparableMetricBlock {
  return {
    totalStudents: over.totalStudents ?? 100,
    activeStudents: over.activeStudents ?? 60,
    completedSessions: over.completedSessions ?? 6,
    totalSessions: over.totalSessions ?? 8,
    reflectionCount: over.reflectionCount ?? 8,
    avgSessionsPerStudent: over.avgSessionsPerStudent ?? 13,
    completionPct: over.completionPct ?? 75,
    ...over,
  }
}

const STUDENT = block({
  completedSessions: 8,
  reflectionCount: 8,
  avgSessionsPerStudent: 13,
  completionPct: 75,
  totalStudents: 1,
  activeStudents: 1,
  consciousCompletionPct: 68,
  avgDepth: 4.2,
  distinctActiveDays: 12,
})
const UNIT = block({
  totalStudents: 100,
  activeStudents: 20,
  completedSessions: 500,
  reflectionCount: 400,
  avgSessionsPerStudent: 5.9,
  completionPct: 63,
  consciousCompletionPct: 50,
  avgDepth: 3.2,
  distinctActiveDays: 7,
})

function renderCard() {
  return render(
    <StudentHomeCard
      student={STUDENT}
      unit={UNIT}
      indicators={INDICATORS}
      continueHref="/courses/next"
    />,
  )
}

const clickBtn = (name: string) => fireEvent.click(screen.getByRole("button", { name }))

// ---------------------------------------------------------------------------
// MUDANÇA 1 — the comparison is the DEFAULT and ONLY content; no intent toggle,
// no progress view.
// ---------------------------------------------------------------------------

describe("MUDANÇA 1 — comparação é a vista única (sem 'Meu progresso')", () => {
  it("mostra a tabela de comparação por default", () => {
    renderCard()
    expect(screen.getByTestId("comparison-insights-table")).toBeInTheDocument()
  })

  it("NÃO existe o toggle de intenção 'Meu progresso' / 'Como me comparo'", () => {
    renderCard()
    expect(screen.queryByRole("button", { name: "Meu progresso" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Como me comparo" })).toBeNull()
    // e nenhuma manchete de progresso.
    expect(screen.queryByRole("heading", { name: "Meu progresso" })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// MUDANÇA 2 — ONE toggle only: [Visão detalhada] (default) / [Gráficos].
// ---------------------------------------------------------------------------

describe("MUDANÇA 2 — um único toggle Visão detalhada / Gráficos", () => {
  it("tem exatamente 2 botões de toggle, com as labels exatas do Hugo", () => {
    renderCard()
    // The only two toggle buttons in the card.
    expect(screen.getByRole("button", { name: "Visão detalhada" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Gráficos" })).toBeInTheDocument()
    // Old sub-toggle labels are gone.
    expect(screen.queryByRole("button", { name: "Tabela" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Barras" })).toBeNull()
  })

  it("'Visão detalhada' é o default (tabela); 'Gráficos' mostra as barras", () => {
    renderCard()
    expect(
      screen.getByRole("button", { name: "Visão detalhada" }).getAttribute("aria-pressed"),
    ).toBe("true")
    expect(screen.getByTestId("comparison-insights-table")).toBeInTheDocument()
    expect(screen.queryByText("Sinais principais")).toBeNull()

    // → Gráficos: bars appear, table hides, and the active pill follows.
    clickBtn("Gráficos")
    expect(screen.getByText("Sinais principais")).toBeInTheDocument()
    expect(screen.queryByTestId("comparison-insights-table")).toBeNull()
    expect(screen.getByRole("button", { name: "Gráficos" }).getAttribute("aria-pressed")).toBe(
      "true",
    )
    expect(
      screen.getByRole("button", { name: "Visão detalhada" }).getAttribute("aria-pressed"),
    ).toBe("false")

    // back to Visão detalhada.
    clickBtn("Visão detalhada")
    expect(screen.getByTestId("comparison-insights-table")).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// The single CTA is preserved — SH-1.5 R2 (Hugo 2026-07-18): the "Continuar
// agora" button moved INTO the dark ritmo-summary panel (which lives under
// "Visão detalhada"), so it is present in the detailed view and no longer
// carries the "Próximo passo:" label. Its href is unchanged.
// ---------------------------------------------------------------------------

describe("CTA único preservado", () => {
  it("existe exatamente UM 'Continuar' na Visão detalhada, sem o rótulo 'Próximo passo'", () => {
    renderCard()
    const cta = () => screen.getByRole("link", { name: /continuar/i })
    expect(screen.getAllByRole("link", { name: /continuar/i })).toHaveLength(1)
    expect(cta().getAttribute("href")).toBe("/courses/next")
    // The old NextStepBar label is gone from this view.
    expect(screen.queryByText(/Próximo passo/i)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// M1 — SH-1.5 R2 (Hugo 2026-07-18): the CTA moved into the dark ritmo-summary
// panel, so it now renders AFTER the comparison table (docked in the panel that
// follows the table), not in a separate bar below the whole card. The intent
// preserved: the CTA comes after the comparison content in reading order.
// M2 — the reference is the TURMA (subtitle), never a named unidade.
// ---------------------------------------------------------------------------

describe("M1/M2 — CTA depois do card + escopo turma", () => {
  it("M1: o CTA renderiza DEPOIS da tabela de comparação (ordem no DOM)", () => {
    renderCard()
    const table = screen.getByTestId("comparison-insights-table")
    const cta = screen.getByRole("link", { name: /continuar/i })
    // cta follows the table and is not contained by it → DOCUMENT_POSITION_FOLLOWING.
    expect(table.compareDocumentPosition(cta)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it("M2: título 'Meu ritmo' + subtítulo em 'turma', sem unidade nomeada", () => {
    renderCard()
    expect(screen.getByRole("heading", { name: "Meu ritmo" })).toBeInTheDocument()
    expect(screen.getByText(/em relação à turma/i)).toBeInTheDocument()
    expect(screen.queryByText(/Ribeirão/)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Ajuste fino (Hugo 2026-07-14) — subtítulo ENXUTO: apenas a frase em 1ª
// pessoa. O standing ("No geral, estou à frente/atrás da turma") e a promoção
// do módulo atual ("Estou em Módulo 2: ...") foram REMOVIDOS — a leitura por
// indicador vive na coluna Leitura da tabela.
// ---------------------------------------------------------------------------
describe("subtítulo enxuto do Meu ritmo", () => {
  it("subtítulo é APENAS 'Como estou em relação à turma nos últimos 30 dias.'", () => {
    renderCard()
    const subtitle = screen.getByText(/Como estou em relação à turma nos últimos 30 dias\./)
    expect(subtitle).toBeInTheDocument()
    expect(subtitle.textContent?.trim()).toBe("Como estou em relação à turma nos últimos 30 dias.")
    expect(screen.queryByText(/Como você está/)).toBeNull()
  })

  it("sem standing e sem módulo promovido, mesmo com lastCompletedLabel no payload", () => {
    renderCard()
    expect(screen.queryByText(/No geral,/)).toBeNull()
    expect(screen.queryByText(/estou à frente da turma/)).toBeNull()
    expect(screen.queryByText(/Estou em Módulo/)).toBeNull()
    // e a tabela NÃO tem a coluna "Onde você está".
    expect(screen.queryByText("Onde você está")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// SH-1.5 R2 (Hugo 2026-07-18) — the ritmo summary now lives in an EMPHASISED
// dark panel and the "Continuar agora" CTA is docked inside that same panel,
// replacing the old plain-italic paragraph + separate "Próximo passo:" bar.
// ---------------------------------------------------------------------------
describe("SH-1.5 R2 — resumo em faixa escura + CTA no canto do mesmo painel", () => {
  it("o parágrafo-resumo e o CTA vivem no MESMO painel escuro", () => {
    renderCard()
    const summary = screen.getByTestId("ritmo-summary")
    const cta = screen.getByRole("link", { name: /continuar/i })
    // The dark panel is the summary's parent; it also contains the CTA.
    const panel = summary.parentElement as HTMLElement
    expect(panel).not.toBeNull()
    expect(panel.className).toContain("bg-neutral-900")
    expect(panel.contains(cta)).toBe(true)
    // The CTA follows the paragraph inside the panel.
    expect(summary.compareDocumentPosition(cta)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it("o resumo aparece SÓ na Visão detalhada, não em Gráficos", () => {
    renderCard()
    expect(screen.getByTestId("ritmo-summary")).toBeInTheDocument()
    clickBtn("Gráficos")
    expect(screen.queryByTestId("ritmo-summary")).toBeNull()
    // com Gráficos não há CTA nem rótulo de próximo passo.
    expect(screen.queryByRole("link", { name: /continuar/i })).toBeNull()
    expect(screen.queryByText(/Próximo passo/i)).toBeNull()
  })
})
