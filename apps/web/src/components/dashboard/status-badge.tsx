import { Badge } from "@eximia/ui"

const STATUS_CONFIG = {
  active: { label: "Ativo", className: "bg-cerrado-600/15 text-cerrado-400" },
  completed: { label: "Concluido", className: "bg-semantic-success/15 text-semantic-success" },
  draft: { label: "Rascunho", className: "bg-text-muted/15 text-text-muted" },
  published: { label: "Publicado", className: "bg-semantic-success/15 text-semantic-success" },
  archived: { label: "Arquivado", className: "bg-accent-gold/15 text-accent-gold" },
} as const

type StatusType = keyof typeof STATUS_CONFIG

interface StatusBadgeProps {
  status: StatusType
  size?: "sm" | "md"
}

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  return (
    <Badge
      className={`${config.className} ${size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1"}`}
    >
      {config.label}
    </Badge>
  )
}
