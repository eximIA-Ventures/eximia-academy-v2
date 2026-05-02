"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Badge,
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@eximia/ui"
import { useTenantSlug } from "@/components/providers/tenant-slug-provider"
import { GripVertical, MoreVertical } from "lucide-react"
import Link from "next/link"

interface ChapterListItemProps {
  id: string
  title: string
  status: string
  index: number
  courseId: string
  pendingQuestions?: number
  onEdit: (id: string) => void
  onToggleStatus: (id: string) => void
  onDelete: (id: string) => void
  onViewQuestions: (id: string) => void
}

export function ChapterListItem({
  id,
  title,
  status,
  index,
  courseId,
  pendingQuestions = 0,
  onEdit,
  onToggleStatus,
  onDelete,
  onViewQuestions,
}: ChapterListItemProps) {
  const slug = useTenantSlug()
  const p = slug ? `/${slug}` : ""
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={isDragging ? "shadow-elevated" : ""}>
        <CardContent className="p-4 flex items-center gap-3">
          {/* Drag handle */}
          <button
            type="button"
            className="cursor-grab active:cursor-grabbing touch-none"
            {...attributes}
            {...listeners}
            aria-label="Reordenar"
          >
            <GripVertical size={16} className="text-text-muted" />
          </button>

          {/* Index */}
          <span className="text-text-muted text-sm font-mono w-6 shrink-0">{index + 1}.</span>

          {/* Title — clickable to view chapter */}
          <Link
            href={`${p}/courses/${courseId}/chapters/${id}`}
            className="text-text-primary font-medium flex-1 truncate hover:text-accent-blue-light transition-colors"
          >
            {title}
          </Link>

          {/* Status badge */}
          <Badge variant={status === "published" ? "success" : "draft"} badgeSize="sm">
            {status === "published" ? "Publicado" : "Rascunho"}
          </Badge>

          {/* Pending questions badge */}
          {pendingQuestions > 0 && (
            <button
              type="button"
              className="flex items-center gap-1 rounded-full bg-accent-gold/20 px-2 py-0.5 text-xs font-medium text-accent-gold hover:bg-accent-gold/30 transition-colors"
              onClick={() => onViewQuestions(id)}
              title="Perguntas pendentes de aprovacao"
            >
              {pendingQuestions} pergunta{pendingQuestions !== 1 ? "s" : ""} pendente{pendingQuestions !== 1 ? "s" : ""}
            </button>
          )}

          {/* Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="ghost" size="sm" aria-label="Acoes">
                <MoreVertical size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="right-0 left-auto">
              <Link href={`${p}/courses/${courseId}/chapters/${id}`}>
                <DropdownMenuItem>Visualizar</DropdownMenuItem>
              </Link>
              <Link href={`${p}/courses/${courseId}/chapters/${id}/present`}>
                <DropdownMenuItem>Apresentar</DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onEdit(id)}>Editar</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewQuestions(id)}>Perguntas</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleStatus(id)}>
                {status === "published" ? "Despublicar" : "Publicar"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-semantic-error" onClick={() => onDelete(id)}>
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardContent>
      </Card>
    </div>
  )
}
