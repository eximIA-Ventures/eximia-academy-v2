// ---------------------------------------------------------------------------
// ComparisonInsightsTable — "Meu ritmo": Você vs a média da TURMA
// ---------------------------------------------------------------------------
// Hugo (2026-07-12). A 2-ROW table ("Você" / "Média da turma") with the 4
// OPERATIONAL indicators the gestor sees in the "Tabela simplificada" as COLUMNS,
// in order: Último acesso · Ritmo · Progresso · Engajamento. Same visual grammar
// as the manager table (framed, light header, sort arrows, dividers).
//
// WINNER-PER-INDICATOR HIGHLIGHT, now DIRECTION-AWARE (Hugo):
//   • Progresso / Engajamento → MAIOR vence.
//   • Último acesso → MENOR vence (recência: menos dias = melhor). Direção INVERTIDA.
//   • "Onde você está" → SEM destaque. Antes esta coluna mostrava o BADGE DE
//     TRIAGEM DO GESTOR ("No ritmo"/"Sem acesso"/"Atrasado") também na linha
//     "Você" — a lente ERRADA para a auto-visão (Hugo): o aluno não é triado na
//     própria home, e "Sem acesso" (triagem = >14 dias sem SESSÃO) mente para
//     quem reflete/interage sem "sessão". Agora a célula "Você" mostra ONDE O
//     ALUNO PAROU — o módulo da ATIVIDADE MAIS RECENTE (tipicamente EM ANDAMENTO,
//     NÃO o último concluído) MAIS a % de progresso DAQUELE módulo (ex.: "Módulo 3:
//     Precificação · 60%"), derivado subject-scoped no pipeline (area-gestor: a
//     sessão mais recente com chapter → chapter.title + order; % = sessões
//     concluídas do capítulo ÷ questões ativas do capítulo; SEM scan org-wide).
//     NÃO usa a triagem do gestor. Fallback só quando NÃO há atividade com módulo:
//     "Começando". A "Média da turma" NÃO tem "onde" (a média não pára em lugar
//     nenhum): a célula da referência é "—" (o RitmoBadge/triagem do GESTOR seguem
//     intocados em ritmo-badge.tsx + student-insights-table.tsx). Não se "bate a
//     média" aqui.
// The winning cell glows strong green (semantic-success token); the loser is neutral,
// never red. A tie or a missing value highlights neither side.
//
// Pure presentation. Card-less: the container (StudentHomeCard) owns the Card,
// the caption and the Visão detalhada/Gráficos toggle. Data comes pre-computed
// org-wide (StudentHomeIndicators); this component only renders + compares.
// ---------------------------------------------------------------------------

import type { StudentHomeIndicators } from "@/types/analytics"
import { ArrowUpDown } from "lucide-react"

const WIN_BG = "var(--color-semantic-success)"
const WIN_TEXT = "#ffffff"
const BAR_TRACK = "var(--color-bg-hover)"
const BAR_WIN_FILL = "var(--color-semantic-success)"
const BAR_NEUTRAL_FILL = "rgba(0, 0, 0, 0.22)"

/** Which side wins an indicator. null = tie, missing, or a no-winner column. */
type Winner = "subject" | "reference" | null
type Direction = "higher" | "lower" | "none"

/**
 * The winning side of an indicator, DIRECTION-AWARE (Hugo): "higher" → larger
 * value wins (progresso, engajamento); "lower" → smaller wins (último acesso, a
 * recência invertida). null on tie or when either value is missing.
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
 * "Onde você está" — a auto-visão do ALUNO na linha "Você" (Hugo, 2026-07-14):
 * mostra o NOME do ÚLTIMO módulo/capítulo que o aluno CONCLUIU (ex.: "Capítulo 3:
 * Precificação"), não um veredito de triagem nem "% concluído" (redundante com a
 * coluna Progresso). O rótulo vem pronto do pipeline (subject-scoped em
 * area-gestor: chapter.title + order). Fallback só quando NADA foi concluído
 * ainda: "Começando". Pure.
 */
export function whereYouAreLabel(lastCompletedLabel: string | null | undefined): string {
  const clean = lastCompletedLabel?.trim()
  return clean ? clean : "Começando"
}

/** "há X dias" / "hoje" — for the Último acesso cells. null → placeholder. */
function formatDays(days: number | null, whenNull: string): string {
  if (days === null) return whenNull
  if (days <= 0) return "hoje"
  if (days === 1) return "há 1 dia"
  return `há ${days} dias`
}

interface HomeColumn {
  key: string
  label: string
  direction: Direction
  /** Comparable numeric values (null → not comparable / missing). */
  subjectValue: number | null
  referenceValue: number | null
  /** Rendered cell content. */
  subjectNode: React.ReactNode
  referenceNode: React.ReactNode
  /** Optional muted sub-line under the value (e.g. "X interações · Y reflexões"). */
  subjectSub?: React.ReactNode
  referenceSub?: React.ReactNode
  /** true → the % progress bar is drawn under the value. */
  isPct?: boolean
}

