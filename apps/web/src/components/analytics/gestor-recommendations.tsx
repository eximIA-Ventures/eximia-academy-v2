"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import { Lightbulb } from "lucide-react"
import type { Recommendation } from "@/types/analytics"

interface GestorRecommendationsProps {
  recommendations: Recommendation[]
}

export function GestorRecommendations({ recommendations }: GestorRecommendationsProps) {
  if (recommendations.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb size={18} />
          Recomendações para o Gestor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {recommendations.map((rec) => (
          <div
            key={rec.message}
            className={`rounded-md border px-4 py-3 text-sm ${
              rec.priority === "high"
                ? "border-semantic-error/30 bg-semantic-error/5 text-text-primary"
                : rec.priority === "medium"
                  ? "border-semantic-warning/30 bg-semantic-warning/5 text-text-primary"
                  : "border-semantic-success/30 bg-semantic-success/5 text-text-primary"
            }`}
          >
            <span
              className={`mr-2 inline-block h-2 w-2 rounded-full ${
                rec.priority === "high"
                  ? "bg-semantic-error"
                  : rec.priority === "medium"
                    ? "bg-semantic-warning"
                    : "bg-semantic-success"
              }`}
            />
            {rec.message}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
