"use client"

/**
 * ModuleEngagementChart — Item 5
 *
 * "Sessões + Engajamento por Módulo"
 *
 * Shows per chapter (módulo):
 *   • Number of sessions (bar, left scale)
 *   • Engagement rate % (line/dot overlay, right scale)
 *
 * Engagement rate per module is defined as the same formula used in item 2.3
 * (indicator 2.3) at the aggregate level, but scoped down to a single chapter:
 *
 *   engagementRate(chapter) = (reflectionsWritten + socraticRealized) /
 *                             (reflectionPotential + socraticPotential)  × 100
 *
 * This data is already available in `indicators.perModule` returned by the
 * `/api/analytics/aggregate` route. The component accepts `ModuleIndicator[]`
 * from `@/types/analytics` (the `ReflectionSocraticIndicators.perModule` field)
 * plus the `ModuleAccessItem[]` already present in the dashboard to get the
 * session count per chapter.
 *
 * ---------------------------------------------------------------------------
 * API REQUIREMENTS (note for integrator / backend team):
 * ---------------------------------------------------------------------------
 * The component needs two data arrays:
 *
 *   1. `indicators: ModuleIndicator[]`  — from `data.indicators?.perModule`.
 *      Already returned by `/api/analytics/aggregate` (FASE 1a). No changes
 *      needed to the aggregate route.
 *
 *   2. `moduleAccess: ModuleAccessItem[]` — already a prop of AnalyticsDashboard.
 *      Already provided by the analytics page.tsx.
 *
 * NO new API fields are required. If `indicators` is undefined (e.g. the route
 * hasn't been called yet or the scope has no chapters), the component falls
 * back to showing only session bars with engagement shown as "—".
 *
 * ---------------------------------------------------------------------------
 * Integration note for analytics-dashboard.tsx:
 * ---------------------------------------------------------------------------
 *   import { ModuleEngagementChart } from "./module-engagement-chart"
 *
 *   // In the "uso" tab, after the ModuleFunnelCombined card:
 *   <ModuleEngagementChart
 *     moduleAccess={filteredModuleAccess}
 *     indicators={currentData.indicators?.perModule}
 *   />
 *
 * The component is self-contained; it does NOT need to be inside the
 * lg:grid-cols-3 layout (it spans the full width for readability).
 */

import type { ModuleIndicator } from "@/types/analytics"
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModuleAccessItem {
  chapterTitle: string
  chapterOrder: number
  courseId: string
  /** Present when the server returns it; used as stable join key. */
  chapterId?: string
  sessionCount: number
  completedCount: number
  studentCount: number
}

