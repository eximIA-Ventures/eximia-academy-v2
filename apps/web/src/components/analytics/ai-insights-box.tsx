"use client"

import { Lightbulb, Sparkles } from "lucide-react"
import { useEffect, useState } from "react"

export interface Insight {
  type: "positive" | "warning" | "critical" | "info"
  text: string
}

interface AiInsightsBoxProps {
  insights: Insight[]
  title?: string
  aiMetrics?: Record<string, unknown>
  aiTab?: "uso" | "aprendizagem"
}

const TYPE_STYLES = {
  positive: "bg-green-50 border-green-200 text-green-800",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  critical: "bg-red-50 border-red-200 text-red-800",
  info: "bg-blue-50 border-blue-200 text-blue-800",
}

const DOT_STYLES = {
  positive: "bg-green-500",
  warning: "bg-amber-500",
  critical: "bg-red-500",
  info: "bg-blue-500",
}

export function AiInsightsBox({ insights, title = "Insights", aiMetrics, aiTab }: AiInsightsBoxProps) {
  const [aiInsights, setAiInsights] = useState<Insight[] | null>(null)
  const [loading, setLoading] = useState(false)

  const displayInsights = aiInsights ?? insights
  if (displayInsights.length === 0 && !aiMetrics) return null

  async function fetchAiInsights() {
    if (!aiMetrics || !aiTab) return
    setLoading(true)
    try {
      const res = await fetch("/api/analytics/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab: aiTab, metrics: aiMetrics }),
      })
      const data = await res.json()
      if (data.insights?.length > 0) setAiInsights(data.insights)
    } catch { /* fallback to deterministic */ }
    setLoading(false)
  }

  return (
    <div className="rounded-xl bg-gray-50/80 dark:bg-bg-surface/50 px-4 py-3">
      <div className="flex items-start gap-2.5">
        <Lightbulb size={13} className="text-text-muted mt-0.5 shrink-0" />
        <div className="flex-1 space-y-1">
          {displayInsights.map((insight, i) => (
            <p key={i} className="text-[11px] text-text-secondary leading-relaxed">
              <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 align-middle ${DOT_STYLES[insight.type]}`} />
              {insight.text}
            </p>
          ))}
        </div>
        {aiMetrics && (
          <button
            type="button"
            onClick={fetchAiInsights}
            disabled={loading}
            className={`shrink-0 flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded-lg transition-all ${
              aiInsights ? "text-cerrado-600 bg-cerrado-600/5" : "text-text-muted hover:text-cerrado-600 hover:bg-cerrado-600/5"
            } ${loading ? "opacity-50" : ""}`}
          >
            <Sparkles size={10} />
            {loading ? "..." : aiInsights ? "IA ✓" : "IA"}
          </button>
        )}
      </div>
    </div>
  )
}

/** Generate insights from usage data */
export function generateUsageInsights(data: {
  totalSessions: number
  deltaSessions?: number | null
  engagementRate?: number
  rosterStudents: Array<{ risk: string; daysSinceLastActivity: number | null }>
  unitStats: Array<{ areaName: string; activeStudents: number; totalStudents: number; completionPct: number }>
}): Insight[] {
  const insights: Insight[] = []
  const { totalSessions, deltaSessions, engagementRate, rosterStudents, unitStats } = data

  // Session trend
  if (deltaSessions !== null && deltaSessions !== undefined) {
    if (deltaSessions > 20) insights.push({ type: "positive", text: `Sessões aumentaram ${deltaSessions}% vs período anterior. O engajamento está crescendo.` })
    else if (deltaSessions < -20) insights.push({ type: "critical", text: `Sessões caíram ${Math.abs(deltaSessions)}% vs período anterior. Atenção: o engajamento está diminuindo.` })
    else if (deltaSessions >= 0) insights.push({ type: "info", text: `Sessões estáveis (${deltaSessions >= 0 ? "+" : ""}${deltaSessions}% vs anterior). Ritmo mantido.` })
  }

  // Engagement
  if (engagementRate !== undefined) {
    if (engagementRate < 10) insights.push({ type: "warning", text: `Taxa de engajamento em ${engagementRate}% — a maioria dos alunos não completou interações e reflexões. Considere enviar lembretes.` })
    else if (engagementRate > 50) insights.push({ type: "positive", text: `Engajamento de ${engagementRate}% — a turma está participando ativamente.` })
  }

  // Never accessed
  const neverAccessed = rosterStudents.filter((s) => s.risk === "never_accessed").length
  if (neverAccessed > 0) {
    const pct = Math.round((neverAccessed / rosterStudents.length) * 100)
    insights.push({ type: neverAccessed > 5 ? "critical" : "warning", text: `${neverAccessed} alunos (${pct}%) nunca acessaram a plataforma. Recomendação: enviar convite individual.` })
  }

  // Inactive
  const inactive = rosterStudents.filter((s) => s.risk === "inactive").length
  if (inactive >= 3) {
    insights.push({ type: "warning", text: `${inactive} alunos estão inativos há mais de 14 dias. Risco de abandono.` })
  }

  // Unit comparison
  if (unitStats.length >= 2) {
    const sorted = [...unitStats].sort((a, b) => b.completionPct - a.completionPct)
    const best = sorted[0]
    const worst = sorted[sorted.length - 1]
    if (best.completionPct - worst.completionPct > 15) {
      insights.push({ type: "info", text: `${best.areaName} está ${best.completionPct - worst.completionPct}pp à frente de ${worst.areaName} em conclusão. Considere replicar práticas de ${best.areaName}.` })
    }
  }

  return insights
}

/** Generate insights from learning data */
export function generateLearningInsights(data: {
  avgDepth: number
  totalReflections: number
  totalStudents: number
  moduleStats: Array<{ chapterTitle: string; reflectionCount: number; studentCount: number; totalStudents: number; avgWordCount: number }>
}): Insight[] {
  const insights: Insight[] = []
  const { avgDepth, totalReflections, totalStudents, moduleStats } = data

  // Depth
  if (avgDepth >= 5) insights.push({ type: "positive", text: `Profundidade média de ${avgDepth}/7 — a turma está demonstrando pensamento crítico avançado (análise + questionamento).` })
  else if (avgDepth >= 3 && avgDepth < 5) insights.push({ type: "info", text: `Profundidade média de ${avgDepth}/7 — nível de aplicação/análise. Há espaço para estimular questionamento mais profundo.` })
  else if (avgDepth > 0 && avgDepth < 3) insights.push({ type: "warning", text: `Profundidade média de ${avgDepth}/7 — predominância de repetição e compreensão básica. Considere atividades que exijam análise.` })

  // Reflections participation
  const modulesWithLowParticipation = moduleStats.filter((m) => m.totalStudents > 0 && m.studentCount / m.totalStudents < 0.2 && m.reflectionCount > 0)
  if (modulesWithLowParticipation.length > 0) {
    const names = modulesWithLowParticipation.map((m) => `"${m.chapterTitle}"`).join(", ")
    insights.push({ type: "warning", text: `Baixa participação em reflexões nos módulos ${names} — menos de 20% dos alunos refletiram.` })
  }

  // Modules with zero reflections
  const zeroReflModules = moduleStats.filter((m) => m.reflectionCount === 0)
  if (zeroReflModules.length > 0) {
    insights.push({ type: "critical", text: `${zeroReflModules.length} módulo(s) sem nenhuma reflexão: ${zeroReflModules.map((m) => `"${m.chapterTitle}"`).join(", ")}. Os alunos podem não estar encontrando os slides de reflexão.` })
  }

  // Word count insight
  const avgWords = moduleStats.filter((m) => m.avgWordCount > 0)
  if (avgWords.length > 0) {
    const highest = avgWords.reduce((a, b) => a.avgWordCount > b.avgWordCount ? a : b)
    const lowest = avgWords.reduce((a, b) => a.avgWordCount < b.avgWordCount ? a : b)
    if (highest.avgWordCount > lowest.avgWordCount * 2) {
      insights.push({ type: "info", text: `"${highest.chapterTitle}" gera reflexões 2x mais longas que "${lowest.chapterTitle}" (~${highest.avgWordCount} vs ~${lowest.avgWordCount} palavras). O primeiro módulo pode ter prompts mais eficazes.` })
    }
  }

  // Overall reflections
  if (totalStudents > 0 && totalReflections === 0) {
    insights.push({ type: "critical", text: "Nenhuma reflexão registrada. Verifique se os slides de reflexão estão configurados nos capítulos." })
  }

  return insights
}
