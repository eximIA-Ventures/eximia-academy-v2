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
import type { SessionMetrics } from "@/types/analytics"

const CHART_THEME = {
  grid: "rgba(255,255,255,0.1)",
  axis: "var(--color-text-secondary, #a0a0a0)",
  tooltipBg: "var(--color-bg-card, #1e1e1e)",
  tooltipBorder: "1px solid rgba(255,255,255,0.1)",
  tooltipText: "var(--color-text-primary, #ffffff)",
  line: "var(--color-varzea, #2a7a8a)",
} as const

interface SessionMetricsPanelProps {
  metrics: SessionMetrics
}

function MetricItem({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="flex items-center justify-between  py-3 last:border-0">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm font-medium text-text-primary">{value ?? "—"}</span>
    </div>
  )
}

function kolbStyleFromAxes(grasping: number, transforming: number): string {
  if (grasping >= 0 && transforming >= 0) return "Acomodador"
  if (grasping >= 0 && transforming < 0) return "Divergente"
  if (grasping < 0 && transforming >= 0) return "Convergente"
  return "Assimilador"
}

export function SessionMetricsPanel({ metrics }: SessionMetricsPanelProps) {
  const densityData = metrics.emotionalDensityProgression.map((d, i) => ({
    turn: `T${i + 1}`,
    density: Math.round(d * 100) / 100,
  }))

  const kolb = metrics.kolbSessionVector
  const kolbStyle = kolb ? kolbStyleFromAxes(kolb.graspingAxis, kolb.transformingAxis) : null

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Key metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Métricas da Sessão</CardTitle>
          </CardHeader>
          <CardContent>
            <MetricItem label="Nível de abstração" value={metrics.abstractionLevel} />
            <MetricItem
              label="Certeza vs Exploração"
              value={
                metrics.certaintyVsExploration != null
                  ? metrics.certaintyVsExploration > 0
                    ? `Exploração (+${metrics.certaintyVsExploration.toFixed(2)})`
                    : `Certeza (${metrics.certaintyVsExploration.toFixed(2)})`
                  : null
              }
            />
            <MetricItem
              label="Defesa ativa"
              value={
                metrics.defenseActive != null
                  ? metrics.defenseActive
                    ? "Sim"
                    : "Não"
                  : null
              }
            />
          </CardContent>
        </Card>

        {/* Kolb session vector */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kolb desta Sessão</CardTitle>
          </CardHeader>
          <CardContent>
            {kolb ? (
              <>
                <MetricItem label="Grasping (CE ← → AC)" value={kolb.graspingAxis.toFixed(2)} />
                <MetricItem label="Transforming (RO ← → AE)" value={kolb.transformingAxis.toFixed(2)} />
                <MetricItem label="Indicadores" value={kolb.indicatorsCount} />
                <MetricItem label="Tendência" value={kolbStyle} />
              </>
            ) : (
              <p className="py-4 text-sm text-text-muted">Dados Kolb indisponíveis para esta sessão.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Emotional density progression */}
      {densityData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Densidade Emocional por Turno</CardTitle>
          </CardHeader>
          <CardContent>
            <div aria-label="Gráfico de densidade emocional" role="img">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={densityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                  <XAxis dataKey="turn" stroke={CHART_THEME.axis} fontSize={11} tickLine={false} />
                  <YAxis stroke={CHART_THEME.axis} fontSize={11} tickLine={false} />
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
                    dataKey="density"
                    stroke={CHART_THEME.line}
                    strokeWidth={2}
                    dot={{ fill: CHART_THEME.line, r: 2 }}
                    name="Densidade"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
