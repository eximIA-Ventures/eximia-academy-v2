"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

/** Design token references for Recharts (requires JS values, not CSS classes) */
const CHART_THEME = {
  grid: "rgba(255,255,255,0.1)", // --color-border-subtle
  axis: "var(--color-text-secondary, #a0a0a0)",
  tooltipBg: "var(--color-bg-card, #1e1e1e)", // --color-bg-card
  tooltipBorder: "1px solid rgba(255,255,255,0.1)", // --color-border-subtle
  tooltipText: "var(--color-text-primary, #ffffff)", // --color-text-primary
  line: "var(--color-cerrado-600, #2a6ab0)", // --color-cerrado-600
} as const

interface EngagementChartProps {
  data: Array<{ week: string; sessions: number }>
}

export function EngagementChart({ data }: EngagementChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Engajamento ao Longo do Tempo</CardTitle>
      </CardHeader>
      <CardContent>
        <div aria-label="Grafico de sessoes por semana nas ultimas 12 semanas" role="img">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
              <XAxis dataKey="week" stroke={CHART_THEME.axis} fontSize={12} tickLine={false} />
              <YAxis stroke={CHART_THEME.axis} fontSize={12} tickLine={false} />
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
                dataKey="sessions"
                stroke={CHART_THEME.line}
                strokeWidth={2}
                dot={{ fill: CHART_THEME.line, r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {/* Screen reader fallback */}
        <table className="sr-only">
          <caption>Sessões completadas por semana</caption>
          <thead>
            <tr>
              <th>Semana</th>
              <th>Sessões</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.week}>
                <td>{d.week}</td>
                <td>{d.sessions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
