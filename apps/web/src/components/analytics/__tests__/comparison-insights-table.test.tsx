import type { StudentHomeIndicators } from "@/types/analytics"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  ComparisonInsightsTable,
  behindSeverityOf,
  formatFraction,
  formatRank,
  leituraFor,
  subjectColumnLabel,
  subjectPillFor,
  winnerOf,
} from "../comparison-insights-table"
import { DEFAULT_CONTINUE_HREF } from "../student-comparison-view"

// Fixture no espírito do exemplo aprovado do Hugo: Você mais recente (última
// atividade invertida → Você vence), Progresso Média maior (Você atrás → leitura
// acionável), Interações e Reflexões Você maior (leituras de reforço). SH-1.5 adiciona
// os denominadores de fração (interactionsMax/reflectionsMax) e o rank real
// (isTopEngagement). O fixture base NÃO é #1 (engajamento não vence a média por
// muito, mas o sinal isTopEngagement é falso por padrão).
// Round 2 (Hugo 2026-07-18): a Turma agora leva fração (interactionsMaxAvg /
// reflectionsMaxAvg / engagementMaxAvg) e a célula Você de Engajamento vira RANKING
// (engagementRank / engagementTotalStudents), não mais o score.
const INDICATORS: StudentHomeIndicators = {
  subject: {
    lastAccessDays: 0, // hoje
    ritmoDisplay: "no_ritmo",
    progressPct: 50,
    engagement: 14,
    interactions: 7,
    reflections: 8,
    interactionsMax: 10, // SH-1.5 — fração "7/10"
    reflectionsMax: 50, // SH-1.5 — fração "8/50"
    engagementRank: 3, // Round 2 — "3º de 15" na célula Você de Engajamento
    engagementTotalStudents: 15,
    lastCompletedLabel: "Módulo 2: Definir o Problema · 80%",
  },
  reference: {
    lastAccessAvgDays: 52,
    ritmoEmDiaPct: 58,
    progressAvgPct: 55,
    engagementAvg: 9,
    interactionsAvg: 5,
    reflectionsAvg: 3,
    interactionsMaxAvg: 12, // Round 2 — Turma "5/12"
    reflectionsMaxAvg: 40, // Round 2 — Turma "3/40"
    engagementMaxAvg: 64, // Round 2 — Turma engajamento "9/64"
  },
}

// ---------------------------------------------------------------------------
// winnerOf — DIRECTION-AWARE (intocado pelo redesign transposto/SH-1.5).
// ---------------------------------------------------------------------------

