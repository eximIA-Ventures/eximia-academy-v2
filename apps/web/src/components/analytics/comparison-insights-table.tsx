// ---------------------------------------------------------------------------
// ComparisonInsightsTable — "Meu ritmo": formato TRANSPOSTO (Hugo 2026-07-14,
// redesenhado em SH-1.5 2026-07-18)
// ---------------------------------------------------------------------------
// Redesign aprovado: uma linha POR INDICADOR, colunas fixas
//   | Indicador | Você (Eu {nome}) | Turma | Como estou |
// 5 linhas, na ordem exata do mockup do Hugo (SH-1.5): Última atividade ·
// Progresso - conclusão · Interações realizadas · Reflexões realizadas ·
// Engajamento. (Engajamento voltou a ser LINHA PRÓPRIA em SH-1.5, como score
// absoluto comparável Você vs Turma; antes de SH-1.5 ele ficava fora da tabela.)
//
// FRAÇÃO GRACIOSA X/Y (SH-1.5, Round 2 Hugo 2026-07-18: nos DOIS lados agora):
//   • Interações realizadas → Você "{interactions}/{interactionsMax}" (Y = capítulos
//     da trilha do aluno); Turma "{interactionsAvg}/{interactionsMaxAvg}" (Y = média
//     dos tetos da org).
//   • Reflexões realizadas  → Você "{reflections}/{reflectionsMax}" (Y = slides com
//     reflexão possível da trilha); Turma "{reflectionsAvg}/{reflectionsMaxAvg}".
//   Cada lado degrada ao absoluto "X" quando o denominador vem ausente/0, sem
//   NaN/crash (formatFraction).
//   Engajamento é ASSIMÉTRICO (Round 2): a célula VOCÊ mostra o RANKING (formatRank,
//   "3º de N", NÃO mais a pontuação), a célula TURMA mostra a média como fração X/Y
//   (formatFraction com engagementMaxAvg). O vencedor/cor/leitura da linha continuam
//   sobre os SCORES brutos (s.engagement vs r.engagementAvg), só o texto muda.
//
// COMO ESTOU — a 4ª coluna (renomeada de "Leitura" em SH-1.5) traduz o vencedor
// de cada indicador (winnerOf) em um CHIP TONAL compacto, com frases mais longas.
// (Round 2, Hugo 2026-07-18: o prefixo "…" foi REMOVIDO de todas as frases; o
// texto começa direto pela palavra.)
//   • aluno acima  → reforço, verde suave + TrendingUp ("acima da média",
//     "ritmo acima da média", "ativo acima da média");
//   • empate       → neutro + Minus ("no ritmo da turma");
//   • aluno abaixo → NUNCA punitivo, sempre acionável, tom cerrado (convite) +
//     seta ("vamos retomar?", "1 sessão te recoloca no ritmo"). Jamais vermelho.
//   A linha Engajamento tem tratamento ESPECIAL: a frase "1º da turma –
//   Parabéns!" só aparece quando o backend confirma rank real = 1 (sem empate),
//   via `subject.isTopEngagement === true` (AC7). Nunca hardcoded, nunca
//   aproximado — qualquer outro caso cai no fallback padrão win/tie/behind.
//
// DESTAQUE DO VALOR VENCEDOR (Hugo, iterado 2026-07-14): quando o ALUNO vence
// o indicador, o VALOR da coluna Eu volta ao PILL original (cápsula
// semantic-success com texto branco, o mesmo estilo de antes do formato
// transposto — o texto verde solto foi rejeitado). O valor destaca, o chip
// interpreta. Empate/derrota ficam neutros; a coluna Turma nunca destaca.
//
// SEM setas de ordenação (não se ordena uma tabela transposta) e SEM a coluna
// "Onde você está" (removida no formato transposto).
//
// WINNER-PER-INDICATOR (direction-aware, alimenta a Como estou e o destaque acima):
//   • Progresso / Interações / Reflexões / Engajamento → MAIOR vence.
//   • Última atividade → MENOR vence (recência invertida).
// Empate ou valor ausente não gera leitura de vitória/convite.
//
// PARÁGRAFO-RESUMO (SH-1.5): a frase pessoal abaixo da tabela é composta pela
// função pura `buildRitmoSummary` (ritmo-summary.ts), fora deste arquivo — o
// container (StudentHomeCard) chama e renderiza. Ver aquele módulo.
//
// Pure presentation. Card-less: o container (StudentHomeCard) é dono do Card,
// do subtítulo e do toggle Visão detalhada/Gráficos. Labels parametrizáveis:
// `studentFirstName` vira o cabeçalho da coluna do sujeito ("Eu (Rinaldo)";
// num drill de gestor, o nome do aluno), degradando para "Você".
// ---------------------------------------------------------------------------

