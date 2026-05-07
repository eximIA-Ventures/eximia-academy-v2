"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts"
import type { EvolutionPoint } from "@/types/analytics"

const CHART_THEME = {
  grid: "rgba(255,255,255,0.1)",
  axis: "var(--color-text-secondary, #a0a0a0)",
  tooltipBg: "var(--color-bg-card, #1e1e1e)",
  tooltipBorder: "1px solid rgba(255,255,255,0.1)",
  tooltipText: "var(--color-text-primary, #ffffff)",
  depthLine: "var(--color-cerrado-600, #2a6ab0)",
  densityLine: "var(--color-varzea, #2a7a8a)",
  kolbPoint: "var(--color-accent-gold, #c4a040)",
} as const

interface DepthProgressionChartProps {
  evolution: EvolutionPoint[]
}

export function DepthProgressionChart({ evolution }: DepthProgressionChartProps) {
  if (evolution.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolução de Profundidade</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-text-muted">
            Sem dados de evolução disponíveis.
          </p>
        </CardContent>
      </Card>
    )
  }

  const depthData = evolution.map((e, i) => ({
    session: `S${i + 1}`,
    depth: e.depthReached,
    density: e.avgEmotionalDensity,
    date: new Date(e.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
  }))

  const kolbData = evolution
    .filter((e) => e.kolbGrasping != null && e.kolbTransforming != null)
    .map((e) => ({
      x: e.kolbGrasping!,
      y: e.kolbTransforming!,
      date: new Date(e.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
    }))

  return (
    <div className="space-y-6">
      {/* Depth over sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profundidade ao Longo das Sessões</CardTitle>
        </CardHeader>
        <CardContent>
          <div aria-label="Evolução de profundidade por sessão" role="img">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={depthData}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                <XAxis dataKey="session" stroke={CHART_THEME.axis} fontSize={11} tickLine={false} />
                <YAxis domain={[0, 7]} stroke={CHART_THEME.axis} fontSize={11} tickLine={false} />
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
                  name="Profundidade"
                />
                {depthData.some((d) => d.density != null) && (
                  <Line
                    type="monotone"
                    dataKey="density"
                    stroke={CHART_THEME.densityLine}
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    dot={{ fill: CHART_THEME.densityLine, r: 2 }}
                    name="Densidade Emocional"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Kolb vector trail */}
      {kolbData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trajetória Kolb</CardTitle>
          </CardHeader>
          <CardContent>
            <div aria-label="Trajetória Kolb ao longo das sessões" role="img">
              <ResponsiveContainer width="100%" height={280}>
                <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                  <XAxis
                    type="number"
                    dataKey="x"
                    domain={[-1, 1]}
                    stroke={CHART_THEME.axis}
                    fontSize={11}
                    tickLine={false}
                    label={{
                      value: "Grasping (CE ← → AC)",
                      position: "bottom",
                      offset: 10,
                      fill: CHART_THEME.axis,
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    domain={[-1, 1]}
                    stroke={CHART_THEME.axis}
                    fontSize={11}
                    tickLine={false}
                    label={{
                      value: "Transforming",
                      angle: -90,
                      position: "insideLeft",
                      offset: -5,
                      fill: CHART_THEME.axis,
                      fontSize: 11,
                    }}
                  />
                  <ReferenceLine x={0} stroke={CHART_THEME.grid} />
                  <ReferenceLine y={0} stroke={CHART_THEME.grid} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: CHART_THEME.tooltipBg,
                      border: CHART_THEME.tooltipBorder,
                      borderRadius: "6px",
                      color: CHART_THEME.tooltipText,
                    }}
                  />
                  <Scatter
                    data={kolbData}
                    fill={CHART_THEME.kolbPoint}
                    line={{ stroke: CHART_THEME.kolbPoint, strokeWidth: 1 }}
                    name="Trajetória Kolb"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-center text-xs text-text-muted">
              {kolbData.length} sessões com vetor Kolb (conectadas cronologicamente)
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