describe("winnerOf — direction-aware", () => {
  it("higher: maior vence (progresso, interações, reflexões, engajamento)", () => {
    expect(winnerOf(75, 63, "higher")).toBe("subject")
    expect(winnerOf(50, 55, "higher")).toBe("reference")
  })
  it("lower: MENOR vence (última atividade, recência invertida)", () => {
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
// SH-1.5 — formatFraction: "X/Y" com denominador válido, degrada ao absoluto.
// ---------------------------------------------------------------------------

describe("formatFraction — fração honesta com degradação", () => {
  it("denominador > 0 → 'X/Y'", () => {
    expect(formatFraction(7, 10)).toBe("7/10")
    expect(formatFraction(41, 50)).toBe("41/50")
  })
  it("denominador 0/ausente → absoluto 'X' (AC10, sem NaN/Infinity)", () => {
    expect(formatFraction(7, 0)).toBe("7")
    expect(formatFraction(7, undefined)).toBe("7")
    expect(formatFraction(7, null)).toBe("7")
  })
})

// ---------------------------------------------------------------------------
// Round 2 (Hugo 2026-07-18) — formatRank: notação de posição no ranking, degrada
// graciosamente a "—" em qualquer entrada malformada/ausente (nunca NaN/crash).
// Round 6 (Hugo 2026-07-18) — a notação DROPOU o "de {total}": mostra SÓ "{rank}º"
// (o Hugo tirou o total de alunos olhando o app ao vivo). `total` ainda é RECEBIDO e
// VALIDADO (rank ≤ total continua obrigatório p/ ser válido), só não aparece no texto.
// ---------------------------------------------------------------------------

describe("formatRank — posição no ranking com degradação graciosa", () => {
  it("Round 6 — rank e total válidos → '{rank}º' (SÓ a posição, sem 'de {total}')", () => {
    expect(formatRank(3, 15)).toBe("3º")
    expect(formatRank(1, 1)).toBe("1º") // aluno sozinho na org
    expect(formatRank(1, 20)).toBe("1º")
    // Round 6 — o "de N" foi removido do texto renderizado.
    expect(formatRank(3, 15)).not.toContain("de")
  })
  it("ausente/inválido → '—' (sem crash; `total` ainda valida rank ≤ total)", () => {
    expect(formatRank(undefined, 15)).toBe("—")
    expect(formatRank(3, undefined)).toBe("—")
    expect(formatRank(null, null)).toBe("—")
    expect(formatRank(0, 15)).toBe("—") // rank < 1
    expect(formatRank(16, 15)).toBe("—") // rank > total (validação defensiva preservada)
    expect(formatRank(Number.NaN, 15)).toBe("—")
    expect(formatRank(3, Number.POSITIVE_INFINITY)).toBe("—")
  })
})

// ---------------------------------------------------------------------------
// SH-1.5 — FORMATO TRANSPOSTO, 5 LINHAS na ordem/labels exatos do mockup do Hugo:
// | Indicador | Você | Turma | Como estou |. Última atividade → Progresso -
// conclusão → Interações realizadas → Reflexões realizadas → Engajamento.
// ---------------------------------------------------------------------------

describe("ComparisonInsightsTable — 5 linhas na ordem/labels do mockup (AC1/AC2)", () => {
  it("cabeçalho: Indicador | Você | Turma | Como estou (sem nome → 'Você', AC6)", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    for (const label of ["Indicador", "Você", "Turma", "Como estou"]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    // O header antigo "Leitura" NÃO existe mais.
    expect(screen.queryByText("Leitura")).not.toBeInTheDocument()
  })

  it("AC2 — labels exatos: Última atividade · Progresso - conclusão · Interações realizadas · Reflexões realizadas · Engajamento", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    for (const label of [
      "Última atividade",
      "Progresso - conclusão",
      "Interações realizadas",
      "Reflexões realizadas",
      "Engajamento",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    // Labels antigos NÃO aparecem mais.
    for (const old of ["Progresso", "Sessões concluídas", "Reflexões", "Último acesso"]) {
      // "Progresso" e "Reflexões" são substrings dos novos; usamos getByText exato
      // via função para não casar parcialmente.
      expect(screen.queryByText((content) => content === old)).not.toBeInTheDocument()
    }
  })

  it("AC1 — ordem exata das 5 linhas no DOM", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const keys = ["lastAccess", "progress", "sessions", "reflections", "engagement"]
    for (let i = 0; i < keys.length - 1; i++) {
      const a = screen.getByTestId(`row-${keys[i]}`)
      const b = screen.getByTestId(`row-${keys[i + 1]}`)
      expect(a.compareDocumentPosition(b)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    }
  })

  it("Round 2 — frações nos DOIS lados: Interações 7/10·5/12 · Reflexões 8/50·3/40", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(screen.getByTestId("cell-subject-sessions").textContent).toBe("7/10")
    expect(screen.getByTestId("cell-reference-sessions").textContent).toBe("5/12")
    expect(screen.getByTestId("cell-subject-reflections").textContent).toBe("8/50")
    expect(screen.getByTestId("cell-reference-reflections").textContent).toBe("3/40")
  })

  it("Round 2 — Turma degrada ao absoluto quando o denominador médio é ausente/0", () => {
    // Sem os *MaxAvg (ou 0), a célula Turma cai no absoluto — mesma degradação graciosa
    // do lado Você, sem NaN/crash.
    const noTurmaMax: StudentHomeIndicators = {
      ...INDICATORS,
      reference: {
        ...INDICATORS.reference,
        interactionsMaxAvg: 0,
        reflectionsMaxAvg: undefined,
      },
    }
    render(<ComparisonInsightsTable indicators={noTurmaMax} />)
    expect(screen.getByTestId("cell-reference-sessions").textContent).toBe("5")
    expect(screen.getByTestId("cell-reference-reflections").textContent).toBe("3")
  })

  it("AC10 — sem denominador as frações Você degradam ao absoluto (sem crash)", () => {
    const noMax: StudentHomeIndicators = {
      ...INDICATORS,
      subject: { ...INDICATORS.subject, interactionsMax: 0, reflectionsMax: undefined },
    }
    render(<ComparisonInsightsTable indicators={noMax} />)
    expect(screen.getByTestId("cell-subject-sessions").textContent).toBe("7")
    expect(screen.getByTestId("cell-subject-reflections").textContent).toBe("8")
  })

  it("Round 6 — Engajamento: Você é RANKING SÓ posição ('3º'), Turma é FRASE ÚNICA consolidada", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    // Round 6 (Hugo 2026-07-18) — a célula Você mostra SÓ a posição "3º", sem o
    // "de 15" (o total de alunos foi removido), e não o score bruto (14) nem fração.
    expect(screen.getByTestId("cell-subject-engagement").textContent).toBe("3º")
    expect(screen.getByTestId("cell-subject-engagement").textContent).not.toContain("de")
    expect(screen.getByTestId("cell-subject-engagement").textContent).not.toBe("14")
    // Round 6 (Hugo 2026-07-18) — a célula Turma da linha Engajamento foi CONSOLIDADA
    // numa ÚNICA frase "a turma fez, em média, {N} pontos": sem número solto "9" acima
    // e sem a legenda -raw separada. r.engagementAvg do fixture = 9.
    expect(screen.getByTestId("cell-reference-engagement").textContent).toBe(
      "a turma fez, em média, 9 pontos",
    )
    expect(screen.getByTestId("cell-reference-engagement").textContent).not.toContain("/")
    // A legenda-espelho -raw do Round 5 deixou de existir (consolidada na frase única).
    expect(screen.queryByTestId("cell-reference-engagement-raw")).toBeNull()
  })

  it("Round 2 — Engajamento Você degrada a '—' quando o rank vem ausente (sem crash)", () => {
    const noRank: StudentHomeIndicators = {
      ...INDICATORS,
      subject: {
        ...INDICATORS.subject,
        engagementRank: undefined,
        engagementTotalStudents: undefined,
      },
    }
    render(<ComparisonInsightsTable indicators={noRank} />)
    expect(screen.getByTestId("cell-subject-engagement").textContent).toBe("—")
  })

  it("valores restantes: Progresso 50% vs 55%, atividade hoje vs há 52 dias", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(screen.getByTestId("cell-subject-progress").textContent).toBe("50%")
    expect(screen.getByTestId("cell-reference-progress").textContent).toBe("55%")
    expect(screen.getByTestId("cell-subject-lastAccess").textContent).toBe("hoje")
    expect(screen.getByTestId("cell-reference-lastAccess").textContent).toBe("há 52 dias")
  })

  it("REMOVIDO: coluna 'Onde você está' e setas de ordenação", () => {
    const { container } = render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(screen.queryByText("Onde você está")).not.toBeInTheDocument()
    expect(screen.queryByText("Módulo 2: Definir o Problema · 80%")).not.toBeInTheDocument()
    expect(container.querySelector("thead svg")).toBeNull()
  })

  it("destaque direction-aware: última atividade Você vence (0d < 52d); Progresso Média vence", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(screen.getByTestId("cell-subject-lastAccess").getAttribute("data-win")).toBe("true")
    expect(screen.getByTestId("cell-reference-lastAccess").getAttribute("data-win")).toBe("false")
    expect(screen.getByTestId("cell-reference-progress").getAttribute("data-win")).toBe("true")
    expect(screen.getByTestId("cell-subject-progress").getAttribute("data-win")).toBe("false")
  })

  // Round 3 (Hugo 2026-07-18) — REVERSÃO EXPLÍCITA do antigo "nunca vermelho".
  // O aluno atrás agora carrega severidade de COR (amarelo/vermelho). No fixture
  // base o único indicador atrás é Progresso (50 vs 55, gap ~9% → MILD/amarelo),
  // então esperamos o token de warning (semantic-warning), e NÃO o de sucesso.
  it("Round 3 — aluno atrás em Progresso vira AMARELO (mild), não mais cerrado neutro", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const chip = screen.getByTestId("leitura-progress")
    expect(chip.getAttribute("data-tone")).toBe("behind-mild")
    expect(chip.className).toContain("bg-semantic-warning/10")
    expect(chip.className).toContain("text-semantic-warning")
  })
})

