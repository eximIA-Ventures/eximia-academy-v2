"use client"

import { Card, CardContent } from "@eximia/ui"
import { MessageSquare, Search, Zap } from "lucide-react"

const STYLE_LABELS: Record<
  string,
  { title: string; icon: typeof MessageSquare; values: Record<string, string> }
> = {
  engagement_style: {
    title: "Engajamento",
    icon: Zap,
    values: {
      reflective: "Reflexivo",
      impulsive: "Impulsivo",
      balanced: "Equilibrado",
    },
  },
  detail_orientation: {
    title: "Detalhamento",
    icon: Search,
    values: {
      verbose: "Detalhista",
      concise: "Objetivo",
      balanced: "Equilibrado",
    },
  },
  reasoning_style: {
    title: "Raciocinio",
    icon: MessageSquare,
    values: {
      analytical: "Analitico",
      creative: "Criativo",
      systematic: "Sistematico",
      intuitive: "Intuitivo",
    },
  },
}

interface LearningStyleCardsProps {
  engagementStyle: string
  detailOrientation: string
  reasoningStyle: string
}

export function LearningStyleCards({
  engagementStyle,
  detailOrientation,
  reasoningStyle,
}: LearningStyleCardsProps) {
  const styles = [
    { key: "engagement_style", value: engagementStyle },
    { key: "detail_orientation", value: detailOrientation },
    { key: "reasoning_style", value: reasoningStyle },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {styles.map(({ key, value }) => {
        const config = STYLE_LABELS[key]
        const Icon = config.icon
        const translatedValue = config.values[value] ?? value

        return (
          <Card key={key}>
            <CardContent className="flex flex-col items-center gap-2 py-5 text-center">
              <Icon className="h-5 w-5 text-accent-blue-mid" />
              <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
                {config.title}
              </span>
              <span className="text-sm font-semibold text-text-primary">{translatedValue}</span>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
