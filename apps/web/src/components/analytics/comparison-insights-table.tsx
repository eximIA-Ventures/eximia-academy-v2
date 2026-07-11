// ---------------------------------------------------------------------------
// ComparisonInsightsTable — the OFFICIAL "Você vs Média" comparison view
// ---------------------------------------------------------------------------
// SH-1.4 UX rework (Hugo, 2026-07-11). A 2-ROW table: "Você" and
// "Média · {unidade}", with the INDICATORS as COLUMNS — the same visual grammar
// as the manager "Tabela simplificada" (student-insights-table.tsx): the same
// `<table>` markup, the uppercase-muted headers, the clean bordered rows and the
// progress bar on the % indicators.
//
// WINNER-PER-INDICATOR HIGHLIGHT (Hugo's 3rd instruction): for EACH indicator we
// mark the WINNING cell — whichever side has the higher value (higher = better in
// all five: conclusão consciente %, profundidade /7, conclusão %, consistência em
// dias, reflexões). The winner can be Você OR Média (e.g. if Média's Profundidade
// 4.6 beats Você 4.0, the MÉDIA cell is highlighted, not Você). The highlight is
// STRONG and high-contrast (a solid green fill, Anthropic-comparison style),
// clearly heavier than a light tint. The losing cell is NEUTRAL — never red,
// never punitive. A tie (equal, or a missing value) highlights NEITHER side.
//
// Pure presentation. Card-less: the container (StudentHomeCard) owns the Card,
// the caption and the Visão detalhada/Gráficos toggle. Median/IQR reanchoring of
// the reference (SH-1.1 referenceStats) beyond the simple fallback here is SH-1.5.
// ---------------------------------------------------------------------------

import type { ComparableMetricBlock } from "@/types/analytics"

// Strong winner language — a SOLID green fill with white bold text (house green
// #059669, the RITMO "Concluído" green). Deliberately heavier than the old light
// tint so the winning cell reads as the clear "melhor" at a glance. Travels
// INLINE (house CSS-STALE IMMUNITY pattern) so the highlight never drops out.
const WIN_BG = "#059669"
const WIN_TEXT = "#ffffff"
const BAR_TRACK = "var(--color-bg-hover)"
const BAR_WIN_FILL = "#059669" // winner bar — solid strong green
const BAR_NEUTRAL_FILL = "rgba(0, 0, 0, 0.22)" // loser/neutral rule, lighter

type IndicatorFormat = "pct" | "decimal1" | "int"

interface CompareIndicator {
  key: string
  /** Short column header (pt-BR), shown uppercase. */
  label: string
  subject: number | null
  reference: number | null
  format: IndicatorFormat
  /** Optional value suffix, e.g. "/7". */
  suffix?: string
  /** true → the value is a 0–100 percentage and gets the green progress bar. */
  isPct?: boolean
}

/** Which side wins an indicator (higher value = better). null = tie or missing. */
type Winner = "subject" | "reference" | null

/** Per-student average of a raw count (guards totalStudents = 0). */
function perStudent(total: number, students: number): number {
  return students > 0 ? Math.round(total / students) : 0
}

/** Coalesce optional/undefined metric fields to null (no `?? undefined` traps). */
function opt(n: number | undefined): number | null {
  return typeof n === "number" ? n : null
}

/**
 * Build the 5 comparison columns Hugo confirmed, in order:
 * Conclusão consciente · Profundidade /7 · Conclusão % · Consistência (dias) ·
 * Reflexões. Pure and exported for unit testing. The reference is the UNIDADE
 * average (per-student where a raw count would be apples-to-oranges), with the
 * SH-1.1 `referenceStats` median as the graceful fallback where present.
 */
