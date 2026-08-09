"use client"

import type { ExceptionFeedItem } from "@/types/analytics"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import { AlertTriangle, XCircle } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

interface ExceptionsFeedCardProps {
  items: ExceptionFeedItem[]
}

// Mesma taxonomia/paleta canônica do semáforo (lib/triage-colors.ts): atenção
// (vermelho) tem precedência sobre sem acesso (amarelo).
const SEVERITY_CONFIG = {
  atencao: {
    icon: XCircle,
    variant: "error" as const,
    label: "Atenção",
    borderClass: "border-semantic-error/30",
    bgClass: "bg-semantic-error/5",
  },
  sem_acesso: {
    icon: AlertTriangle,
    variant: "warning" as const,
    label: "Sem acesso",
    borderClass: "border-semantic-warning/30",
    bgClass: "bg-semantic-warning/5",
  },
}

/**
 * "Feed de exceções" (redesign Analytics Apple-like, aba Uso da Plataforma).
 * Lista alunos que saíram do "no ritmo", priorizados por severidade, reusa a
 * triagem canônica do módulo Engagement em vez de um baseline inventado.
 */
export function ExceptionsFeedCard({ items }: ExceptionsFeedCardProps) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? items : items.slice(0, 5)

  return (
    <Card className="dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06]">
      <CardHeader>
        <CardTitle className="text-base">
          Quem saiu do normal
          {items.length > 0 && (
            <span className="ml-2 text-sm font-normal text-text-muted">({items.length})</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length > 0 ? (
          <div className="space-y-2">
            {visible.map((item) => {
              const config = SEVERITY_CONFIG[item.severity]
              const Icon = config.icon
              return (
                <div
                  key={item.studentId}
                  className={`flex items-start gap-3 rounded-md border p-3 ${config.borderClass} ${config.bgClass}`}
                >
                  <Icon size={16} className="mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/analytics/students/${item.studentId}`}
                        className="text-sm font-medium text-text-primary hover:underline"
                      >
                        {item.studentName}
                      </Link>
                      <Badge variant={config.variant} badgeSize="sm">
                        {config.label}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-text-secondary">{item.reason}</p>
                  </div>
                </div>
              )
            })}

            {items.length > 5 && !showAll && (
              <Button variant="ghost" className="w-full" onClick={() => setShowAll(true)}>
                Ver todos ({items.length - 5} restantes)
              </Button>
            )}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-text-muted">
            Sem dados no momento, nenhum aluno em atenção ou sem acesso neste escopo.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
