"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import { useId } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { EmotionalJourneyPoint } from "@/types/analytics"

const CHART_THEME = {
  grid: "rgba(255,255,255,0.1)",
  axis: "var(--color-text-secondary, #a0a0a0)",
  tooltipBg: "var(--color-bg-card, #1e1e1e)",
  tooltipBorder: "1px solid rgba(255,255,255,0.1)",
  tooltipText: "var(--color-text-primary, #ffffff)",
  areaStroke: "var(--color-varzea, #2a7a8a)",
  areaFill: "rgba(45, 157, 143, 0.2)",
} as const

interface EmotionalJourneyChartProps {
  data: EmotionalJourneyPoint[]
}

export function EmotionalJourneyChart({ data }: EmotionalJourneyChartProps) {
  const gradientId = useId()
  const chartData = data.map((d) => ({
    step: `E${d.step}`,
    avgDensity: d.avgDensity,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Jornada Emocional Media</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <div aria-label="Jornada emocional media da turma" role="img">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_THEME.areaStroke} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={CHART_THEME.areaStroke} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                <XAxis dataKey="step" stroke={CHART_THEME.axis} fontSize={11} tickLine={false} />
                <YAxis stroke={CHART_THEME.axis} fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: CHART_THEME.tooltipBg,
                    border: CHART_THEME.tooltipBorder,
                    borderRadius: "6px",
                    color: CHART_THEME.tooltipText,
                  }}
                  formatter={(value) => [`${value}`, "Densidade"]}
                />
                <Area
                  type="monotone"
                  dataKey="avgDensity"
                  stroke={CHART_THEME.areaStroke}
                  fill={`url(#${gradientId})`}
                  strokeWidth={2}
                  name="Densidade Emocional"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-text-muted">
            Sem dados de jornada emocional no período.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
