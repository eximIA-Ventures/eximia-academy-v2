import type { StudentHomeIndicators } from "@/types/analytics"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  ComparisonInsightsTable,
  firstPersonStanding,
  subjectRowLabel,
  winnerOf,
} from "../comparison-insights-table"

// Você mais recente (último acesso invertido → Você vence), "Onde você está" =
// onde parou + % no Você e "—" na Média (sem vencedor), Progresso Média maior
// (destaque na MÉDIA), Engajamento Você maior (destaque em Você).
const INDICATORS: StudentHomeIndicators = {
  subject: {
    lastAccessDays: 1,
    ritmoDisplay: "no_ritmo",
    progressPct: 50,
    engagement: 14,
    interactions: 6,
    reflections: 2,
    // "Onde você está" — ONDE O ALUNO PAROU: módulo da atividade mais recente + % (Hugo).
    lastCompletedLabel: "Módulo 3: Precificação · 60%",
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

// ---------------------------------------------------------------------------
// winnerOf — DIRECTION-AWARE.
// ---------------------------------------------------------------------------

describe("winnerOf — direction-aware", () => {
  it("higher: maior vence (progresso, engajamento)", () => {
    expect(winnerOf(75, 63, "higher")).toBe("subject")
    expect(winnerOf(50, 55, "higher")).toBe("reference")
  })
  it("lower: MENOR vence (último acesso, recência invertida)", () => {
    expect(winnerOf(1, 4, "lower")).toBe("subject") // menos dias = mais recente = vence
    expect(winnerOf(9, 4, "lower")).toBe("reference")
  })
  it("empate ou valor ausente → ninguém vence", () => {
    expect(winnerOf(5, 5, "higher")).toBeNull()
    expect(winnerOf(5, 5, "lower")).toBeNull()
    expect(winnerOf(null, 4, "lower")).toBeNull()
    expect(winnerOf(4, null, "higher")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Render — 4 operational columns, 2 rows, direction-aware highlight, ritmo
// without a winner.
// ---------------------------------------------------------------------------

describe("ComparisonInsightsTable — 4 indicadores operacionais", () => {
  it("renderiza as 4 colunas na ordem + cabeçalho da 1a coluna + 2 linhas", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    // A coluna outrora "Ritmo" vira "Onde você está" na auto-visão do aluno.
    for (const label of [
      "Comparação",
      "Último acesso",
      "Onde você está",
      "Progresso",
      "Engajamento",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    // PONTO 1 (Hugo 2026-07-14): a linha do sujeito é 1ª pessoa — sem nome
    // informado degrada para "Eu" (com nome vira "Eu (Nome)", testado abaixo).
    expect(screen.getByText("Eu")).toBeInTheDocument()
    expect(screen.getByText("Média da turma")).toBeInTheDocument()
  })

  it("Onde você está: 'onde parou + %' no Você + '—' na Média, SEM vencedor", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    // A auto-visão do aluno mostra onde ele PAROU (módulo + %); a Média não tem
    // "onde" (a média não pára em lugar nenhum) → célula "—".
    expect(screen.getByTestId("cell-subject-ritmo").textContent).toBe("Módulo 3: Precificação · 60%")
    expect(screen.getByTestId("cell-reference-ritmo").textContent).toBe("—")
    expect(screen.queryByText("58% em dia")).not.toBeInTheDocument()
    expect(screen.getByTestId("cell-subject-ritmo").getAttribute("data-win")).toBe("false")
    expect(screen.getByTestId("cell-reference-ritmo").getAttribute("data-win")).toBe("false")
  })

  it("Último acesso INVERTIDO: Você mais recente (1d < 4d) vence", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(screen.getByTestId("cell-subject-lastAccess").getAttribute("data-win")).toBe("true")
    expect(screen.getByTestId("cell-reference-lastAccess").getAttribute("data-win")).toBe("false")
    expect(screen.getByText("há 1 dia")).toBeInTheDocument()
    expect(screen.getByText("há 4 dias")).toBeInTheDocument()
  })

  it("Progresso (maior vence): Média 55 > Você 50 → destaque na MÉDIA", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(screen.getByTestId("cell-reference-progress").getAttribute("data-win")).toBe("true")
    expect(screen.getByTestId("cell-subject-progress").getAttribute("data-win")).toBe("false")
  })

  it("Engajamento (maior vence): Você 14 > Média 9 → destaque em Você; nunca vermelho", () => {
    const { container } = render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(screen.getByTestId("cell-subject-engagement").getAttribute("data-win")).toBe("true")
    expect(screen.getByTestId("cell-reference-engagement").getAttribute("data-win")).toBe("false")
    expect(container.innerHTML).not.toMatch(/text-red|bg-red|#ef|#dc2/i)
  })

  it("FRENTE 2: Engajamento mostra número + 'X interações · Y reflexões' nas 2 linhas", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    // Você: score 14 + sublinha 6 interações · 2 reflexões.
    expect(screen.getByTestId("cell-subject-engagement").textContent).toBe("14")
    expect(screen.getByText("6 interações · 2 reflexões")).toBeInTheDocument()
    // Média: score 9 + sublinha média 4 interações · 1 reflexão.
    expect(screen.getByTestId("cell-reference-engagement").textContent).toBe("9")
    expect(screen.getByText("4 interações · 1 reflexões")).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// "Onde você está" — a auto-visão do ALUNO substitui a triagem do gestor na
// coluna Ritmo da linha "Você" (Hugo, 2026-07-14). A célula "Você" mostra o NOME
// do ÚLTIMO módulo/capítulo CONCLUÍDO (ex.: "Módulo 3: Precificação"), não um
// veredito nem "% concluído" (redundante com Progresso). Fallback só quando nada
// foi concluído: "Começando". A Média da turma e a visão do gestor
// (student-insights-table.tsx) NÃO mudam.
// ---------------------------------------------------------------------------

describe("Onde você está — linha Você (auto-visão do aluno)", () => {
  it("cabeçalho da coluna vira 'Onde você está' (não 'Ritmo')", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(screen.getByText("Onde você está")).toBeInTheDocument()
    expect(screen.queryByText("Ritmo")).not.toBeInTheDocument()
  })

  it("a linha Você NÃO mostra o badge de triagem, mostra onde PAROU + %", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    // O badge de triagem do gestor não aparece mais na auto-visão do aluno.
    expect(screen.queryByText("No ritmo")).not.toBeInTheDocument()
    // A célula "Você" mostra onde o aluno PAROU (módulo da atividade mais recente + %).
    expect(screen.getByTestId("cell-subject-ritmo").textContent).toBe("Módulo 3: Precificação · 60%")
    expect(screen.getByTestId("cell-subject-ritmo").textContent).not.toMatch(/% concluído/)
  })

  it("sem conclusão (lastCompletedLabel null) → 'Começando'", () => {
    const zero: StudentHomeIndicators = {
      ...INDICATORS,
      subject: { ...INDICATORS.subject, lastCompletedLabel: null },
    }
    render(<ComparisonInsightsTable indicators={zero} />)
    expect(screen.getByTestId("cell-subject-ritmo").textContent).toBe("Começando")
  })

  it("a Média da turma vira '—' (a média não tem 'onde') e a célula NÃO tem vencedor", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(screen.getByTestId("cell-reference-ritmo").textContent).toBe("—")
    expect(screen.queryByText("58% em dia")).not.toBeInTheDocument()
    expect(screen.getByTestId("cell-subject-ritmo").getAttribute("data-win")).toBe("false")
    expect(screen.getByTestId("cell-reference-ritmo").getAttribute("data-win")).toBe("false")
  })
})

// ---------------------------------------------------------------------------
// SH-F.5 — o topo do Você vira fração "X de N" (só o Você; Média absoluta),
// sublinha intocada, winner só do absoluto, edge X>N são.
// ---------------------------------------------------------------------------

const withMax = (engagementMax: number, engagement = INDICATORS.subject.engagement) => ({
  ...INDICATORS,
  subject: { ...INDICATORS.subject, engagement, engagementMax },
})

describe("SH-F.5 — Engajamento fração X de N", () => {
  it("com engagementMax → Você = 'X de N' E Média = 'X de N' (mesmo N — Hugo 2026-07-14)", () => {
    // RE-SPEC do AC6 antigo ("Média absoluta"): Hugo pediu CONSISTÊNCIA — a
    // Média usa o MESMO denominador N da trilha que já alimenta o Você.
    render(<ComparisonInsightsTable indicators={withMax(40)} />)
    expect(screen.getByTestId("cell-subject-engagement").textContent).toBe("14 de 40")
    expect(screen.getByTestId("cell-reference-engagement").textContent).toBe("9 de 40")
  })

  it("sem engagementMax → AMBOS degradam para o absoluto", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(screen.getByTestId("cell-subject-engagement").textContent).toBe("14")
    expect(screen.getByTestId("cell-reference-engagement").textContent).toBe("9")
  })

  it("AC5: sublinha absoluta INTOCADA mesmo com a fração no topo", () => {
    render(<ComparisonInsightsTable indicators={withMax(40)} />)
    expect(screen.getByText("6 interações · 2 reflexões")).toBeInTheDocument()
  })

  it("AC7: o denominador NÃO move o vencedor (winner só do absoluto)", () => {
    // winnerOf compara os absolutos, independente de N.
    expect(winnerOf(14, 9, "higher")).toBe("subject")
    // Com N grande, Você (14) ainda vence a Média (9).
    render(<ComparisonInsightsTable indicators={withMax(200)} />)
    expect(screen.getByTestId("cell-subject-engagement").getAttribute("data-win")).toBe("true")
    expect(screen.getByTestId("cell-reference-engagement").getAttribute("data-win")).toBe("false")
  })

  it("AC11: X > N renderiza a fração honesta 'X de N' sem clamp, sem NaN/quebra", () => {
    const { container } = render(<ComparisonInsightsTable indicators={withMax(10, 14)} />)
    expect(screen.getByTestId("cell-subject-engagement").textContent).toBe("14 de 10")
    expect(container.innerHTML).not.toMatch(/NaN|undefined/)
  })
})

// ---------------------------------------------------------------------------
// AJUSTE 2 (Hugo 2026-07-14) — penúltima visita: quando não há acesso ANTERIOR
// à visita atual (subject.lastAccessDays null), a célula Você mostra o rótulo
// honesto "Primeiro acesso" (o aluno ESTÁ acessando — "nunca" seria mentira).
// ---------------------------------------------------------------------------
describe("Último acesso (Você) — estado sem acesso anterior", () => {
  it("subject.lastAccessDays null → 'Primeiro acesso' na célula Você", () => {
    const first = {
      ...INDICATORS,
      subject: { ...INDICATORS.subject, lastAccessDays: null },
    }
    render(<ComparisonInsightsTable indicators={first} />)
    expect(screen.getByTestId("cell-subject-lastAccess").textContent).toBe("Primeiro acesso")
  })
})

// ---------------------------------------------------------------------------
// PONTO 1 (Hugo 2026-07-14) — protagonismo em 1ª pessoa: o resumo "estou à
// frente / estou atrás da turma" é derivado dos MESMOS vencedores que a tabela
// destaca (lastAccess menor vence; progresso/engajamento maior vence). Empate
// ou dados faltando → null (o subtítulo fica só com a frase base).
// ---------------------------------------------------------------------------
describe("firstPersonStanding — resumo 1ª pessoa do placar Você vs turma", () => {
  it("maioria de vitórias do aluno → 'estou à frente da turma'", () => {
    expect(firstPersonStanding(INDICATORS)).toBe("estou à frente da turma")
  })

  it("maioria de derrotas → 'estou atrás da turma'", () => {
    const behind = {
      subject: { ...INDICATORS.subject, lastAccessDays: 9, progressPct: 20, engagement: 2 },
      reference: INDICATORS.reference,
    }
    expect(firstPersonStanding(behind)).toBe("estou atrás da turma")
  })

  it("empate no placar → null (sem frase)", () => {
    const even = {
      // Último acesso perde (9 > 4), progresso vence (70 > 55), engajamento empata (9 = 9).
      subject: { ...INDICATORS.subject, lastAccessDays: 9, progressPct: 70, engagement: 9 },
      reference: INDICATORS.reference,
    }
    expect(firstPersonStanding(even)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// PONTO 1 acréscimo (Hugo 2026-07-14) — a label da linha do sujeito vira
// "Eu (PrimeiroNome)": 1ª pessoa + o nome real do aluno logado. Se o caller
// passar o nome completo, usa só o PRIMEIRO nome. Sem nome → "Eu". A linha
// "Média da turma" NÃO muda.
// ---------------------------------------------------------------------------
describe("label da linha do sujeito — 'Eu (Nome)'", () => {
  it("com studentFirstName='Rinaldo' → 'Eu (Rinaldo)'", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} studentFirstName="Rinaldo" />)
    expect(screen.getByText("Eu (Rinaldo)")).toBeInTheDocument()
    expect(screen.getByText("Média da turma")).toBeInTheDocument()
  })

  it("nome COMPLETO informado → usa só o primeiro nome: 'Eu (Rinaldo)'", () => {
    render(
      <ComparisonInsightsTable indicators={INDICATORS} studentFirstName="Rinaldo Capitelli" />,
    )
    expect(screen.getByText("Eu (Rinaldo)")).toBeInTheDocument()
  })

  it("subjectRowLabel puro: vazio/espacos → 'Eu'", () => {
    expect(subjectRowLabel("  ")).toBe("Eu")
    expect(subjectRowLabel(null)).toBe("Eu")
    expect(subjectRowLabel(undefined)).toBe("Eu")
    expect(subjectRowLabel("Rinaldo Capitelli")).toBe("Eu (Rinaldo)")
  })
})
