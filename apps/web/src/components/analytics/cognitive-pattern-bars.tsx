"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { CognitivePatternAggregated } from "@/types/analytics"

const CHART_THEME = {
  grid: "rgba(255,255,255,0.1)",
  axis: "var(--color-text-secondary, #a0a0a0)",
  tooltipBg: "var(--color-bg-card, #1e1e1e)",
  tooltipBorder: "1px solid rgba(255,255,255,0.1)",
  tooltipText: "var(--color-text-primary, #ffffff)",
  bar: "var(--color-accent-blue-mid, #2a6ab0)",
} as const

interface CognitivePatternBarsProps {
  patterns: CognitivePatternAggregated[]
}

export function CognitivePatternBars({ patterns }: CognitivePatternBarsProps) {
  if (patterns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Padroes Cognitivos Recorrentes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-4 text-center text-sm text-text-muted">
            Nenhum padrao cognitivo identificado ainda.
          </p>
        </CardContent>
      </Card>
    )
  }

  const chartData = patterns.slice(0, 10).map((p) => ({
    pattern: p.pattern.length > 25 ? `${p.pattern.slice(0, 22)}...` : p.pattern,
    fullPattern: p.pattern,
    count: p.count,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Padroes Cognitivos Recorrentes</CardTitle>
      </CardHeader>
      <CardContent>
        <div aria-label="Grafico de padroes cognitivos" role="img">
          <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 40)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 120, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} horizontal={false} />
              <XAxis type="number" stroke={CHART_THEME.axis} fontSize={11} tickLine={false} />
              <YAxis
                type="category"
                dataKey="pattern"
                stroke={CHART_THEME.axis}
                fontSize={11}
                tickLine={false}
                width={110}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: CHART_THEME.tooltipBg,
                  border: CHART_THEME.tooltipBorder,
                  borderRadius: "6px",
                  color: CHART_THEME.tooltipText,
                }}
                formatter={(value) => [`${value}x`]}
              />
              <Bar dataKey="count" fill={CHART_THEME.bar} radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Screen reader fallback */}
        <table className="sr-only">
          <caption>Padroes cognitivos recorrentes</caption>
          <thead>
            <tr>
              <th>Padrao</th>
              <th>Ocorrencias</th>
              <th>Ultima vez</th>
            </tr>
          </thead>
          <tbody>
            {patterns.map((p) => (
              <tr key={p.pattern}>
                <td>{p.pattern}</td>
                <td>{p.count}</td>
                <td>{p.lastSeen}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