import type { StudentHomeIndicators } from "@/types/analytics"
import type { LucideIcon } from "lucide-react"
import { ArrowRight, Minus, TrendingUp } from "lucide-react"

const WIN_BG = "var(--color-semantic-success)"
const WIN_TEXT = "#ffffff"
const BAR_TRACK = "var(--color-bg-hover)"
const BAR_FILL = "rgba(0, 0, 0, 0.25)"
const BAR_WIN_FILL = "var(--color-semantic-success)"

/** Which side wins an indicator. null = tie, missing, or a no-winner column. */
type Winner = "subject" | "reference" | null

/**
 * The winning side of an indicator, DIRECTION-AWARE (Hugo): "higher" → larger
 * value wins (progresso, sessões, reflexões); "lower" → smaller wins (último
 * acesso, a recência invertida). null on tie or when either value is missing.
 */
export function winnerOf(
  subject: number | null,
  reference: number | null,
  direction: "higher" | "lower",
): Winner {
  if (subject === null || reference === null) return null
  if (subject === reference) return null
  if (direction === "higher") return subject > reference ? "subject" : "reference"
  return subject < reference ? "subject" : "reference"
}

/**
 * PONTO 1 acréscimo (Hugo 2026-07-14) — a label da coluna do sujeito: 1ª pessoa
 * + o PRIMEIRO nome real do aluno logado, "Eu (Rinaldo)". Recebendo o nome
 * completo, usa só o primeiro token; sem nome utilizável degrada para "Você"
 * (o cabeçalho aprovado do formato transposto). Pure.
 */
export function subjectColumnLabel(firstName: string | null | undefined): string {
  const first = firstName?.trim().split(/\s+/)[0]
  return first ? `Eu (${first})` : "Você"
}

/** "há X dias" / "hoje" — for the Último acesso cells. null → placeholder. */
function formatDays(days: number | null, whenNull: string): string {
  if (days === null) return whenNull
  if (days <= 0) return "hoje"
  if (days === 1) return "há 1 dia"
  return `há ${days} dias`
}

// SH-1.5 — a 5ª linha "Engajamento" (score absoluto Você vs Turma). A ordem/labels
// mudam (mockup do Hugo), mas as CHAVES internas preservam os nomes já testados de
// SH-F.5 e agregam `engagement`. `winnerOf`/`leituraFor` seguem intocados.
type RowKey = "lastAccess" | "progress" | "sessions" | "reflections" | "engagement"

/**
 * A coluna "Como estou" (SH-1.5, renomeada de "Leitura") — copy por indicador ×
 * resultado, frases mais longas que o chip antigo (Round 2, Hugo 2026-07-18: sem
 * o prefixo "…", o texto começa direto pela palavra). Regra de tom
 * (Hugo, PRESERVADA): acima = reforço; empate = neutro; abaixo = acionável, nunca
 * punitivo. A linha `engagement` tem tratamento ESPECIAL (rank real, ver
 * `leituraFor`): o `win` genérico aqui só entra quando o aluno vence a média mas
 * NÃO é o #1 real da turma.
 */
const LEITURA_COPY: Record<RowKey, { win: string; tie: string; behind: string }> = {
  lastAccess: {
    win: "ativo acima da média",
    tie: "no ritmo da turma",
    behind: "vamos retomar?",
  },
  progress: {
    win: "ritmo acima da média",
    tie: "no ritmo da turma",
    behind: "1 sessão te recoloca no ritmo",
  },
  sessions: {
    win: "acima da média",
    tie: "no ritmo da turma",
    behind: "que tal mais uma hoje?",
  },
  reflections: {
    win: "acima da média",
    tie: "no ritmo da turma",
    behind: "suas reflexões contam, registre uma",
  },
  engagement: {
    win: "acima da média",
    tie: "no ritmo da turma",
    behind: "vamos engajar mais?",
  },
}

/**
 * SH-1.5 (AC7) — a leitura ESPECIAL da linha Engajamento quando o aluno é o #1 real
 * da turma (rank confirmado no backend, `subject.isTopEngagement === true`). Só esta
 * frase carrega a alegação de 1º lugar; qualquer outro caso cai no fallback padrão.
 */
