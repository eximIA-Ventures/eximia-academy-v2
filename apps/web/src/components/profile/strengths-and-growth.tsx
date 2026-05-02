"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import { CheckCircle, TrendingUp } from "lucide-react"

interface StrengthsAndGrowthProps {
  strengths: string[]
  growthAreas: string[]
}

export function StrengthsAndGrowth({ strengths, growthAreas }: StrengthsAndGrowthProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {strengths.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-text-primary">Pontos Fortes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {strengths.map((item) => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 shrink-0 text-accent-green-mid" />
                <span className="text-sm text-text-secondary">{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {growthAreas.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-text-primary">
              Áreas de Crescimento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {growthAreas.map((item) => (
              <div key={item} className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 shrink-0 text-accent-gold" />
                <span className="text-sm text-text-secondary">{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
