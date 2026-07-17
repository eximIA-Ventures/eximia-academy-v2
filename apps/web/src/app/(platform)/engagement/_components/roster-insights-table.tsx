"use client"

// ---------------------------------------------------------------------------
// RosterInsightsTable — the "Lista" of a semáforo card, in the "Meu ritmo"
// visual grammar (fatia 16, spec §5).
// ---------------------------------------------------------------------------
// Hugo REJECTED the fatia 12 rendering (the manager-variant "Tabela
// simplificada") — he wants EXACTLY the grammar of the student home's "Meu
// ritmo" table: framed rounded border, light header band with UPPERCASE labels
// + decorative sort arrow, row dividers, highlighted values, and a final
// READING column with the strong-green pill (#059669) like "Acima da média"/
// "Ativo". The reference is `comparison-insights-table.tsx` (src/components,
// pasta de analytics) — READ-ONLY: its GRAMMAR is replicated here (it is a
// 2-row Você-vs-Média comparison with an incompatible data shape, so the
// component itself is never imported).
//
// Pure presentation, N rows (one per student of the card's cohort). NO Ação
// column, NO row expansion, NO sort logic (headers are inert, like the
// reference), and NO navigation out of /engagement (spec §5.4 — the second
// reason fatia 12 was rejected).
// ---------------------------------------------------------------------------

import { ArrowUpDown } from "lucide-react"
import type { EngagementStudentDetail } from "./types"

// Colour constants — identical to the reference (comparison-insights-table),
// declared locally per spec §5.1 (the reference file is read-only).
const WIN_BG = "#059669"
const WIN_TEXT = "#ffffff"
const BAR_TRACK = "var(--color-bg-hover)"
const BAR_WIN_FILL = "#059669"
const BAR_NEUTRAL_FILL = "rgba(0, 0, 0, 0.22)"

/**
 * The SAME engagement formula as the manager table's `getEngagementScore`
 * (interações concluídas x2 + reflexões) — replicated per spec §5.3, never
 * imported (that file is out of scope).
 */
export function engagementScoreOf(row: {
  completedSessions: number
  reflectionsCount: number
}): number {
  return row.completedSessions * 2 + row.reflectionsCount
}

/** The deterministic verdict of the "Leitura" column (spec §5.3). */
export type LeituraVerdict =
  | { kind: "acima_media" } // pill verde "Acima da média"
  | { kind: "ativo" } // pill verde "Ativo"
  | { kind: "nunca" } // texto neutro "Nunca acessou"
  | { kind: "sem_atividade"; days: number } // texto neutro "Sem atividade há {days} dias"

/**
 * Leitura precedence (spec §5.3, first match wins):
 *   1. engagement STRICTLY above the cohort average → acima_media (tie is NOT above).
 *   2. accessed within the last 7 days (0..7)      → ativo.
 *   3. never accessed (null)                       → nunca.
 *   4. otherwise                                    → sem_atividade with the day count.
 * Green pill only for 1 and 2; 3 and 4 are neutral muted text, never red.
 */
export function leituraOf(
  row: {
    completedSessions: number
    reflectionsCount: number
    daysSinceLastActivity: number | null
  },
  cohortAvgEngagement: number,
): LeituraVerdict {
  if (engagementScoreOf(row) > cohortAvgEngagement) return { kind: "acima_media" }
  if (row.daysSinceLastActivity !== null && row.daysSinceLastActivity <= 7) {
    return { kind: "ativo" }
  }
  if (row.daysSinceLastActivity === null) return { kind: "nunca" }
  return { kind: "sem_atividade", days: row.daysSinceLastActivity }
}

/** "hoje" / "há 1 dia" / "há N dias" — null → "Nunca acessou" (spec §5.2 col 2). */
function formatLastAccess(days: number | null): string {
  if (days === null) return "Nunca acessou"
  if (days <= 0) return "hoje"
  if (days === 1) return "há 1 dia"
  return `há ${days} dias`
}

/**
 * Decorative column header (label + inert arrow) — same ColHeader as the
 * reference. Headers are INERT in this v1 (no sort logic), like the reference.
 */
function ColHeader({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
      {label}
      <ArrowUpDown size={12} className="text-text-muted/40" aria-hidden="true" />
    </span>
  )
}

/** The % progress bar — same PctBar as the reference: green fill when the row
 *  reads green (Leitura verdict 1 or 2), neutral otherwise. */
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

/** The "Leitura" cell: strong-green pill for the 2 green verdicts (same win
 *  badge as the reference's ValueCell), neutral muted text otherwise. */
function LeituraCell({ id, verdict }: { id: string; verdict: LeituraVerdict }) {
  const green = verdict.kind === "acima_media" || verdict.kind === "ativo"
  if (green) {
    return (
      <span
        data-testid={`cell-${id}-leitura`}
        data-win="true"
        style={{ backgroundColor: WIN_BG, color: WIN_TEXT }}
        className="inline-flex items-center rounded-full px-3 py-1 text-sm font-bold shadow-sm"
      >
        {verdict.kind === "acima_media" ? "Acima da média" : "Ativo"}
      </span>
    )
  }
  return (
    <span data-testid={`cell-${id}-leitura`} data-win="false" className="text-sm text-text-muted">
      {verdict.kind === "nunca" ? "Nunca acessou" : `Sem atividade há ${verdict.days} dias`}
    </span>
  )
}

const COLUMN_LABELS = ["Último acesso", "Progresso", "Sessões", "Reflexões", "Leitura"] as const

export interface RosterInsightsTableProps {
  rows: EngagementStudentDetail[]
  /**
   * Average engagement over the FULL card cohort (every loaded row, BEFORE the
   * course filter) — spec §5.3: stable while the gestor filters by course.
   */
  cohortAvgEngagement: number
}

export function RosterInsightsTable({ rows, cohortAvgEngagement }: RosterInsightsTableProps) {
  return (
    // Framed "micro-table" — the same finish as the reference (bordered,
    // rounded, light header band, row dividers).
    <div
      className="overflow-hidden rounded-xl"
      style={{ border: "1px solid var(--color-border-subtle)" }}
      data-testid="roster-insights-table"
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
                <ColHeader label="Aluno" />
              </th>
              {COLUMN_LABELS.map((label) => (
                <th key={label} className="px-4 py-3 text-center">
                  <ColHeader label={label} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const verdict = leituraOf(row, cohortAvgEngagement)
              const green = verdict.kind === "acima_media" || verdict.kind === "ativo"
              return (
                <tr
                  key={row.id}
                  data-testid={`roster-row-${row.id}`}
                  className="transition-colors hover:bg-bg-hover"
                  style={i > 0 ? { borderTop: "1px solid var(--color-border-subtle)" } : undefined}
                >
                  <td className="px-4 py-4 text-left">
                    <span className="block font-bold text-text-primary">{row.fullName ?? "—"}</span>
                    {row.email && (
                      <span className="block text-[11px] text-text-muted">{row.email}</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="text-sm tabular-nums text-text-primary">
                      {formatLastAccess(row.daysSinceLastActivity)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="text-sm font-semibold tabular-nums text-text-primary">
                      {row.progressPct}%
                    </span>
                    <PctBar pct={row.progressPct} win={green} />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="text-sm tabular-nums text-text-primary">
                      {row.completedSessions} de {row.totalSessions}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="text-sm tabular-nums text-text-primary">
                      {row.reflectionsCount}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <LeituraCell id={row.id} verdict={verdict} />
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
