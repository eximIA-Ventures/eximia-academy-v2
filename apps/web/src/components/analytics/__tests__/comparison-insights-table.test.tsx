import type { StudentHomeIndicators } from "@/types/analytics"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  ComparisonInsightsTable,
  behindSeverityOf,
  formatFraction,
  formatPopulation,
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
// ROUND 9 (Hugo 2026-07-18) — formatPopulation: o total de pessoas da turma como
// texto, degrada a null (célula omite a linha) em qualquer entrada malformada.
// ---------------------------------------------------------------------------

describe("formatPopulation — total de pessoas com degradação graciosa (Round 9)", () => {
  it("total válido → '{N} pessoas' (plural) e '1 pessoa' (singular)", () => {
    expect(formatPopulation(46)).toBe("46 pessoas")
    expect(formatPopulation(15)).toBe("15 pessoas")
    expect(formatPopulation(1)).toBe("1 pessoa")
  })
  it("ausente/inválido → null (a célula omite a linha, sem 'undefined pessoas')", () => {
    expect(formatPopulation(undefined)).toBeNull()
    expect(formatPopulation(null)).toBeNull()
    expect(formatPopulation(0)).toBeNull()
    expect(formatPopulation(-3)).toBeNull()
    expect(formatPopulation(Number.NaN)).toBeNull()
    expect(formatPopulation(Number.POSITIVE_INFINITY)).toBeNull()
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

  it("Round 6/9 — Engajamento: Você é RANKING SÓ posição ('3º'), Turma é TOTAL de pessoas + Média da turma", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    // Round 6 (Hugo 2026-07-18) — a célula Você mostra SÓ a posição "3º", sem o
    // "de 15" (o total de alunos foi removido), e não o score bruto (14) nem fração.
    expect(screen.getByTestId("cell-subject-engagement").textContent).toBe("3º")
    expect(screen.getByTestId("cell-subject-engagement").textContent).not.toContain("de")
    expect(screen.getByTestId("cell-subject-engagement").textContent).not.toBe("14")
    // Round 9 (Hugo 2026-07-18) — a célula Turma virou 2 linhas: o TOTAL de pessoas
    // ("15 pessoas", engagementTotalStudents do fixture = 15) como valor principal +
    // a legenda "Média da turma: 9" (r.engagementAvg = 9). A frase única "a turma fez,
    // em média, N pontos" do Round 6 deixou de existir.
    expect(screen.getByTestId("cell-reference-engagement").textContent).toBe("15 pessoas")
    expect(screen.getByTestId("cell-reference-engagement-avg").textContent).toBe(
      "Média da turma: 9 pontos",
    )
    expect(screen.queryByText("a turma fez, em média, 9 pontos")).not.toBeInTheDocument()
    // A legenda-espelho -raw do Round 5 continua não existindo.
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
    // ROUND 21→22 — Round 21 tinha trocado win para laranja (cerrado-600); Round 22 reverteu
    // (correção de escopo, o laranja era só para o cartão de resumo, não a tabela).
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

  it("empate → 'no ritmo da turma' (Progresso 50 vs 50)", () => {
    const tied: StudentHomeIndicators = {
      ...INDICATORS,
      reference: { ...INDICATORS.reference, progressAvgPct: 50 },
    }
    render(<ComparisonInsightsTable indicators={tied} />)
    expect(screen.getByTestId("leitura-progress").textContent).toBe("no ritmo da turma")
    expect(screen.getByTestId("leitura-progress").getAttribute("data-tone")).toBe("tie")
  })

  it("Round 15 — chip do empate é AMARELO INEQUÍVOCO (/15 + texto pleno), acima do limiar de percepção", () => {
    const tied: StudentHomeIndicators = {
      ...INDICATORS,
      reference: { ...INDICATORS.reference, progressAvgPct: 50 },
    }
    render(<ComparisonInsightsTable indicators={tied} />)
    const chip = screen.getByTestId("leitura-progress")
    // Round 15 — o /5 do Round 14 sumia contra fundo branco ("cadê o amarelo?"). Subido para
    // /15 + texto âmbar pleno, valor já provado legível no app (skill-badge, badge PUT).
    expect(chip.className).toContain("bg-semantic-warning/15")
    expect(chip.className).toContain("text-semantic-warning")
    // não é mais o /5 imperceptível do Round 14 nem o cinza do Round 13.
    expect(chip.className).not.toContain("bg-semantic-warning/5")
    expect(chip.className).not.toContain("bg-black/5")
    expect(chip.className).not.toContain("text-text-secondary")
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
// tom da Leitura. Vitória → verde; atrás → cor da severidade.
// Round 16 (Hugo 2026-07-18) — EMPATE REAL (winner null + tom "tie") → pill amarelo "tie";
// ausência de dado (tom "none") continua sem pill.
// ---------------------------------------------------------------------------
describe("subjectPillFor — pill do valor da célula Você", () => {
  it("aluno vence → 'win' (verde)", () => {
    expect(subjectPillFor("subject", "win")).toBe("win")
  })
  it("aluno atrás → cor da severidade (mild/severe)", () => {
    expect(subjectPillFor("reference", "behind-mild")).toBe("behind-mild")
    expect(subjectPillFor("reference", "behind-severe")).toBe("behind-severe")
  })
  it("Round 16 — EMPATE REAL (winner null + tom 'tie') → pill 'tie' (amarelo), não mais null", () => {
    expect(subjectPillFor(null, "tie")).toBe("tie")
  })
  it("ausência de dado (tom 'none') / vencedor null sem empate → sem pill", () => {
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
// ROUND 9 (Hugo 2026-07-18) — a célula TURMA de Engajamento virou DUAS linhas,
// espelhando o lado Você (pill "11º" + legenda "Você fez N pontos"): o TOTAL de
// pessoas ("46 pessoas", peso principal) em cima + a legenda muted "Média da turma:
// {N}" embaixo. Juntas com o Você, reconstroem "11 de 46". SUPERA a frase única "a
// turma fez, em média, N pontos" do Round 6 (que por sua vez superou o número solto
// + legenda do Round 5). O total vem de `engagementTotalStudents` (mesmo campo do
// `formatRank`, via `formatPopulation`, sem cálculo novo); a média de
// `reference.engagementAvg` (mesma fonte de sempre, só a redação mudou). Degrada:
// total ausente → linha de topo omitida (sem "undefined pessoas"). SÓ na linha
// Engajamento; as outras 4 seguem com o valor bruto no ValueCell.
// ---------------------------------------------------------------------------
describe("Engajamento — célula Turma em 2 linhas: total de pessoas + Média da turma (Round 9)", () => {
  it("linha de topo = total de pessoas ('15 pessoas', engagementTotalStudents=15)", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const cell = screen.getByTestId("cell-reference-engagement")
    expect(cell.textContent).toBe("15 pessoas")
    // Peso das demais células Turma (Round 8): text-sm font-medium.
    expect(cell.className).toContain("text-sm")
    expect(cell.className).toContain("font-medium")
    expect(cell.className).toContain("text-text-muted")
  })

  it("linha de baixo = legenda muted 'Média da turma: {N} pontos' (r.engagementAvg=9)", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const avg = screen.getByTestId("cell-reference-engagement-avg")
    // Round 11 — a unidade "pontos" foi acrescentada (screenshot #2 do Hugo).
    expect(avg.textContent).toBe("Média da turma: 9 pontos")
    // Mesmo estilo da legenda "Você fez N pontos" do lado Você.
    expect(avg.className).toContain("text-xs")
    expect(avg.className).toContain("text-text-muted")
  })

  it("SUPERA a frase única do Round 6: 'a turma fez, em média, N pontos' não existe mais", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(screen.queryByText("a turma fez, em média, 9 pontos")).not.toBeInTheDocument()
    // A legenda-espelho -raw do Round 5 continua não existindo.
    expect(screen.queryByTestId("cell-reference-engagement-raw")).toBeNull()
  })

  it("degradação graciosa: total ausente → linha de topo OMITIDA (sem 'undefined pessoas'), média segue", () => {
    const noTotal: StudentHomeIndicators = {
      ...INDICATORS,
      subject: { ...INDICATORS.subject, engagementTotalStudents: undefined },
    }
    render(<ComparisonInsightsTable indicators={noTotal} />)
    // A linha de topo (o valor principal com testid cell-reference-engagement) some.
    expect(screen.queryByTestId("cell-reference-engagement")).toBeNull()
    // Nunca "undefined pessoas" / "null pessoas".
    expect(screen.queryByText(/undefined|null/i)).not.toBeInTheDocument()
    // A legenda da média continua presente sozinha.
    expect(screen.getByTestId("cell-reference-engagement-avg").textContent).toBe(
      "Média da turma: 9 pontos",
    )
  })

  it("as outras 4 linhas NÃO têm 'Média da turma' e mantêm o valor bruto", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const engRow = screen.getByTestId("row-engagement")
    expect(engRow.textContent).toContain("Média da turma")
    for (const key of ["lastAccess", "progress", "sessions", "reflections"]) {
      const row = screen.getByTestId(`row-${key}`)
      expect(row.textContent).not.toContain("Média da turma")
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

  it("Turma NÃO destaca em WIN/BEHIND, mesmo quando ela é a vencedora (regra geral; exceção só no empate — Round 17)", () => {
    // Fixture BEHIND: aluno atrás, Turma vencendo → win/behind, NÃO empate. A regra geral
    // "Turma não destaca" continua (Round 17 abre exceção só para empate REAL, testado abaixo).
    render(<ComparisonInsightsTable indicators={BEHIND} />)
    for (const key of ["lastAccess", "progress", "sessions"]) {
      const ref = screen.getByTestId(`cell-reference-${key}`)
      expect(ref.className).not.toContain("bg-semantic-error/10")
      expect(ref.className).not.toContain("bg-semantic-warning/10")
      expect(ref.className).not.toContain("rounded-full")
    }
  })

  it("Round 16 — EMPATE REAL agora DESTACA a célula Você com pill amarelo /15 (Progresso 50 vs 50)", () => {
    const tied: StudentHomeIndicators = {
      ...INDICATORS,
      subject: { ...INDICATORS.subject, progressPct: 50 },
      reference: { ...INDICATORS.reference, progressAvgPct: 50 },
    }
    render(<ComparisonInsightsTable indicators={tied} />)
    const cell = screen.getByTestId("cell-subject-progress")
    // Round 16 — o empate deixou de ser texto neutro; ganhou pill amarelo suave (o /15 já
    // calibrado do chip tie), coerente com o chip/botão amarelo da mesma linha.
    expect(cell.className).toContain("rounded-full")
    expect(cell.className).toContain("bg-semantic-warning/15")
    expect(cell.className).toContain("text-semantic-warning")
    // não é vermelho nem o /10 do behind — é o tom de empate próprio.
    expect(cell.className).not.toContain("bg-semantic-error/10")
  })

  it("Round 17 — EMPATE REAL destaca AS DUAS células (Você E Turma) em amarelo /15", () => {
    // Hugo: "coloca o amarelo nos dois pois estão empatados". No empate os dois têm o mesmo
    // valor, então os dois destacam — exceção à regra "Turma nunca destaca" (só p/ empate).
    const tied: StudentHomeIndicators = {
      ...INDICATORS,
      subject: { ...INDICATORS.subject, progressPct: 50 },
      reference: { ...INDICATORS.reference, progressAvgPct: 50 },
    }
    render(<ComparisonInsightsTable indicators={tied} />)
    for (const testid of ["cell-subject-progress", "cell-reference-progress"]) {
      const cell = screen.getByTestId(testid)
      expect(cell.className).toContain("rounded-full")
      expect(cell.className).toContain("bg-semantic-warning/15")
      expect(cell.className).toContain("text-semantic-warning")
    }
  })

  it("Round 17 — a exceção é SÓ empate: em win a Turma continua neutra (sem pill)", () => {
    // Fixture base INDICATORS: várias linhas com win/behind, nenhuma empatada exceto se
    // forçado. Aqui uso uma linha onde o aluno VENCE (sessions 7 vs 5) → Turma não destaca.
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const ref = screen.getByTestId("cell-reference-sessions")
    expect(ref.className).not.toContain("bg-semantic-warning/15")
    expect(ref.className).not.toContain("rounded-full")
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

  it("REESCRITO (era 'cor cerrado SEMPRE'): a cor do botão VARIA por tom (Round 7→12, Round 21 revertido no 22)", () => {
    // Round 6 afirmava cor cerrado fixa para todos; a Round 7 REVERTEU — a cor agora
    // espelha o leitura.tone da linha. Round 12: a cor vive no FUNDO SÓLIDO da pill (bg-*).
    // ROUND 21→22: o Round 21 tinha trocado win para cerrado-500 (laranja); o Round 22
    // REVERTEU (correção de escopo, o laranja era só para o cartão de resumo). No
    // MIXED_TONES: engagement vence (win → verde), progress atrás severe (vermelho),
    // sessions atrás mild (âmbar). Nenhum é cerrado, porque nenhum é `none`.
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
// visual chip↔botão. Mapeamento: win=verde (semantic-success — Round 21 tentou laranja,
// revertido no Round 22, correção de escopo), tie=neutro,
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

  it("win → VERDE SÓLIDO (bg-semantic-success text-white), espelhando o chip win", () => {
    render(<ComparisonInsightsTable indicators={ALL_TONES} continueHref="/courses/next" />)
    // sanidade: o tom da linha é mesmo win (o chip prova), depois a cor do botão.
    expect(screen.getByTestId("leitura-engagement").getAttribute("data-tone")).toBe("win")
    const btn = screen.getByTestId("action-engagement")
    expect(btn.getAttribute("data-tone")).toBe("win")
    // Round 12 — pill SÓLIDA saturada: fundo cheio na cor do tom + texto branco. A relação
    // de cor por tom do Round 7 permanece; muda a saturação (/10 → sólido). ROUND 21→22 — o
    // Round 21 tinha trocado para laranja (cerrado-500); o Round 22 REVERTEU para verde
    // (correção de escopo, o laranja era só para o cartão de resumo, não a tabela).
    expect(btn.className).toContain("bg-semantic-success")
    expect(btn.className).not.toContain("bg-cerrado-500")
    expect(btn.className).not.toContain("bg-cerrado-600")
    expect(btn.className).toContain("text-white")
  })

  it("tie → AMARELO CLARO/SUAVE (bg-semantic-warning/70), valor JÁ PRESENTE no CSS (renderiza)", () => {
    render(<ComparisonInsightsTable indicators={ALL_TONES} continueHref="/courses/next" />)
    expect(screen.getByTestId("leitura-progress").getAttribute("data-tone")).toBe("tie")
    const btn = screen.getByTestId("action-progress")
    expect(btn.getAttribute("data-tone")).toBe("tie")
    // Round 16 — o /60 do Round 15 estava no código mas o Tailwind não gerava a regra CSS
    // (opacidade nova, não usada em outro lugar) → botão transparente. Trocado por /70, o
    // valor já presente no CSS (analytics-dashboard), garantindo que renderiza. Texto preto/70.
    expect(btn.className).toContain("bg-semantic-warning/70")
    expect(btn.className).toContain("text-black/70")
    // não é mais o /60 (não-renderizado) do Round 15, o /40 do Round 14, nem o neutro cinza.
    expect(btn.className).not.toContain("bg-semantic-warning/60")
    expect(btn.className).not.toContain("bg-semantic-warning/40")
    expect(btn.className).not.toContain("bg-bg-elevated")
    expect(btn.className).not.toContain("bg-semantic-error")
    expect(btn.className).not.toContain("bg-cerrado-600")
    expect(btn.className).not.toContain("bg-semantic-success") // win (Round 22: verde de novo)
  })

  it("behind-mild → ÂMBAR SÓLIDO forte (bg-semantic-warning /100, NÃO /70) com texto PRETO", () => {
    render(<ComparisonInsightsTable indicators={ALL_TONES} continueHref="/courses/next" />)
    expect(screen.getByTestId("leitura-sessions").getAttribute("data-tone")).toBe("behind-mild")
    const btn = screen.getByTestId("action-sessions")
    expect(btn.getAttribute("data-tone")).toBe("behind-mild")
    // Round 16 — behind-mild é o âmbar SÓLIDO (sem /70); distinto do empate mais claro /70.
    expect(btn.className).toContain("bg-semantic-warning")
    expect(btn.className).not.toContain("bg-semantic-warning/70")
    expect(btn.className).toContain("text-black/80")
    expect(btn.className).not.toContain("text-white")
  })

  it("tie e behind-mild são AMBOS amarelos, mas em INTENSIDADES distintas (mesmo token, opacidade diferente)", () => {
    render(<ComparisonInsightsTable indicators={ALL_TONES} continueHref="/courses/next" />)
    const tie = screen.getByTestId("action-progress").className
    const mild = screen.getByTestId("action-sessions").className
    // ambos na família warning...
    expect(tie).toContain("semantic-warning")
    expect(mild).toContain("semantic-warning")
    // ...mas o empate é /70 (mais claro) e o behind-mild é sólido (sem /70) — distinguíveis.
    expect(tie).toContain("bg-semantic-warning/70")
    expect(mild).not.toContain("/70")
  })

  it("behind-severe → VERMELHO SÓLIDO (bg-semantic-error text-white), espelhando o chip severe", () => {
    render(<ComparisonInsightsTable indicators={ALL_TONES} continueHref="/courses/next" />)
    expect(screen.getByTestId("leitura-reflections").getAttribute("data-tone")).toBe(
      "behind-severe",
    )
    const btn = screen.getByTestId("action-reflections")
    expect(btn.getAttribute("data-tone")).toBe("behind-severe")
    // Round 12 — fundo vermelho sólido + texto branco.
    expect(btn.className).toContain("bg-semantic-error")
    expect(btn.className).toContain("text-white")
  })

  it("none → CERRADO/laranja SÓLIDO preservado como fallback (dado ausente)", () => {
    render(<ComparisonInsightsTable indicators={ALL_TONES} continueHref="/courses/next" />)
    expect(screen.getByTestId("leitura-lastAccess").getAttribute("data-tone")).toBe("none")
    const btn = screen.getByTestId("action-lastAccess")
    expect(btn.getAttribute("data-tone")).toBe("none")
    // Round 12 — fundo cerrado sólido + texto branco (fallback dado ausente).
    expect(btn.className).toContain("bg-cerrado-600")
    expect(btn.className).toContain("text-white")
    // ROUND 21→22: o Round 21 tinha win TAMBÉM em cerrado (degrau -500 vs -600 do none, para
    // não colidirem); o Round 22 reverteu win para verde nesta tabela, então a colisão nem
    // existe mais aqui — `none` segue o único cerrado desta linha.
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

  it("os 5 tons produzem 5 fundos DISTINTOS (relação de cor real, não decorativa)", () => {
    render(<ComparisonInsightsTable indicators={ALL_TONES} continueHref="/courses/next" />)
    // Round 16 — 5 fundos distintos: tie virou âmbar /70 (mais claro), behind-mild âmbar
    // SÓLIDO. A checagem do /70 vem ANTES da checagem do warning sólido, senão o empate seria
    // classificado como "warning" e colidiria com o behind-mild.
    // ROUND 21→22: o Round 21 tinha win e none AMBOS cerrado (degraus -500/-600 distintos);
    // o Round 22 reverteu win para verde, então o classificador volta ao estado pré-Round-21
    // (win=success, none=cerrado, sem degraus a distinguir).
    const toneToken = (key: string) => {
      const cls = screen.getByTestId(`action-${key}`).className
      if (cls.includes("bg-semantic-warning/70")) return "warning-soft" // tie (empate)
      if (cls.includes("bg-semantic-success")) return "success"
      if (cls.includes("bg-semantic-error")) return "error"
      if (cls.includes("bg-semantic-warning")) return "warning" // behind-mild sólido
      if (cls.includes("bg-cerrado-600")) return "cerrado"
      return "neutral"
    }
    const tokens = [
      toneToken("engagement"), // win → success
      toneToken("reflections"), // behind-severe → error
      toneToken("sessions"), // behind-mild → warning (sólido)
      toneToken("lastAccess"), // none → cerrado
      toneToken("progress"), // tie → warning-soft (âmbar /70)
    ]
    // Todos os 5 distintos entre si — prova que a cor de fato varia com o tom.
    expect(new Set(tokens).size).toBe(5)
    expect(tokens).toEqual(["success", "error", "warning", "cerrado", "warning-soft"])
  })
})

// ---------------------------------------------------------------------------
// ROUND 8 (Hugo 2026-07-18) — alinhamento em COLUNAS reais + hierarquia de cor.
// Feedback ao vivo ("esse visual ta bem ruim, tudo muito igual, desalinhado") +
// pedido explícito de texto maior na frase da Turma/Engajamento. Três correções:
//   (1) chip e ação viraram DUAS <td>s reais (antes: 1 <td> com flex interno);
//   (2) a frase "a turma fez, em média, N pontos" subiu de text-xs p/ text-sm
//       font-medium (peso das demais células Turma);
//   (3) o ActionButton baixou de fundo SÓLIDO p/ TINTADO /10 (peso leve),
//       preservando a RELAÇÃO de cor por tom do Round 7.
// ---------------------------------------------------------------------------
// Fixture com os 5 tons de uma vez, reusado pelo bloco Round 8 (mesmo desenho do
// Round 7 ALL_TONES): none/tie/behind-mild/behind-severe/win.
const ALL_TONES_R8: StudentHomeIndicators = {
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

describe("Round 8 — colunas reais, texto maior na Turma/Engajamento, botão em tom suave", () => {
  it("(1) chip e botão ficam em <td>s SEPARADOS (colunas reais), não no mesmo contêiner", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} continueHref="/courses/next" />)
    for (const key of ["lastAccess", "progress", "sessions", "reflections", "engagement"]) {
      const chip = screen.getByTestId(`leitura-${key}`)
      const action = screen.getByTestId(`action-${key}`)
      const chipCell = chip.closest("td")
      const actionCell = action.closest("td")
      // Ambos vivem numa <td>...
      expect(chipCell).not.toBeNull()
      expect(actionCell).not.toBeNull()
      // ...mas em <td>s DIFERENTES (colunas reais, não flex numa célula só).
      expect(chipCell).not.toBe(actionCell)
    }
  })

  it("(1) o <thead> tem uma 5ª coluna para a ação (rótulo sr-only 'Ação')", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const acao = screen.getByText("Ação")
    expect(acao.className).toContain("sr-only")
    // A tabela agora tem 5 colunas de cabeçalho: Indicador | Você | Turma | Como estou | Ação.
    const { container } = render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const headerCells = container.querySelectorAll("thead th")
    expect(headerCells.length).toBe(5)
  })

  it("(1) cada linha do corpo tem 5 <td> (Indicador | Você | Turma | chip | ação)", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    for (const key of ["lastAccess", "progress", "sessions", "reflections", "engagement"]) {
      const row = screen.getByTestId(`row-${key}`)
      expect(row.querySelectorAll("td").length).toBe(5)
    }
  })

  it("(1) a coluna de ação alinha: o <td> do botão é o MESMO índice de coluna em todas as linhas", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} continueHref="/courses/next" />)
    for (const key of ["lastAccess", "progress", "sessions", "reflections", "engagement"]) {
      const row = screen.getByTestId(`row-${key}`)
      const cells = Array.from(row.querySelectorAll("td"))
      const actionCell = screen.getByTestId(`action-${key}`).closest("td")
      // O botão está sempre na 5ª coluna (índice 4) — alinhamento nativo de <table>.
      expect(cells.indexOf(actionCell as HTMLTableCellElement)).toBe(4)
    }
  })

  it("(2) o valor principal da Turma/Engajamento usa text-sm font-medium (peso das demais células Turma)", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    // Round 9 — o valor principal da célula Turma virou o total de pessoas ("15
    // pessoas"), mas mantém o peso text-sm font-medium introduzido no Round 8.
    const cell = screen.getByTestId("cell-reference-engagement")
    expect(cell.textContent).toBe("15 pessoas")
    expect(cell.className).toContain("text-sm")
    expect(cell.className).toContain("font-medium")
    expect(cell.className).not.toContain("text-xs")
  })

  it("(3) [Round 12] botão sólido saturado: win = bg-semantic-success text-white (não mais tintado)", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} continueHref="/courses/next" />)
    // No fixture base, engagement vence a média → win. Round 12: pill sólida saturada,
    // fundo cheio + texto branco (o Round 8 discreto /10 foi superado a pedido do Hugo).
    // ROUND 21→22: o Round 21 tinha trocado para laranja (cerrado-500); o Round 22 REVERTEU
    // para verde (correção de escopo, o laranja era só para o cartão de resumo).
    const btn = screen.getByTestId("action-engagement")
    expect(btn.getAttribute("data-tone")).toBe("win")
    expect(btn.className).toContain("bg-semantic-success")
    expect(btn.className).not.toContain("bg-cerrado-500")
    expect(btn.className).toContain("text-white")
  })

  it("(3) a RELAÇÃO de cor por tom (Round 7) é PRESERVADA — cada tom ainda tem sua família", () => {
    render(<ComparisonInsightsTable indicators={ALL_TONES_R8} continueHref="/courses/next" />)
    // Round 12 — win → bg-success, behind-severe → bg-error, behind-mild → bg-warning.
    expect(screen.getByTestId("action-engagement").className).toContain("bg-semantic-success")
    expect(screen.getByTestId("action-reflections").className).toContain("bg-semantic-error")
    expect(screen.getByTestId("action-sessions").className).toContain("bg-semantic-warning")
  })
})

// ---------------------------------------------------------------------------
// ROUND 10 (Hugo 2026-07-18) — ícone SEMÂNTICO por ação (não mais o ArrowRight
// genérico repetido 5x) + diferenciação botão↔chip (anel + peso da fonte). Feedback
// ao vivo: "precisamos melhorar o visual dos botões agora, ta tudo muito igual.
// precisamos dos botões com alguns ícones e etc". Cada botão ganha um glifo Lucide
// próprio à esquerda (liderança); os 5 são visualmente distintos e reusam o
// vocabulário do app. Identidade do glifo é afirmada por 2 evidências: o data-testid
// `action-icon-<key>` e a classe `lucide-<glifo>` que o próprio lucide-react emite.
// ---------------------------------------------------------------------------
describe("Round 10 — ícone semântico por ação + diferenciação botão↔chip", () => {
  // Mapa esperado key → classe lucide (o glifo semântico de cada ação).
  const EXPECTED_ICON: Record<string, string> = {
    lastAccess: "lucide-rotate-ccw", // RotateCcw — retomar
    progress: "lucide-play", // Play — continuar sessão
    sessions: "lucide-message-square", // MessageSquare — interação
    reflections: "lucide-pencil", // Pencil — registrar reflexão
    engagement: "lucide-zap", // Zap — continuar agora
  }

  it("cada botão tem o ícone SEMÂNTICO certo por linha (via testid do ícone)", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} continueHref="/courses/next" />)
    for (const key of Object.keys(EXPECTED_ICON)) {
      const icon = screen.getByTestId(`action-icon-${key}`)
      expect(icon).toBeInTheDocument()
      // O ícone vive DENTRO do botão da mesma linha (à esquerda, liderança).
      expect(screen.getByTestId(`action-${key}`).contains(icon)).toBe(true)
    }
  })

  it("o glifo renderizado corresponde à ação (classe lucide-<glifo>)", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} continueHref="/courses/next" />)
    for (const [key, expectedClass] of Object.entries(EXPECTED_ICON)) {
      const icon = screen.getByTestId(`action-icon-${key}`)
      expect(icon.getAttribute("class")).toContain(expectedClass)
    }
  })

  it("os 5 ícones são glifos DISTINTOS entre si (não repetição do mesmo)", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} continueHref="/courses/next" />)
    const glyphs = ["lastAccess", "progress", "sessions", "reflections", "engagement"].map(
      (key) => {
        const cls = screen.getByTestId(`action-icon-${key}`).getAttribute("class") ?? ""
        // extrai o nome do glifo lucide (ex.: 'lucide-rotate-ccw').
        return cls.split(/\s+/).find((c) => c.startsWith("lucide-") && c !== "lucide") ?? cls
      },
    )
    expect(new Set(glyphs).size).toBe(5)
  })

  it("o ícone genérico ArrowRight NÃO é mais o único/principal — o semântico lidera à esquerda", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} continueHref="/courses/next" />)
    // O botão tem >= 2 svgs (o semântico + o ArrowRight de affordance ao final).
    const btn = screen.getByTestId("action-lastAccess")
    const svgs = btn.querySelectorAll("svg")
    expect(svgs.length).toBeGreaterThanOrEqual(2)
    // O PRIMEIRO svg (liderança) é o semântico da linha, não o ArrowRight.
    expect(svgs[0].getAttribute("class")).toContain("lucide-rotate-ccw")
  })

  it("diferenciação botão↔chip (Round 13): o botão é pill SÓLIDA (bg cheio) e o chip é liso /10", () => {
    // Round 13 — a diferenciação ação↔status vem do FUNDO SÓLIDO: o botão é uma pill de fundo
    // cheio na cor do tom; o chip descritivo continua pill lisa /10 (tintado, sem cor forte).
    // O peso da fonte NÃO é mais o diferenciador (ambos font-semibold agora, como no gestor);
    // o sólido vs tintado já separa "ação" de "status" com folga.
    render(<ComparisonInsightsTable indicators={INDICATORS} continueHref="/courses/next" />)
    for (const key of ["lastAccess", "progress", "sessions", "reflections", "engagement"]) {
      const btn = screen.getByTestId(`action-${key}`)
      // botão: fundo sólido (uma das famílias de cor sólida) — nunca o /10 tintado do chip.
      expect(btn.className).not.toContain("/10")
      // chip: fundo tintado /10 (nunca fundo sólido pleno da família semântica).
      // (o chip win usa bg-semantic-success/10; o botão win usa bg-semantic-success cheio.)
    }
  })

  it("Round 13 — MAGREZA idêntica ao gestor: px-3.5 py-1.5 text-xs font-semibold, sem h-8 fixo", () => {
    // Replicação EXATA do botão do card do gestor (student-insights-table.tsx). A "gordura"
    // do Round 12 era o h-8 fixo + justify-center (centralização VERTICAL forçada por causa da
    // altura fixa) + font-bold; agora é o py-1.5 fluido enxuto.
    // ROUND 24 — `justify-center` REAPARECE na classe, mas por um motivo DIFERENTE do que o
    // Round 13 removeu: não é mais para centralizar verticalmente dentro de uma altura fixa
    // (`h-8`, que segue ausente), é para centralizar HORIZONTALMENTE o conteúdo (ícone+texto+
    // seta) dentro da largura fixa nova (`min-w-[220px]`, ver Round 24). A "gordura" que o
    // Round 13 corrigiu era a combinação h-8+justify-center+font-bold; sem `h-8` e sem
    // `font-bold`, o botão continua magro — só ganhou uma largura mínima padronizada.
    render(<ComparisonInsightsTable indicators={INDICATORS} continueHref="/courses/next" />)
    for (const key of ["lastAccess", "progress", "sessions", "reflections", "engagement"]) {
      const cls = screen.getByTestId(`action-${key}`).className
      expect(cls).toContain("px-3.5")
      expect(cls).toContain("py-1.5")
      expect(cls).toContain("text-xs")
      expect(cls).toContain("font-semibold")
      // a causa ORIGINAL da gordura (altura fixa) continua ausente.
      expect(cls).not.toContain("h-8")
      // e não é mais font-bold (o gestor é font-semibold).
      expect(cls).not.toContain("font-bold")
    }
  })

  it("Round 13 — ícone semântico em size 14 (o exato do gestor, não 13)", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} continueHref="/courses/next" />)
    // lucide emite width/height no SVG; o ícone semântico da ação deve ter 14 (gestor).
    const icon = screen.getByTestId("action-icon-lastAccess")
    expect(icon.getAttribute("width")).toBe("14")
    expect(icon.getAttribute("height")).toBe("14")
  })

  it("o botão é pill sólida rounded-full com shadow (peso de CTA), o chip é liso sem shadow", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} continueHref="/courses/next" />)
    for (const key of ["lastAccess", "progress", "sessions", "reflections", "engagement"]) {
      const btn = screen.getByTestId(`action-${key}`)
      expect(btn.className).toContain("rounded-full")
      expect(btn.className).toContain("shadow-sm")
      // o chip não tem shadow (é status descritivo, não CTA).
      expect(screen.getByTestId(`leitura-${key}`).className).not.toContain("shadow")
    }
  })

  it("o FUNDO SÓLIDO PRESERVA a relação de cor por tom (Round 7→12): win=success, severe=error, mild=warning", () => {
    render(<ComparisonInsightsTable indicators={ALL_TONES_R8} continueHref="/courses/next" />)
    expect(screen.getByTestId("action-engagement").className).toContain("bg-semantic-success")
    expect(screen.getByTestId("action-reflections").className).toContain("bg-semantic-error")
    expect(screen.getByTestId("action-sessions").className).toContain("bg-semantic-warning")
  })

  it("label e href PRESERVADOS (o ícone é aditivo, não substitui texto/destino)", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} continueHref="/courses/next" />)
    expect(screen.getByTestId("action-lastAccess").textContent).toContain("Retomar atividade")
    expect(screen.getByTestId("action-engagement").textContent).toContain("Continuar agora")
    for (const key of ["lastAccess", "progress", "sessions", "reflections", "engagement"]) {
      expect(screen.getByTestId(`action-${key}`).getAttribute("href")).toBe("/courses/next")
    }
  })
})

