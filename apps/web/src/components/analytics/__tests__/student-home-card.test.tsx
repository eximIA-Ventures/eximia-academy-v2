import { buildRitmoSummary } from "@/lib/analytics/ritmo-summary"
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
//
// Round 6 (Hugo 2026-07-18) — the comparison TABLE now renders its own universal
// ActionButtons on every row (labels "Continuar sessão", "Continuar agora", …), so
// a card-wide `/continuar/i` link query is no longer unique. The intent of this
// test is specifically about the PANEL CTA being the single CTA of the summary
// band, so we scope the assertions to the dark ritmo-summary panel (the table's
// buttons live inside `comparison-insights-table`, a different container, and are
// tested there).
// ---------------------------------------------------------------------------

describe("ROUND 18 — CTA REMOVIDO do painel do resumo (era duplicado do CTA por linha)", () => {
  it("o painel do resumo NÃO tem mais nenhum link/CTA (o botão 'Continuar agora' saiu)", () => {
    renderCard()
    // Scope to the dark panel that holds the summary.
    const panel = screen.getByTestId("ritmo-summary").parentElement as HTMLElement
    expect(panel.className).toContain("bg-neutral-900")
    // Round 18 — o CTA foi removido do painel; nenhum <a> mora aqui agora.
    expect(panel.querySelectorAll("a")).toHaveLength(0)
    // o rótulo antigo do NextStepBar segue ausente.
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

describe("M1/M2 — resumo depois do card + escopo turma", () => {
  it("M1: o painel do resumo renderiza DEPOIS da tabela de comparação (ordem no DOM)", () => {
    renderCard()
    const table = screen.getByTestId("comparison-insights-table")
    // Round 18 — o CTA saiu; miro o painel do resumo em si (o parágrafo), que segue a tabela.
    const summary = screen.getByTestId("ritmo-summary")
    // summary follows the table and is not contained by it → DOCUMENT_POSITION_FOLLOWING.
    expect(table.compareDocumentPosition(summary)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it("M2: título 'Meu ritmo' + subtítulo 'Como estou na minha jornada' (Round 18), sem unidade nomeada", () => {
    renderCard()
    expect(screen.getByRole("heading", { name: "Meu ritmo" })).toBeInTheDocument()
    expect(screen.getByText("Como estou na minha jornada")).toBeInTheDocument()
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
  it("ROUND 18 — subtítulo é 'Como estou na minha jornada' (sem ponto final)", () => {
    renderCard()
    const subtitle = screen.getByText("Como estou na minha jornada")
    expect(subtitle).toBeInTheDocument()
    expect(subtitle.textContent?.trim()).toBe("Como estou na minha jornada")
    // o subtítulo antigo (turma / 30 dias) não existe mais.
    expect(screen.queryByText(/em relação à turma nos últimos 30 dias/)).toBeNull()
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
describe("ROUND 19 — resumo em faixa escura + ÍCONE reativo (ilustração cancelada pelo Hugo)", () => {
  it("o parágrafo-resumo e o ÍCONE vivem no MESMO painel escuro (sem CTA)", () => {
    renderCard()
    const summary = screen.getByTestId("ritmo-summary")
    // The dark panel is the summary's parent.
    const panel = summary.parentElement as HTMLElement
    expect(panel).not.toBeNull()
    expect(panel.className).toContain("bg-neutral-900")
    // Round 19 — o ícone reativo vive no painel; o CTA não existe mais (Round 18).
    const icon = screen.getByTestId("ritmo-icon")
    expect(panel.contains(icon)).toBe(true)
    expect(panel.querySelectorAll("a")).toHaveLength(0)
    // O ícone segue o parágrafo dentro do painel.
    expect(summary.compareDocumentPosition(icon)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it("o resumo (e o ícone) aparecem SÓ na Visão detalhada, não em Gráficos", () => {
    renderCard()
    expect(screen.getByTestId("ritmo-summary")).toBeInTheDocument()
    expect(screen.getByTestId("ritmo-icon")).toBeInTheDocument()
    clickBtn("Gráficos")
    expect(screen.queryByTestId("ritmo-summary")).toBeNull()
    expect(screen.queryByTestId("ritmo-icon")).toBeNull()
    expect(screen.queryByText(/Próximo passo/i)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// ROUND 19 (Hugo 2026-07-18, "cancela a ideia das illustrations, coloca só um ícone")
// — supersede o bloco "ilustração reativa" do Round 18: o glifo Lucide exibido reflete
// o tom GERAL do aluno (summaryToneOf, severity-first + override de #1, INTOCADO — só
// o QUE renderiza por tom mudou, de SVG custom para ícone). 5 tons → 5 ícones Lucide.
// ---------------------------------------------------------------------------
describe("ROUND 19 — ícone reativo por tom geral", () => {
  it("aluno à frente (win) → ícone TrendingUp (mesmo glifo do chip 'Como estou' win)", () => {
    // STUDENT do fixture vence progresso/interações/reflexões/engajamento e atividade.
    renderCard()
    const icon = screen.getByTestId("ritmo-icon")
    expect(icon.getAttribute("data-tone")).toBe("win")
    expect(icon.querySelector("svg.lucide-trending-up")).not.toBeNull()
    expect(icon.getAttribute("aria-label")).toBeTruthy()
  })

  it("aluno severamente atrás → ícone AlertCircle (severidade domina)", () => {
    const severe: StudentHomeIndicators = {
      ...INDICATORS,
      subject: { ...INDICATORS.subject, progressPct: 10, lastAccessDays: 60 },
      reference: { ...INDICATORS.reference, progressAvgPct: 90, lastAccessAvgDays: 3 },
    }
    render(<StudentHomeCard student={STUDENT} unit={UNIT} indicators={severe} continueHref="/x" />)
    const icon = screen.getByTestId("ritmo-icon")
    expect(icon.getAttribute("data-tone")).toBe("behind-severe")
    expect(icon.querySelector("svg.lucide-circle-alert")).not.toBeNull()
  })

  it("nenhum <img> nem asset de /illustrations/ é renderizado (ilustração cancelada)", () => {
    renderCard()
    const icon = screen.getByTestId("ritmo-icon")
    expect(icon.querySelector("img")).toBeNull()
    expect(document.querySelector('img[src^="/illustrations/"]')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// ROUND 20 (Hugo 2026-07-18, "ainda não tá legal esse visual... tem que ser algo que o
// cara olhe e pense 'caralho, captei vossa mensagem'", narrowado para "to falando só da
// frase" + "me surpreende, só não exagera") — o cartão da frase-resumo perde o formato
// de citação/aspas e vira manchete pessoal (1ª frase, negrito, cor do tom) + linha de
// apoio (2ª frase, muted), sobre um glow tintado por tom em vez de preto chapado. A
// LÓGICA de `buildRitmoSummary`/`summaryToneOf` está intocada — só a apresentação.
// ---------------------------------------------------------------------------
describe("ROUND 20 — cartão da frase-resumo: manchete pessoal + glow por tom (sem aspas)", () => {
  it("o texto NÃO usa mais formato de citação (sem aspas ao redor do resumo)", () => {
    renderCard()
    const summary = screen.getByTestId("ritmo-summary")
    expect(summary.textContent).not.toContain('"')
  })

  it("o resumo vira 2 elementos tipográficos: manchete (1ª frase) + linha de apoio (2ª frase)", () => {
    renderCard()
    const summary = screen.getByTestId("ritmo-summary")
    const paragraphs = summary.querySelectorAll("p")
    expect(paragraphs).toHaveLength(2)

    const expected = buildRitmoSummary(INDICATORS, undefined)
    const [expectedHeadline, expectedSupport] = expected.split(/(?<=\.)\s+(.*)/s)
    expect(paragraphs[0].textContent).toBe(expectedHeadline)
    expect(paragraphs[1].textContent).toBe(expectedSupport)
    // Junto, os 2 parágrafos reconstroem o resumo completo (nenhum dado perdido/alterado).
    expect(`${paragraphs[0].textContent} ${paragraphs[1].textContent}`).toBe(expected)
  })

  it("a manchete é NEGRITO e usa a cor do tom (win → text-semantic-success)", () => {
    // STUDENT do fixture vence tudo → tom geral "win" (mesmo fixture do teste de ícone win).
    renderCard()
    const summary = screen.getByTestId("ritmo-summary")
    const headline = summary.querySelector("p") as HTMLElement
    expect(headline.className).toContain("font-bold")
    expect(headline.className).toContain("text-semantic-success")
  })

  it("a manchete muda de cor conforme summaryToneOf (behind-severe → text-semantic-error)", () => {
    const severe: StudentHomeIndicators = {
      ...INDICATORS,
      subject: { ...INDICATORS.subject, progressPct: 10, lastAccessDays: 60 },
      reference: { ...INDICATORS.reference, progressAvgPct: 90, lastAccessAvgDays: 3 },
    }
    render(<StudentHomeCard student={STUDENT} unit={UNIT} indicators={severe} continueHref="/x" />)
    const summary = screen.getByTestId("ritmo-summary")
    const headline = summary.querySelector("p") as HTMLElement
    expect(headline.className).toContain("text-semantic-error")
  })

  it("o painel tem um glow de fundo tintado por tom (background-image radial-gradient)", () => {
    renderCard()
    const summary = screen.getByTestId("ritmo-summary")
    const panel = summary.parentElement as HTMLElement
    expect(panel.style.backgroundImage).toContain("radial-gradient")
    // O glow é sutil (a mesma família de opacidade dos chips da tabela) — não um bloco
    // de cor sólida: nenhuma opacidade acima de 20% no color-stop do gradiente.
    const alphaMatch = panel.style.backgroundImage.match(/\/\s*(\d+)%/)
    expect(alphaMatch).not.toBeNull()
    expect(Number(alphaMatch?.[1])).toBeLessThanOrEqual(20)
  })

  it("SEM borda/anel tintado por tom no painel (opção 'presença física' foi deliberadamente descartada)", () => {
    // O painel já tinha um ring NEUTRO em dark-mode (dark:ring-1 dark:ring-white/10,
    // de rounds anteriores, ortogonal a esta decisão) — o que o Round 20 recusou foi
    // ACRESCENTAR um segundo dispositivo visual (borda ou anel NA COR DO TOM) em cima
    // do glow + manchete. Nenhuma classe `border-*`/`ring-semantic-*`/`ring-cerrado-*`.
    renderCard()
    const summary = screen.getByTestId("ritmo-summary")
    const panel = summary.parentElement as HTMLElement
    expect(panel.className).not.toMatch(/\bborder(?!-collapse)/)
    expect(panel.className).not.toMatch(/ring-(semantic|cerrado)/)
  })

  it("o ícone reativo (Round 19) permanece, só um pouco menor (h-12, não mais h-14)", () => {
    renderCard()
    const icon = screen.getByTestId("ritmo-icon")
    expect(icon.className).toContain("h-12")
    expect(icon.className).not.toContain("h-14")
  })
})

// ---------------------------------------------------------------------------
// ROUND 4 (Hugo 2026-07-18) — o card THREADA o continueHref até a tabela: o
// botão acionável que aparece nas linhas "atrás" leva para o MESMO destino do
// CTA "Continuar agora" do painel. Prova de fim-a-fim (o card passa o prop; a
// tabela renderiza o botão com o href certo).
// ---------------------------------------------------------------------------
describe("Round 4 — continueHref threaded do card até o botão acionável da tabela", () => {
  // Fixture com o aluno ATRÁS em Progresso (20 vs 80) para forçar o botão da linha.
  const BEHIND_INDICATORS: StudentHomeIndicators = {
    ...INDICATORS,
    subject: { ...INDICATORS.subject, progressPct: 20 },
    reference: { ...INDICATORS.reference, progressAvgPct: 80 },
  }

  it("o botão da linha atrás aponta para o mesmo continueHref passado ao card", () => {
    render(
      <StudentHomeCard
        student={STUDENT}
        unit={UNIT}
        indicators={BEHIND_INDICATORS}
        continueHref="/courses/next"
      />,
    )
    // O botão acionável da tabela (Progresso atrás) usa o href threaded do card.
    // Round 18 — o CTA do PAINEL foi removido, então a fonte única de ação é o CTA por
    // linha da tabela; o threading do continueHref para a tabela segue intacto.
    expect(screen.getByTestId("action-progress").getAttribute("href")).toBe("/courses/next")
  })
})
