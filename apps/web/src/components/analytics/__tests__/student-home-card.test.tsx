import { buildRitmoSummary } from "@/lib/analytics/ritmo-summary"
import type { ComparableMetricBlock, StudentHomeIndicators } from "@/types/analytics"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
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
// MUDANÇA 2 — HISTÓRICO: 3 toggles [Visão detalhada] [Gráficos] [Comparativo com
// a Jornada]. ROUND 28 (Hugo 2026-07-28, ao vivo): "tira e exclui os gráficos" —
// o toggle "Gráficos" (e o painel de barras que ele acionava) foi removido; os 2
// toggles restantes foram renomeados para o par "Turma"/"Meu plano", sob o
// rótulo "Comparar com:".
// ---------------------------------------------------------------------------

describe("ROUND 28 — 2 toggles (Meu plano / Turma) sob o rótulo 'Meu progresso'", () => {
  it("tem exatamente 2 botões de toggle, com as labels novas do Hugo — 'Gráficos' sumiu", () => {
    renderCard()
    expect(screen.getByRole("button", { name: "Turma" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Meu plano" })).toBeInTheDocument()
    // Old labels (this round's AND the older sub-toggle labels) are gone.
    expect(screen.queryByRole("button", { name: "Visão detalhada" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Gráficos" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Comparativo com a Jornada" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Tabela" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Barras" })).toBeNull()
  })

  it("o rótulo 'Meu progresso' aparece ACIMA do grupo de toggles", () => {
    // 2026-08-01 (Hugo): "Comparar com:" dizia a MECÂNICA do controle, o rótulo
    // passou a dizer o ASSUNTO. 2026-08-05 (Hugo): o parêntese explicativo saiu
    // e sobraram as duas palavras "Meu progresso". A estrutura (rótulo irmão do
    // grupo) não mudou. As duas palavras seguem UM único nó de texto — a
    // justificação de ponta a ponta é CSS, não markup partido; se alguém quebrar
    // a frase em spans, este getByText cai.
    renderCard()
    const label = screen.getByText("Meu progresso")
    const toggleGroup = label.parentElement as HTMLElement
    expect(toggleGroup.querySelector('button[type="button"]')).not.toBeNull()
    // o rótulo é irmão do grupo de botões, não filho do seletor de curso.
    expect(within(toggleGroup).getByRole("button", { name: "Turma" })).toBeInTheDocument()
    // o parêntese antigo não sobrou em lugar nenhum.
    expect(screen.queryByText(/em relação ao plano ou à turma/)).toBeNull()
  })

  it("'Meu plano' vem ANTES de 'Turma' na ordem visual (Hugo 2026-08-05)", () => {
    // Só a ORDEM DE RENDERIZAÇÃO mudou. O default de estado continua sendo a
    // "Turma" (compareView === "table"), coberto pelo teste seguinte — logo o
    // primeiro botão da esquerda NÃO é o pressionado, e isso é intencional.
    renderCard()
    const plano = screen.getByRole("button", { name: "Meu plano" })
    const turma = screen.getByRole("button", { name: "Turma" })
    expect(plano.compareDocumentPosition(turma) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("'Turma' (era 'Visão detalhada') é o default (tabela)", () => {
    renderCard()
    expect(screen.getByRole("button", { name: "Turma" }).getAttribute("aria-pressed")).toBe("true")
    expect(screen.getByTestId("comparison-insights-table")).toBeInTheDocument()
    expect(screen.queryByText("Sinais principais")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// SH-3.3 R5 (Hugo 2026-07-21) — 3º toggle, hoje renomeado para "Meu plano" (era
// "Comparativo com a Jornada", ver ROUND 28 acima). Full content coverage lives
// in plan-comparison-panel.test.tsx (its own fetch, its own states) — this just
// proves the SWITCH wires up correctly: the panel mounts, the table view hides,
// and it's lazy (no fetch until the toggle is actually clicked).
// ---------------------------------------------------------------------------

describe("SH-3.3 R5 — toggle 'Meu plano' (era 'Comparativo com a Jornada')", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {})) // never resolves — skeleton state is enough here
  })

  it("clicar em 'Meu plano' mostra o painel e esconde a tabela", () => {
    renderCard()
    expect(global.fetch).not.toHaveBeenCalled() // lazy: not fetched before the toggle is opened

    clickBtn("Meu plano")
    expect(screen.getByRole("button", { name: "Meu plano" }).getAttribute("aria-pressed")).toBe(
      "true",
    )
    expect(screen.queryByTestId("comparison-insights-table")).toBeNull()
    expect(screen.queryByText("Sinais principais")).toBeNull()
    expect(global.fetch).toHaveBeenCalledWith("/api/analytics/plan-dashboard", expect.anything())

    // voltar para Turma esconde o painel de novo.
    clickBtn("Turma")
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

  it("o resumo (e o ícone) aparecem SÓ na 'Turma', não em 'Meu plano' (ROUND 28: 'Gráficos' foi removido)", () => {
    renderCard()
    expect(screen.getByTestId("ritmo-summary")).toBeInTheDocument()
    expect(screen.getByTestId("ritmo-icon")).toBeInTheDocument()
    clickBtn("Meu plano")
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

  it("aluno muito atrás (2+ linhas) → ícone AlertCircle (SH-2.5: tom 'behind' único, sem mild/severe)", () => {
    const behind: StudentHomeIndicators = {
      ...INDICATORS,
      subject: { ...INDICATORS.subject, progressPct: 10, lastAccessDays: 60 },
      reference: { ...INDICATORS.reference, progressAvgPct: 90, lastAccessAvgDays: 3 },
    }
    render(<StudentHomeCard student={STUDENT} unit={UNIT} indicators={behind} continueHref="/x" />)
    const icon = screen.getByTestId("ritmo-icon")
    expect(icon.getAttribute("data-tone")).toBe("behind")
    expect(icon.querySelector("svg.lucide-circle-alert")).not.toBeNull()
  })

  it("SH-2.6 (caso Rinaldo) — EXATAMENTE 1 linha atrás entre 4 boas → ícone Minus ÂMBAR (tom 'tie'), NÃO mais vermelho", () => {
    const oneBehind: StudentHomeIndicators = {
      ...INDICATORS,
      subject: { ...INDICATORS.subject, progressPct: 50 },
      reference: { ...INDICATORS.reference, progressAvgPct: 67 },
    }
    render(
      <StudentHomeCard student={STUDENT} unit={UNIT} indicators={oneBehind} continueHref="/x" />,
    )
    const icon = screen.getByTestId("ritmo-icon")
    expect(icon.getAttribute("data-tone")).toBe("tie")
    expect(icon.className).toContain("bg-semantic-warning/15")
    expect(icon.className).toContain("text-semantic-warning")
    expect(icon.querySelector("svg.lucide-minus")).not.toBeNull()
    expect(icon.querySelector("svg.lucide-circle-alert")).toBeNull()
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

  it("a manchete é NEGRITO (Round 23: em BRANCO, não mais na cor do tom — ver describe dedicado abaixo)", () => {
    // STUDENT do fixture vence tudo → tom geral "win" (mesmo fixture do teste de ícone win).
    renderCard()
    const summary = screen.getByTestId("ritmo-summary")
    const headline = summary.querySelector("p") as HTMLElement
    expect(headline.className).toContain("font-bold")
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
// ROUND 21 (Hugo 2026-07-18, screenshot: "tem muito verde, então coloca por padrão no
// laranja da academy" + "pode deixar um pouco menor") — win: verde → laranja de marca
// (cerrado) em TODO o cartão (ícone, manchete, glow); manchete reduzida um degrau. O
// token global `--color-semantic-success` NÃO foi tocado (escopo é só este componente).
// ---------------------------------------------------------------------------
describe("ROUND 21 — win vira laranja cerrado (não mais verde) + manchete reduzida", () => {
  it("o ícone reativo do win também é laranja/cerrado (não mais verde)", () => {
    renderCard()
    const icon = screen.getByTestId("ritmo-icon")
    expect(icon.getAttribute("data-tone")).toBe("win")
    expect(icon.className).toContain("text-cerrado-600")
    expect(icon.className).not.toContain("semantic-success")
  })

  it("o glow do painel no win usa o oklch do cerrado-600 (mesmo valor de SEG_ACTIVE_BG), não mais o verde", () => {
    renderCard()
    const summary = screen.getByTestId("ritmo-summary")
    const panel = summary.parentElement as HTMLElement
    // oklch(0.64 0.17 42) é o MESMO triple de --color-cerrado-600 em theme.css (e do
    // SEG_ACTIVE_BG do botão "Visão detalhada" — o laranja de marca que o Hugo referenciou).
    expect(panel.style.backgroundImage).toContain("0.64 0.17 42")
    expect(panel.style.backgroundImage).not.toContain("0.65 0.19 155") // era o verde (Round 20)
  })

  it("SEM ambiguidade win↔none NESTE painel: none continua neutro/branco, só win é cerrado", () => {
    // Diferente do botão de ação da tabela (onde win/none colidiriam se ambos fossem
    // cerrado-600, resolvido lá com um degrau -500), este painel NÃO precisa diferenciar
    // por degrau: `none` aqui é branco neutro (bg-white/10), nunca cerrado, então não há
    // colisão a resolver.
    // Mesmo shape/cast do fixture "sem dado" de ritmo-summary.test.ts (summaryToneOf → "none").
    const noData: StudentHomeIndicators = {
      subject: {
        lastAccessDays: null,
        progressPct: null as unknown as number,
        engagement: null as unknown as number,
        interactions: null as unknown as number,
        reflections: null as unknown as number,
      },
      reference: {
        lastAccessAvgDays: null,
        ritmoEmDiaPct: 40,
        progressAvgPct: null as unknown as number,
        engagementAvg: null as unknown as number,
        interactionsAvg: null as unknown as number,
        reflectionsAvg: null as unknown as number,
      },
    }
    render(<StudentHomeCard student={STUDENT} unit={UNIT} indicators={noData} continueHref="/x" />)
    const icon = screen.getByTestId("ritmo-icon")
    expect(icon.getAttribute("data-tone")).toBe("none")
    expect(icon.className).toContain("bg-white/10")
    expect(icon.className).not.toContain("cerrado")
  })

  it("a manchete encolheu um degrau (text-base/sm:text-lg), não mais text-lg/sm:text-xl", () => {
    renderCard()
    const summary = screen.getByTestId("ritmo-summary")
    const headline = summary.querySelector("p") as HTMLElement
    const classes = headline.className.split(/\s+/)
    expect(classes).toContain("text-base")
    expect(classes).toContain("sm:text-lg")
    // não é mais o tamanho-base do Round 20 (checagem por TOKEN exato, "sm:text-lg" não
    // deve falso-positivar como contendo "text-lg" solto).
    expect(classes).not.toContain("text-lg")
    expect(classes).not.toContain("sm:text-xl")
    // continua NEGRITO — só o tamanho mudou (a decisão de design do Round 20 permanece,
    // apenas menos dominante). A cor foi removida depois, no Round 23 (ver describe abaixo).
    expect(headline.className).toContain("font-bold")
  })
})

// ---------------------------------------------------------------------------
// ROUND 23 (Hugo 2026-07-18, "to achando que o texto em branco talvez fique melhor",
// olhando o painel ao vivo) — a manchete deixa de ser colorida pelo tom e vira texto
// BRANCO fixo. Pedido pontual, só sobre o TEXTO: o glow de fundo e o ícone CONTINUAM
// refletindo o tom (não tocados). Hierarquia manchete > linha de apoio agora vem de
// tamanho + peso + opacidade (branco 100% vs branco 60%), não mais de cor.
// ---------------------------------------------------------------------------
describe("ROUND 23 — manchete em BRANCO fixo (não mais na cor do tom)", () => {
  it("a manchete é BRANCO PLENO (text-white) no tom win, não mais text-cerrado-600", () => {
    renderCard()
    const summary = screen.getByTestId("ritmo-summary")
    const headline = summary.querySelector("p") as HTMLElement
    const classes = headline.className.split(/\s+/)
    expect(classes).toContain("text-white")
    expect(classes).not.toContain("text-cerrado-600")
    expect(headline.className).not.toContain("text-semantic-success")
  })

  it("a manchete é BRANCO PLENO em QUALQUER tom (behind também não usa mais text-semantic-error)", () => {
    const behind: StudentHomeIndicators = {
      ...INDICATORS,
      subject: { ...INDICATORS.subject, progressPct: 10, lastAccessDays: 60 },
      reference: { ...INDICATORS.reference, progressAvgPct: 90, lastAccessAvgDays: 3 },
    }
    render(<StudentHomeCard student={STUDENT} unit={UNIT} indicators={behind} continueHref="/x" />)
    const summary = screen.getByTestId("ritmo-summary")
    const headline = summary.querySelector("p") as HTMLElement
    const classes = headline.className.split(/\s+/)
    expect(classes).toContain("text-white")
    expect(headline.className).not.toContain("text-semantic-error")
    expect(headline.className).not.toContain("text-semantic-warning")
    expect(headline.className).not.toContain("text-cerrado")
  })

  it("hierarquia PRESERVADA sem cor: manchete é branco 100% (text-white puro), apoio é branco 60% (text-white/60)", () => {
    renderCard()
    const summary = screen.getByTestId("ritmo-summary")
    const paragraphs = summary.querySelectorAll("p")
    const headlineClasses = paragraphs[0].className.split(/\s+/)
    // "text-white" exato (não "text-white/NN") — opacidade PLENA na manchete.
    expect(headlineClasses).toContain("text-white")
    expect(paragraphs[0].className).not.toContain("text-white/")
    // a linha de apoio segue muted (60%), mais fraca que a manchete.
    expect(paragraphs[1].className).toContain("text-white/60")
    // manchete ainda maior (text-base/sm:text-lg) e mais pesada (font-bold) que o apoio
    // (text-sm, peso normal) — 3 sinais de hierarquia (tamanho, peso, opacidade) no lugar
    // do sinal de cor que existia até o Round 22.
    expect(paragraphs[0].className).toContain("font-bold")
    expect(paragraphs[1].className).not.toContain("font-bold")
  })

  it("o GLOW e o ÍCONE continuam refletindo o tom (só o texto da manchete mudou)", () => {
    renderCard() // win
    const summary = screen.getByTestId("ritmo-summary")
    const panel = summary.parentElement as HTMLElement
    const icon = screen.getByTestId("ritmo-icon")
    // glow ainda tintado (oklch do cerrado-600, o mesmo do Round 21/22, intocado).
    expect(panel.style.backgroundImage).toContain("radial-gradient")
    expect(panel.style.backgroundImage).toContain("0.64 0.17 42")
    // ícone ainda cerrado no win (Round 21/22, intocado).
    expect(icon.className).toContain("text-cerrado-600")
  })
})

// ---------------------------------------------------------------------------
// ROUND 4 (Hugo 2026-07-18) — o card THREADA o continueHref até a tabela: o
// botão acionável que aparece nas linhas "atrás" leva para o MESMO destino do
// CTA "Continuar agora" do painel. Prova de fim-a-fim (o card passa o prop; a
// tabela renderiza o botão com o href certo).
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// SH-3.3 R3 (Hugo 2026-07-21) — o CTA "Meu plano" SAIU do cabeçalho do card
// (3ª iteração: colidia como CTA duplicado ao lado dos toggles, ainda em
// laranja/pequeno). Ele agora vive numa faixa independente, ACIMA do card
// inteiro (StudyPlanInviteStrip, testado em study-plan-invite-strip.test.tsx).
// Este describe cobre a ausência: nenhum link para /meu-plano sobrevive
// dentro do StudentHomeCard (nem cabeçalho, nem painel escuro).
// ---------------------------------------------------------------------------
describe("SH-3.3 R3 — CTA 'Meu plano' NÃO existe mais dentro do card (moveu para a faixa acima)", () => {
  it("nenhum link para /meu-plano sobrevive em lugar nenhum do card", () => {
    renderCard()
    expect(screen.queryAllByRole("link", { name: /Meu plano/ })).toHaveLength(0)
    expect(document.querySelectorAll('a[href="/meu-plano"]')).toHaveLength(0)
  })

  it("o cabeçalho tem só os 2 toggles de vista, sem CTA de navegação junto", () => {
    renderCard()
    const controls = screen.getByRole("button", { name: "Turma" }).parentElement
    expect(controls?.querySelectorAll("a")).toHaveLength(0)
  })
})

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

// ---------------------------------------------------------------------------
// JRN-D (correção Hugo 2026-07-24, ao vivo) — seletor de curso no cabeçalho do
// card. Fica SEMPRE visível com 1+ curso (antes escondia com <2, o que privava o
// aluno de 1 matrícula, o Rinaldo, do controle); some só com 0 cursos. Default
// "Todos os cursos" (null); mudar chama onSelectCourse.
// ---------------------------------------------------------------------------
describe("JRN-D — seletor de curso do card 'Meu ritmo'", () => {
  const COURSES = [
    { courseId: "c1", courseTitle: "Curso Um" },
    { courseId: "c2", courseTitle: "Curso Dois" },
  ]

  it("aparece com 1 curso só (correção: sempre visível, caso Rinaldo)", () => {
    render(
      <StudentHomeCard
        student={STUDENT}
        unit={UNIT}
        indicators={INDICATORS}
        continueHref="/courses/next"
        courseOptions={[{ courseId: "c1", courseTitle: "Único" }]}
        selectedCourseId={null}
        onSelectCourse={() => {}}
      />,
    )
    const select = screen.getByLabelText("Filtrar por curso") as HTMLSelectElement
    expect(select).toBeInTheDocument()
    // default "Todos os cursos" (null) = agregado = dado idêntico ao de hoje.
    expect(select.value).toBe("")
    expect(screen.getByRole("option", { name: "Todos os cursos" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Único" })).toBeInTheDocument()
  })

  it("NÃO aparece sem curso nenhum (courseOptions vazio)", () => {
    render(
      <StudentHomeCard
        student={STUDENT}
        unit={UNIT}
        indicators={INDICATORS}
        continueHref="/courses/next"
        courseOptions={[]}
        onSelectCourse={() => {}}
      />,
    )
    expect(screen.queryByLabelText("Filtrar por curso")).toBeNull()
  })

  it("aparece com 2+ cursos, default 'Todos os cursos', e lista os cursos", () => {
    render(
      <StudentHomeCard
        student={STUDENT}
        unit={UNIT}
        indicators={INDICATORS}
        continueHref="/courses/next"
        courseOptions={COURSES}
        selectedCourseId={null}
        onSelectCourse={() => {}}
      />,
    )
    const select = screen.getByLabelText("Filtrar por curso") as HTMLSelectElement
    expect(select).toBeInTheDocument()
    expect(select.value).toBe("") // "Todos os cursos" = default (null)
    expect(screen.getByRole("option", { name: "Todos os cursos" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Curso Um" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Curso Dois" })).toBeInTheDocument()
  })

  it("escolher um curso chama onSelectCourse com o courseId; 'Todos' chama com null", () => {
    const onSelectCourse = vi.fn()
    render(
      <StudentHomeCard
        student={STUDENT}
        unit={UNIT}
        indicators={INDICATORS}
        continueHref="/courses/next"
        courseOptions={COURSES}
        selectedCourseId={null}
        onSelectCourse={onSelectCourse}
      />,
    )
    const select = screen.getByLabelText("Filtrar por curso")
    fireEvent.change(select, { target: { value: "c2" } })
    expect(onSelectCourse).toHaveBeenLastCalledWith("c2")
    fireEvent.change(select, { target: { value: "" } })
    expect(onSelectCourse).toHaveBeenLastCalledWith(null)
  })
})

// ---------------------------------------------------------------------------
// TESTE VERMELHO — POP-FIX-001, run 2026-08-07-academy-manager-dashboard-copy-fixes
// Passo 2 (Identificar o Problema). Item 2 de 4 do `00-criterio.md`:
//
//   student-home-card.tsx:207-209 — «"Meu progresso" ficou muito separado»
//
// LEITURA ADOTADA, e por que ela e não a outra. O relato do cliente é ambíguo em
// prosa: "separado" pode ser (a) o rótulo afastado VERTICALMENTE do grupo de
// toggles, ou (b) as duas palavras afastadas HORIZONTALMENTE uma da outra. O
// GEMBA desempata a favor de (b), por três fatos verificáveis:
//
//   1. o afastamento vertical é `gap-1.5` (6px) no container da linha 198 — 6px
//      não é "muito separado", é dos gaps mais apertados do design system;
//   2. `gap-1.5` NÃO mudou: é anterior ao commit `fde186e` e sobreviveu a ele;
//   3. o commit `fde186e` (2026-08-05, DOIS DIAS antes do relato) tem no próprio
//      assunto a palavra "esticado", e foi ele que introduziu
//      `[text-align-last:justify]`, jogando "Meu" na ponta esquerda e
//      "progresso" na ponta direita, na largura inteira do par de botões.
//
// O cliente disse "FICOU muito separado" — "ficou" denuncia mudança recente, e a
// única mudança recente é a justificação. Ver `02-modo-de-falha.md`, seção
// "Item 2 — a ambiguidade e como o GEMBA a desempata".
//
// O invariante do nó de texto ÚNICO (herdado da rodada 2026-08-05) segue de pé e
// é reafirmado abaixo: a correção é tirar o esticamento, jamais partir a frase em
// spans — isso quebraria o leitor de tela e o `getByText` desta suíte.
// ---------------------------------------------------------------------------

describe("StudentHomeCard — rótulo 'Meu progresso' não esticado (POP-FIX-001, item 2)", () => {
  it("o rótulo NÃO é justificado de ponta a ponta (as duas palavras ficam juntas)", () => {
    renderCard()
    const label = screen.getByText("Meu progresso")
    expect(label.className).not.toContain("[text-align-last:justify]")
    expect(label.className).not.toContain("text-justify")
  })

  it("as duas palavras seguem em UM único nó de texto (a correção tira o esticamento, não parte a frase)", () => {
    renderCard()
    const label = screen.getByText("Meu progresso")
    expect(label.textContent).toBe("Meu progresso")
    expect(label.querySelectorAll("span").length).toBe(0)
  })

  it("a estrutura fica intacta: o rótulo continua irmão do grupo de toggles", () => {
    renderCard()
    const label = screen.getByText("Meu progresso")
    const group = label.parentElement as HTMLElement
    expect(within(group).getByRole("button", { name: "Meu plano" })).toBeInTheDocument()
    expect(within(group).getByRole("button", { name: "Turma" })).toBeInTheDocument()
  })
})