const TOP_ENGAGEMENT_COPY = "1º da turma – Parabéns!"

/**
 * Formata a célula de VALOR de uma métrica que pode ter fração "X/Y" (SH-1.5).
 * Denominador presente e > 0 → "X/Y" (ex.: "7/10"); ausente/0 → o absoluto "X"
 * (degradação graciosa, AC3/AC4/AC10 — sem NaN, sem Infinity, sem crash). Pure.
 */
export function formatFraction(value: number, max: number | undefined | null): string {
  if (max != null && max > 0) return `${value}/${max}`
  return String(value)
}

/**
 * SH-1.5 Round 2 (Hugo 2026-07-18) — formats the "Você" Engajamento cell as a
 * RANKING position ("3º de 15") instead of a raw score. Both rank and total must
 * be present, finite and ≥1 with rank ≤ total; anything malformed/absent degrades
 * to "—" (same defensive style as formatFraction — never NaN, never a crash).
 * Notation chosen (Hugo can retune): "{rank}º de {total}", pt-BR ordinal + "de".
 * Pure.
 */
export function formatRank(
  rank: number | undefined | null,
  total: number | undefined | null,
): string {
  if (rank == null || total == null) return "—"
  if (!Number.isFinite(rank) || !Number.isFinite(total)) return "—"
  if (rank < 1 || total < 1 || rank > total) return "—"
  return `${rank}º de ${total}`
}

export interface Leitura {
  text: string
  tone: "win" | "tie" | "behind" | "none"
}

/**
 * Deriva a Leitura de um indicador dos vencedores que a tabela computa
 * (winnerOf) — nunca uma conta paralela. Valor ausente de qualquer lado → "—"
 * (sem leitura possível, não é empate). Pure, exported for tests.
 */
export function leituraFor(
  key: RowKey,
  subject: number | null,
  reference: number | null,
  direction: "higher" | "lower",
  /**
   * SH-1.5 (AC7) — REAL rank signal, consumed ONLY for the `engagement` row: when
   * TRUE and the student is winning that row, the reading becomes "1º da turma".
   * NEVER hardcoded, NEVER approximated — it reflects a backend rank of exactly 1
   * (no tie, AC12). Any other row, or `false`/absent, uses the standard copy.
   */
  isTopEngagement?: boolean,
): Leitura {
  if (subject === null || reference === null) return { text: "—", tone: "none" }
  const winner = winnerOf(subject, reference, direction)
  const copy = LEITURA_COPY[key]
  if (winner === "subject") {
    // AC7 — the "1º da turma" claim is unlocked SOLELY by the real rank signal.
    if (key === "engagement" && isTopEngagement === true) {
      return { text: TOP_ENGAGEMENT_COPY, tone: "win" }
    }
    return { text: copy.win, tone: "win" }
  }
  if (winner === "reference") return { text: copy.behind, tone: "behind" }
  return { text: copy.tie, tone: "tie" }
}

/**
 * O chip tonal da Leitura — fundo suave + texto na cor semântica + ícone
 * pequeno. Verde (reforço) / neutro (no ritmo) / cerrado (convite acionável).
 */
const LEITURA_CHIP: Record<
  Exclude<Leitura["tone"], "none">,
  { className: string; Icon: LucideIcon }
> = {
  win: { className: "bg-semantic-success/10 text-semantic-success", Icon: TrendingUp },
  tie: { className: "bg-black/5 text-text-secondary dark:bg-white/10", Icon: Minus },
  behind: { className: "bg-cerrado-600/10 text-cerrado-600", Icon: ArrowRight },
}

