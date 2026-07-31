import type { StudentHomeIndicators } from "@/types/analytics"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  ComparisonInsightsTable,
  effectiveWinnerFor,
  formatFraction,
  formatPopulation,
  formatRank,
  leituraFor,
  recencyReadingFor,
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
  it("total válido → '{N} pessoas ativas' (plural) e '1 pessoa ativa' (singular) — SH-2.5, deixa explícito que já é a população filtrada da SH-2.1", () => {
    expect(formatPopulation(46)).toBe("46 pessoas ativas")
    expect(formatPopulation(15)).toBe("15 pessoas ativas")
    expect(formatPopulation(1)).toBe("1 pessoa ativa")
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

  it("AC2/B1 — labels exatos: Última sessão de estudo · Percorrido · Conclusão · Interações realizadas · Reflexões realizadas · Engajamento", () => {
    // SH-2.2 (Hugo 2026-07-19, caso Angelo) — "Última atividade" renomeado para
    // "Última sessão de estudo" (o dado, corrigido na mesma story, passou a medir
    // só estudo real — sessão/reflexão —, não mais login puro).
    // B.1 (feat-percorrido-na-tela-do-aluno, Hugo 2026-07-31) — "Progresso -
    // conclusão" renomeado para "Conclusão": a linha mede o clique em "Módulo
    // Concluído", que colide de frente com o novo vocabulário ("progresso" =
    // preencher as interações). B.2 — nova linha "Percorrido".
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    for (const label of [
      "Última sessão de estudo",
      "Percorrido",
      "Conclusão",
      "Interações realizadas",
      "Reflexões realizadas",
      "Engajamento",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    // Labels antigos NÃO aparecem mais.
    for (const old of [
      "Progresso",
      "Progresso - conclusão",
      "Sessões concluídas",
      "Reflexões",
      "Último acesso",
      "Última atividade",
    ]) {
      // "Progresso" e "Reflexões" são substrings dos novos; usamos getByText exato
      // via função para não casar parcialmente.
      expect(screen.queryByText((content) => content === old)).not.toBeInTheDocument()
    }
  })

  it("AC1/B2 — ordem exata das 6 linhas no DOM, Percorrido IMEDIATAMENTE antes de Conclusão", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const keys = ["lastAccess", "percorrido", "progress", "sessions", "reflections", "engagement"]
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
    expect(screen.getByTestId("cell-reference-engagement").textContent).toBe("15 pessoas ativas")
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
  // SH-2.5 (Hugo 2026-07-19) — a distinção mild/severe foi removida: "atrás" (fora da
  // faixa de tolerância de 5%) é sempre vermelho direto, sem gradiente. No fixture
  // base o único indicador atrás é Progresso (50 vs 55, gap ~9%, fora da faixa de
  // 5%), então esperamos o token de erro (semantic-error), não mais o de warning.
  it("SH-2.5 — aluno atrás em Progresso vira VERMELHO direto (behind), não mais cerrado neutro nem âmbar mild", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const chip = screen.getByTestId("leitura-progress")
    expect(chip.getAttribute("data-tone")).toBe("behind")
    expect(chip.className).toContain("bg-semantic-error/10")
    expect(chip.className).toContain("text-semantic-error")
  })
})

// ---------------------------------------------------------------------------
// SH-1.5 — coluna "Como estou" (AC6): frases mais longas, tom preservado
// (win/tie/behind). Round 2 (Hugo 2026-07-18): o prefixo "… " foi REMOVIDO — o
// texto começa direto pela palavra. A linha Engajamento tem a regra do rank real (AC7).
// ---------------------------------------------------------------------------

describe("coluna 'Como estou' — copy longa sem prefixo '… ' e tom preservado (AC6)", () => {
  it("acima da média → reforço: Interações/Reflexões 'acima da média'", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(screen.getByTestId("leitura-sessions").textContent).toBe("acima da média")
    expect(screen.getByTestId("leitura-sessions").getAttribute("data-tone")).toBe("win")
    expect(screen.getByTestId("leitura-reflections").textContent).toBe("acima da média")
  })

  it("SH-2.5 (item 3) — 'Última sessão de estudo' usa leitura PRÓPRIA por recência absoluta, não mais 'acima da média' comparativo", () => {
    // INDICATORS.subject.lastAccessDays = 0 (hoje) → dentro de RECENCY_THRESHOLDS.recentDays
    // (7) → tone win, texto próprio de recencyReadingFor, NÃO o antigo LEITURA_COPY.lastAccess.
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const leitura = screen.getByTestId("leitura-lastAccess")
    expect(leitura.textContent).toBe("estudando com frequência")
    expect(leitura.getAttribute("data-tone")).toBe("win")
  })

  it("chip tonal: fundo suave + ícone (svg); atrás vira VERMELHO direto (SH-2.5, sem gradiente)", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const win = screen.getByTestId("leitura-sessions")
    expect(win.className).toContain("rounded-full")
    // ROUND 21→22 — Round 21 tinha trocado win para laranja (cerrado-600); Round 22 reverteu
    // (correção de escopo, o laranja era só para o cartão de resumo, não a tabela).
    expect(win.className).toContain("bg-semantic-success/10")
    expect(win.querySelector("svg")).not.toBeNull()
    // SH-2.5 — atrás (Progresso 50 vs 55, fora da faixa de 5%) agora é VERMELHO
    // (semantic-error) direto, não mais o âmbar mild de antes.
    const behind = screen.getByTestId("leitura-progress")
    expect(behind.className).toContain("bg-semantic-error/10")
    expect(behind.querySelector("svg")).not.toBeNull()
  })

  it("abaixo → COPY ainda acionável e não punitiva: Progresso atrás vira '1 sessão te recoloca no ritmo' (SH-2.5: tom único behind)", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const leitura = screen.getByTestId("leitura-progress")
    // A COPY do convite é PRESERVADA (só o tom mudou, nunca o texto).
    expect(leitura.textContent).toBe("1 sessão te recoloca no ritmo")
    // SH-2.5 — não existe mais gradiente mild/severe: fora da faixa de 5% é "behind".
    expect(leitura.getAttribute("data-tone")).toBe("behind")
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

describe("leituraFor — espelha winnerOf, faixa de tolerância de 5% (SH-2.5)", () => {
  it("win/tie/behind/none", () => {
    expect(leituraFor("sessions", 7, 5, "higher")).toEqual({
      text: "acima da média",
      tone: "win",
    })
    expect(leituraFor("progress", 50, 50, "higher")).toEqual({
      text: "no ritmo da turma",
      tone: "tie",
    })
    // SH-2.5 — gap enorme (engajamento 8 vs 40, ~80%): behind único, sem gradiente.
    expect(leituraFor("engagement", 8, 40, "higher")).toEqual({
      text: "vamos engajar mais?",
      tone: "behind",
    })
    // Gap moderado (Progresso 50 vs 55, ~9%, fora da faixa de 5%) → MESMO tom "behind".
    expect(leituraFor("progress", 50, 55, "higher")).toEqual({
      text: "1 sessão te recoloca no ritmo",
      tone: "behind",
    })
    expect(leituraFor("reflections", null, 3, "higher")).toEqual({ text: "—", tone: "none" })
  })
})

// ---------------------------------------------------------------------------
// SH-2.7 (Hugo 2026-07-19, caso Rinaldo) — o FREIO absoluto de ritmo esperado.
// "Acima de uma Turma ruim" não é a mesma coisa que "no próprio ritmo": um aluno
// pode vencer `winnerOf` (relativo) e ainda estar abaixo do que a própria trilha
// esperava dele a esta altura (`ownPaceOk === false`). O tom nunca vira `win`
// nesse caso — cai para `tie`, nunca é punido com `behind` (a regra só CONTÉM
// elogio indevido, nunca piora quem já estava atrás).
// ---------------------------------------------------------------------------
describe("effectiveWinnerFor — freio absoluto de ritmo esperado (SH-2.7)", () => {
  it("subject vence a Turma E está no próprio ritmo (ownPaceOk true) → mantém 'subject'", () => {
    expect(effectiveWinnerFor("subject", true)).toBe("subject")
  })

  it("subject vence a Turma MAS está abaixo do próprio ritmo (ownPaceOk false) → rebaixa para null", () => {
    expect(effectiveWinnerFor("subject", false)).toBeNull()
  })

  it("ownPaceOk ausente (sem dado de trilha) → comportamento intocado, mantém 'subject'", () => {
    expect(effectiveWinnerFor("subject", undefined)).toBe("subject")
  })

  it("nunca PIORA quem já está atrás da Turma (winner 'reference' + ownPaceOk false continua 'reference')", () => {
    expect(effectiveWinnerFor("reference", false)).toBe("reference")
  })

  it("tie genuíno (winner null) não é afetado pelo freio, com qualquer ownPaceOk", () => {
    expect(effectiveWinnerFor(null, false)).toBeNull()
    expect(effectiveWinnerFor(null, true)).toBeNull()
  })
})

describe("leituraFor — freio absoluto de ritmo esperado, ownPace (SH-2.7/2.7.1)", () => {
  it("vence a Turma E está no próprio ritmo → tone win, copy normal (comportamento intocado)", () => {
    expect(
      leituraFor("reflections", 8, 4, "higher", undefined, { ok: true, actualPct: 40 }),
    ).toEqual({
      text: "acima da média",
      tone: "win",
    })
  })

  it("caso Rinaldo (reprodução com os NÚMEROS REAIS): Reflexões 8/41 (Você) vs 4 (Turma), mas abaixo do próprio ritmo esperado → tone tie, NUNCA win, copy QUANTIFICADA com o % real (SH-2.7.1)", () => {
    // Dado real (Supabase, tenant CORY, 2026-07-19): Rinaldo tem 8 reflexões de um
    // teto de 41 (8/41 ≈ 19,5121...%), Turma faz em média 4, mas seu ritmo esperado
    // à altura da trilha é 33% — 19,5% < 33% → abaixo do PRÓPRIO ritmo, mesmo
    // vencendo a Turma no relativo. `actualPct` é o MESMO valor que `buildRows`
    // calcularia via `fractionPctOf(8, 41)`, não um número arredondado à mão.
    const leitura = leituraFor("reflections", 8, 4, "higher", undefined, {
      ok: false,
      actualPct: (8 / 41) * 100,
    })
    expect(leitura.tone).toBe("tie")
    expect(leitura.tone).not.toBe("win")
    expect(leitura.text).toBe("Acima da turma, mas apenas 19,5% do seu potencial")
    expect(leitura.text).not.toBe("no ritmo da turma") // não é um tie genuíno, seria falso
  })

  it("já está atrás da Turma (winner reference) → tone behind, INDEPENDENTE de ownPace (freio nunca piora)", () => {
    expect(
      leituraFor("progress", 30, 50, "higher", undefined, { ok: false, actualPct: 30 }),
    ).toEqual({
      text: "1 sessão te recoloca no ritmo",
      tone: "behind",
    })
    expect(
      leituraFor("progress", 30, 50, "higher", undefined, { ok: true, actualPct: 30 }),
    ).toEqual({
      text: "1 sessão te recoloca no ritmo",
      tone: "behind",
    })
  })

  it("tie genuíno (dentro da faixa de 5%, sem freio envolvido) usa a copy padrão, não a quantificada", () => {
    expect(
      leituraFor("sessions", 50, 50, "higher", undefined, { ok: false, actualPct: 50 }),
    ).toEqual({
      text: "no ritmo da turma",
      tone: "tie",
    })
  })

  it("SH-2.7.1 — leituraFor É genérica por design: se CHAMADA diretamente com ownPace para 'engagement', o freio se aplica igual às outras chaves (a proteção mora em buildRows, não na função)", () => {
    // A copy quantificada (item 1) não é mais um texto fixo por RowKey
    // (LEITURA_COPY não tem mais `capped`) — é calculada genericamente a partir de
    // `ownPace.actualPct`, então `leituraFor` HONRA `ownPace` para qualquer chave
    // recebida. A garantia de que "engagement nunca é capped na prática" é do
    // CALL SITE (`buildRows` nunca constrói `ownPace` para essa linha) — provada
    // end-to-end no describe "reprodução real do caso Rinaldo" abaixo.
    expect(
      leituraFor("engagement", 8, 4, "higher", undefined, { ok: false, actualPct: 8 }),
    ).toEqual({
      text: "Acima da turma, mas apenas 8,0% do seu potencial",
      tone: "tie",
    })
  })
})

// ---------------------------------------------------------------------------
// SH-2.7 — reprodução END-TO-END do caso real do Rinaldo (Supabase, tenant CORY,
// 2026-07-19), via ComparisonInsightsTable inteira: Reflexões 8/41 (~19,5%) vence
// a Turma 4/41 (~9,75%) no relativo, mas fica abaixo do ritmo esperado (33%,
// elapsedDays≈58,7/deadlineDays=180 da matrícula real) — a linha NÃO pode ler
// "win"/verde. Progresso 50% (Você) segue à frente do próprio ritmo (33%), mas
// atrás da Turma (67%) — o freio não se aplica aí (winner já é "reference").
// ---------------------------------------------------------------------------
describe("ComparisonInsightsTable — reprodução real do caso Rinaldo (SH-2.7)", () => {
  const RINALDO_INDICATORS: StudentHomeIndicators = {
    subject: {
      lastAccessDays: 1,
      progressPct: 50,
      engagement: 7 * 2 + 8, // interactions*2 + reflections = 22
      interactions: 7,
      reflections: 8,
      interactionsMax: 8,
      reflectionsMax: 41,
      // SH-2.7 — ritmo esperado real: elapsedDays≈58,7 / deadlineDays=180 → 33%.
      expectedProgressPct: 33,
    },
    reference: {
      lastAccessAvgDays: 5,
      ritmoEmDiaPct: 50,
      progressAvgPct: 67,
      engagementAvg: 12,
      interactionsAvg: 5,
      reflectionsAvg: 4,
    },
  }

  it("Reflexões: 8/41 vence a Turma 4/41, mas NÃO pode ler win/verde (abaixo do ritmo esperado real) — SH-2.7.1: copy cita o % real, 19,5%", () => {
    render(<ComparisonInsightsTable indicators={RINALDO_INDICATORS} />)
    const leitura = screen.getByTestId("leitura-reflections")
    expect(leitura.getAttribute("data-tone")).toBe("tie")
    expect(leitura.getAttribute("data-tone")).not.toBe("win")
    // 8/41 = 19,5121...% → "19,5%" (1 casa decimal, formato brasileiro).
    expect(leitura.textContent).toBe("Acima da turma, mas apenas 19,5% do seu potencial")
    // O PILL do valor Você também deixa de ser verde (win) — vira âmbar (tie).
    const cell = screen.getByTestId("cell-subject-reflections")
    expect(cell.getAttribute("data-win")).toBe("false")
  })

  it("Progresso: 50% (Você) atrás da Turma (67%) — o freio NUNCA piora, continua behind normalmente", () => {
    render(<ComparisonInsightsTable indicators={RINALDO_INDICATORS} />)
    const leitura = screen.getByTestId("leitura-progress")
    expect(leitura.getAttribute("data-tone")).toBe("behind")
  })

  it("SH-2.7.1 — Engajamento vence a Turma (22 vs 12) e PERMANECE win/verde: buildRows nunca passa ownPace para essa linha, o freio nunca a alcança", () => {
    render(<ComparisonInsightsTable indicators={RINALDO_INDICATORS} />)
    const leitura = screen.getByTestId("leitura-engagement")
    expect(leitura.getAttribute("data-tone")).toBe("win")
    expect(leitura.textContent).not.toContain("do seu potencial")
  })
})

// ---------------------------------------------------------------------------
// SH-2.5 (item 3, Hugo 2026-07-19) — recencyReadingFor: leitura PRÓPRIA da linha
// "Última sessão de estudo", por FAIXA ABSOLUTA de recência, decoupled de
// winnerOf/Turma. `leituraFor("lastAccess", ...)` continua CHAMÁVEL (função pura,
// não removida), mas a TABELA não a usa mais para esta linha — só `recencyReadingFor`.
// ---------------------------------------------------------------------------
describe("recencyReadingFor — faixas absolutas de recência (SH-2.5, item 3)", () => {
  it("<= 7 dias → win ('estudando com frequência')", () => {
    expect(recencyReadingFor(0)).toEqual({
      leitura: { text: "estudando com frequência", tone: "win" },
      winner: "subject",
    })
    expect(recencyReadingFor(7)).toEqual({
      leitura: { text: "estudando com frequência", tone: "win" },
      winner: "subject",
    })
  })

  it("8-30 dias → grau intermediário (tie, âmbar — reusa o tom já existente)", () => {
    expect(recencyReadingFor(8)).toEqual({
      leitura: { text: "faz um tempo que não aparece", tone: "tie" },
      winner: null,
    })
    expect(recencyReadingFor(30)).toEqual({
      leitura: { text: "faz um tempo que não aparece", tone: "tie" },
      winner: null,
    })
  })

  it("> 30 dias → behind ('sumiu da trilha')", () => {
    expect(recencyReadingFor(31)).toEqual({
      leitura: { text: "sumiu da trilha", tone: "behind" },
      winner: "reference",
    })
    expect(recencyReadingFor(90)).toEqual({
      leitura: { text: "sumiu da trilha", tone: "behind" },
      winner: "reference",
    })
  })

  it("null (nunca teve sessão de estudo) → none ('—', SH-2.2 mantido)", () => {
    expect(recencyReadingFor(null)).toEqual({ leitura: { text: "—", tone: "none" }, winner: null })
  })
})

// ---------------------------------------------------------------------------
// AJUSTE 2 (Hugo 2026-07-14) — penúltima visita: sem acesso ANTERIOR à visita
// atual (subject.lastAccessDays null), a célula Você mostra o fallback de "sem
// sessão de estudo ainda". SH-2.2 (Hugo 2026-07-19) — o fallback mudou de
// "Primeiro acesso" para "Ainda sem sessão de estudo": null agora também cobre
// o aluno que já logou várias vezes mas nunca estudou de verdade (caso Angelo),
// não só o literal primeiro login.
// ---------------------------------------------------------------------------
describe("Última sessão de estudo (Você) — estado sem sessão de estudo anterior", () => {
  it("subject.lastAccessDays null → 'Ainda sem sessão de estudo' na célula Você", () => {
    const first = {
      ...INDICATORS,
      subject: { ...INDICATORS.subject, lastAccessDays: null },
    }
    render(<ComparisonInsightsTable indicators={first} />)
    expect(screen.getByTestId("cell-subject-lastAccess").textContent).toBe(
      "Ainda sem sessão de estudo",
    )
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
// SH-2.5 (Hugo 2026-07-19, feedback ao vivo) — `winnerOf` deixou de tratar "tie"
// como igualdade EXATA e passou a usar uma FAIXA DE TOLERÂNCIA relativa de 5%
// (`TONE_THRESHOLDS.tolerancePct`) ao redor da referência. Dentro da faixa → tie
// (null); fora dela → o lado com o sinal correto vence. HISTÓRICO: esta suíte
// testava `behindSeverityOf`/`SEVERE_BEHIND_THRESHOLD` (corte em 30%, distinção
// mild/severe) — REMOVIDOS nesta story (o Hugo pediu explicitamente vermelho
// direto, sem gradiente, fora da faixa de 5%).
// ---------------------------------------------------------------------------
describe("winnerOf — faixa de tolerância de 5% (SH-2.5)", () => {
  it("higher (maior é melhor): dentro de 5% → tie (null)", () => {
    // gap = (subject - reference) / max(reference,1)
    expect(winnerOf(52, 50, "higher")).toBeNull() // 4% → tie
    expect(winnerOf(48, 50, "higher")).toBeNull() // -4% → tie
    expect(winnerOf(52.5, 50, "higher")).toBeNull() // exatamente 5% (limite inclusive) → tie
  })

  it("higher: o caso real do Hugo (Rinaldo, Progresso 50 vs Turma 67, gap ~25%) → 'reference' (vermelho), não mais âmbar mild", () => {
    expect(winnerOf(50, 67, "higher")).toBe("reference")
  })

  it("higher: mais de 5% acima/abaixo → vencedor real, sem gradiente de severidade", () => {
    expect(winnerOf(53, 50, "higher")).toBe("subject") // +6% → win
    expect(winnerOf(47, 50, "higher")).toBe("reference") // -6% → behind (direto, sem mild)
    expect(winnerOf(10, 100, "higher")).toBe("reference") // -90% → behind (mesmo tom do -6%, sem severe)
  })

  it("lower (menor é melhor): dentro de 5% → tie; fora → vencedor real", () => {
    // gap = (reference - subject) / max(reference,1)
    expect(winnerOf(4, 4.2, "lower")).toBeNull() // ~4.76% → tie
    expect(winnerOf(3, 4, "lower")).toBe("subject") // 25% melhor → win
    expect(winnerOf(5, 4, "lower")).toBe("reference") // 25% pior → behind
  })

  it("reference 0 não estoura (divisor Math.max(reference,1))", () => {
    expect(winnerOf(1, 0, "higher")).toBe("subject") // gap 100% → win, sem crash
  })

  it("valor ausente em qualquer lado → null (sem leitura, não é tie)", () => {
    expect(winnerOf(null, 50, "higher")).toBeNull()
    expect(winnerOf(50, null, "higher")).toBeNull()
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
  it("aluno atrás → 'behind' (vermelho, SH-2.5: sem mais distinção mild/severe)", () => {
    expect(subjectPillFor("reference", "behind")).toBe("behind")
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
    expect(cell.textContent).toBe("15 pessoas ativas")
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
// Round 3 (Hugo 2026-07-18, histórico) — severidade de COR (amarelo/vermelho) no
// CHIP e no PILL do valor Você quando atrás. SH-2.5 (Hugo 2026-07-19) — a
// distinção mild/severe foi REMOVIDA: qualquer linha fora da faixa de tolerância
// de 5% (`TONE_THRESHOLDS`) vira "behind" (vermelho direto), independente da
// magnitude do gap. Fixture com 3 linhas atrás por gaps BEM diferentes (14 dias
// de atraso via recência absoluta, 75% e 12,5% via comparação com a Turma) —
// as 3 renderizam o MESMO vermelho agora, prova de que a severidade não
// diferencia mais a cor.
// ---------------------------------------------------------------------------
describe("SH-2.5 — 'behind' único (vermelho direto), sem gradiente, em ≥2 linhas com gaps diferentes", () => {
  const BEHIND: StudentHomeIndicators = {
    ...INDICATORS,
    subject: {
      ...INDICATORS.subject,
      lastAccessDays: 60, // > RECENCY_THRESHOLDS.staleDays (30) → recencyReadingFor → behind
      progressPct: 20, // vs 80 → gap 75%, fora da faixa de 5%
      interactions: 7, // vs 8 → gap 12,5%, TAMBÉM fora da faixa de 5% (antes era "mild")
    },
    reference: {
      ...INDICATORS.reference,
      lastAccessAvgDays: 4,
      progressAvgPct: 80,
      interactionsAvg: 8,
    },
  }

  it("CHIP: última sessão de estudo (recência absoluta), progresso e interações — TODAS vermelhas (semantic-error), mesmo com gaps de magnitudes diferentes", () => {
    render(<ComparisonInsightsTable indicators={BEHIND} />)
    // "Última sessão de estudo" não usa mais winnerOf/Turma (item 3) — 60 dias >
    // staleDays (30) → recencyReadingFor → behind, texto próprio "sumiu da trilha".
    const last = screen.getByTestId("leitura-lastAccess")
    expect(last.getAttribute("data-tone")).toBe("behind")
    expect(last.textContent).toBe("sumiu da trilha")
    expect(last.className).toContain("bg-semantic-error/10")
    expect(last.className).toContain("text-semantic-error")

    const prog = screen.getByTestId("leitura-progress")
    expect(prog.getAttribute("data-tone")).toBe("behind")
    expect(prog.className).toContain("bg-semantic-error/10")

    // SH-2.5 — 12,5% de gap ERA "mild" (âmbar); agora é o MESMO "behind" vermelho.
    const sess = screen.getByTestId("leitura-sessions")
    expect(sess.getAttribute("data-tone")).toBe("behind")
    expect(sess.className).toContain("bg-semantic-error/10")
    expect(sess.className).toContain("text-semantic-error")
  })

  it("PILL do valor Você: as 3 linhas atrás viram pill VERMELHO uniforme (SH-2.5: sem mais vermelho severe vs amarelo mild)", () => {
    render(<ComparisonInsightsTable indicators={BEHIND} />)
    const lastCell = screen.getByTestId("cell-subject-lastAccess")
    expect(lastCell.className).toContain("rounded-full")
    expect(lastCell.className).toContain("bg-semantic-error/10")
    const progCell = screen.getByTestId("cell-subject-progress")
    expect(progCell.className).toContain("bg-semantic-error/10")
    // SH-2.5 — interações (gap 12,5%) também vermelho agora, não mais amarelo.
    const sessCell = screen.getByTestId("cell-subject-sessions")
    expect(sessCell.className).toContain("rounded-full")
    expect(sessCell.className).toContain("bg-semantic-error/10")
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

  it("aparece nas linhas ATRÁS, independente da magnitude do gap (SH-2.5: sem mild/severe): lastAccess, progress, sessions", () => {
    render(<ComparisonInsightsTable indicators={MIXED_TONES} continueHref="/courses/next" />)
    expect(screen.getByTestId("action-lastAccess")).toBeInTheDocument() // behind (recência > 30d)
    expect(screen.getByTestId("action-progress")).toBeInTheDocument() // behind (gap 75%)
    expect(screen.getByTestId("action-sessions")).toBeInTheDocument() // behind (gap 12,5%, antes era mild)
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

  it("presença UNIVERSAL nos 4 tones (win, tie, behind, none), num único fixture", () => {
    // SH-2.5 — só existem 4 tons agora (mild/severe removidos). Fixture desenhado
    // para exibir os 4 de uma vez (sessions e reflections COMPARTILHAM "behind",
    // com gaps de magnitudes bem diferentes — 12,5% e 80% — prova de que a
    // magnitude não diferencia mais o tom):
    //  • lastAccess: null → none
    //  • progress:   50 vs 50 → tie
    //  • sessions:   7 vs 8 (higher, gap 12,5%) → behind
    //  • reflections: 8 vs 40 (higher, gap 80%) → behind
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
    expect(screen.getByTestId("leitura-sessions").getAttribute("data-tone")).toBe("behind")
    expect(screen.getByTestId("leitura-reflections").getAttribute("data-tone")).toBe("behind")
    expect(screen.getByTestId("leitura-engagement").getAttribute("data-tone")).toBe("win")
    for (const key of ["lastAccess", "progress", "sessions", "reflections", "engagement"]) {
      expect(screen.getByTestId(`action-${key}`)).toBeInTheDocument()
    }
  })

  it("label correto por linha (todas as 5, independentemente do status)", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} continueHref="/courses/next" />)
    // No fixture base os tones variam (win/tie/behind), mas o label é fixo por linha.
    expect(screen.getByTestId("action-lastAccess").textContent).toContain("Retomar os estudos")
    expect(screen.getByTestId("action-progress").textContent).toContain("Continuar sessão")
    expect(screen.getByTestId("action-sessions").textContent).toContain("Fazer uma interação")
    expect(screen.getByTestId("action-reflections").textContent).toContain("Registrar uma reflexão")
    expect(screen.getByTestId("action-engagement").textContent).toContain("Continuar agora")
  })

  it("sem interactionHref/reflectionHref: href = o continueHref recebido (todas as 5 linhas apontam para o MESMO destino, fallback)", () => {
    render(<ComparisonInsightsTable indicators={MIXED_TONES} continueHref="/courses/next" />)
    for (const key of ["lastAccess", "progress", "sessions", "reflections", "engagement"]) {
      expect(screen.getByTestId(`action-${key}`).getAttribute("href")).toBe("/courses/next")
    }
  })

  // SH-3.3 (Hugo 2026-07-21) — as 5 linhas deixaram de compartilhar UM destino
  // genérico: "progress"/"sessions"/"engagement" preferem o deep-link REAL da
  // próxima interação pendente; "reflections" prefere o deep-link REAL da
  // próxima reflexão pendente; "lastAccess" continua no continueHref genérico
  // (não é uma pendência endereçável). Ambos os deep-links caem para o
  // continueHref genérico quando ausentes/null (achado secundário corrigido:
  // as 5 linhas já não colidiam num único destino não-endereçável).
  it("com interactionHref/reflectionHref: cada linha aponta para o deep-link REAL da sua própria pendência", () => {
    render(
      <ComparisonInsightsTable
        indicators={MIXED_TONES}
        continueHref="/courses/next"
        interactionHref="/courses/course-x/chapters/ch-x?focus=interaction"
        reflectionHref="/courses/course-x/chapters/ch-x?focus=reflection&slideId=sl-x"
      />,
    )
    expect(screen.getByTestId("action-lastAccess").getAttribute("href")).toBe("/courses/next")
    expect(screen.getByTestId("action-progress").getAttribute("href")).toBe(
      "/courses/course-x/chapters/ch-x?focus=interaction",
    )
    expect(screen.getByTestId("action-sessions").getAttribute("href")).toBe(
      "/courses/course-x/chapters/ch-x?focus=interaction",
    )
    expect(screen.getByTestId("action-engagement").getAttribute("href")).toBe(
      "/courses/course-x/chapters/ch-x?focus=interaction",
    )
    expect(screen.getByTestId("action-reflections").getAttribute("href")).toBe(
      "/courses/course-x/chapters/ch-x?focus=reflection&slideId=sl-x",
    )
  })

  it("interactionHref/reflectionHref null (sem pendência real) → degrada graciosamente pro continueHref, nunca um slideId inexistente", () => {
    render(
      <ComparisonInsightsTable
        indicators={MIXED_TONES}
        continueHref="/courses/next"
        interactionHref={null}
        reflectionHref={null}
      />,
    )
    for (const key of ["progress", "sessions", "engagement", "reflections"]) {
      expect(screen.getByTestId(`action-${key}`).getAttribute("href")).toBe("/courses/next")
    }
  })

  it("REESCRITO MAIS UMA VEZ (Hugo, 2026-07-31): a cor do botão VOLTA a variar por tom, revertendo o Round 27", () => {
    // HISTÓRICO desta mesma asserção: Round 6 afirmava cor cerrado fixa para todos; Round 7
    // reverteu para a cor espelhar leitura.tone; Round 12 moveu a cor pro fundo sólido; Round
    // 21→22 ajustou o tom win; Round 27 (Hugo, ao vivo, "esses botões estão todos bugados")
    // unificou os 5 na identidade do mundo. Hugo, 2026-07-31, reversão consciente do Round 27:
    // "gostaria que os botões de ação voltassem para as cores do status" — MIXED_TONES tem
    // engagement=win (verde) e progress/sessions=behind (vermelho), classes DISTINTAS de novo.
    render(<ComparisonInsightsTable indicators={MIXED_TONES} continueHref="/courses/next" />)
    const engagement = screen.getByTestId("action-engagement").className // win
    expect(engagement).toContain("bg-semantic-success")
    expect(engagement).toContain("text-white")
    for (const key of ["progress", "sessions"]) {
      const cls = screen.getByTestId(`action-${key}`).className // behind
      expect(cls).toContain("bg-semantic-error")
      expect(cls).toContain("text-white")
      // nenhum resquício da identidade única do mundo do Round 27.
      expect(cls).not.toContain("bg-[var(--world-accent)]")
    }
  })

  it("sem continueHref → cai no default seguro DEFAULT_CONTINUE_HREF (não quebra call sites)", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(screen.getByTestId("action-progress").getAttribute("href")).toBe(DEFAULT_CONTINUE_HREF)
  })
})

// ---------------------------------------------------------------------------
// ROUND 7 (Hugo 2026-07-18) — HISTÓRICO, SUBSTITUÍDO NO ROUND 27 ABAIXO. Até a Round 6 o
// botão era SEMPRE cerrado/laranja (cor fixa); a Round 7 fez a cor de FUNDO do botão
// espelhar o `leitura.tone` da MESMA linha (win=verde, tie=neutro/âmbar, behind=vermelho,
// none=cerrado fallback), relação que durou até o Round 22.
//
// ROUND 27 (Hugo 2026-07-28, ao vivo em localhost:3002, screenshot): "esses botões estão
// todos bugados, e não estão funcionando" — o arco-íris por linha (verde/âmbar/vermelho
// conforme o tom) fazia um CTA de ação parecer um estado de erro (um botão vermelho não lê
// como "clique aqui para continuar"). A cor do botão deixou de variar por tom: os 5 CTAs
// agora usam a MESMA classe, a identidade do mundo (`--world-accent`/`--world-accent-fg`,
// ver `ACTION_BUTTON_CLASS` no componente). A severidade por linha CONTINUA visível — só que
// no chip "Como estou" (LEITURA_CHIP, intocado) e no pill do valor Você (VALUE_PILL,
// intocado); `data-tone` no botão também permanece (introspecção), só a classe visual mudou.
// A fixture ALL_TONES abaixo (5 tons distintos numa única leitura) é reaproveitada para
// provar exatamente isso: tons diferentes, MESMA cor de botão.
// ---------------------------------------------------------------------------
describe("Round 7 → Round 27 — o botão de ação NÃO varia mais por tom (identidade do mundo)", () => {
  // Fixture que exibe os 5 estados de uma vez (mesmo desenho do teste Round 6
  // 'presença UNIVERSAL nos 4 tones + none'):
  //  • lastAccess: null → none
  //  • progress:   50 vs 50 → tie
  //  • sessions:   7 vs 8 (higher) → behind
  //  • reflections: 8 vs 40 (higher) → behind
  //  • engagement: 14 vs 9 (higher) → win
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

  it("[2026-07-31] os 5 tons (win/tie/behind×2/none) voltam a produzir classes DISTINTAS de botão — reversão do Round 27", () => {
    render(<ComparisonInsightsTable indicators={ALL_TONES} continueHref="/courses/next" />)
    // sanidade: os 5 tons SÃO de fato distintos na leitura (o chip prova) — a fixture
    // continua cobrindo win/tie/behind/behind/none como antes.
    expect(screen.getByTestId("leitura-engagement").getAttribute("data-tone")).toBe("win")
    expect(screen.getByTestId("leitura-progress").getAttribute("data-tone")).toBe("tie")
    expect(screen.getByTestId("leitura-sessions").getAttribute("data-tone")).toBe("behind")
    expect(screen.getByTestId("leitura-reflections").getAttribute("data-tone")).toBe("behind")
    expect(screen.getByTestId("leitura-lastAccess").getAttribute("data-tone")).toBe("none")

    // Hugo, 2026-07-31: o botão volta a espelhar `leitura.tone` (reverte o Round
    // 27). win/tie/behind produzem classes DIFERENTES entre si; os 2 "behind"
    // (sessions/reflections) compartilham a MESMA classe entre si; "none"
    // (lastAccess) permanece na identidade do mundo, o fallback que sempre foi.
    expect(screen.getByTestId("action-engagement").className).toContain("bg-semantic-success")
    expect(screen.getByTestId("action-progress").className).toContain("bg-semantic-warning")
    expect(screen.getByTestId("action-sessions").className).toContain("bg-semantic-error")
    expect(screen.getByTestId("action-reflections").className).toContain("bg-semantic-error")
    expect(screen.getByTestId("action-lastAccess").className).toContain("bg-[var(--world-accent)]")
  })

  it("data-tone no botão CONTINUA refletindo a leitura da linha (introspecção), mesmo sem mudar a cor visual", () => {
    render(<ComparisonInsightsTable indicators={ALL_TONES} continueHref="/courses/next" />)
    expect(screen.getByTestId("action-engagement").getAttribute("data-tone")).toBe("win")
    expect(screen.getByTestId("action-progress").getAttribute("data-tone")).toBe("tie")
    expect(screen.getByTestId("action-sessions").getAttribute("data-tone")).toBe("behind")
    expect(screen.getByTestId("action-reflections").getAttribute("data-tone")).toBe("behind")
    expect(screen.getByTestId("action-lastAccess").getAttribute("data-tone")).toBe("none")
  })

  it("label/ícone/href PRESERVADOS independente do tom (só a cor deixou de variar)", () => {
    render(<ComparisonInsightsTable indicators={ALL_TONES} continueHref="/courses/next" />)
    // As 5 linhas com 5 tons distintos: label por linha e href idênticos ao Round 6.
    expect(screen.getByTestId("action-lastAccess").textContent).toContain("Retomar os estudos")
    expect(screen.getByTestId("action-progress").textContent).toContain("Continuar sessão")
    expect(screen.getByTestId("action-sessions").textContent).toContain("Fazer uma interação")
    expect(screen.getByTestId("action-reflections").textContent).toContain("Registrar uma reflexão")
    expect(screen.getByTestId("action-engagement").textContent).toContain("Continuar agora")
    for (const key of ["lastAccess", "progress", "sessions", "reflections", "engagement"]) {
      expect(screen.getByTestId(`action-${key}`).getAttribute("href")).toBe("/courses/next")
    }
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
    expect(cell.textContent).toBe("15 pessoas ativas")
    expect(cell.className).toContain("text-sm")
    expect(cell.className).toContain("font-medium")
    expect(cell.className).not.toContain("text-xs")
  })

  it("(3) [Round 12→27→2026-07-31] pill sólida POR TOM voltou: engagement (win) usa bg-semantic-success, não mais a identidade do mundo do Round 27", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} continueHref="/courses/next" />)
    // No fixture base, engagement vence a média → win. O Round 27 (Hugo 2026-07-28)
    // uniformizou a cor do botão pra identidade do mundo; o Hugo REVERTEU essa
    // decisão em 2026-07-31 ("gostaria que os botões de ação voltassem para as
    // cores do status") — o botão volta a espelhar `leitura.tone`, como no
    // Round 12. `data-tone` sempre refletiu a leitura, em qualquer rodada.
    const btn = screen.getByTestId("action-engagement")
    expect(btn.getAttribute("data-tone")).toBe("win")
    expect(btn.className).toContain("bg-semantic-success")
    expect(btn.className).toContain("text-white")
    expect(btn.className).not.toContain("bg-[var(--world-accent)]")
  })

  it("(3) [2026-07-31] a RELAÇÃO de cor por tom (Round 7) VOLTOU — win/behind/behind produzem classes DISTINTAS de novo", () => {
    render(<ComparisonInsightsTable indicators={ALL_TONES_R8} continueHref="/courses/next" />)
    // Hugo, 2026-07-31, reversão consciente do Round 27: "gostaria que os botões
    // de ação voltassem para as cores do status, ou seja, se naquela análise
    // está amarelo, coloca o botão amarelo". win → verde, behind → vermelho —
    // famílias distintas de novo (o Round 27 as unificava em --world-accent).
    const win = screen.getByTestId("action-engagement").className
    const behindA = screen.getByTestId("action-reflections").className
    const behindB = screen.getByTestId("action-sessions").className
    expect(win).toContain("bg-semantic-success")
    expect(behindA).toContain("bg-semantic-error")
    expect(behindB).toContain("bg-semantic-error")
    // os 2 "behind" compartilham a MESMA classe entre si, mas win ≠ behind.
    expect(behindA).toBe(behindB)
    expect(win).not.toBe(behindA)
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

  it("Round 13 — MAGREZA idêntica ao gestor: px-3.5 py-1.5 font-semibold, sem h-8 fixo", () => {
    // Replicação EXATA do botão do card do gestor (student-insights-table.tsx). A "gordura"
    // do Round 12 era o h-8 fixo + justify-center (centralização VERTICAL forçada por causa da
    // altura fixa) + font-bold; agora é o py-1.5 fluido enxuto.
    // ROUND 24 — `justify-center` REAPARECE na classe, mas por um motivo DIFERENTE do que o
    // Round 13 removeu: não é mais para centralizar verticalmente dentro de uma altura fixa
    // (`h-8`, que segue ausente), é para centralizar HORIZONTALMENTE o conteúdo (ícone+texto+
    // seta) dentro da largura fixa. A "gordura" que o Round 13 corrigiu era a combinação
    // h-8+justify-center+font-bold; sem `h-8` e sem `font-bold`, o botão continua magro.
    // ROUND 25 — `text-xs` SAIU da classe base do botão: o tamanho do TEXTO agora varia por
    // rótulo (ver describe "Round 25" abaixo), então esta checagem não pode mais assumir
    // `text-xs` em TODAS as 5 linhas — só "engagement" (o rótulo mais curto) ainda usa
    // `text-xs`. `px-3.5`/`py-1.5`/`font-semibold` continuam idênticos ao gestor em TODOS os
    // botões (propriedades do CONTAINER, não do texto).
    render(<ComparisonInsightsTable indicators={INDICATORS} continueHref="/courses/next" />)
    for (const key of ["lastAccess", "progress", "sessions", "reflections", "engagement"]) {
      const cls = screen.getByTestId(`action-${key}`).className
      expect(cls).toContain("px-3.5")
      expect(cls).toContain("py-1.5")
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

  it("[2026-07-31] o FUNDO SÓLIDO VOLTA a seguir a relação de cor por tom (reversão do Round 27) — win/behind têm classes DISTINTAS", () => {
    render(<ComparisonInsightsTable indicators={ALL_TONES_R8} continueHref="/courses/next" />)
    const win = screen.getByTestId("action-engagement").className
    const behindA = screen.getByTestId("action-reflections").className
    const behindB = screen.getByTestId("action-sessions").className
    expect(win).toContain("bg-semantic-success")
    expect(behindA).toContain("bg-semantic-error")
    expect(behindB).toContain("bg-semantic-error")
    expect(win).not.toContain("bg-[var(--world-accent)]")
  })

  it("label e href PRESERVADOS (o ícone é aditivo, não substitui texto/destino)", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} continueHref="/courses/next" />)
    expect(screen.getByTestId("action-lastAccess").textContent).toContain("Retomar os estudos")
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

  it("[2026-07-31] a relação cor↔tom (Round 7) VOLTOU (reversão do Round 27) — os 5 tons produzem famílias de cor DISTINTAS", () => {
    const allTones: StudentHomeIndicators = {
      ...INDICATORS,
      subject: {
        ...INDICATORS.subject,
        lastAccessDays: null, // none
        progressPct: 50, // tie
        interactions: 7, // behind (gap 12,5%, fora da faixa de 5%)
        reflections: 8, // behind (gap 80%)
        engagement: 14, // win
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
    // Hugo, 2026-07-31: "se naquela análise está amarelo, coloca o botão
    // amarelo" — cada tom volta a produzir a PRÓPRIA família de cor.
    expect(screen.getByTestId("action-engagement").className).toContain("bg-semantic-success") // win
    expect(screen.getByTestId("action-reflections").className).toContain("bg-semantic-error") // behind
    expect(screen.getByTestId("action-sessions").className).toContain("bg-semantic-error") // behind
    expect(screen.getByTestId("action-progress").className).toContain("bg-semantic-warning") // tie
    expect(screen.getByTestId("action-lastAccess").className).toContain("bg-[var(--world-accent)]") // none (fallback, sempre foi)
  })

  it("[2026-07-31] contraste por tom: win/tie/behind usam texto branco sobre a cor sólida do tom; 'none' mantém o par --world-accent-fg de sempre", () => {
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
    // Hugo, 2026-07-31 — reversão do Round 27: win/tie/behind voltam a ter fundo
    // sólido por tom, e os 3 usam texto branco (`ACTION_BUTTON_BY_TONE`,
    // comparison-insights-table.tsx). "none" (sem leitura possível) continua no
    // fallback --world-accent/--world-accent-fg de sempre — não é um tom "por
    // status", é a ausência de status.
    for (const key of ["engagement", "reflections", "sessions", "progress"]) {
      const cls = screen.getByTestId(`action-${key}`).className
      expect(cls).toContain("text-white")
    }
    const noneCls = screen.getByTestId("action-lastAccess").className
    expect(noneCls).toContain("text-[var(--world-accent-fg)]")
    expect(noneCls).not.toContain("text-white")
  })

  it("os 5 RÓTULOS específicos por métrica PRESERVADOS (não viraram genéricos por status)", () => {
    // Decisão explícita do Hugo (Round 12): adotar o peso da referência, MAS manter os
    // rótulos específicos por métrica — não os genéricos "Lembrar"/"No ritmo"/"Acionar".
    render(<ComparisonInsightsTable indicators={INDICATORS} continueHref="/courses/next" />)
    expect(screen.getByTestId("action-lastAccess").textContent).toContain("Retomar os estudos")
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
  it("SUPERSEDIDO no Round 25→26 — min-w-[220px] virou w-[205px] fixo (ver describe 'Round 25→26' abaixo)", () => {
    // Round 24 usava min-w (um PISO): rótulos mais longos que o mínimo continuavam
    // expandindo o botão além dele, o que na prática manteve os 5 botões com larguras
    // diferentes (o próprio Hugo detectou isso no screenshot seguinte). O Round 25 trocou
    // para largura REAL fixa + fonte variável por rótulo; o Round 26 subiu essa largura de
    // 180px para 205px (mais espaço, fontes maiores) — a prova de simetria de verdade vive
    // no describe "Round 25→26" abaixo.
    render(<ComparisonInsightsTable indicators={ALL_TONES_R8} continueHref="/courses/next" />)
    for (const key of ["lastAccess", "progress", "sessions", "reflections", "engagement"]) {
      const cls = screen.getByTestId(`action-${key}`).className
      expect(cls).not.toContain("min-w-[220px]")
      expect(cls).toContain("w-[205px]")
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

  it("labels/href/ícones PRESERVADOS (só largura e centralização mudaram; cor por tom voltou em 2026-07-31)", () => {
    render(<ComparisonInsightsTable indicators={ALL_TONES_R8} continueHref="/courses/next" />)
    expect(screen.getByTestId("action-engagement").textContent).toContain("Continuar agora")
    expect(screen.getByTestId("action-engagement").getAttribute("href")).toBe("/courses/next")
    expect(screen.getByTestId("action-engagement").className).toContain("bg-semantic-success") // win
    expect(screen.getByTestId("action-reflections").className).toContain("bg-semantic-error") // behind
  })
})

// ---------------------------------------------------------------------------
// ROUND 25 (Hugo 2026-07-18, novo screenshot da coluna "Ação"): "ainda não tá simétrico...
// faça com que os textos sejam com tamanho variável, para manter o tamanho dos botões
// padronizados" — o INVERSO do Round 24 (que usava `min-w`, um PISO): agora a largura é
// REAL fixa e o TAMANHO DA FONTE do rótulo varia por linha (`ACTION_LABEL_SIZE`) para cada
// texto caber numa única linha. Ícone e seta mantêm o MESMO tamanho sempre.
// ROUND 26 (Hugo 2026-07-18, "pode aumentar um pouco o tamanho"): a largura fixa e a
// progressão de fonte SUBIRAM (w-[180px]→w-[205px], 12→11→10→9→8px virou 14→13→12→11→10px),
// mesmo mecanismo do Round 25, só os valores calculados mudaram — ver ActionButton/
// ACTION_LABEL_SIZE no componente para a conta completa.
// ---------------------------------------------------------------------------
describe("Round 25→26 — largura REAL fixa (w-[205px]) + fonte do rótulo variável por linha", () => {
  it("os 5 botões têm a MESMA largura FIXA (w-[205px], Round 26), não apenas um piso mínimo", () => {
    render(<ComparisonInsightsTable indicators={ALL_TONES_R8} continueHref="/courses/next" />)
    for (const key of ["lastAccess", "progress", "sessions", "reflections", "engagement"]) {
      const cls = screen.getByTestId(`action-${key}`).className
      expect(cls).toContain("w-[205px]")
      // NÃO é min-w (piso) — é largura de verdade, igual nos 5, independente do rótulo.
      expect(cls).not.toContain("min-w-")
    }
  })

  it("o TEXTO do rótulo varia de tamanho por linha, conforme ACTION_LABEL_SIZE (Round 26: progressão +2px)", () => {
    render(<ComparisonInsightsTable indicators={ALL_TONES_R8} continueHref="/courses/next" />)
    // Progressão limpa 14→13→12→11→10px (Round 26; era 12→11→10→9→8 no Round 25), do rótulo
    // mais curto ao mais longo (ver cálculo no comentário de ActionButton/ACTION_LABEL_SIZE).
    expect(screen.getByTestId("action-engagement-label").className).toContain("text-sm")
    expect(screen.getByTestId("action-progress-label").className).toContain("text-[13px]")
    expect(screen.getByTestId("action-lastAccess-label").className).toContain("text-xs")
    expect(screen.getByTestId("action-sessions-label").className).toContain("text-[11px]")
    expect(screen.getByTestId("action-reflections-label").className).toContain("text-[10px]")
  })

  it("o ícone semântico e a seta (ArrowRight) mantêm o MESMO tamanho em TODAS as linhas — só o texto varia", () => {
    render(<ComparisonInsightsTable indicators={ALL_TONES_R8} continueHref="/courses/next" />)
    for (const key of ["lastAccess", "progress", "sessions", "reflections", "engagement"]) {
      const icon = screen.getByTestId(`action-icon-${key}`)
      // lucide-react aplica width/height (px) via o prop `size`, não CSS font-size — o
      // tamanho do glifo é IDÊNTICO nas 5 linhas, mesmo com o texto ao lado em tamanhos
      // diferentes.
      expect(icon.getAttribute("width")).toBe("14")
      expect(icon.getAttribute("height")).toBe("14")
    }
    // A seta ArrowRight (sem testid próprio) é o 2º <svg> dentro do botão; mesma checagem.
    const svgs = screen.getByTestId("action-reflections").querySelectorAll("svg")
    expect(svgs[1]?.getAttribute("width")).toBe("11")
    expect(svgs[1]?.getAttribute("height")).toBe("11")
  })

  it("whitespace-nowrap (Round 24) PERMANECE — nenhum rótulo quebra linha mesmo com fonte reduzida", () => {
    render(<ComparisonInsightsTable indicators={ALL_TONES_R8} continueHref="/courses/next" />)
    for (const key of ["lastAccess", "progress", "sessions", "reflections", "engagement"]) {
      expect(screen.getByTestId(`action-${key}`).className).toContain("whitespace-nowrap")
    }
  })

  it("o rótulo mais LONGO ('Registrar uma reflexão', o menor tamanho de fonte) continua renderizando por INTEIRO, sem truncar", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} continueHref="/courses/next" />)
    const label = screen.getByTestId("action-reflections-label")
    expect(label.textContent).toBe("Registrar uma reflexão")
    // Round 26 — subiu de text-[8px] para text-[10px] (visivelmente maior/mais confortável).
    expect(label.className).toContain("text-[10px]")
  })

  it("labels/href PRESERVADOS (só a fonte do texto e a largura do botão mudaram; cor por tom voltou em 2026-07-31)", () => {
    render(<ComparisonInsightsTable indicators={ALL_TONES_R8} continueHref="/courses/next" />)
    expect(screen.getByTestId("action-engagement-label").textContent).toBe("Continuar agora")
    expect(screen.getByTestId("action-engagement").getAttribute("href")).toBe("/courses/next")
    expect(screen.getByTestId("action-engagement").className).toContain("bg-semantic-success") // win
    expect(screen.getByTestId("action-reflections").className).toContain("bg-semantic-error") // behind
  })
})

// ---------------------------------------------------------------------------
// B.3/B.4/B.9 — feat-percorrido-na-tela-do-aluno (Hugo 2026-07-31).
//
// LEIA ANTES DE "CONSERTAR" QUALQUER UM DESTES: eles guardam DECISÕES, não
// detalhes visuais. Em especial B.3: a linha Percorrido é a ÚNICA sem botão de
// ação, e isso vai parecer esquecimento para quem vier depois. Não é.
// ---------------------------------------------------------------------------

describe("B.3 — o Percorrido NÃO tem botão de ação (de propósito)", () => {
  // O porquê, na voz do Hugo (2026-07-31): "o percorrido só existe porque
  // mesmo existindo e cobrando, tem pessoas que ainda não interagem, mas
  // 'brigam' pois 'completaram o curso'". Ou seja: o Percorrido é EVIDÊNCIA,
  // não meta. Dar a ele um CTA o transformaria em mais uma barra a encher, e
  // ensinaria o comportamento que a medida existe para expor: passar slides.
  // Reverter isto exige decisão NOVA do Hugo, não um ajuste de UI.
  const withPercorrido: StudentHomeIndicators = {
    ...INDICATORS,
    subject: { ...INDICATORS.subject, percorridoPct: 100 },
    reference: { ...INDICATORS.reference, percorridoAvgPct: 82 },
  }

  it("a linha Percorrido não renderiza NENHUM botão de ação", () => {
    render(<ComparisonInsightsTable indicators={withPercorrido} studentFirstName="Rinaldo" />)

    const row = screen.getByTestId("row-percorrido")
    expect(row.querySelector("a")).toBeNull()
    expect(row.querySelector("button")?.getAttribute("aria-label")).toMatch(/Sobre a coluna/)
  })

  it("todas as OUTRAS linhas continuam tendo botão de ação", () => {
    render(<ComparisonInsightsTable indicators={withPercorrido} studentFirstName="Rinaldo" />)

    for (const key of ["lastAccess", "progress", "sessions", "reflections", "engagement"]) {
      expect(screen.getByTestId(`row-${key}`).querySelector("a")).not.toBeNull()
    }
  })
})

describe("B.4 — 'Continuar sessão' aparece no máximo UMA vez", () => {
  it("sem CTA no Percorrido, some a duplicação em linhas seguidas", () => {
    // O protótipo colocava "Continuar sessão" em Percorrido E Conclusão, uma
    // embaixo da outra. Com B.3 o problema desaparece por construção.
    render(
      <ComparisonInsightsTable
        indicators={{
          ...INDICATORS,
          subject: { ...INDICATORS.subject, percorridoPct: 100 },
          reference: { ...INDICATORS.reference, percorridoAvgPct: 82 },
        }}
        studentFirstName="Rinaldo"
      />,
    )

    expect(screen.queryAllByText("Continuar sessão").length).toBeLessThanOrEqual(1)
  })
})

describe("B.9 — ausência de percorrido é 'sem dado', NUNCA 0%", () => {
  // Zero mentiria sobre quem estudou ANTES da instrumentação existir. É a
  // mesma regra já valendo na tabela do gestor.
  it("percorridoPct ausente → 'sem dado' nas duas colunas, sem '0%'", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} studentFirstName="Rinaldo" />)

    const row = screen.getByTestId("row-percorrido")
    expect(row.textContent).toContain("sem dado")
    expect(row.textContent).not.toContain("0%")
  })

  it("percorridoPct presente → mostra o percentual real", () => {
    render(
      <ComparisonInsightsTable
        indicators={{
          ...INDICATORS,
          subject: { ...INDICATORS.subject, percorridoPct: 100 },
          reference: { ...INDICATORS.reference, percorridoAvgPct: 82 },
        }}
        studentFirstName="Rinaldo"
      />,
    )

    const row = screen.getByTestId("row-percorrido")
    expect(row.textContent).toContain("100%")
    expect(row.textContent).toContain("82%")
  })
})

describe("B.6 — a ajuda de Percorrido e Conclusão explica a DIFERENÇA entre si", () => {
  it("o texto de cada um cita o outro (a confusão é entre os dois)", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} studentFirstName="Rinaldo" />)

    fireEvent.click(screen.getByRole("button", { name: "Sobre a coluna Percorrido" }))
    expect(screen.getByRole("note").textContent).toMatch(/slides/i)

    fireEvent.click(screen.getByRole("button", { name: "Sobre a coluna Conclusão" }))
    expect(screen.getByRole("note").textContent).toMatch(/percorrid/i)
  })
})
