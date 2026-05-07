import { Badge, Button, Card, CardContent } from "@eximia/ui"
import type { LucideIcon } from "lucide-react"

type AssessmentStatus = "not_started" | "in_progress" | "completed"

const STATUS_CONFIG: Record<AssessmentStatus, { label: string; variant: "draft" | "warning" | "success" }> = {
  not_started: { label: "Não iniciado", variant: "draft" },
  in_progress: { label: "Em progresso", variant: "warning" },
  completed: { label: "Concluído", variant: "success" },
}

interface AssessmentCardProps {
  title: string
  description: string
  estimatedTime: string
  status: AssessmentStatus
  icon: LucideIcon
  onStart: () => void
  onViewResult: () => void
}

export function AssessmentCard({ title, description, estimatedTime, status, icon: Icon, onStart, onViewResult }: AssessmentCardProps) {
  const statusConfig = STATUS_CONFIG[status]
  return (
    <Card className="transition-colors hover:border-border-light">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cerrado-600/10 text-cerrado-600">
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-semibold text-text-primary">{title}</h3>
              <Badge variant={statusConfig.variant} badgeSize="sm">{statusConfig.label}</Badge>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{description}</p>
            <p className="mt-2 text-xs text-text-muted">Tempo estimado: {estimatedTime}</p>
            <div className="mt-4">
              {status === "completed" ? (
                <Button variant="outline" size="sm" onClick={onViewResult}>Ver Resultado</Button>
              ) : (
                <Button size="sm" onClick={onStart}>{status === "in_progress" ? "Continuar" : "Iniciar"}</Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