function LeituraChip({ leitura, testid }: { leitura: Leitura; testid: string }) {
  if (leitura.tone === "none") {
    return (
      <span data-testid={testid} data-tone="none" className="text-xs text-text-muted">
        {leitura.text}
      </span>
    )
  }
  const { className, Icon } = LEITURA_CHIP[leitura.tone]
  return (
    <span
      data-testid={testid}
      data-tone={leitura.tone}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${className}`}
    >
      <Icon size={12} aria-hidden="true" className="shrink-0" />
      {leitura.text}
    </span>
  )
}

interface HomeRow {
  key: RowKey
  label: string
  direction: "higher" | "lower"
  /** Comparable numeric values (null → not comparable / missing). */
  subjectValue: number | null
  referenceValue: number | null
  /** Rendered cell content. */
  subjectNode: React.ReactNode
  referenceNode: React.ReactNode
  /** true → the % progress bar is drawn under the value. */
  isPct?: boolean
}

// SH-1.5 — ORDEM EXATA do mockup do Hugo (2026-07-18): Última atividade →
// Progresso - conclusão → Interações realizadas → Reflexões realizadas →
// Engajamento. Labels renomeados; frações X/Y em Interações/Reflexões (denominador
// da PRÓPRIA trilha, degrada ao absoluto); Engajamento é score ABSOLUTO (sem
// fração — a fração de SH-F.5 vive só na leitura "Como estou", via rank real).
function buildRows(indicators: StudentHomeIndicators): HomeRow[] {
  const s = indicators.subject
  const r = indicators.reference
  return [
    {
      key: "lastAccess",
      label: "Última atividade",
      direction: "lower", // menos dias = melhor (recência invertida)
      subjectValue: s.lastAccessDays,
      referenceValue: r.lastAccessAvgDays,
      // AJUSTE 2 (Hugo 2026-07-14): a célula Você mostra a PENÚLTIMA visita.
      // null = não há acesso anterior — o aluno está acessando AGORA pela
      // primeira vez, então o rótulo honesto é "Primeiro acesso" (nunca "nunca").
      subjectNode: formatDays(s.lastAccessDays, "Primeiro acesso"),
      referenceNode: formatDays(r.lastAccessAvgDays, "—"),
    },
    {
      key: "progress",
      label: "Progresso - conclusão",
      direction: "higher",
      subjectValue: s.progressPct,
      referenceValue: r.progressAvgPct,
      subjectNode: `${s.progressPct}%`,
      referenceNode: `${r.progressAvgPct}%`,
      isPct: true,
    },
    {
      // `interactions` = sessões concluídas ("interações realizadas") no payload.
      // SH-1.5 — fração "X/Y" nos DOIS lados (Round 2, Hugo 2026-07-18): Você usa o
      // teto da PRÓPRIA trilha (interactionsMax); Turma usa a MÉDIA dos tetos da org
      // (interactionsMaxAvg). Cada lado degrada ao absoluto se o denominador vier
      // ausente/0 (formatFraction), sem crash.
      key: "sessions",
      label: "Interações realizadas",
      direction: "higher",
      subjectValue: s.interactions,
      referenceValue: r.interactionsAvg,
      subjectNode: formatFraction(s.interactions, s.interactionsMax),
      referenceNode: formatFraction(r.interactionsAvg, r.interactionsMaxAvg),
    },
    {
      // SH-1.5 — fração "X/Y" nos DOIS lados (Round 2): Você usa reflectionsMax da
      // própria trilha; Turma usa reflectionsMaxAvg (média dos tetos da org).
      key: "reflections",
      label: "Reflexões realizadas",
      direction: "higher",
      subjectValue: s.reflections,
      referenceValue: r.reflectionsAvg,
      subjectNode: formatFraction(s.reflections, s.reflectionsMax),
      referenceNode: formatFraction(r.reflectionsAvg, r.reflectionsMaxAvg),
    },
    {
      // SH-1.5 Round 2 (Hugo 2026-07-18) — a linha Engajamento assimétrica por
      // decisão do Hugo: a célula VOCÊ mostra o RANKING (formatRank, "3º de N"), não
      // mais o score; a célula TURMA mostra a média de pontos como fração X/Y
      // (formatFraction com engagementMaxAvg). A leitura "Como estou" e o
      // vencedor/cor CONTINUAM baseados nos scores brutos (subjectValue/referenceValue
      // = s.engagement/r.engagementAvg), SEM mudança — só o TEXTO exibido muda.
      key: "engagement",
      label: "Engajamento",
      direction: "higher",
      subjectValue: s.engagement,
      referenceValue: r.engagementAvg,
      subjectNode: formatRank(s.engagementRank, s.engagementTotalStudents),
      referenceNode: formatFraction(r.engagementAvg, r.engagementMaxAvg),
    },
  ]
}

/**
 * One value cell. `highlight` (o ALUNO venceu o indicador) veste o PILL verde
 * original (cápsula semantic-success + texto branco, o estilo de antes do
 * formato transposto — Hugo rejeitou o texto verde solto). Empate/derrota são
 * texto neutro; a coluna Turma nunca destaca. `data-win` permanece como
 * semântica testável do vencedor direction-aware nos dois lados.
 */
function ValueCell({
  testid,
  win,
  highlight,
  dim,
  children,
}: {
  testid: string
  win: boolean
  /** true = valor do ALUNO vencedor → pill verde original. */
  highlight: boolean
  dim: boolean
  children: React.ReactNode
}) {
  if (highlight) {
    return (
      <span
        data-testid={testid}
        data-win={win ? "true" : "false"}
        style={{ backgroundColor: WIN_BG, color: WIN_TEXT }}
        className="inline-flex items-center rounded-full px-3 py-1 text-sm font-bold tabular-nums shadow-sm"
      >
        {children}
      </span>
    )
  }
  return (
    <span
      data-testid={testid}
      data-win={win ? "true" : "false"}
      className={`text-sm tabular-nums ${dim ? "font-medium text-text-muted" : "font-semibold text-text-primary"}`}
    >
      {children}
    </span>
  )
}

/** The % progress bar — verde quando o ALUNO vence a linha; neutra no resto. */
function PctBar({ pct, win }: { pct: number | null; win: boolean }) {
  if (pct === null) return null
  return (
    <div
      style={{ backgroundColor: BAR_TRACK }}
      className="mx-auto mt-2 h-1.5 w-16 overflow-hidden rounded-full"
    >
      {pct > 0 && (
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(100, Math.max(0, pct))}%`,
            backgroundColor: win ? BAR_WIN_FILL : BAR_FILL,
          }}
        />
      )}
    </div>
  )
}