// ---------------------------------------------------------------------------
// SH-1.5 — coluna "Como estou" (AC6): frases mais longas, tom preservado
// (win/tie/behind). Round 2 (Hugo 2026-07-18): o prefixo "… " foi REMOVIDO — o
// texto começa direto pela palavra. A linha Engajamento tem a regra do rank real (AC7).
// ---------------------------------------------------------------------------

describe("coluna 'Como estou' — copy longa sem prefixo '… ' e tom preservado (AC6)", () => {
  it("acima da média → reforço: Interações/Reflexões 'acima da média', última atividade 'ativo acima da média'", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(screen.getByTestId("leitura-sessions").textContent).toBe("acima da média")
    expect(screen.getByTestId("leitura-sessions").getAttribute("data-tone")).toBe("win")
    expect(screen.getByTestId("leitura-reflections").textContent).toBe("acima da média")
    expect(screen.getByTestId("leitura-lastAccess").textContent).toBe("ativo acima da média")
  })

  it("chip tonal: fundo suave + ícone (svg); atrás usa severidade (amarelo mild)", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const win = screen.getByTestId("leitura-sessions")
    expect(win.className).toContain("rounded-full")
    expect(win.className).toContain("bg-semantic-success/10")
    expect(win.querySelector("svg")).not.toBeNull()
    // Round 3 — atrás moderado (Progresso 50 vs 55) agora é AMARELO (semantic-warning),
    // não mais o cerrado único de antes.
    const behind = screen.getByTestId("leitura-progress")
    expect(behind.className).toContain("bg-semantic-warning/10")
    expect(behind.querySelector("svg")).not.toBeNull()
  })

  it("abaixo → COPY ainda acionável e não punitiva: Progresso atrás vira '1 sessão te recoloca no ritmo' (só a cor ganha severidade)", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const leitura = screen.getByTestId("leitura-progress")
    // A COPY do convite é PRESERVADA (Round 3 muda a cor, não o texto).
    expect(leitura.textContent).toBe("1 sessão te recoloca no ritmo")
    // O tom agora carrega a severidade: mild (amarelo) neste gap de ~9%.
    expect(leitura.getAttribute("data-tone")).toBe("behind-mild")
  })

  it("empate → neutro 'no ritmo da turma' (Progresso 50 vs 50)", () => {
    const tied: StudentHomeIndicators = {
      ...INDICATORS,
      reference: { ...INDICATORS.reference, progressAvgPct: 50 },
    }
    render(<ComparisonInsightsTable indicators={tied} />)
    expect(screen.getByTestId("leitura-progress").textContent).toBe("no ritmo da turma")
    expect(screen.getByTestId("leitura-progress").getAttribute("data-tone")).toBe("tie")
  })

  it("valor ausente → '—' sem chip (sem leitura, não é empate)", () => {
    const first: StudentHomeIndicators = {
      ...INDICATORS,
      subject: { ...INDICATORS.subject, lastAccessDays: null },
    }
    render(<ComparisonInsightsTable indicators={first} />)
    const none = screen.getByTestId("leitura-lastAccess")
    expect(none.textContent).toBe("—")
    expect(none.getAttribute("data-tone")).toBe("none")
    expect(none.querySelector("svg")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// SH-1.5 (AC7, BLOQUEANTE) — a linha Engajamento só mostra "1º da turma –
// Parabéns!" quando o rank REAL (isTopEngagement) confirma #1. Acima da média
// mas NÃO #1 → cai no fallback "acima da média". NUNCA hardcoded. Round 2 (Hugo
// 2026-07-18): sem o prefixo "… ".
// ---------------------------------------------------------------------------

describe("Engajamento — rank real gate (AC7)", () => {
  it("aluno #1 real (isTopEngagement true, e vence a média) → '1º da turma – Parabéns!'", () => {
    const top: StudentHomeIndicators = {
      ...INDICATORS,
      subject: { ...INDICATORS.subject, engagement: 30, isTopEngagement: true },
    }
    render(<ComparisonInsightsTable indicators={top} />)
    const leitura = screen.getByTestId("leitura-engagement")
    expect(leitura.textContent).toBe("1º da turma – Parabéns!")
    expect(leitura.getAttribute("data-tone")).toBe("win")
  })

  it("acima da média mas NÃO #1 (engagement 14 > 9, isTopEngagement false) → fallback 'acima da média', NUNCA '1º da turma'", () => {
    // O fixture base já é este caso: vence a média mas isTopEngagement ausente.
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const leitura = screen.getByTestId("leitura-engagement")
    expect(leitura.textContent).toBe("acima da média")
    expect(leitura.textContent).not.toContain("1º da turma")
    expect(leitura.getAttribute("data-tone")).toBe("win")
  })

  it("isTopEngagement true mas o aluno NÃO vence a média (edge) → NÃO mostra 1º lugar (winner manda)", () => {
    // Defensivo: se por algum motivo o sinal chega true mas o número não vence a
    // média, o gate de winnerOf ainda prevalece (a frase só entra em 'subject wins').
    const weird: StudentHomeIndicators = {
      ...INDICATORS,
      subject: { ...INDICATORS.subject, engagement: 5, isTopEngagement: true },
      reference: { ...INDICATORS.reference, engagementAvg: 9 },
    }
    render(<ComparisonInsightsTable indicators={weird} />)
    expect(screen.getByTestId("leitura-engagement").textContent).not.toContain("1º da turma")
  })

  it("leituraFor puro (AC7): engagement + isTopEngagement gate", () => {
    // #1 real → 1º da turma.
    expect(leituraFor("engagement", 30, 9, "higher", true)).toEqual({
      text: "1º da turma – Parabéns!",
      tone: "win",
    })
    // vence a média mas não é #1 → fallback win.
    expect(leituraFor("engagement", 14, 9, "higher", false)).toEqual({
      text: "acima da média",
      tone: "win",
    })
    // #1 só vale para engajamento: outra linha ignora o sinal.
    expect(leituraFor("sessions", 7, 5, "higher", true)).toEqual({
      text: "acima da média",
      tone: "win",
    })
  })
})

// ---------------------------------------------------------------------------
// leituraFor puro — espelha winnerOf nas 3 direções de resultado (SH-1.5 copy,
// Round 2 sem prefixo "… ").
// ---------------------------------------------------------------------------

describe("leituraFor — espelha winnerOf (copy SH-1.5)", () => {
  it("win/tie/behind(severidade)/none", () => {
    expect(leituraFor("sessions", 7, 5, "higher")).toEqual({
      text: "acima da média",
      tone: "win",
    })
    expect(leituraFor("progress", 50, 50, "higher")).toEqual({
      text: "no ritmo da turma",
      tone: "tie",
    })
    // Round 3 — Última atividade 60d vs 4d (lower): atrás com gap enorme → severe.
    // A COPY é a mesma; o tom carrega a severidade.
    expect(leituraFor("lastAccess", 60, 4, "lower")).toEqual({
      text: "vamos retomar?",
      tone: "behind-severe",
    })
    // Atrás moderado (Progresso 50 vs 55, gap ~9%) → mild.
    expect(leituraFor("progress", 50, 55, "higher")).toEqual({
      text: "1 sessão te recoloca no ritmo",
      tone: "behind-mild",
    })
    expect(leituraFor("reflections", null, 3, "higher")).toEqual({ text: "—", tone: "none" })
  })
})

// ---------------------------------------------------------------------------
// AJUSTE 2 (Hugo 2026-07-14) — penúltima visita: sem acesso ANTERIOR à visita
// atual (subject.lastAccessDays null), a célula Você mostra "Primeiro acesso".
// ---------------------------------------------------------------------------
describe("Última atividade (Você) — estado sem acesso anterior", () => {
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
// Coluna do sujeito parametrizável — "Eu (Nome)" no aluno logado (protagonismo,
// PONTO 1); num drill de gestor recebe o nome do aluno; sem nome → "Você".
// ---------------------------------------------------------------------------
describe("label da coluna do sujeito — parametrizável", () => {
  it("com studentFirstName='Rinaldo' → cabeçalho 'Eu (Rinaldo)'", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} studentFirstName="Rinaldo" />)
    expect(screen.getByText("Eu (Rinaldo)")).toBeInTheDocument()
  })

  it("nome COMPLETO informado → usa só o primeiro nome: 'Eu (Rinaldo)'", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} studentFirstName="Rinaldo Capitelli" />)
    expect(screen.getByText("Eu (Rinaldo)")).toBeInTheDocument()
  })

  it("subjectColumnLabel puro: vazio/espacos/ausente → 'Você'", () => {
    expect(subjectColumnLabel("  ")).toBe("Você")
    expect(subjectColumnLabel(null)).toBe("Você")
    expect(subjectColumnLabel(undefined)).toBe("Você")
    expect(subjectColumnLabel("Rinaldo Capitelli")).toBe("Eu (Rinaldo)")
  })
})

