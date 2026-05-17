"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import { HelpCircle } from "lucide-react"
import { useState } from "react"
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

const DEPTH_DESCRIPTIONS = [
  { level: 1, label: "Repetição superficial", desc: "Aluno repete o conteúdo sem elaborar" },
  { level: 2, label: "Compreensão básica", desc: "Entende o conceito mas não aplica" },
  { level: 3, label: "Aplicação", desc: "Conecta o conceito a situações práticas" },
  { level: 4, label: "Análise", desc: "Decompõe problemas e identifica causas" },
  { level: 5, label: "Questionamento", desc: "Questiona premissas e busca alternativas" },
  { level: 6, label: "Síntese", desc: "Combina conceitos para criar soluções novas" },
  { level: 7, label: "Insight original", desc: "Gera ideias inéditas com aplicação real" },
]

export function DepthDistributionChart({ data }: DepthDistributionChartProps) {
  const [showHelp, setShowHelp] = useState(false)

  const chartData = data.map((d) => ({
    name: `${d.level}`,
    label: d.label,
    count: d.count,
  }))

  const totalSessions = data.reduce((sum, d) => sum + d.count, 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Distribuição de Profundidade</CardTitle>
            <button type="button" onClick={() => setShowHelp(!showHelp)} className="text-text-muted hover:text-cerrado-600 transition-colors">
              <HelpCircle size={14} />
            </button>
          </div>
          <span className="text-xs text-text-muted">{totalSessions} sessões analisadas</span>
        </div>
        {showHelp && (
          <div className="mt-3 rounded-xl bg-bg-surface p-4 shadow-card space-y-2">
            <p className="text-xs text-text-secondary leading-relaxed">
              <strong>O que é:</strong> Mede o nível de raciocínio que o aluno demonstrou nas interações com a IA socrática. Quanto maior o nível, mais profundo o pensamento crítico.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {DEPTH_DESCRIPTIONS.map((d) => (
                <div key={d.level} className="flex items-start gap-2 py-0.5">
                  <span className="shrink-0 h-4 w-4 rounded text-[9px] font-bold flex items-center justify-center text-white" style={{ backgroundColor: DEPTH_COLORS[d.level - 1] }}>
                    {d.level}
                  </span>
                  <div>
                    <span className="text-[10px] font-semibold text-text-primary">{d.label}</span>
                    <span className="text-[10px] text-text-muted ml-1">— {d.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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
