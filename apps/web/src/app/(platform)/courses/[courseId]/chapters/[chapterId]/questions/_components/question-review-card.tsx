"use client"

import { SkillBadge } from "@/components/skill-badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  Card,
  CardContent,
  Textarea,
  useToast,
} from "@eximia/ui"
import { Check, Pencil, X } from "lucide-react"
import { useState } from "react"

interface Question {
  id: string
  text: string
  skill: "analise" | "sintese" | "aplicacao" | "reflexao"
  intention: string
  expected_depth: string | null
  common_shallow_answer: string | null
  followup_prompts: string[]
  citations: string[]
  status: "pending" | "active" | "rejected"
  metadata: Record<string, unknown>
}

interface QuestionReviewCardProps {
  question: Question
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onUpdateText: (id: string, newText: string) => void
  isPending?: boolean
}

const STATUS_BADGE: Record<
  Question["status"],
  { label: string; variant: "warning" | "success" | "error" }
> = {
  pending: { label: "Pendente", variant: "warning" },
  active: { label: "Aprovada", variant: "success" },
  rejected: { label: "Rejeitada", variant: "error" },
}

export function QuestionReviewCard({
  question,
  onApprove,
  onReject,
  onUpdateText,
  isPending = false,
}: QuestionReviewCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(question.text)
  const { toast } = useToast()

  const statusConfig = STATUS_BADGE[question.status]

  const handleSave = () => {
    onUpdateText(question.id, editText)
    setIsEditing(false)
    toast({ title: "Texto atualizado", variant: "success" })
  }

  const handleCancel = () => {
    setEditText(question.text)
    setIsEditing(false)
  }

  return (
    <Card
      className={
        question.status === "active"
          ? "border-l-4 border-l-semantic-success"
          : question.status === "rejected"
            ? "opacity-60"
            : undefined
      }
    >
      <CardContent className="p-6">
        {/* Header row: badges + action buttons */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <SkillBadge skill={question.skill} />
            <Badge variant={statusConfig.variant} badgeSize="sm">
              {statusConfig.label}
            </Badge>
          </div>

          {question.status === "pending" && (
            <div className="flex items-center gap-1">
              {/* Approve button */}
              <Button
                variant="ghost"
                size="icon"
                disabled={isPending}
                onClick={() => onApprove(question.id)}
                aria-label="Aprovar"
              >
                <Check size={16} />
              </Button>

              {/* Edit button */}
              <Button
                variant="ghost"
                size="icon"
                disabled={isPending}
                onClick={() => setIsEditing(true)}
                aria-label="Editar"
              >
                <Pencil size={16} />
              </Button>

              {/* Reject button */}
              <Button
                variant="ghost"
                size="icon"
                disabled={isPending}
                onClick={() => onReject(question.id)}
                aria-label="Rejeitar"
              >
                <X size={16} />
              </Button>
            </div>
          )}
        </div>

        {/* Question text */}
        {isEditing ? (
          <div className="space-y-3">
            <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleSave} disabled={isPending}>
                Salvar
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancel}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <p
            className={
              question.status === "rejected"
                ? "text-sm text-text-primary line-through"
                : "text-sm text-text-primary"
            }
          >
            {question.text}
          </p>
        )}

        {/* Accordion sections */}
        <Accordion type="multiple">
          <AccordionItem value="intention">
            <AccordionTrigger>Intencao Pedagogica</AccordionTrigger>
            <AccordionContent>
              <p className="text-sm text-text-secondary">{question.intention}</p>
            </AccordionContent>
          </AccordionItem>

          {question.expected_depth && (
            <AccordionItem value="depth">
              <AccordionTrigger>Profundidade Esperada</AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-text-secondary">{question.expected_depth}</p>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </CardContent>
    </Card>
  )
}