// ---------------------------------------------------------------------------
// Round 3 (Hugo 2026-07-18) — behindSeverityOf: grau de atraso direction-aware,
// corte em SEVERE_BEHIND_THRESHOLD (30%). Valores concretos que cruzam os 30%.
// ---------------------------------------------------------------------------
describe("behindSeverityOf — mild vs severe cruzando os 30%", () => {
  it("higher (maior é melhor): abaixo até 30% → mild; acima de 30% → severe", () => {
    // gap = (reference - subject) / max(reference,1)
    expect(behindSeverityOf(50, 55, "higher")).toBe("mild") // (55-50)/55 = 0.0909 → mild
    expect(behindSeverityOf(90, 100, "higher")).toBe("mild") // 0.10 → mild
    expect(behindSeverityOf(70, 100, "higher")).toBe("mild") // exatamente 0.30 → NÃO > 0.30 → mild
    expect(behindSeverityOf(69, 100, "higher")).toBe("severe") // 0.31 → severe
    expect(behindSeverityOf(10, 100, "higher")).toBe("severe") // 0.90 → severe
  })

  it("lower (menor é melhor, ex.: última atividade em dias): excedeu p/ pior", () => {
    // gap = (subject - reference) / max(reference,1)
    expect(behindSeverityOf(5, 4, "lower")).toBe("mild") // (5-4)/4 = 0.25 → mild
    expect(behindSeverityOf(6, 4, "lower")).toBe("severe") // (6-4)/4 = 0.50 → severe
    expect(behindSeverityOf(60, 4, "lower")).toBe("severe") // 14 → severe
  })

  it("reference 0 não estoura (divisor Math.max(reference,1))", () => {
    expect(behindSeverityOf(5, 0, "lower")).toBe("severe") // (5-0)/1 = 5 → severe
  })
})

