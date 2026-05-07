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
import type { CareerAnchorsResult } from "./scoring"
import { ANCHOR_LABELS } from "./scoring"

const ANCHOR_DESCRIPTIONS: Record<string, string> = {
  technical: "Busca aprofundamento e maestria em uma área tecnica especifica",
  management: "Deseja coordenar, liderar e ter responsabilidade por resultados amplos",
  autonomy: "Precisa de liberdade e independencia para definir seu proprio caminho",
  security: "Valoriza estabilidade, previsibilidade e seguranca financeira",
  entrepreneurship: "Movido pela criacao de novos negocios, produtos ou servicos",
  service: "Quer contribuir para o bem-estar dos outros e causas significativas",
  challenge: "Busca superar obstaculos, competir e testar seus limites",
  lifestyle: "Prioriza o equilibrio entre vida pessoal, familia e trabalho",
}

interface CareerAnchorsResultsProps {
  result: CareerAnchorsResult
  onBack: () => void
}

export function CareerAnchorsResults({ result, onBack }: CareerAnchorsResultsProps) {
  const anchors = Object.keys(ANCHOR_LABELS) as (keyof Omit<CareerAnchorsResult, "top3">)[]

  const chartData = anchors.map((key) => ({
    subject: ANCHOR_LABELS[key],
    score: result[key] as number,
  }))

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Button>
        <h2 className="text-xl font-bold text-text-primary">Resultado — Âncoras de Carreira</h2>
      </div>

      {/* Top 3 Anchors Highlight */}
      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        {result.top3.map((key, index) => (
          <Card key={key} className="border-cerrado-600/30 bg-cerrado-600/5">
            <CardContent className="p-4 text-center">
              <span className="text-xs font-medium text-cerrado-600">#{index + 1}</span>
              <h3 className="mt-1 text-sm font-bold text-text-primary">{ANCHOR_LABELS[key]}</h3>
              <p className="mt-1 text-lg font-bold text-cerrado-600">
                {(result[key as keyof Omit<CareerAnchorsResult, "top3">] as number).toFixed(1)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-6">
        <CardContent className="p-6">
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={chartData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" className="text-xs" />
              <PolarRadiusAxis domain={[1, 6]} tickCount={6} />
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
        {anchors.map((key) => {
          const isTop3 = result.top3.includes(key)
          return (
            <Card key={key}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-text-primary">{ANCHOR_LABELS[key]}</h3>
                      {isTop3 && (
                        <span className="rounded-full bg-cerrado-600/10 px-2 py-0.5 text-xs font-medium text-cerrado-600">
                          Top 3
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-text-muted">{ANCHOR_DESCRIPTIONS[key]}</p>
                  </div>
                  <div className="text-lg font-bold text-cerrado-600">
                    {(result[key] as number).toFixed(1)}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