function buildColumns(indicators: StudentHomeIndicators): HomeColumn[] {
  const s = indicators.subject
  const r = indicators.reference
  return [
    {
      key: "lastAccess",
      label: "Último acesso",
      direction: "lower", // menos dias = melhor (recência invertida)
      subjectValue: s.lastAccessDays,
      referenceValue: r.lastAccessAvgDays,
      // AJUSTE 2 (Hugo 2026-07-14): a linha Você mostra a PENÚLTIMA visita (o
      // acesso anterior ao atual). null = não há acesso anterior — o aluno está
      // acessando AGORA pela primeira vez, então o rótulo honesto é "Primeiro
      // acesso" (nunca "nunca": ele está aqui).
      subjectNode: formatDays(s.lastAccessDays, "Primeiro acesso"),
      referenceNode: formatDays(r.lastAccessAvgDays, "—"),
    },
    {
      // "Onde você está": a linha "Você" mostra ONDE O ALUNO PAROU — o módulo da
      // atividade mais recente + a % daquele módulo (ex.: "Módulo 3: Precificação
      // · 60%"). A Média NÃO tem "onde" (Hugo 2026-07-14): a célula da referência
      // vira "—". A key permanece "ritmo" (data-testid estável cell-*-ritmo).
      key: "ritmo",
      label: "Onde você está",
      direction: "none", // sem vencedor (auto-visão, não comparação)
      subjectValue: null,
      referenceValue: null,
      subjectNode: whereYouAreLabel(s.lastCompletedLabel),
      referenceNode: "—",
    },
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
      key: "engagement",
      label: "Engajamento",
      direction: "higher",
      subjectValue: s.engagement,
      referenceValue: r.engagementAvg,
      // SH-F.5 — the "Você" number is the fraction "X de N" when the trail ceiling
      // is known; it degrades to the plain absolute "X" when engagementMax is
      // absent. The Média (referenceNode) stays ABSOLUTE (Hugo, AC6). The winner
      // still compares the ABSOLUTE subjectValue/referenceValue (AC7 — untouched).
      subjectNode:
        s.engagementMax != null ? `${s.engagement} de ${s.engagementMax}` : String(s.engagement),
      referenceNode: String(r.engagementAvg),
      // Gestor-style breakdown under the score (no ★TOP — roster ranking only).
      subjectSub: `${s.interactions} interações · ${s.reflections} reflexões`,
      referenceSub: `${r.interactionsAvg} interações · ${r.reflectionsAvg} reflexões`,
    },
  ]
}

/**
 * Decorative column sort-header (label + arrow), visually identical to the
 * manager table's SortHeader but inert (sorting a 2-row comparison does nothing).
 */
function ColHeader({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
      {label}
      <ArrowUpDown size={12} className="text-text-muted/40" aria-hidden="true" />
    </span>
  )
}

/** One value cell. `win` paints the STRONG green winner badge; else neutral. */
function ValueCell({
  testid,
  win,
  dim,
  children,
}: {
  testid: string
  win: boolean
  dim: boolean
  children: React.ReactNode
}) {
  if (win) {
    return (
      <span
        data-testid={testid}
        data-win="true"
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
      data-win="false"
      className={`text-sm tabular-nums ${dim ? "font-medium text-text-muted" : "font-semibold text-text-primary"}`}
    >
      {children}
    </span>
  )
}

/** The % progress bar for the progress indicator: green (winner) / neutral. */
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
            backgroundColor: win ? BAR_WIN_FILL : BAR_NEUTRAL_FILL,
          }}
        />
      )}
    </div>
  )
}

export function ComparisonInsightsTable({ indicators }: { indicators: StudentHomeIndicators }) {
  const columns = buildColumns(indicators)
  const winners = columns.map((c) =>
    c.direction === "none" ? null : winnerOf(c.subjectValue, c.referenceValue, c.direction),
  )

  return (
    // Framed "micro-table" — the manager finish (bordered, rounded, light header
    // row, row dividers). Same grammar as the gestor "Tabela simplificada".
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
                <ColHeader label="Comparação" />
              </th>
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-3 text-center">
                  <ColHeader label={col.label} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Você — winning cells glow strong green; losers stay neutral. */}
            <tr data-testid="row-subject" className="transition-colors hover:bg-bg-hover">
              <td className="px-4 py-4 text-left">
                <span className="text-[15px] font-bold text-text-primary">Você</span>
              </td>
              {columns.map((col, i) => {
                const win = winners[i] === "subject"
                return (
                  <td key={col.key} className="px-4 py-4 text-center">
                    <ValueCell testid={`cell-subject-${col.key}`} win={win} dim={false}>
                      {col.subjectNode}
                    </ValueCell>
                    {col.isPct && <PctBar pct={col.subjectValue} win={win} />}
                    {col.subjectSub && (
                      <div className="mt-1 text-[11px] text-text-muted tabular-nums">
                        {col.subjectSub}
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
            {/* Média da turma — lighter by default; a winning cell glows too. */}
            <tr
              data-testid="row-reference"
              className="transition-colors hover:bg-bg-hover"
              style={{ borderTop: "1px solid var(--color-border-subtle)" }}
            >
              <td className="px-4 py-4 text-left">
                <span className="text-sm font-medium text-text-muted">Média da turma</span>
              </td>
              {columns.map((col, i) => {
                const win = winners[i] === "reference"
                return (
                  <td key={col.key} className="px-4 py-4 text-center">
                    <ValueCell testid={`cell-reference-${col.key}`} win={win} dim={!win}>
                      {col.referenceNode}
                    </ValueCell>
                    {col.isPct && <PctBar pct={col.referenceValue} win={win} />}
                    {col.referenceSub && (
                      <div className="mt-1 text-[11px] text-text-muted tabular-nums">
                        {col.referenceSub}
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
