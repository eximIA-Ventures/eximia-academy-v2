"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { KolbPoint } from "@/types/analytics"

const CHART_THEME = {
  grid: "rgba(255,255,255,0.1)",
  axis: "var(--color-text-secondary, #a0a0a0)",
  tooltipBg: "var(--color-bg-card, #1e1e1e)",
  tooltipBorder: "1px solid rgba(255,255,255,0.1)",
  tooltipText: "var(--color-text-primary, #ffffff)",
  point: "var(--color-cerrado-600, #2a6ab0)",
} as const

interface KolbTeamScatterProps {
  data: KolbPoint[]
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { studentName: string; x: number; y: number; dominantStyle: string | null } }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div
      style={{
        backgroundColor: CHART_THEME.tooltipBg,
        border: CHART_THEME.tooltipBorder,
        borderRadius: "6px",
        color: CHART_THEME.tooltipText,
        padding: "8px 12px",
        fontSize: "12px",
      }}
    >
      <p className="font-semibold">{d.studentName}</p>
      <p>Grasping: {d.x.toFixed(2)}</p>
      <p>Transforming: {d.y.toFixed(2)}</p>
      {d.dominantStyle && <p>Estilo: {d.dominantStyle}</p>}
    </div>
  )
}

export function KolbTeamScatter({ data }: KolbTeamScatterProps) {
  const chartData = data.map((p) => ({
    x: p.graspingAxis,
    y: p.transformingAxis,
    studentName: p.studentName,
    dominantStyle: p.dominantStyle,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mapa Kolb da Turma</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <>
            <div aria-label="Mapa Kolb da turma" role="img" className="relative">
              <ResponsiveContainer width="100%" height={320}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                  <XAxis
                    type="number"
                    dataKey="x"
                    domain={[-1, 1]}
                    stroke={CHART_THEME.axis}
                    fontSize={11}
                    tickLine={false}
                    label={{
                      value: "CE (Sentir) ← → AC (Pensar)",
                      position: "bottom",
                      offset: 15,
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
                      value: "RO (Observar) ← → AE (Fazer)",
                      angle: -90,
                      position: "insideLeft",
                      offset: -5,
                      fill: CHART_THEME.axis,
                      fontSize: 11,
                    }}
                  />
                  <ReferenceLine x={0} stroke={CHART_THEME.grid} />
                  <ReferenceLine y={0} stroke={CHART_THEME.grid} />
                  <Tooltip content={<CustomTooltip />} />
                  <Scatter data={chartData} fill={CHART_THEME.point} />
                </ScatterChart>
              </ResponsiveContainer>

              {/* Quadrant labels */}
              <div className="pointer-events-none absolute inset-0 text-2xs text-text-muted">
                <span className="absolute left-[15%] top-[10%]">Acomodador</span>
                <span className="absolute right-[15%] top-[10%]">Divergente</span>
                <span className="absolute left-[15%] bottom-[20%]">Convergente</span>
                <span className="absolute right-[15%] bottom-[20%]">Assimilador</span>
              </div>
            </div>
            <p className="mt-2 text-center text-xs text-text-muted">
              {chartData.length} {chartData.length === 1 ? "aluno" : "alunos"} mapeados
            </p>
          </>
        ) : (
          <p className="py-8 text-center text-sm text-text-muted">
            Nenhum dado Kolb disponivel para a turma.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
