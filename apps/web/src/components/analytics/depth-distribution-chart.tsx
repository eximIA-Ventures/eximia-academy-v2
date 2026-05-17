"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import { HelpCircle } from "lucide-react"
import { useState } from "react"
import type { DepthDistribution } from "@/types/analytics"

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
    name: d.label,
    level: d.level,
    count: d.count,
  }))

  const totalSessions = data.reduce((sum, d) => sum + d.count, 0)
  const maxCount = Math.max(...data.map((d) => d.count), 1)

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
        <div className="space-y-2">
          {chartData.map((d, i) => {
            const pct = maxCount > 0 ? (d.count / maxCount) * 100 : 0
            const totalPct = totalSessions > 0 ? Math.round((d.count / totalSessions) * 100) : 0
            return (
              <div key={i} className="flex items-center gap-3">
                <div className="w-40 shrink-0 text-right">
                  <span className="text-[11px] text-text-secondary">{d.name}</span>
                </div>
                <div className="flex-1 h-6 rounded-lg bg-black/[0.03] overflow-hidden relative">
                  <div
                    className="h-full rounded-lg transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: DEPTH_COLORS[i] }}
                  />
                </div>
                <div className="w-16 shrink-0 text-right">
                  <span className="text-xs font-semibold text-text-primary tabular-nums">{d.count}</span>
                  <span className="text-[9px] text-text-muted ml-1">({totalPct}%)</span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
