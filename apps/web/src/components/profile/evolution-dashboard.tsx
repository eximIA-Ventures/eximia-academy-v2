"use client"

import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@eximia/ui"
import { TrendingUp } from "lucide-react"
import { useEffect, useState } from "react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

interface HistoryEntry {
  id: string
  assessment_type: string
  result: Record<string, unknown>
  completed_at: string
}

interface EvolutionDashboardProps {
  userId: string
}

const ASSESSMENT_LABELS: Record<string, string> = {
  big_five: "Big Five",
  enneagram: "Eneagrama",
  disc: "DISC",
  multiple_intelligences: "Inteligências Múltiplas",
  career_anchors: "Âncoras de Carreira",
}

const LINE_COLORS = [
  "var(--color-accent-blue-mid)",
  "var(--color-accent-green)",
  "var(--color-accent-gold)",
  "var(--color-accent-purple)",
  "var(--color-accent-red)",
]

const DIMENSION_LABELS: Record<string, string> = {
  openness: "Abertura",
  conscientiousness: "Conscienciosidade",
  extraversion: "Extroversão",
  agreeableness: "Amabilidade",
  neuroticism: "Neuroticismo",
  d: "Dominância",
  i: "Influência",
  s: "Estabilidade",
  c: "Conformidade",
  linguistic: "Linguística",
  logical: "Lógico-Matemática",
  spatial: "Espacial",
  musical: "Musical",
  kinesthetic: "Cinestésica",
  interpersonal: "Interpessoal",
  intrapersonal: "Intrapessoal",
  naturalist: "Naturalista",
  technical: "Técnica",
  management: "Gestão",
  autonomy: "Autonomia",
  security: "Segurança",
  entrepreneurship: "Empreendedorismo",
  service: "Serviço",
  challenge: "Desafio",
  lifestyle: "Estilo de Vida",
}

function getChartDataForType(entries: HistoryEntry[], type: string) {
  const typeEntries = entries
    .filter((e) => e.assessment_type === type)
    .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime())

  if (typeEntries.length < 2) return null

  const sampleResult = typeEntries[0].result
  const numericKeys = Object.entries(sampleResult)
    .filter(([key, val]) => typeof val === "number" && key !== "type" && key !== "wing")
    .map(([key]) => key)

  if (numericKeys.length === 0) return null

  const data = typeEntries.map((entry) => {
    const date = new Date(entry.completed_at).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    })
    const point: Record<string, unknown> = { date }
    for (const key of numericKeys) {
      point[key] = entry.result[key]
    }
    return point
  })

  return { data, keys: numericKeys }
}

export function EvolutionDashboard({ userId }: EvolutionDashboardProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadHistory() {
      const supabase = createClient()
      const { data, error: queryError } = await supabase
        .from("assessment_history")
        .select("id, assessment_type, result, completed_at")
        .eq("user_id", userId)
        .order("completed_at", { ascending: true })

      if (cancelled) return
      if (queryError) {
        setError("Erro ao carregar histórico de assessments.")
        setLoading(false)
        return
      }
      setHistory((data as HistoryEntry[]) ?? [])
      setLoading(false)
    }
    loadHistory()
    return () => { cancelled = true }
  }, [userId])

  if (loading) {
    return (
      <div className="mt-6 flex items-center justify-center py-12">
        <p className="text-sm text-text-muted">Carregando histórico...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mt-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-semantic-error">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="mt-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TrendingUp className="mb-3 h-10 w-10 text-text-muted" />
            <p className="text-sm text-text-muted">
              Nenhum histórico de assessments ainda.
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Complete assessments e refaça-os ao longo do tempo para acompanhar sua evolução.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const assessmentTypes = [...new Set(history.map((h) => h.assessment_type))]

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-accent-blue-mid" />
        <h3 className="text-lg font-bold text-text-primary">Evolução ao Longo do Tempo</h3>
      </div>

      {assessmentTypes.map((type) => {
        const chartInfo = getChartDataForType(history, type)

        if (!chartInfo) {
          const count = history.filter((h) => h.assessment_type === type).length
          return (
            <Card key={type}>
              <CardContent className="p-5">
                <h4 className="mb-2 text-sm font-semibold text-text-primary">
                  {ASSESSMENT_LABELS[type] ?? type}
                </h4>
                <p className="text-xs text-text-muted">
                  {count === 1
                    ? "Completado 1 vez. Refaça para visualizar sua evolução."
                    : "Dados insuficientes para gerar gráfico."}
                </p>
              </CardContent>
            </Card>
          )
        }

        return (
          <Card key={type}>
            <CardContent className="p-5">
              <h4 className="mb-4 text-sm font-semibold text-text-primary">
                {ASSESSMENT_LABELS[type] ?? type}
              </h4>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartInfo.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-medium)" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-bg-card)",
                      border: "1px solid var(--color-border-medium)",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  {chartInfo.keys.map((key, i) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      name={DIMENSION_LABELS[key] ?? key}
                      stroke={LINE_COLORS[i % LINE_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
