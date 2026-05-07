"use client"

import { Button, Card, CardContent } from "@eximia/ui"
import { ArrowLeft } from "lucide-react"
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts"

interface BigFiveResult {
  openness: number
  conscientiousness: number
  extraversion: number
  agreeableness: number
  neuroticism: number
}

const DIMENSION_LABELS: Record<string, { label: string; description: string }> = {
  openness: { label: "Abertura", description: "Curiosidade intelectual, criatividade e abertura a novas experiencias" },
  conscientiousness: { label: "Conscienciosidade", description: "Organizacao, disciplina e orientacao a objetivos" },
  extraversion: { label: "Extroversao", description: "Sociabilidade, energia e tendencia a buscar estimulacao" },
  agreeableness: { label: "Amabilidade", description: "Cooperacao, empatia e consideracao pelos outros" },
  neuroticism: { label: "Neuroticismo", description: "Tendencia a experimentar emocoes negativas e instabilidade emocional" },
}

interface BigFiveResultsProps {
  result: BigFiveResult
  onBack: () => void
}

export function BigFiveResults({ result, onBack }: BigFiveResultsProps) {
  const chartData = [
    { subject: "Abertura", score: result.openness },
    { subject: "Conscienciosidade", score: result.conscientiousness },
    { subject: "Extroversao", score: result.extraversion },
    { subject: "Amabilidade", score: result.agreeableness },
    { subject: "Neuroticismo", score: result.neuroticism },
  ]

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Button>
        <h2 className="text-xl font-bold text-text-primary">Resultado — Big Five</h2>
      </div>

      <Card className="mb-6">
        <CardContent className="p-6">
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={chartData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" className="text-xs" />
              <PolarRadiusAxis domain={[1, 5]} tickCount={5} />
              <Radar
                dataKey="score"
                stroke="var(--color-cerrado-600)"
                fill="var(--color-cerrado-600)"
                fillOpacity={0.3}
              />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {Object.entries(DIMENSION_LABELS).map(([key, dim]) => (
          <Card key={key}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-text-primary">{dim.label}</h3>
                  <p className="text-xs text-text-muted">{dim.description}</p>
                </div>
                <div className="text-lg font-bold text-cerrado-600">
                  {(result as unknown as Record<string, number>)[key]?.toFixed(1)}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
