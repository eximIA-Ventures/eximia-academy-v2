"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { DepthDistribution } from "@/types/analytics"

const CHART_THEME = {
  grid: "rgba(255,255,255,0.1)",
  axis: "var(--color-text-secondary, #a0a0a0)",
  tooltipBg: "var(--color-bg-card, #1e1e1e)",
  tooltipBorder: "1px solid rgba(255,255,255,0.1)",
  tooltipText: "var(--color-text-primary, #ffffff)",
} as const

const DEPTH_COLORS = [
  "#6b7280", // 1 - gray
  "#3b82f6", // 2 - blue
  "#2a6ab0", // 3 - cerrado-600
  "#8b5cf6", // 4 - purple
  "#c4a040", // 5 - accent-gold
  "#2a7a8a", // 6 - varzea
  "#10b981", // 7 - green
]

interface DepthDistributionChartProps {
  data: DepthDistribution[]
}

export function DepthDistributionChart({ data }: DepthDistributionChartProps) {
  const chartData = data.map((d) => ({
    name: `${d.level}`,
    label: d.label,
    count: d.count,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Distribuicao de Profundidade</CardTitle>
      </CardHeader>
      <CardContent>
        <div aria-label="Distribuicao de profundidade da turma" role="img">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} vertical={false} />
              <XAxis dataKey="name" stroke={CHART_THEME.axis} fontSize={11} tickLine={false} />
              <YAxis stroke={CHART_THEME.axis} fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: CHART_THEME.tooltipBg,
                  border: CHART_THEME.tooltipBorder,
                  borderRadius: "6px",
                  color: CHART_THEME.tooltipText,
                }}
                formatter={(value, _name, props) => [
                  `${value} sessoes`,
                  (props.payload as { label: string }).label,
                ]}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={30}>
                {chartData.map((_entry, index) => (
                  <Cell key={index} fill={DEPTH_COLORS[index % DEPTH_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
