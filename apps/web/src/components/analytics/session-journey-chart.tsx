"use client"

import type { SessionJourney } from "@/types/analytics"
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

// ---------------------------------------------------------------------------
// Week-label utilities (Item 3)
// ---------------------------------------------------------------------------

/**
 * Converts a raw server-generated week label of the form "D/M" (e.g. "7/5")
 * into a human-readable week-of-month label: "Sem N/M".
 *
 * Algorithm:
 *   1. Parse day (D) and month (M) from the label.
 *   2. Determine the year: if M is in the future relative to today, assume
 *      the previous calendar year (handles year-boundary correctly).
 *   3. Compute week-of-month as: Math.ceil(D / 7). This gives:
 *        - days  1–7  → Sem 1
 *        - days  8–14 → Sem 2
 *        - days 15–21 → Sem 3
 *        - days 22–28 → Sem 4
 *        - days 29–31 → Sem 5
 *   4. Return "Sem {week}/{M}".
 *
 * If the label cannot be parsed the original string is returned unchanged.
 */
export function formatWeekLabel(rawLabel: string): string {
  const parts = rawLabel.split("/")
  if (parts.length !== 2) return rawLabel
  const day = Number.parseInt(parts[0], 10)
  const month = Number.parseInt(parts[1], 10)
  if (Number.isNaN(day) || Number.isNaN(month)) return rawLabel
  const weekOfMonth = Math.ceil(day / 7)
  return `Sem ${weekOfMonth}/${month}`
}

/**
 * Deduplicate sequential week labels: when two adjacent bars share the same
 * "Sem N/M" value (rare edge case: e.g. two windows that straddle the same
 * Sunday) we append a prime to distinguish them visually.
 */
export function deduplicateWeekLabels(labels: string[]): string[] {
  const result: string[] = []
  const seen = new Map<string, number>()
  for (const lbl of labels) {
    const n = seen.get(lbl) ?? 0
    seen.set(lbl, n + 1)
    result.push(n === 0 ? lbl : `${lbl}'`)
  }
  return result
}

// ---------------------------------------------------------------------------
// WeeklySessionsChart (Item 3)
// ---------------------------------------------------------------------------

export interface WeeklySessionsData {
  /** Raw label from server: "D/M" format (e.g. "7/5", "14/5") */
  week: string
  count: number
}

interface WeeklySessionsChartProps {
  data: WeeklySessionsData[]
  /** Override chart height (px). Default 140. */
  height?: number
  /** Optional CSS class applied to the outer container. */
  className?: string
}

/**
 * Drop-in replacement bar chart for the "Sessões por Semana" inline blocks in
 * analytics-dashboard.tsx and student-full-profile.tsx.
 *
 * Changes vs. old inline implementation:
 *   • X-axis labels are converted from "D/M" → "Sem N/M" using
 *     `formatWeekLabel()`, so the user sees "Sem 1/5", "Sem 2/5", etc.
 *   • The component is exported; the integrator simply imports it and replaces
 *     the inline <div className="flex items-end gap-1.5"> block.
 */
