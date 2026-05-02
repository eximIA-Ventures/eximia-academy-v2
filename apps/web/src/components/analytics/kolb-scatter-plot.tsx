"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts"

const CHART_THEME = {
  grid: "rgba(255,255,255,0.1)",
  axis: "var(--color-text-secondary, #a0a0a0)",
  tooltipBg: "var(--color-bg-card, #1e1e1e)",
  tooltipBorder: "1px solid rgba(255,255,255,0.1)",
  tooltipText: "var(--color-text-primary, #ffffff)",
  aiPoint: "var(--color-accent-blue-mid, #2a6ab0)",
  testPoint: "var(--color-accent-gold, #c4a040)",
} as const

interface KolbScatterPlotProps {
  aiGrasping: number | null
  aiTransforming: number | null
  aiStyle: string | null
  aiConfidence: number | null
  testStyle: string | null
}

export function KolbScatterPlot({
  aiGrasping,
  aiTransforming,
  aiStyle,
  aiConfidence,
  testStyle,
}: KolbScatterPlotProps) {
  const hasData = aiGrasping != null && aiTransforming != null

  const aiData = hasData ? [{ x: aiGrasping, y: aiTransforming, label: "IA" }] : []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Kolb — Posicao no Plano</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <>
            <div aria-label="Grafico Kolb do aluno" role="img">
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
                      value: "Transforming (RO ← → AE)",
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
                    formatter={(value) => [typeof value === "number" ? value.toFixed(2) : String(value)]}
                  />
                  <Scatter
                    name="IA"
                    data={aiData}
                    fill={CHART_THEME.aiPoint}
                    shape="circle"
                    legendType="circle"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-text-secondary">
              {aiStyle && (
                <span>
                  Estilo IA: <strong className="text-text-primary">{aiStyle}</strong>
                </span>
              )}
              {aiConfidence != null && (
                <span>
                  Confianca: <strong className="text-text-primary">{Math.round(aiConfidence * 100)}%</strong>
                </span>
              )}
              {testStyle && (
                <span>
                  Estilo Teste: <strong className="text-accent-gold">{testStyle}</strong>
                </span>
              )}
            </div>
          </>
        ) : (
          <p className="py-8 text-center text-sm text-text-muted">
            Dados insuficientes para plotar o grafico Kolb.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
