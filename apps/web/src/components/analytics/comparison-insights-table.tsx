// ---------------------------------------------------------------------------
// ComparisonInsightsTable — "Meu ritmo": Você vs a média da ORGANIZAÇÃO
// ---------------------------------------------------------------------------
// Hugo (2026-07-12). A 2-ROW table ("Você" / "Média da organização") with the 4
// OPERATIONAL indicators the gestor sees in the "Tabela simplificada" as COLUMNS,
// in order: Último acesso · Ritmo · Progresso · Engajamento. Same visual grammar
// as the manager table (framed, light header, sort arrows, dividers).
//
// WINNER-PER-INDICATOR HIGHLIGHT, now DIRECTION-AWARE (Hugo):
//   • Progresso / Engajamento → MAIOR vence.
//   • Último acesso → MENOR vence (recência: menos dias = melhor). Direção INVERTIDA.
//   • Ritmo → SEM destaque (status categórico; a badge tem cor própria, a Média
//     mostra "% em dia" = no_ritmo + concluído). Não se "bate a média" aqui.
// The winning cell glows strong green (#059669, inline); the loser is neutral,
// never red. A tie or a missing value highlights neither side.
//
// Pure presentation. Card-less: the container (StudentHomeCard) owns the Card,
// the caption and the Visão detalhada/Gráficos toggle. Data comes pre-computed
// org-wide (StudentHomeIndicators); this component only renders + compares.
// ---------------------------------------------------------------------------

import type { StudentHomeIndicators } from "@/types/analytics"
import { ArrowUpDown } from "lucide-react"
import { RitmoBadge, type RitmoDisplay } from "./ritmo-badge"

const WIN_BG = "#059669"
const WIN_TEXT = "#ffffff"
const BAR_TRACK = "var(--color-bg-hover)"
const BAR_WIN_FILL = "#059669"
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
      subjectNode: formatDays(s.lastAccessDays, "nunca"),
      referenceNode: formatDays(r.lastAccessAvgDays, "—"),
    },
    {
      key: "ritmo",
      label: "Ritmo",
      direction: "none", // status categórico — sem vencedor
      subjectValue: null,
      referenceValue: null,
      subjectNode: <RitmoBadge display={s.ritmoDisplay as RitmoDisplay | undefined} />,
      referenceNode: `${r.ritmoEmDiaPct}% em dia`,
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
      subjectNode: String(s.engagement),
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
            {/* Média da organização — lighter by default; a winning cell glows too. */}
            <tr
              data-testid="row-reference"
              className="transition-colors hover:bg-bg-hover"
              style={{ borderTop: "1px solid var(--color-border-subtle)" }}
            >
              <td className="px-4 py-4 text-left">
                <span className="text-sm font-medium text-text-muted">Média da organização</span>
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