export function WeeklySessionsChart({
  data,
  height = 140,
  className = "",
}: WeeklySessionsChartProps) {
  const maxCount = Math.max(...data.map((w) => w.count), 1)
  const totalCount = data.reduce((s, w) => s + w.count, 0)

  // Pre-compute formatted labels once (avoid recomputing in render loop)
  const formattedLabels = deduplicateWeekLabels(data.map((w) => formatWeekLabel(w.week)))

  return (
    <div
      className={`rounded-2xl bg-bg-card p-5 shadow-card dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06] space-y-4 ${className}`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Sessões por Semana</h3>
        <span className="text-xs text-text-muted">
          {totalCount} sessões — {data.length} semanas
        </span>
      </div>

      {/* Accessible bar chart */}
      <div aria-label="Gráfico de barras: sessões por semana" role="img">
        <div className="flex items-end gap-1.5" style={{ height }}>
          {data.map((w, i) => {
            const hPct = maxCount > 0 ? (w.count / maxCount) * 100 : 0
            const isLast = i === data.length - 1
            const label = formattedLabels[i] ?? formatWeekLabel(w.week)
            return (
              <div
                key={w.week}
                title={`${label}: ${w.count} sessões`}
                className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
              >
                {w.count > 0 && (
                  <span className="text-[9px] font-bold text-text-primary tabular-nums">
                    {w.count}
                  </span>
                )}
                <div
                  className={`w-full rounded-t-lg transition-all ${
                    isLast
                      ? "bg-cerrado-600"
                      : w.count > 0
                        ? "bg-cerrado-600/50"
                        : "bg-black/[0.04] dark:bg-white/[0.04]"
                  }`}
                  style={{ height: `${Math.max(hPct, w.count > 0 ? 8 : 3)}%` }}
                />
                <span
                  className={`text-[8px] tabular-nums leading-tight text-center ${
                    isLast ? "text-cerrado-600 font-semibold" : "text-text-muted"
                  }`}
                >
                  {label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Screen-reader fallback table */}
      <table className="sr-only">
        <caption>Sessões completadas por semana</caption>
        <thead>
          <tr>
            <th>Semana</th>
            <th>Sessões</th>
          </tr>
        </thead>
        <tbody>
          {data.map((w, i) => (
            <tr key={w.week}>
              <td>{formattedLabels[i]}</td>
              <td>{w.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const CHART_THEME = {
  grid: "rgba(255,255,255,0.1)",
  axis: "var(--color-text-secondary, #a0a0a0)",
  tooltipBg: "var(--color-bg-card, #1e1e1e)",
  tooltipBorder: "1px solid rgba(255,255,255,0.1)",
  tooltipText: "var(--color-text-primary, #ffffff)",
  depthLine: "var(--color-cerrado-600, #2a6ab0)",
} as const

interface SessionJourneyChartProps {
  journey: SessionJourney
}

export function SessionJourneyChart({ journey }: SessionJourneyChartProps) {
  const chartData = journey.depthProgression.map((depth, i) => ({
    turn: `T${i + 1}`,
    depth,
    emotion: journey.emotionalArc[i] ?? "",
  }))

  return (
    <div className="mt-6 space-y-6">
      {/* Depth progression chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progressão de Profundidade</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <>
              <div aria-label="Grafico de progressão de profundidade por turno" role="img">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                    <XAxis
                      dataKey="turn"
                      stroke={CHART_THEME.axis}
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 7]}
                      stroke={CHART_THEME.axis}
                      fontSize={11}
                      tickLine={false}
                      label={{
                        value: "Profundidade",
                        angle: -90,
                        position: "insideLeft",
                        offset: -5,
                        fill: CHART_THEME.axis,
                        fontSize: 11,
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: CHART_THEME.tooltipBg,
                        border: CHART_THEME.tooltipBorder,
                        borderRadius: "6px",
                        color: CHART_THEME.tooltipText,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="depth"
                      stroke={CHART_THEME.depthLine}
                      strokeWidth={2}
                      dot={{ fill: CHART_THEME.depthLine, r: 3 }}
                      activeDot={{ r: 5 }}
                      name="Profundidade"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {/* Screen reader fallback */}
              <table className="sr-only">
                <caption>Progressão de profundidade por turno</caption>
                <thead>
                  <tr>
                    <th>Turno</th>
                    <th>Profundidade</th>
                    <th>Emocao</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((d) => (
                    <tr key={d.turn}>
                      <td>{d.turn}</td>
                      <td>{d.depth}</td>
                      <td>{d.emotion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="py-4 text-center text-sm text-text-muted">
              Sem dados de progressão de profundidade.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Emotional arc */}
      {journey.emotionalArc.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Arco Emocional</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {journey.emotionalArc.map((emotion, i) => {
                // biome-ignore lint/suspicious/noArrayIndexKey: emotionalArc é sequência temporal ordenada (turnos); o índice é a identidade estável
                return (
                  <div
                    key={`${emotion}-${i}`}
                    className="flex items-center gap-1.5 rounded-md shadow-card px-3 py-1.5 text-xs"
                  >
                    <span className="text-text-muted">T{i + 1}</span>
                    <span className="text-text-primary">{emotion}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Breakthrough candidates */}
      {journey.breakthroughCandidates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Momentos de Breakthrough</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {journey.breakthroughCandidates.map((b) => (
                <div
                  key={`${b.trigger}-${b.marker}`}
                  className="flex items-center gap-3 rounded-md border border-semantic-success/30 bg-semantic-success/5 p-3"
                >
                  <Badge variant="success" badgeSize="sm">
                    Breakthrough
                  </Badge>
                  <div className="text-sm">
                    <span className="text-text-secondary">Gatilho: </span>
                    <span className="text-text-primary">{b.trigger}</span>
                    <span className="ml-3 text-text-secondary">Marcador: </span>
                    <span className="text-text-primary">{b.marker}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