export function ComparisonInsightsTable({
  indicators,
  studentFirstName,
}: {
  indicators: StudentHomeIndicators
  /**
   * A label da coluna do sujeito: no aluno logado, "Eu (Nome)"; num drill de
   * gestor, o primeiro nome do aluno visto. Ausente → "Você".
   */
  studentFirstName?: string | null
}) {
  const rows = buildRows(indicators)

  return (
    // Framed "micro-table" — the manager finish (bordered, rounded, light header
    // row, row dividers). Same grammar as the gestor "Tabela simplificada",
    // agora SEM setas de ordenação (tabela transposta não ordena).
    <div
      className="overflow-hidden rounded-xl"
      style={{ border: "1px solid var(--color-border-subtle)" }}
      data-testid="comparison-insights-table"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              style={{
                backgroundColor: "var(--color-bg-elevated)",
                borderBottom: "1px solid var(--color-border-subtle)",
              }}
            >
              <th className="px-4 py-3 text-left">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Indicador
                </span>
              </th>
              <th className="px-4 py-3 text-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                  {subjectColumnLabel(studentFirstName)}
                </span>
              </th>
              <th className="px-4 py-3 text-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Turma
                </span>
              </th>
              <th className="px-4 py-3 text-left">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Como estou
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const winner = winnerOf(row.subjectValue, row.referenceValue, row.direction)
              const leitura = leituraFor(
                row.key,
                row.subjectValue,
                row.referenceValue,
                row.direction,
                // AC7 — the real rank signal only affects the Engajamento row; any
                // other row ignores it. Absent → treated as not-#1 (standard copy).
                indicators.subject.isTopEngagement,
              )
              return (
                <tr
                  key={row.key}
                  data-testid={`row-${row.key}`}
                  className="transition-colors hover:bg-bg-hover"
                  style={i > 0 ? { borderTop: "1px solid var(--color-border-subtle)" } : undefined}
                >
                  <td className="px-4 py-4 text-left">
                    <span className="text-sm font-semibold text-text-primary">{row.label}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <ValueCell
                      testid={`cell-subject-${row.key}`}
                      win={winner === "subject"}
                      highlight={winner === "subject"}
                      dim={false}
                    >
                      {row.subjectNode}
                    </ValueCell>
                    {row.isPct && <PctBar pct={row.subjectValue} win={winner === "subject"} />}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <ValueCell
                      testid={`cell-reference-${row.key}`}
                      win={winner === "reference"}
                      highlight={false}
                      dim={true}
                    >
                      {row.referenceNode}
                    </ValueCell>
                    {row.isPct && <PctBar pct={row.referenceValue} win={false} />}
                  </td>
                  <td className="px-4 py-4 text-left">
                    <LeituraChip leitura={leitura} testid={`leitura-${row.key}`} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
