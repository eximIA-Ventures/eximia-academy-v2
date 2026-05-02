"use client"

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
import type { SessionJourney } from "@/types/analytics"

const CHART_THEME = {
  grid: "rgba(255,255,255,0.1)",
  axis: "var(--color-text-secondary, #a0a0a0)",
  tooltipBg: "var(--color-bg-card, #1e1e1e)",
  tooltipBorder: "1px solid rgba(255,255,255,0.1)",
  tooltipText: "var(--color-text-primary, #ffffff)",
  depthLine: "var(--color-accent-blue-mid, #2a6ab0)",
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
              {journey.emotionalArc.map((emotion, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 rounded-md border border-border-subtle px-3 py-1.5 text-xs"
                >
                  <span className="text-text-muted">T{i + 1}</span>
                  <span className="text-text-primary">{emotion}</span>
                </div>
              ))}
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
              {journey.breakthroughCandidates.map((b, i) => (
                <div key={i} className="flex items-center gap-3 rounded-md border border-semantic-success/30 bg-semantic-success/5 p-3">
                  <Badge variant="success" badgeSize="sm">Breakthrough</Badge>
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
