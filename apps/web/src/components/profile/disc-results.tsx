"use client"

import { Button, Card, CardContent } from "@eximia/ui"
import { ArrowLeft } from "lucide-react"
import type { DISCResult } from "./scoring"

const DISC_DIMENSIONS: Record<string, { label: string; color: string; description: string }> = {
  d: { label: "Dominancia (D)", color: "bg-accent-red", description: "Direto, decidido, orientado a resultados. Aceita desafios e busca controle." },
  i: { label: "Influencia (I)", color: "bg-accent-gold", description: "Entusiasta, otimista, colaborativo. Gosta de influenciar e motivar pessoas." },
  s: { label: "Estabilidade (S)", color: "bg-accent-green", description: "Paciente, confiavel, cooperativo. Valoriza harmonia e previsibilidade." },
  c: { label: "Conformidade (C)", color: "bg-cerrado-600", description: "Analitico, preciso, detalhista. Valoriza qualidade e procedimentos." },
}

interface DISCResultsProps {
  result: DISCResult
  onBack: () => void
}

export function DISCResults({ result, onBack }: DISCResultsProps) {
  const maxVal = Math.max(result.d, result.i, result.s, result.c, 1)

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Button>
        <h2 className="text-xl font-bold text-text-primary">Resultado — DISC</h2>
      </div>

      <Card className="mb-6">
        <CardContent className="space-y-5 p-6">
          {(["d", "i", "s", "c"] as const).map((key) => {
            const dim = DISC_DIMENSIONS[key]
            const value = result[key]
            const width = Math.max((value / maxVal) * 100, 4)
            return (
              <div key={key}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-semibold text-text-primary">{dim.label}</span>
                  <span className="text-sm font-bold text-cerrado-600">{value}%</span>
                </div>
                <div className="h-4 overflow-hidden rounded-full bg-bg-surface" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={dim.label}>
                  <div
                    className={`h-full rounded-full ${dim.color} transition-all duration-500`}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {(["d", "i", "s", "c"] as const).map((key) => {
          const dim = DISC_DIMENSIONS[key]
          return (
            <Card key={key}>
              <CardContent className="p-4">
                <h3 className="font-semibold text-text-primary">{dim.label}</h3>
                <p className="mt-1 text-sm text-text-secondary">{dim.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