// ---------------------------------------------------------------------------
// ROUND 12 (Uma / @ux-design-expert, Hugo 2026-07-18) — PILL SÓLIDA SATURADA POR TOM. O
// Hugo reagiu ao outline do Round 11 com um screenshot de referência (pills sólidas/
// saturadas, texto branco, ícone forte, rounded-full) e pediu "usa esse estilo de botão",
// mantendo os RÓTULOS específicos por métrica. O botão saiu do outline do DS (Round 11) para
// uma pill rounded-full de FUNDO SÓLIDO por tom, peso forte de CTA. A forma rounded-full é
// fiel à referência e coerente com o chip vizinho. A relação cor↔tom (Round 7) e a família
// de cor (verde=win/âmbar-vermelho=atrás/neutro=empate/cerrado=fallback) permanecem; muda só
// a SATURAÇÃO (/10 → sólido). Estados de acessibilidade (foco visível, active, transição)
// reproduzidos à mão. Ação #2 (screenshot #2): legenda da Turma/Engajamento com unidade
// "pontos". Estes testes travam o PESO/SATURAÇÃO e a preservação de cor↔tom/rótulos.
// ---------------------------------------------------------------------------
describe("Round 12 — botão de ação em pill sólida saturada por tom", () => {
  it("o botão é pill rounded-full (fiel à referência), NÃO o rounded-xl outline do Round 11", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} continueHref="/courses/next" />)
    for (const key of ["lastAccess", "progress", "sessions", "reflections", "engagement"]) {
      const btn = screen.getByTestId(`action-${key}`)
      expect(btn.className).toContain("rounded-full")
      expect(btn.className).not.toContain("rounded-xl")
    }
    // o chip "Como estou" também é rounded-full (pill lisa); a diferenciação é o FUNDO SÓLIDO.
    expect(screen.getByTestId("leitura-progress").className).toContain("rounded-full")
  })

  it("mantém os estados de acessibilidade (foco visível + transição) reproduzidos à mão", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} continueHref="/courses/next" />)
    const btn = screen.getByTestId("action-progress")
    // Round 12 — os estados do DS que o outline dava de graça são reproduzidos à mão para
    // não regredir acessibilidade ao sair do buttonVariants.
    expect(btn.className).toContain("focus-visible:ring")
    expect(btn.className).toContain("transition")
  })

  it("continua um <a>/Link navegável com href (é CTA de navegação, não <button>)", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} continueHref="/courses/next" />)
    const btn = screen.getByTestId("action-progress")
    expect(btn.tagName.toLowerCase()).toBe("a")
    expect(btn.getAttribute("href")).toBe("/courses/next")
  })

  it("a relação cor↔tom (Round 7) SOBREVIVE à mudança para sólido: 5 tons → 5 fundos distintos", () => {
    const allTones: StudentHomeIndicators = {
      ...INDICATORS,
      subject: {
        ...INDICATORS.subject,
        lastAccessDays: null, // none → cerrado sólido
        progressPct: 50, // tie → âmbar /70 (Round 16)
        interactions: 7, // behind-mild → âmbar sólido
        reflections: 8, // behind-severe → vermelho sólido
        engagement: 14, // win → verde sólido
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
    expect(screen.getByTestId("action-engagement").className).toContain("bg-semantic-success")
    expect(screen.getByTestId("action-reflections").className).toContain("bg-semantic-error")
    // behind-mild é o âmbar SÓLIDO (sem /70); tie é o âmbar mais claro /70 (Round 16).
    expect(screen.getByTestId("action-sessions").className).toContain("bg-semantic-warning")
    expect(screen.getByTestId("action-sessions").className).not.toContain("bg-semantic-warning/70")
    expect(screen.getByTestId("action-progress").className).toContain("bg-semantic-warning/70")
    expect(screen.getByTestId("action-lastAccess").className).toContain("bg-cerrado-600")
  })

  it("contraste WCAG por tom: fundos escuros → texto branco; âmbar claro → texto preto", () => {
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
    // win/severe/none: fundo escuro o bastante → texto branco.
    expect(screen.getByTestId("action-engagement").className).toContain("text-white")
    expect(screen.getByTestId("action-reflections").className).toContain("text-white")
    expect(screen.getByTestId("action-lastAccess").className).toContain("text-white")
    // behind-mild: âmbar CLARO (oklch L 0.8) → texto PRETO, nunca branco.
    const mild = screen.getByTestId("action-sessions")
    expect(mild.className).toContain("text-black/80")
    expect(mild.className).not.toContain("text-white")
  })

  it("os 5 RÓTULOS específicos por métrica PRESERVADOS (não viraram genéricos por status)", () => {
    // Decisão explícita do Hugo (Round 12): adotar o peso da referência, MAS manter os
    // rótulos específicos por métrica — não os genéricos "Lembrar"/"No ritmo"/"Acionar".
    render(<ComparisonInsightsTable indicators={INDICATORS} continueHref="/courses/next" />)
    expect(screen.getByTestId("action-lastAccess").textContent).toContain("Retomar atividade")
    expect(screen.getByTestId("action-progress").textContent).toContain("Continuar sessão")
    expect(screen.getByTestId("action-sessions").textContent).toContain("Fazer uma interação")
    expect(screen.getByTestId("action-reflections").textContent).toContain("Registrar uma reflexão")
    expect(screen.getByTestId("action-engagement").textContent).toContain("Continuar agora")
    // os rótulos genéricos por status da referência NÃO aparecem.
    for (const generic of ["Lembrar", "No ritmo", "Acionar"]) {
      expect(screen.queryByText(generic)).not.toBeInTheDocument()
    }
  })

  it("ícone semântico (Round 10) e ArrowRight de affordance PERMANECEM dentro da pill sólida", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} continueHref="/courses/next" />)
    const icon = screen.getByTestId("action-icon-lastAccess")
    expect(screen.getByTestId("action-lastAccess").contains(icon)).toBe(true)
    expect(icon.getAttribute("class")).toContain("lucide-rotate-ccw")
    // >= 2 svgs: o semântico (liderança) + o ArrowRight (affordance ao final).
    expect(
      screen.getByTestId("action-lastAccess").querySelectorAll("svg").length,
    ).toBeGreaterThanOrEqual(2)
  })

  it("fix #2: legenda da Turma/Engajamento inclui a unidade 'pontos'", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(screen.getByTestId("cell-reference-engagement-avg").textContent).toBe(
      "Média da turma: 9 pontos",
    )
  })
})