interface ModuleEngagementChartProps {
  moduleAccess: ModuleAccessItem[]
  /**
   * `indicators?.perModule` from AggregateAnalyticsResponse.
   * Optional: if absent, engagement bars render as 0 and a note is shown.
   */
  indicators?: ModuleIndicator[]
  /** Optional CSS class on the outer container. */
  className?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHART_THEME = {
  grid: "rgba(128,128,128,0.12)",
  axis: "var(--color-text-secondary, #a0a0a0)",
  sessionBar: "var(--color-cerrado-600, #2a6ab0)",
  engagementLine: "#f59e0b", // amber-400 — distinct from session bar
  tooltipBg: "var(--color-bg-card, #1e1e1e)",
  tooltipBorder: "1px solid rgba(255,255,255,0.1)",
  tooltipText: "var(--color-text-primary, #ffffff)",
} as const

/**
 * Derive per-module engagement rate from ModuleIndicator.
 *
 *   engagementPct = (reflectionsWritten + socraticRealized)
 *                  / (reflectionPotential + socraticPotential) × 100
 *
 * Returns null if both potentials are 0 (chapter has no reflections or
 * socratic interactions defined → engagement is undefined, not 0%).
 */
function moduleEngagementPct(ind: ModuleIndicator): number | null {
  const potential = ind.reflectionPotential + ind.socraticPotential
  if (potential === 0) return null
  const realized = ind.reflectionsWritten + ind.socraticRealized
  return Math.round((realized / potential) * 100 * 10) / 10 // 1 decimal
}

interface ChartRow {
  label: string
  sessionCount: number
  engagementPct: number | null
  /** Used in tooltip for display */
  fullTitle: string
}

function buildChartData(
  access: ModuleAccessItem[],
  indicators: ModuleIndicator[] | undefined,
): ChartRow[] {
  // Sort access by chapterOrder
  const sorted = [...access].sort((a, b) => a.chapterOrder - b.chapterOrder)

  // Index indicators by chapterId (always present on ModuleIndicator) for a
  // stable key that avoids collisions across courses sharing a chapter title.
  // On the access side, prefer chapterId when the server supplies it; otherwise
  // fall back to courseId + "::" + chapterTitle.
  const indMap = new Map<string, ModuleIndicator>()
  for (const ind of indicators ?? []) {
    indMap.set(ind.chapterId, ind)
  }

  return sorted.map((a) => {
    // Build the same lookup key used when indexing indicators above.
    const key = a.chapterId ?? `${a.courseId}::${a.chapterTitle}`
    const ind = indMap.get(key)
    // Truncate title for axis (max 14 chars) to keep chart readable
    const truncated =
      a.chapterTitle.length > 14 ? `${a.chapterTitle.slice(0, 12)}…` : a.chapterTitle
    return {
      label: truncated,
      sessionCount: a.sessionCount,
      engagementPct: ind ? moduleEngagementPct(ind) : null,
      fullTitle: a.chapterTitle,
    }
  })
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

interface TooltipEntry {
  name: string
  value: number | null
  color: string
  payload?: ChartRow
}

interface TooltipProps {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  return (
    <div
      style={{
        backgroundColor: CHART_THEME.tooltipBg,
        border: CHART_THEME.tooltipBorder,
        borderRadius: 8,
        padding: "8px 12px",
        color: CHART_THEME.tooltipText,
        fontSize: 11,
        minWidth: 160,
      }}
    >
      <p className="font-semibold mb-1">{row?.fullTitle ?? label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}:{" "}
          <span className="font-bold tabular-nums">
            {p.value !== null && p.value !== undefined
              ? p.name === "Engajamento"
                ? `${p.value}%`
                : p.value
              : "—"}
          </span>
        </p>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ModuleEngagementChart({
  moduleAccess,
  indicators,
  className = "",
}: ModuleEngagementChartProps) {
  const chartData = buildChartData(moduleAccess, indicators)

  if (chartData.length === 0) return null

  const hasEngagement = chartData.some((r) => r.engagementPct !== null)
  const avgEngagement = hasEngagement
    ? Math.round(
        (chartData
          .filter((r) => r.engagementPct !== null)
          .reduce((s, r) => s + (r.engagementPct ?? 0), 0) /
          chartData.filter((r) => r.engagementPct !== null).length) *
          10,
      ) / 10
    : null

  return (
    <div
      className={`rounded-2xl bg-white dark:bg-bg-card p-5 shadow-card dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06] space-y-4 ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Sessões + Engajamento por Módulo
          </h3>
          <p className="text-[9px] text-text-muted mt-0.5">
            Barras: nº de sessões · Linha: taxa de engajamento por módulo
            {!hasEngagement && (
              <span className="ml-1 text-amber-500">
                (engajamento indisponível — indicators não retornados pelo servidor)
              </span>
            )}
          </p>
        </div>
        {/* Summary pill */}
        {avgEngagement !== null && (
          <div className="shrink-0 rounded-xl bg-amber-500/10 px-3 py-1.5 text-center">
            <p className="text-[9px] text-text-muted">Eng. médio</p>
            <p className="text-sm font-bold text-amber-500 tabular-nums">{avgEngagement}%</p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-[10px] text-text-muted">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: CHART_THEME.sessionBar }}
          />
          Sessões
        </span>
        {hasEngagement && (
          <span className="flex items-center gap-1.5 text-[10px] text-text-muted">
            <span
              className="inline-block h-0.5 w-5 rounded-full"
              style={{ backgroundColor: CHART_THEME.engagementLine }}
            />
            Engajamento (%)
          </span>
        )}
      </div>

      {/* Chart */}
      <div aria-label="Gráfico combinado: sessões e engajamento por módulo" role="img">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart
            data={chartData}
            margin={{ top: 8, right: hasEngagement ? 40 : 8, left: 0, bottom: 32 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} vertical={false} />
            <XAxis
              dataKey="label"
              stroke={CHART_THEME.axis}
              fontSize={10}
              tickLine={false}
              angle={-35}
              textAnchor="end"
              height={50}
              interval={0}
            />
            {/* Left Y-axis: session count */}
            <YAxis
              yAxisId="sessions"
              orientation="left"
              stroke={CHART_THEME.axis}
              fontSize={10}
              tickLine={false}
              width={32}
              allowDecimals={false}
            />
            {/* Right Y-axis: engagement % (0–100) */}
            {hasEngagement && (
              <YAxis
                yAxisId="engagement"
                orientation="right"
                stroke={CHART_THEME.engagementLine}
                fontSize={10}
                tickLine={false}
                width={36}
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
              />
            )}
            <Tooltip content={<CustomTooltip />} />

            {/* Session bars */}
            <Bar
              yAxisId="sessions"
              dataKey="sessionCount"
              name="Sessões"
              fill={CHART_THEME.sessionBar}
              fillOpacity={0.75}
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />

            {/* Engagement line (only when data available) */}
            {hasEngagement && (
              <>
                {/* Average reference line */}
                {avgEngagement !== null && (
                  <ReferenceLine
                    yAxisId="engagement"
                    y={avgEngagement}
                    stroke={CHART_THEME.engagementLine}
                    strokeDasharray="4 4"
                    strokeOpacity={0.4}
                    label={{
                      value: `Média: ${avgEngagement}%`,
                      position: "insideTopRight",
                      fontSize: 9,
                      fill: CHART_THEME.engagementLine,
                    }}
                  />
                )}
                <Line
                  yAxisId="engagement"
                  type="monotone"
                  dataKey="engagementPct"
                  name="Engajamento"
                  stroke={CHART_THEME.engagementLine}
                  strokeWidth={2}
                  dot={{ fill: CHART_THEME.engagementLine, r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Screen-reader table fallback */}
      <table className="sr-only">
        <caption>Sessões e engajamento por módulo</caption>
        <thead>
          <tr>
            <th>Módulo</th>
            <th>Sessões</th>
            <th>Engajamento (%)</th>
          </tr>
        </thead>
        <tbody>
          {chartData.map((row) => (
            <tr key={row.fullTitle}>
              <td>{row.fullTitle}</td>
              <td>{row.sessionCount}</td>
              <td>{row.engagementPct !== null ? `${row.engagementPct}%` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
