import { Card, CardContent, CardHeader, CardTitle, ProgressBar } from "@eximia/ui"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

interface EnrolledCourseCardProps {
  courseId: string
  title: string
  progress: number
  lastAccessedAt: string
  continueChapterId: string | null
}

export function EnrolledCourseCard({
  courseId,
  title,
  progress,
  lastAccessedAt,
  continueChapterId,
}: EnrolledCourseCardProps) {
  const continueHref = continueChapterId
    ? `/courses/${courseId}/chapters/${continueChapterId}/session`
    : `/courses/${courseId}`

  const lastAccessLabel = lastAccessedAt
    ? formatDistanceToNow(new Date(lastAccessedAt), { addSuffix: true, locale: ptBR })
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {lastAccessLabel && (
          <p className="text-xs text-text-muted">Último acesso {lastAccessLabel}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <ProgressBar value={progress} showValue />
        <Link
          href={continueHref}
          aria-label={`Continuar curso ${title}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-accent-blue-mid hover:text-accent-blue-light"
        >
          Continuar
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  )
}