// ---------------------------------------------------------------------------
// ROUND 24 (Hugo 2026-07-18, screenshot recortado da coluna "Ação"): "só não estou gostando
// que isso aqui não está com os tamanhos padronizados e centralizados". Os 5 botões tinham
// larguras diferentes (dimensionadas pelo próprio texto) e ficavam encostados à esquerda da
// célula. Agora: largura mínima FIXA (`min-w-[220px]`, igual nos 5) + conteúdo centralizado
// dentro do botão (`justify-center`) + célula centralizada (`<td>`/`<th>` `text-center`).
// ---------------------------------------------------------------------------
describe("Round 24 — botões de ação com largura padronizada e centralizados", () => {
  it("os 5 botões têm a MESMA largura mínima (min-w-[220px]), independente do comprimento do rótulo", () => {
    render(<ComparisonInsightsTable indicators={ALL_TONES_R8} continueHref="/courses/next" />)
    for (const key of ["lastAccess", "progress", "sessions", "reflections", "engagement"]) {
      expect(screen.getByTestId(`action-${key}`).className).toContain("min-w-[220px]")
    }
  })

  it("o conteúdo (ícone+texto+seta) fica centralizado DENTRO do botão (justify-center)", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} continueHref="/courses/next" />)
    expect(screen.getByTestId("action-progress").className).toContain("justify-center")
  })

  it("o texto do rótulo NUNCA quebra linha (whitespace-nowrap), mesmo com a largura fixa sobrando espaço nos rótulos curtos", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} continueHref="/courses/next" />)
    // "Continuar agora" (engagement) é o rótulo mais CURTO — o caso onde sobra mais espaço
    // dentro do min-w-[220px], portanto o caso mais provável de um wrap acidental sem a classe.
    expect(screen.getByTestId("action-engagement").className).toContain("whitespace-nowrap")
  })

  it("o rótulo mais LONGO ('Registrar uma reflexão') renderiza por INTEIRO, sem truncar", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} continueHref="/courses/next" />)
    expect(screen.getByTestId("action-reflections").textContent).toContain("Registrar uma reflexão")
  })

  it("a célula E o header da coluna 'Ação' são text-center (não mais text-left)", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} continueHref="/courses/next" />)
    const actionCell = screen.getByTestId("action-progress").closest("td") as HTMLElement
    expect(actionCell.className).toContain("text-center")
    expect(actionCell.className).not.toContain("text-left")
    const actionHeader = screen.getByText("Ação").closest("th") as HTMLElement
    expect(actionHeader.className).toContain("text-center")
  })

  it("a célula do chip 'Como estou' PERMANECE text-left (só a coluna Ação centralizou)", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} continueHref="/courses/next" />)
    const chipCell = screen.getByTestId("leitura-progress").closest("td") as HTMLElement
    expect(chipCell.className).toContain("text-left")
    expect(chipCell.className).not.toContain("text-center")
  })

  it("labels/href/ícones/cor por tom PRESERVADOS (só largura e centralização mudaram)", () => {
    render(<ComparisonInsightsTable indicators={ALL_TONES_R8} continueHref="/courses/next" />)
    expect(screen.getByTestId("action-engagement").textContent).toContain("Continuar agora")
    expect(screen.getByTestId("action-engagement").getAttribute("href")).toBe("/courses/next")
    expect(screen.getByTestId("action-engagement").className).toContain("bg-semantic-success")
    expect(screen.getByTestId("action-reflections").className).toContain("bg-semantic-error")
  })
})