// ---------------------------------------------------------------------------
// Round 3 (Hugo 2026-07-18) — subjectPillFor: pill do valor Você por vencedor +
// tom da Leitura. Vitória → verde; atrás → cor da severidade; empate/ausente/turma → null.
// ---------------------------------------------------------------------------
describe("subjectPillFor — pill do valor da célula Você", () => {
  it("aluno vence → 'win' (verde)", () => {
    expect(subjectPillFor("subject", "win")).toBe("win")
  })
  it("aluno atrás → cor da severidade (mild/severe)", () => {
    expect(subjectPillFor("reference", "behind-mild")).toBe("behind-mild")
    expect(subjectPillFor("reference", "behind-severe")).toBe("behind-severe")
  })
  it("empate / ausente / vencedor null → sem pill", () => {
    expect(subjectPillFor(null, "tie")).toBeNull()
    expect(subjectPillFor(null, "none")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Round 3 (Hugo 2026-07-18) — 2ª linha "Você fez N pontos" SÓ na célula Você de
// Engajamento; nenhuma outra linha tem essa legenda.
// ---------------------------------------------------------------------------
describe("Engajamento — 2ª linha 'Você fez N pontos' (Round 3)", () => {
  it("célula Você de Engajamento mostra a pontuação bruta em legenda muted", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const raw = screen.getByTestId("cell-subject-engagement-raw")
    expect(raw.textContent).toBe("Você fez 14 pontos") // s.engagement do fixture
    expect(raw.className).toContain("text-text-muted")
  })

  it("as outras 4 linhas NÃO têm a 2ª linha de pontuação bruta", () => {
    const { container } = render(<ComparisonInsightsTable indicators={INDICATORS} />)
    // Só existe UM nó com o testid da legenda bruta, e ele vive na linha engagement.
    expect(container.querySelectorAll('[data-testid="cell-subject-engagement-raw"]').length).toBe(1)
    expect(screen.queryByText(/^Você fez \d+ pontos$/)).toBeInTheDocument()
    // Nenhuma legenda "Você fez" sob progress/sessions/reflections/lastAccess.
    const engRow = screen.getByTestId("row-engagement")
    expect(engRow.querySelector('[data-testid="cell-subject-engagement-raw"]')).not.toBeNull()
    for (const key of ["lastAccess", "progress", "sessions", "reflections"]) {
      const row = screen.getByTestId(`row-${key}`)
      expect(row.textContent).not.toContain("Você fez")
    }
  })
})

// ---------------------------------------------------------------------------
// Round 6 (Hugo 2026-07-18) — a célula TURMA de Engajamento foi CONSOLIDADA numa
// ÚNICA frase "a turma fez, em média, {N} pontos". Antes (Round 5) havia DOIS
// elementos: o número solto "9" (ValueCell) MAIS a legenda-espelho "Turma fez N
// pontos, em média" embaixo. O Hugo, olhando o app ao vivo, achou o número isolado
// redundante com a frase e pediu UMA linha só. Agora a célula Turma DESTA linha é a
// frase inteira, sem número acima e sem a legenda `-raw` separada; mesmo estilo muted.
// SÓ na linha Engajamento; as outras 4 seguem com o valor bruto no ValueCell.
// ---------------------------------------------------------------------------
describe("Engajamento — célula Turma consolidada em frase única (Round 6)", () => {
  it("a célula Turma de Engajamento é a frase única 'a turma fez, em média, N pontos'", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const cell = screen.getByTestId("cell-reference-engagement")
    // r.engagementAvg do fixture = 9.
    expect(cell.textContent).toBe("a turma fez, em média, 9 pontos")
    expect(cell.className).toContain("text-text-muted")
  })

  it("Round 6 — não há mais número solto nem a legenda '-raw' separada", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    // A célula Turma NÃO é mais só o número "9"; é a frase inteira.
    expect(screen.getByTestId("cell-reference-engagement").textContent).not.toBe("9")
    // A legenda-espelho -raw do Round 5 foi consolidada e não existe mais.
    expect(screen.queryByTestId("cell-reference-engagement-raw")).toBeNull()
  })

  it("as outras 4 linhas NÃO têm a frase 'a turma fez' e mantêm o valor bruto", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    // A frase consolidada vive SÓ na linha Engajamento.
    const engRow = screen.getByTestId("row-engagement")
    expect(engRow.textContent).toContain("a turma fez, em média")
    for (const key of ["lastAccess", "progress", "sessions", "reflections"]) {
      const row = screen.getByTestId(`row-${key}`)
      expect(row.textContent).not.toContain("a turma fez")
      // A célula Turma dessas linhas continua com o valor bruto (ValueCell), não vazia.
      expect(row.querySelector(`[data-testid="cell-reference-${key}"]`)?.textContent).toBeTruthy()
    }
  })
})

// ---------------------------------------------------------------------------
// Round 3 (Hugo 2026-07-18) — severidade de COR (amarelo/vermelho) no CHIP e no
// PILL do valor Você quando atrás, em ≥2 linhas diferentes; Turma nunca destaca.
// ---------------------------------------------------------------------------
describe("Round 3 — severidade amarelo/vermelho quando atrás (chip + pill), ≥2 linhas", () => {
  // Fixture com o aluno ATRÁS em duas linhas de severidades diferentes:
  //  • Última atividade: 60 dias vs 4 (lower) → gap 14 → SEVERE (vermelho)
  //  • Progresso: 20% vs 80% (higher) → gap (80-20)/80 = 0.75 → SEVERE (vermelho)
  //  • Interações: 7 vs 8 (higher) → gap (8-7)/8 = 0.125 → MILD (amarelo)
  const BEHIND: StudentHomeIndicators = {
    ...INDICATORS,
    subject: {
      ...INDICATORS.subject,
      lastAccessDays: 60,
      progressPct: 20,
      interactions: 7,
    },
    reference: {
      ...INDICATORS.reference,
      lastAccessAvgDays: 4,
      progressAvgPct: 80,
      interactionsAvg: 8,
    },
  }

  it("CHIP: última atividade e progresso severos → VERMELHO (semantic-error)", () => {
    render(<ComparisonInsightsTable indicators={BEHIND} />)
    const last = screen.getByTestId("leitura-lastAccess")
    expect(last.getAttribute("data-tone")).toBe("behind-severe")
    expect(last.className).toContain("bg-semantic-error/10")
    expect(last.className).toContain("text-semantic-error")

    const prog = screen.getByTestId("leitura-progress")
    expect(prog.getAttribute("data-tone")).toBe("behind-severe")
    expect(prog.className).toContain("bg-semantic-error/10")
  })

  it("CHIP: interações levemente atrás → AMARELO (semantic-warning)", () => {
    render(<ComparisonInsightsTable indicators={BEHIND} />)
    const sess = screen.getByTestId("leitura-sessions")
    expect(sess.getAttribute("data-tone")).toBe("behind-mild")
    expect(sess.className).toContain("bg-semantic-warning/10")
    expect(sess.className).toContain("text-semantic-warning")
  })

  it("PILL do valor Você: vira pill colorido na cor da severidade (vermelho severe, amarelo mild)", () => {
    render(<ComparisonInsightsTable indicators={BEHIND} />)
    // Severe (vermelho) na última atividade e no progresso.
    const lastCell = screen.getByTestId("cell-subject-lastAccess")
    expect(lastCell.className).toContain("rounded-full")
    expect(lastCell.className).toContain("bg-semantic-error/10")
    const progCell = screen.getByTestId("cell-subject-progress")
    expect(progCell.className).toContain("bg-semantic-error/10")
    // Mild (amarelo) nas interações.
    const sessCell = screen.getByTestId("cell-subject-sessions")
    expect(sessCell.className).toContain("rounded-full")
    expect(sessCell.className).toContain("bg-semantic-warning/10")
  })

  it("Turma NUNCA destaca, mesmo quando ela é a vencedora (sem pill de cor)", () => {
    render(<ComparisonInsightsTable indicators={BEHIND} />)
    for (const key of ["lastAccess", "progress", "sessions"]) {
      const ref = screen.getByTestId(`cell-reference-${key}`)
      expect(ref.className).not.toContain("bg-semantic-error/10")
      expect(ref.className).not.toContain("bg-semantic-warning/10")
      expect(ref.className).not.toContain("rounded-full")
    }
  })

  it("empate continua neutro: sem pill de cor na célula Você (Progresso 50 vs 50)", () => {
    const tied: StudentHomeIndicators = {
      ...INDICATORS,
      subject: { ...INDICATORS.subject, progressPct: 50 },
      reference: { ...INDICATORS.reference, progressAvgPct: 50 },
    }
    render(<ComparisonInsightsTable indicators={tied} />)
    const cell = screen.getByTestId("cell-subject-progress")
    expect(cell.className).not.toContain("bg-semantic-error/10")
    expect(cell.className).not.toContain("bg-semantic-warning/10")
    expect(cell.className).not.toContain("rounded-full")
  })
})

// ---------------------------------------------------------------------------
// ROUND 6 (Hugo 2026-07-18) — botão ACIONÁVEL UNIVERSAL ao lado do chip "Como
// estou". O gate `winner === "reference"` da Round 4 foi REMOVIDO: o botão agora
// aparece em TODAS as 5 linhas incondicionalmente, esteja o aluno ganhando (win),
// empatado (tie), atrás moderado (behind-mild), atrás forte (behind-severe) ou com
// valor ausente (none). Virou um CTA de "continue melhorando", não mais um convite
// condicional só para quem está mal (o Hugo, ao vivo: "mesmo para o Rinaldo, tem
// que ter os botões para melhorar ainda mais a performance dele"). Label por linha
// (ACTION_LABEL), href SEMPRE = o continueHref recebido (default DEFAULT_CONTINUE_HREF),
// COR sempre a mesma (cerrado/laranja), NÃO varia por severidade.
//
// TESTES REESCRITOS vindos da Round 4 (a condição inverteu): os antigos "NÃO
// aparece nas linhas onde o aluno vence", "só Progresso tem botão; win/tie/none
// sem botão" e "NÃO aparece em empate nem em valor ausente" AFIRMAVAM ausência sob
// win/tie/none — agora afirmam PRESENÇA nesses mesmos tones.
// ---------------------------------------------------------------------------
describe("Round 6 — botão acionável UNIVERSAL ao lado do chip 'Como estou' (todas as linhas)", () => {
  // Fixture que cobre TODOS os tones simultaneamente, para provar que o botão
  // aparece em cada um deles:
  //  • lastAccess: 60 vs 4 (lower) → atrás SEVERE (vermelho) → botão presente
  //  • progress:   20 vs 80 (higher) → atrás SEVERE → botão presente
  //  • sessions:   7 vs 8 (higher) → atrás MILD (amarelo) → botão presente
  //  • reflections: 8 vs 3 (higher) → VENCE (win) → botão presente (antes: NÃO tinha)
  //  • engagement: 14 vs 9 (higher) → VENCE (win) → botão presente (antes: NÃO tinha)
  const MIXED_TONES: StudentHomeIndicators = {
    ...INDICATORS,
    subject: {
      ...INDICATORS.subject,
      lastAccessDays: 60,
      progressPct: 20,
      interactions: 7,
      reflections: 8,
      engagement: 14,
    },
    reference: {
      ...INDICATORS.reference,
      lastAccessAvgDays: 4,
      progressAvgPct: 80,
      interactionsAvg: 8,
      reflectionsAvg: 3,
      engagementAvg: 9,
    },
  }

  it("aparece nas linhas ATRÁS (mild E severe): lastAccess, progress, sessions", () => {
    render(<ComparisonInsightsTable indicators={MIXED_TONES} continueHref="/courses/next" />)
    expect(screen.getByTestId("action-lastAccess")).toBeInTheDocument() // severe
    expect(screen.getByTestId("action-progress")).toBeInTheDocument() // severe
    expect(screen.getByTestId("action-sessions")).toBeInTheDocument() // mild
  })

  it("REESCRITO (era 'NÃO aparece'): aparece TAMBÉM nas linhas onde o aluno VENCE (win) — reflections, engagement", () => {
    render(<ComparisonInsightsTable indicators={MIXED_TONES} continueHref="/courses/next" />)
    // Round 4 afirmava .toBeNull() aqui; Round 6 inverteu — o CTA universal aparece.
    expect(screen.getByTestId("action-reflections")).toBeInTheDocument()
    expect(screen.getByTestId("action-engagement")).toBeInTheDocument()
  })

  it("REESCRITO (era 'só Progresso'): no fixture base o botão está em TODAS as 5 linhas, não só na atrás", () => {
    // INDICATORS base: lastAccess vence, progress atrás (50 vs 55, mild), sessions
    // vence, reflections vence, engagement vence. Round 4: só progress tinha botão.
    // Round 6: as 5 têm.
    render(<ComparisonInsightsTable indicators={INDICATORS} continueHref="/courses/next" />)
    for (const key of ["lastAccess", "progress", "sessions", "reflections", "engagement"]) {
      expect(screen.getByTestId(`action-${key}`)).toBeInTheDocument()
    }
  })

  it("REESCRITO (era 'NÃO aparece'): aparece TAMBÉM em empate (tie) e em valor ausente (none)", () => {
    // Progresso empatado (50 vs 50) → tie; lastAccess ausente → none. Round 4 não
    // renderizava botão em nenhum dos dois; Round 6 renderiza (CTA universal).
    const tiedAndAbsent: StudentHomeIndicators = {
      ...INDICATORS,
      subject: { ...INDICATORS.subject, progressPct: 50, lastAccessDays: null },
      reference: { ...INDICATORS.reference, progressAvgPct: 50 },
    }
    render(<ComparisonInsightsTable indicators={tiedAndAbsent} continueHref="/courses/next" />)
    expect(screen.getByTestId("action-progress")).toBeInTheDocument() // tie
    expect(screen.getByTestId("action-lastAccess")).toBeInTheDocument() // none
  })

  it("presença UNIVERSAL nos 4 tones + none, num único fixture (win, tie, behind-mild, behind-severe, none)", () => {
    // Fixture desenhado para exibir os 5 estados de uma vez:
    //  • lastAccess: null → none
    //  • progress:   50 vs 50 → tie
    //  • sessions:   7 vs 8 (higher) → behind-mild
    //  • reflections: 8 vs 40 (higher) → behind-severe
    //  • engagement: 14 vs 9 (higher) → win
    const allTones: StudentHomeIndicators = {
      ...INDICATORS,
      subject: {
        ...INDICATORS.subject,
        lastAccessDays: null,
        progressPct: 50,
        interactions: 7,
        reflections: 8,
        engagement: 14,
      },
      reference: {
        ...INDICATORS.reference,
        progressAvgPct: 50,
        interactionsAvg: 8,
        reflectionsAvg: 40,
        engagementAvg: 9,
      },
    }
    render(<ComparisonInsightsTable indicators={allTones} continueHref="/courses/next" />)
    // Confere que cada tone está de fato representado (o chip prova o tone),
    // e que o botão está presente em TODAS as linhas independentemente do tone.
    expect(screen.getByTestId("leitura-lastAccess").getAttribute("data-tone")).toBe("none")
    expect(screen.getByTestId("leitura-progress").getAttribute("data-tone")).toBe("tie")
    expect(screen.getByTestId("leitura-sessions").getAttribute("data-tone")).toBe("behind-mild")
    expect(screen.getByTestId("leitura-reflections").getAttribute("data-tone")).toBe(
      "behind-severe",
    )
    expect(screen.getByTestId("leitura-engagement").getAttribute("data-tone")).toBe("win")
    for (const key of ["lastAccess", "progress", "sessions", "reflections", "engagement"]) {
      expect(screen.getByTestId(`action-${key}`)).toBeInTheDocument()
    }
  })

  it("label correto por linha (todas as 5, independentemente do status)", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} continueHref="/courses/next" />)
    // No fixture base os tones variam (win/tie/behind), mas o label é fixo por linha.
    expect(screen.getByTestId("action-lastAccess").textContent).toContain("Retomar atividade")
    expect(screen.getByTestId("action-progress").textContent).toContain("Continuar sessão")
    expect(screen.getByTestId("action-sessions").textContent).toContain("Fazer uma interação")
    expect(screen.getByTestId("action-reflections").textContent).toContain("Registrar uma reflexão")
    expect(screen.getByTestId("action-engagement").textContent).toContain("Continuar agora")
  })

  it("href = o continueHref recebido (todas as 5 linhas apontam para o MESMO destino)", () => {
    render(<ComparisonInsightsTable indicators={MIXED_TONES} continueHref="/courses/next" />)
    for (const key of ["lastAccess", "progress", "sessions", "reflections", "engagement"]) {
      expect(screen.getByTestId(`action-${key}`).getAttribute("href")).toBe("/courses/next")
    }
  })

  it("REESCRITO (era 'cor cerrado SEMPRE'): a cor do botão VARIA por tom (Round 7)", () => {
    // Round 6 afirmava cor cerrado fixa para todos; a Round 7 REVERTEU — a cor agora
    // espelha o leitura.tone da linha. No MIXED_TONES: engagement vence (win → verde),
    // progress atrás severe (vermelho), sessions atrás mild (âmbar). Nenhum é cerrado,
    // porque nenhum é `none` (todos têm leitura válida).
    render(<ComparisonInsightsTable indicators={MIXED_TONES} continueHref="/courses/next" />)
    expect(screen.getByTestId("action-engagement").className).toContain("bg-semantic-success")
    expect(screen.getByTestId("action-progress").className).toContain("bg-semantic-error")
    expect(screen.getByTestId("action-sessions").className).toContain("bg-semantic-warning")
    // Nenhuma dessas linhas usa o fallback cerrado (só `none` usa).
    for (const key of ["engagement", "progress", "sessions"]) {
      expect(screen.getByTestId(`action-${key}`).className).not.toContain("bg-cerrado-600")
    }
  })

  it("sem continueHref → cai no default seguro DEFAULT_CONTINUE_HREF (não quebra call sites)", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(screen.getByTestId("action-progress").getAttribute("href")).toBe(DEFAULT_CONTINUE_HREF)
  })
})

