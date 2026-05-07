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
import type { MultipleIntelligencesResult } from "./scoring"
import { INTELLIGENCE_LABELS } from "./scoring"

const INTELLIGENCE_DESCRIPTIONS: Record<string, string> = {
  linguistic: "Habilidade com palavras, leitura, escrita e comunicacao verbal",
  logical: "Capacidade de raciocinar logicamente, resolver problemas e trabalhar com numeros",
  spatial: "Habilidade de pensar em imagens, visualizar e orientar-se no espaco",
  musical: "Sensibilidade a ritmos, melodias e padroes sonoros",
  kinesthetic: "Controle corporal, coordenacao motora e aprendizado pratico",
  interpersonal: "Compreensão das emocoes, motivacoes e intencoes dos outros",
  intrapersonal: "Autoconhecimento, reflexao e compreensão dos proprios sentimentos",
  naturalist: "Sensibilidade ao ambiente natural, classificacao e observação de padroes",
}

interface MultipleIntelligencesResultsProps {
  result: MultipleIntelligencesResult
  onBack: () => void
}

export function MultipleIntelligencesResults({ result, onBack }: MultipleIntelligencesResultsProps) {
  const intelligences = Object.keys(INTELLIGENCE_LABELS) as (keyof MultipleIntelligencesResult)[]

  const chartData = intelligences.map((key) => ({
    subject: INTELLIGENCE_LABELS[key],
    score: result[key],
  }))

  const sorted = [...intelligences].sort((a, b) => result[b] - result[a])

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Button>
        <h2 className="text-xl font-bold text-text-primary">Resultado — Inteligências Múltiplas</h2>
      </div>

      <Card className="mb-6">
        <CardContent className="p-6">
          <ResponsiveContainer width="100%" height={350}>
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
        {sorted.map((key, index) => (
          <Card key={key}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-text-primary">{INTELLIGENCE_LABELS[key]}</h3>
                    {index < 3 && (
                      <span className="rounded-full bg-cerrado-600/10 px-2 py-0.5 text-xs font-medium text-cerrado-600">
                        Top {index + 1}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-text-muted">{INTELLIGENCE_DESCRIPTIONS[key]}</p>
                </div>
                <div className="text-lg font-bold text-cerrado-600">
                  {result[key].toFixed(1)}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
