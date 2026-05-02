import { type HTMLAttributes, type ReactNode, forwardRef } from "react"
import { cn } from "../lib/utils"
import { Card, CardContent } from "./card"

export interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Metric value (number or formatted string) */
  value: string | number
  /** Label describing the metric */
  label: string
  /** Icon element rendered to the left or top */
  icon?: ReactNode
  /** Optional trend indicator: "up" | "down" | "neutral" */
  trend?: "up" | "down" | "neutral"
  /** Optional trend value text (e.g., "+12%") */
  trendValue?: string
}

const trendColorMap = {
  up: "text-semantic-success",
  down: "text-semantic-error",
  neutral: "text-text-muted",
} as const

const trendArrowMap = {
  up: "\u2191",
  down: "\u2193",
  neutral: "\u2192",
} as const

const StatCard = forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, value, label, icon, trend, trendValue, ...props }, ref) => (
    <Card ref={ref} className={cn("p-0", className)} {...props}>
      <CardContent className="p-6">
        {icon && <div className="text-text-muted mb-2">{icon}</div>}
        <div className="text-3xl font-bold text-text-primary">{value}</div>
        <div className="text-sm text-text-secondary mt-1">{label}</div>
        {trend && (
          <div className={cn("flex items-center gap-1 text-xs mt-2", trendColorMap[trend])}>
            {trendValue && <span>{trendValue}</span>}
            <span>{trendArrowMap[trend]}</span>
          </div>
        )}
      </CardContent>
    </Card>
  ),
)
StatCard.displayName = "StatCard"

export { StatCard }
