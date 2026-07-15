// ---------------------------------------------------------------------------
// ComparisonInsightsTable — "Meu ritmo": formato TRANSPOSTO (Hugo 2026-07-14)
// ---------------------------------------------------------------------------
// Redesign aprovado: uma linha POR INDICADOR, colunas fixas
//   | Indicador | Você (Eu {nome}) | Turma | Leitura |
// Linhas, na ordem: Progresso · Sessões concluídas · Reflexões · Último acesso.
// ("Interações" NÃO vira linha própria: no payload StudentHomeIndicators o campo
// `interactions` É "sessões concluídas" — uma segunda linha duplicaria o mesmo
// número. O score Engajamento saiu da tabela: sessões + reflexões JÁ SÃO o seu
// breakdown, agora visíveis como linhas.)
//
// LEITURA — a 4ª coluna traduz o vencedor de cada indicador (winnerOf) em um
// CHIP TONAL compacto:
//   • aluno acima  → reforço, verde suave + TrendingUp ("Acima da média",
//     "Boa participação", "Ativo");
//   • empate       → neutro + Minus ("No ritmo");
//   • aluno abaixo → NUNCA punitivo, sempre acionável, tom cerrado (convite) +
//     seta ("Vamos retomar?", "1 sessão te recoloca no ritmo"). Jamais vermelho.
//
// DESTAQUE DO VALOR VENCEDOR (Hugo, iterado 2026-07-14): quando o ALUNO vence
// o indicador, o VALOR da coluna Eu volta ao PILL original (cápsula
// semantic-success com texto branco, o mesmo estilo de antes do formato
// transposto — o texto verde solto foi rejeitado). O valor destaca, o chip
// interpreta. Empate/derrota ficam neutros; a coluna Turma nunca destaca.
//
// SEM setas de ordenação (não se ordena uma tabela transposta de 4 linhas) e SEM
// a coluna "Onde você está" (removida no formato transposto).
//
// WINNER-PER-INDICATOR (direction-aware, alimenta a Leitura e o destaque acima):
//   • Progresso / Sessões / Reflexões → MAIOR vence.
//   • Último acesso → MENOR vence (recência invertida).
// Empate ou valor ausente não gera leitura de vitória/convite.
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

type RowKey = "progress" | "sessions" | "reflections" | "lastAccess"

/**
 * A coluna Leitura — copy por indicador × resultado, inicial maiúscula (é chip,
 * não rodapé). Regra de tom (Hugo): acima = reforço curto; empate = neutro;
 * abaixo = acionável, nunca punitivo.
 */
const LEITURA_COPY: Record<RowKey, { win: string; tie: string; behind: string }> = {
  progress: { win: "Acima da média", tie: "No ritmo", behind: "1 sessão te recoloca no ritmo" },
  sessions: { win: "Acima da média", tie: "No ritmo", behind: "Que tal mais uma hoje?" },
  reflections: {
    win: "Boa participação",
    tie: "No ritmo",
    behind: "Suas reflexões contam, registre uma",
  },
  lastAccess: { win: "Ativo", tie: "No ritmo", behind: "Vamos retomar?" },
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
): Leitura {
  if (subject === null || reference === null) return { text: "—", tone: "none" }
  const winner = winnerOf(subject, reference, direction)
  const copy = LEITURA_COPY[key]
  if (winner === "subject") return { text: copy.win, tone: "win" }
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

function buildRows(indicators: StudentHomeIndicators): HomeRow[] {
  const s = indicators.subject
  const r = indicators.reference
  return [
    {
      key: "progress",
      label: "Progresso",
      direction: "higher",
      subjectValue: s.progressPct,
      referenceValue: r.progressAvgPct,
      subjectNode: `${s.progressPct}%`,
      referenceNode: `${r.progressAvgPct}%`,
      isPct: true,
    },
    {
      // `interactions` = sessões concluídas ("interações") no payload — a label
      // do aluno é a aprovada pelo Hugo no formato transposto.
      key: "sessions",
      label: "Sessões concluídas",
      direction: "higher",
      subjectValue: s.interactions,
      referenceValue: r.interactionsAvg,
      subjectNode: String(s.interactions),
      referenceNode: String(r.interactionsAvg),
    },
    {
      key: "reflections",
      label: "Reflexões",
      direction: "higher",
      subjectValue: s.reflections,
      referenceValue: r.reflectionsAvg,
      subjectNode: String(s.reflections),
      referenceNode: String(r.reflectionsAvg),
    },
    {
      key: "lastAccess",
      label: "Último acesso",
      direction: "lower", // menos dias = melhor (recência invertida)
      subjectValue: s.lastAccessDays,
      referenceValue: r.lastAccessAvgDays,
      // AJUSTE 2 (Hugo 2026-07-14): a célula Você mostra a PENÚLTIMA visita.
      // null = não há acesso anterior — o aluno está acessando AGORA pela
      // primeira vez, então o rótulo honesto é "Primeiro acesso" (nunca "nunca").
      subjectNode: formatDays(s.lastAccessDays, "Primeiro acesso"),
      referenceNode: formatDays(r.lastAccessAvgDays, "—"),
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
                  Leitura
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