export function buildCompareIndicators(
  student: ComparableMetricBlock,
  unit: ComparableMetricBlock,
): CompareIndicator[] {
  return [
    {
      key: "conscious",
      label: "Conclusão consciente",
      subject: opt(student.consciousCompletionPct),
      reference:
        opt(unit.consciousCompletionPct) ?? opt(unit.referenceStats?.completionPct.median) ?? null,
      format: "pct",
      isPct: true,
    },
    {
      key: "depth",
      label: "Profundidade",
      subject: opt(student.avgDepth),
      reference: opt(unit.avgDepth) ?? opt(unit.referenceStats?.avgDepth?.median) ?? null,
      format: "decimal1",
      suffix: "/7",
    },
    {
      key: "completion",
      label: "Conclusão",
      subject: opt(student.completionPct),
      reference: opt(unit.completionPct) ?? opt(unit.referenceStats?.completionPct.median) ?? null,
      format: "pct",
      isPct: true,
    },
    {
      key: "consistency",
      label: "Consistência (dias)",
      subject: opt(student.distinctActiveDays),
      reference: opt(unit.distinctActiveDays),
      format: "int",
    },
    {
      key: "reflections",
      label: "Reflexões",
      subject: student.reflectionCount,
      reference: perStudent(unit.reflectionCount, unit.totalStudents),
      format: "int",
    },
  ]
}

/** The winning side of an indicator (higher = better). Tie/missing → null. */
export function winnerOf(subject: number | null, reference: number | null): Winner {
  if (subject === null || reference === null) return null
  if (subject > reference) return "subject"
  if (reference > subject) return "reference"
  return null
}

function formatValue(v: number | null, format: IndicatorFormat, suffix?: string): string {
  if (v === null) return "—"
  const base =
    format === "pct"
      ? `${Math.round(v)}%`
      : format === "decimal1"
        ? v.toFixed(1)
        : String(Math.round(v))
  return suffix ? `${base}${suffix}` : base
}

/**
 * One value cell. `win` paints the STRONG green winner badge; otherwise neutral
 * (`dim` = the reference row's lighter weight when it is not the winner).
 */
function ValueCell({
  testid,
  value,
  win,
  dim,
}: {
  testid: string
  value: string
  win: boolean
  dim: boolean
}) {
  if (win) {
    return (
      <span
        data-testid={testid}
        data-win="true"
        style={{ backgroundColor: WIN_BG, color: WIN_TEXT }}
        className="inline-flex items-center rounded-full px-3 py-1 text-sm font-bold tabular-nums shadow-sm"
      >
        {value}
      </span>
    )
  }
  return (
    <span
      data-testid={testid}
      data-win="false"
      className={`text-sm tabular-nums ${dim ? "font-medium text-text-muted" : "font-semibold text-text-primary"}`}
    >
      {value}
    </span>
  )
}

/** Progress bar for the % indicators: green (winner) / neutral (loser). */
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

export function ComparisonInsightsTable({
  student,
  unit,
  unitName,
}: {
  student: ComparableMetricBlock
  unit: ComparableMetricBlock
  unitName: string
}) {
  const indicators = buildCompareIndicators(student, unit)
  const winners = indicators.map((ind) => winnerOf(ind.subject, ind.reference))

  return (
    <div className="overflow-x-auto" data-testid="comparison-insights-table">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="px-4 py-3 text-left" />
            {indicators.map((ind) => (
              <th
                key={ind.key}
                className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-text-muted"
              >
                {ind.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Você — the winning cells glow strong green; losers stay neutral. */}
          <tr data-testid="row-subject">
            <td className="px-4 py-4 text-left">
              <span className="text-[15px] font-bold text-text-primary">Você</span>
            </td>
            {indicators.map((ind, i) => {
              const win = winners[i] === "subject"
              return (
                <td key={ind.key} className="px-4 py-4 text-center">
                  <ValueCell
                    testid={`cell-subject-${ind.key}`}
                    value={formatValue(ind.subject, ind.format, ind.suffix)}
                    win={win}
                    dim={false}
                  />
                  {ind.isPct && <PctBar pct={ind.subject} win={win} />}
                </td>
              )
            })}
          </tr>
          {/* Média — lighter by default, but a WINNING cell glows strong green too. */}
          <tr
            data-testid="row-reference"
            style={{ borderTop: "1px solid var(--color-border-subtle)" }}
          >
            <td className="px-4 py-4 text-left">
              <span className="text-sm font-medium text-text-muted">Média · {unitName}</span>
            </td>
            {indicators.map((ind, i) => {
              const win = winners[i] === "reference"
              return (
                <td key={ind.key} className="px-4 py-4 text-center">
                  <ValueCell
                    testid={`cell-reference-${ind.key}`}
                    value={formatValue(ind.reference, ind.format, ind.suffix)}
                    win={win}
                    dim={!win}
                  />
                  {ind.isPct && <PctBar pct={ind.reference} win={win} />}
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
