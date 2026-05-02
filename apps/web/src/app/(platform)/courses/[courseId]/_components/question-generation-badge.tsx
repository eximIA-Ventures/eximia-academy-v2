"use client"

import { useTenantSlug } from "@/components/providers/tenant-slug-provider"
import { Badge } from "@eximia/ui"
import Link from "next/link"

interface QuestionGenerationBadgeProps {
  courseId: string
  activeJobStatus?: string | null
  pendingQuestionsCount: number
}

export function QuestionGenerationBadge({
  courseId,
  activeJobStatus,
  pendingQuestionsCount,
}: QuestionGenerationBadgeProps) {
  const slug = useTenantSlug(); const p = slug ? `/${slug}` : ""
  if (activeJobStatus === "processing" || activeJobStatus === "pending") {
    return (
      <Badge variant="warning" badgeSize="sm" className="animate-pulse">
        Gerando perguntas...
      </Badge>
    )
  }

  if (pendingQuestionsCount > 0) {
    return (
      <Link href={`${p}/courses/${courseId}/questions`}>
        <Badge variant="warning" badgeSize="sm">
          {pendingQuestionsCount} pergunta{pendingQuestionsCount !== 1 ? "s" : ""} pendente
          {pendingQuestionsCount !== 1 ? "s" : ""}
        </Badge>
      </Link>
    )
  }

  return null
}
