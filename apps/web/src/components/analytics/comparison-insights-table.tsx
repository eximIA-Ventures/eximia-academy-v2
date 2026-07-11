// ---------------------------------------------------------------------------
// ComparisonInsightsTable — "Como me comparo", 2 rows, indicators in COLUMNS
// ---------------------------------------------------------------------------
// SH-1.4 UX rework (Hugo, 2026-07-11). The comparison view is a 2-ROW table:
// "Você" and "Média · {unidade}", with the INDICATORS as COLUMNS — the EXACT
// same visual grammar as the manager "Tabela simplificada" (student-insights-
// table.tsx): the same `<table>` markup, the same uppercase-muted headers, the
// same clean bordered rows, the same green progress bar (#10b981 on the
// bg-hover track) and the same green "No ritmo" badge (RITMO_BADGE, reused
// verbatim from ritmo-badge.tsx — one palette, one taxonomy).
//
// TWO invariants baked in:
//   • HOT only where "Você" STANDS OUT. A cell where the subject beats the
//     reference gets the warm green badge/bar. Being at or below the reference
//     is NEUTRAL grey — never red, never punitive (the whole reason the old
//     indicator-per-row spine was reworked). The "Média" row is a NEUTRAL rule,
//     visually lighter than "Você" in every column.
//   • No misleading "+525%". No relative-percentage delta is ever shown; the
//     comparison is the raw values + the honest green bar for the % indicators.
//
// Pure presentation. Card-less: the container (StudentHomeCard) owns the Card,
// the subtitle and the Tabela/Barras sub-toggle. Median/IQR reanchoring of the
// reference (SH-1.1 referenceStats) beyond the simple fallback here is SH-1.5.
// ---------------------------------------------------------------------------

import type { ComparableMetricBlock } from "@/types/analytics"
import { RITMO_BADGE } from "./ritmo-badge"

// Green "No ritmo" language, reused verbatim so a strength cell is the EXACT
// same pill the manager sees. #10b981 is the manager progress-bar green too.
const HOT = RITMO_BADGE.no_ritmo // { text: "#10b981", bg: "rgba(16,185,129,0.13)", ... }
const BAR_TRACK = "var(--color-bg-hover)"
const BAR_HOT_FILL = "#10b981"
const BAR_NEUTRAL_FILL = "rgba(0, 0, 0, 0.22)" // média — neutral rule, lighter

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

/** A cell is HOT only when the subject stands out (strictly beats the reference). */
function isHot(subject: number | null, reference: number | null): boolean {
  return subject !== null && reference !== null && subject > reference
}

/** One value cell. `hot` paints the green strength badge; otherwise neutral. */
function ValueCell({
  value,
  hot,
  muted,
}: {
  value: string
  hot: boolean
  muted: boolean
}) {
  if (hot) {
    return (
      <span
        data-hot="true"
        style={{ backgroundColor: HOT.bg, color: HOT.text }}
        className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold tabular-nums"
      >
        {value}
      </span>
    )
  }
  return (
    <span
      data-hot="false"
      className={`text-sm tabular-nums ${muted ? "font-medium text-text-muted" : "font-semibold text-text-primary"}`}
    >
      {value}
    </span>
  )
}

/** The green (você) / neutral (média) progress bar for the % indicators. */
function PctBar({ pct, hot, muted }: { pct: number | null; hot: boolean; muted: boolean }) {
  if (pct === null) return null
  const fill = muted ? BAR_NEUTRAL_FILL : hot ? BAR_HOT_FILL : BAR_NEUTRAL_FILL
  return (
    <div
      style={{ backgroundColor: BAR_TRACK }}
      className="mx-auto mt-2 h-1.5 w-16 overflow-hidden rounded-full"
    >
      {pct > 0 && (
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: fill }}
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
          {/* Você — strengths glow warm green, nothing is punished. */}
          <tr data-testid="row-subject">
            <td className="px-4 py-4 text-left">
              <span className="text-[15px] font-bold text-text-primary">Você</span>
            </td>
            {indicators.map((ind) => {
              const hot = isHot(ind.subject, ind.reference)
              return (
                <td key={ind.key} className="px-4 py-4 text-center">
                  <ValueCell
                    value={formatValue(ind.subject, ind.format, ind.suffix)}
                    hot={hot}
                    muted={false}
                  />
                  {ind.isPct && <PctBar pct={ind.subject} hot={hot} muted={false} />}
                </td>
              )
            })}
          </tr>
          {/* Média — the neutral rule: lighter, never colored, never a verdict. */}
          <tr
            data-testid="row-reference"
            style={{ borderTop: "1px solid var(--color-border-subtle)" }}
          >
            <td className="px-4 py-4 text-left">
              <span className="text-sm font-medium text-text-muted">Média · {unitName}</span>
            </td>
            {indicators.map((ind) => (
              <td key={ind.key} className="px-4 py-4 text-center">
                <ValueCell
                  value={formatValue(ind.reference, ind.format, ind.suffix)}
                  hot={false}
                  muted
                />
                {ind.isPct && <PctBar pct={ind.reference} hot={false} muted />}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