// ---------------------------------------------------------------------------
// ROUND 7 (Hugo 2026-07-18) — a COR do ActionButton RELATIVA ao "Como estou". Até a
// Round 6 o botão era SEMPRE cerrado/laranja (cor fixa, desconectada do status). O
// Hugo pediu ao vivo: "faça uma melhoria nos botões de ação e faça com que eles sejam
// relativos ao 'Como estou', de cores e relação." Agora a cor de FUNDO do botão
// espelha o `leitura.tone` da MESMA linha (via ACTION_BUTTON_STYLE), criando a relação
// visual chip↔botão. Mapeamento: win=verde (semantic-success), tie=neutro,
// behind-mild=âmbar (semantic-warning), behind-severe=vermelho (semantic-error),
// none=cerrado fallback. Texto/label/ícone/href PRESERVADOS — só a cor muda por tom.
// ---------------------------------------------------------------------------
describe("Round 7 — cor do ActionButton relativa ao tom de 'Como estou'", () => {
  // Fixture que exibe os 5 estados de uma vez (mesmo desenho do teste Round 6
  // 'presença UNIVERSAL nos 4 tones + none'):
  //  • lastAccess: null → none        → botão CERRADO (fallback)
  //  • progress:   50 vs 50 → tie      → botão NEUTRO
  //  • sessions:   7 vs 8 (higher) → behind-mild   → botão ÂMBAR (semantic-warning)
  //  • reflections: 8 vs 40 (higher) → behind-severe → botão VERMELHO (semantic-error)
  //  • engagement: 14 vs 9 (higher) → win          → botão VERDE (semantic-success)
  const ALL_TONES: StudentHomeIndicators = {
    ...INDICATORS,
    subject: {
      ...INDICATORS.subject,
      lastAccessDays: null,
      progressPct: 50,
      interactions: 7,
      reflections: 8,
      engagement: 14,
    },
    reference: {
      ...INDICATORS.reference,
      progressAvgPct: 50,
      interactionsAvg: 8,
      reflectionsAvg: 40,
      engagementAvg: 9,
    },
  }

  it("win → VERDE (bg-semantic-success), espelhando o chip win", () => {
    render(<ComparisonInsightsTable indicators={ALL_TONES} continueHref="/courses/next" />)
    // sanidade: o tom da linha é mesmo win (o chip prova), depois a cor do botão.
    expect(screen.getByTestId("leitura-engagement").getAttribute("data-tone")).toBe("win")
    const btn = screen.getByTestId("action-engagement")
    expect(btn.getAttribute("data-tone")).toBe("win")
    expect(btn.className).toContain("bg-semantic-success")
    expect(btn.className).toContain("text-white")
  })

  it("tie → NEUTRO (não usa nenhuma cor semântica nem cerrado)", () => {
    render(<ComparisonInsightsTable indicators={ALL_TONES} continueHref="/courses/next" />)
    expect(screen.getByTestId("leitura-progress").getAttribute("data-tone")).toBe("tie")
    const btn = screen.getByTestId("action-progress")
    expect(btn.getAttribute("data-tone")).toBe("tie")
    expect(btn.className).not.toContain("bg-semantic-success")
    expect(btn.className).not.toContain("bg-semantic-warning")
    expect(btn.className).not.toContain("bg-semantic-error")
    expect(btn.className).not.toContain("bg-cerrado-600")
  })

  it("behind-mild → ÂMBAR (bg-semantic-warning) com texto escuro de contraste", () => {
    render(<ComparisonInsightsTable indicators={ALL_TONES} continueHref="/courses/next" />)
    expect(screen.getByTestId("leitura-sessions").getAttribute("data-tone")).toBe("behind-mild")
    const btn = screen.getByTestId("action-sessions")
    expect(btn.getAttribute("data-tone")).toBe("behind-mild")
    expect(btn.className).toContain("bg-semantic-warning")
    // warning é claro (oklch 0.8) → texto escuro, NÃO branco (par validado no app).
    expect(btn.className).toContain("text-black/80")
    expect(btn.className).not.toContain("text-white")
  })

  it("behind-severe → VERMELHO (bg-semantic-error text-white), espelhando o chip severe", () => {
    render(<ComparisonInsightsTable indicators={ALL_TONES} continueHref="/courses/next" />)
    expect(screen.getByTestId("leitura-reflections").getAttribute("data-tone")).toBe(
      "behind-severe",
    )
    const btn = screen.getByTestId("action-reflections")
    expect(btn.getAttribute("data-tone")).toBe("behind-severe")
    expect(btn.className).toContain("bg-semantic-error")
    expect(btn.className).toContain("text-white")
  })

  it("none → CERRADO/laranja preservado como fallback (dado ausente)", () => {
    render(<ComparisonInsightsTable indicators={ALL_TONES} continueHref="/courses/next" />)
    expect(screen.getByTestId("leitura-lastAccess").getAttribute("data-tone")).toBe("none")
    const btn = screen.getByTestId("action-lastAccess")
    expect(btn.getAttribute("data-tone")).toBe("none")
    expect(btn.className).toContain("bg-cerrado-600")
    expect(btn.className).not.toContain("bg-semantic-success")
    expect(btn.className).not.toContain("bg-semantic-warning")
    expect(btn.className).not.toContain("bg-semantic-error")
  })

  it("label/ícone/href PRESERVADOS independente da cor (só a cor muda por tom)", () => {
    render(<ComparisonInsightsTable indicators={ALL_TONES} continueHref="/courses/next" />)
    // As 5 linhas com 5 tons distintos: label por linha e href idênticos ao Round 6.
    expect(screen.getByTestId("action-lastAccess").textContent).toContain("Retomar atividade")
    expect(screen.getByTestId("action-progress").textContent).toContain("Continuar sessão")
    expect(screen.getByTestId("action-sessions").textContent).toContain("Fazer uma interação")
    expect(screen.getByTestId("action-reflections").textContent).toContain("Registrar uma reflexão")
    expect(screen.getByTestId("action-engagement").textContent).toContain("Continuar agora")
    for (const key of ["lastAccess", "progress", "sessions", "reflections", "engagement"]) {
      expect(screen.getByTestId(`action-${key}`).getAttribute("href")).toBe("/courses/next")
    }
  })

  it("os 5 tons produzem 5 classes de fundo DISTINTAS (relação de cor real, não decorativa)", () => {
    render(<ComparisonInsightsTable indicators={ALL_TONES} continueHref="/courses/next" />)
    const bgToken = (key: string) => {
      const cls = screen.getByTestId(`action-${key}`).className
      if (cls.includes("bg-semantic-success")) return "success"
      if (cls.includes("bg-semantic-error")) return "error"
      if (cls.includes("bg-semantic-warning")) return "warning"
      if (cls.includes("bg-cerrado-600")) return "cerrado"
      return "neutral"
    }
    const tokens = [
      bgToken("engagement"), // win → success
      bgToken("reflections"), // behind-severe → error
      bgToken("sessions"), // behind-mild → warning
      bgToken("lastAccess"), // none → cerrado
      bgToken("progress"), // tie → neutral
    ]
    // Todos os 5 distintos entre si — prova que a cor de fato varia com o tom.
    expect(new Set(tokens).size).toBe(5)
    expect(tokens).toEqual(["success", "error", "warning", "cerrado", "neutral"])
  })
})
