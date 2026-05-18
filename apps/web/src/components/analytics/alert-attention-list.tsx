"use client"

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import type { AnalyticsAlert } from "@/types/analytics"

interface AlertAttentionListProps {
  alerts: AnalyticsAlert[]
}

const SEVERITY_CONFIG = {
  critico: {
    icon: XCircle,
    variant: "error" as const,
    label: "Critico",
    borderClass: "border-semantic-error/30",
    bgClass: "bg-semantic-error/5",
  },
  atencao: {
    icon: AlertTriangle,
    variant: "warning" as const,
    label: "Atencao",
    borderClass: "border-semantic-warning/30",
    bgClass: "bg-semantic-warning/5",
  },
  positivo: {
    icon: CheckCircle,
    variant: "success" as const,
    label: "Positivo",
    borderClass: "border-semantic-success/30",
    bgClass: "bg-semantic-success/5",
  },
}

export function AlertAttentionList({ alerts }: AlertAttentionListProps) {
  const [showAll, setShowAll] = useState(false)
  const visibleAlerts = showAll ? alerts : alerts.slice(0, 5)

  return (
    <Card className="dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06]">
      <CardHeader>
        <CardTitle className="text-base">
          Alertas de Atencao
          {alerts.length > 0 && (
            <span className="ml-2 text-sm font-normal text-text-muted">({alerts.length})</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length > 0 ? (
          <div className="space-y-2">
            {visibleAlerts.map((alert) => {
              const config = SEVERITY_CONFIG[alert.severity]
              const Icon = config.icon
              return (
                <div
                  key={`${alert.studentId}-${alert.type}`}
                  className={`flex items-start gap-3 rounded-md border p-3 ${config.borderClass} ${config.bgClass}`}
                >
                  <Icon size={16} className="mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/analytics/students/${alert.studentId}`}
                        className="text-sm font-medium text-text-primary hover:underline"
                      >
                        {alert.studentName}
                      </Link>
                      <Badge variant={config.variant} badgeSize="sm">
                        {config.label}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-text-secondary">{alert.message}</p>
                  </div>
                </div>
              )
            })}

            {alerts.length > 5 && !showAll && (
              <Button variant="ghost" className="w-full" onClick={() => setShowAll(true)}>
                Ver todos ({alerts.length - 5} restantes)
              </Button>
            )}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-text-muted">
            Nenhum alerta no período selecionado.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
