"use client"

import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardContent,
  useToast,
} from "@eximia/ui"
import { BookOpen, Check, Download, ExternalLink, FileText, Loader2, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { applyAllApproved, approveSource, rejectSource } from "../../../enrich/actions"

interface EnrichmentJob {
  id: string
  status: string
  progress: Record<string, unknown> | null
  total_sources_found: number | null
  sources_approved: number | null
  sources_rejected: number | null
  error_message: string | null
}

interface EnrichmentSource {
  id: string
  chapter_id: string
  title: string
  url: string
  snippet: string | null
  relevance_score: number | null
  ai_rationale: string | null
  status: string
  action: string | null
}

interface Chapter {
  id: string
  title: string
}

interface EnrichmentReviewClientProps {
  course: { id: string; title: string }
  job: EnrichmentJob
  sources: EnrichmentSource[]
  chapters: Chapter[]
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  processing: "Processando",
  review: "Em revisao",
  applying: "Aplicando",
  completed: "Concluido",
  failed: "Falhou",
}

const STATUS_VARIANTS: Record<string, "draft" | "warning" | "success" | "archived"> = {
  pending: "draft",
  processing: "warning",
  review: "warning",
  applying: "warning",
  completed: "success",
  failed: "archived",
}

export function EnrichmentReviewClient({
  course,
  job: initialJob,
  sources: initialSources,
  chapters,
}: EnrichmentReviewClientProps) {
  const [job, setJob] = useState(initialJob)
  const [sources, setSources] = useState(initialSources)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const router = useRouter()

  const chapterMap = useMemo(() => new Map(chapters.map((c) => [c.id, c.title])), [chapters])

  // SSE for progress tracking
  useEffect(() => {
    if (!["pending", "processing"].includes(job.status)) return

    const eventSource = new EventSource(`/api/enrichment-jobs/${job.id}/status`)

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        setJob((prev) => ({ ...prev, ...data }))
        if (["review", "completed", "failed"].includes(data.status)) {
          eventSource.close()
          router.refresh()
        }
      } catch {
        // Ignore parse errors
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [job.id, job.status, router])

  const handleApprove = useCallback(
    (sourceId: string, action: "incorporate" | "reference") => {
      startTransition(async () => {
        const result = await approveSource(sourceId, action, course.id, job.id)
        if ("error" in result) {
          toast({ variant: "error", title: result.error })
          return
        }
        setSources((prev) =>
          prev.map((s) => (s.id === sourceId ? { ...s, status: "approved", action } : s)),
        )
        toast({ variant: "success", title: "Fonte aprovada" })
      })
    },
    [course.id, job.id, toast],
  )

  const handleReject = useCallback(
    (sourceId: string) => {
      startTransition(async () => {
        const result = await rejectSource(sourceId, course.id, job.id)
        if ("error" in result) {
          toast({ variant: "error", title: result.error })
          return
        }
        setSources((prev) =>
          prev.map((s) => (s.id === sourceId ? { ...s, status: "rejected" } : s)),
        )
        toast({ variant: "success", title: "Fonte rejeitada" })
      })
    },
    [course.id, job.id, toast],
  )

  const handleApplyAll = useCallback(() => {
    startTransition(async () => {
      const result = await applyAllApproved(job.id, course.id)
      if ("error" in result) {
        toast({ variant: "error", title: result.error })
        return
      }
      toast({ variant: "success", title: "Fontes aplicadas com sucesso!" })
      router.refresh()
    })
  }, [job.id, course.id, toast, router])

  // Stats
  const totalSources = sources.length
  const pendingCount = sources.filter((s) => s.status === "pending").length
  const approvedCount = sources.filter((s) => s.status === "approved").length
  const rejectedCount = sources.filter((s) => s.status === "rejected").length

  // Group sources by chapter
  const sourcesByChapter = useMemo(() => {
    const grouped = new Map<string, EnrichmentSource[]>()
    for (const source of sources) {
      const existing = grouped.get(source.chapter_id) ?? []
      existing.push(source)
      grouped.set(source.chapter_id, existing)
    }
    return grouped
  }, [sources])

  const isProcessing = ["pending", "processing"].includes(job.status)
  const isApplying = job.status === "applying"

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href={`/courses`}>Cursos</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/courses/${course.id}`}>{course.title}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Enriquecimento</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Enriquecimento com IA
          </h1>
          <div className="flex items-center gap-2">
            <Badge
              variant={STATUS_VARIANTS[job.status] ?? "draft"}
              badgeSize="sm"
              className={isProcessing ? "animate-pulse" : ""}
            >
              {STATUS_LABELS[job.status] ?? job.status}
            </Badge>
            {isProcessing && job.progress && (
              <span className="text-sm text-text-muted">
                {String((job.progress as Record<string, unknown>).completed ?? 0)}/
                {String((job.progress as Record<string, unknown>).total ?? 0)} capítulos
                {(job.progress as Record<string, unknown>).current_chapter
                  ? ` — ${String((job.progress as Record<string, unknown>).current_chapter)}`
                  : ""}
              </span>
            )}
          </div>
        </div>

        {job.status === "review" && (
          <div className="flex gap-2">
            <Button onClick={handleApplyAll} disabled={isPending || approvedCount === 0}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Aplicando...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Aplicar aprovados ({approvedCount})
                </>
              )}
            </Button>
            <a href={`/api/enrichment-jobs/${job.id}/export?format=csv`} download>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
            </a>
            <a href={`/api/enrichment-jobs/${job.id}/export?format=pdf`} download>
              <Button variant="outline">
                <FileText className="mr-2 h-4 w-4" />
                TXT
              </Button>
            </a>
          </div>
        )}
      </div>

      {/* Processing indicator */}
      {isProcessing && (
        <Card>
          <CardContent className="flex items-center gap-3 py-8">
            <Loader2 className="h-6 w-6 animate-spin text-cerrado-600" />
            <div>
              <p className="font-medium text-text-primary">Buscando fontes complementares...</p>
              <p className="text-sm text-text-muted">
                A IA esta analisando cada capítulo e buscando fontes na internet.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {isApplying && (
        <Card>
          <CardContent className="flex items-center gap-3 py-8">
            <Loader2 className="h-6 w-6 animate-spin text-cerrado-600" />
            <div>
              <p className="font-medium text-text-primary">Aplicando fontes aprovadas...</p>
              <p className="text-sm text-text-muted">
                A IA esta reescrevendo os capítulos com as fontes aprovadas.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats cards */}
      {!isProcessing && totalSources > 0 && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold text-text-primary">{totalSources}</p>
              <p className="text-sm text-text-muted">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold text-accent-gold">{pendingCount}</p>
              <p className="text-sm text-text-muted">Pendentes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold text-semantic-success">{approvedCount}</p>
              <p className="text-sm text-text-muted">Aprovadas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold text-semantic-error">{rejectedCount}</p>
              <p className="text-sm text-text-muted">Rejeitadas</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error message */}
      {job.error_message && (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-semantic-error">{job.error_message}</p>
          </CardContent>
        </Card>
      )}

      {/* Sources grouped by chapter */}
      {!isProcessing && (
        <div className="space-y-6">
          {[...sourcesByChapter.entries()].map(([chapterId, chapterSources]) => (
            <div key={chapterId} className="space-y-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-text-muted" />
                <h2 className="text-lg font-semibold text-text-primary">
                  {chapterMap.get(chapterId) ?? "Capítulo"}
                </h2>
                <Badge variant="draft" badgeSize="sm">
                  {chapterSources.length} fonte{chapterSources.length !== 1 ? "s" : ""}
                </Badge>
              </div>

              <div className="space-y-3 pl-6">
                {chapterSources.map((source) => (
                  <SourceCard
                    key={source.id}
                    source={source}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    disabled={isPending || job.status !== "review"}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isProcessing && totalSources === 0 && job.status !== "failed" && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-text-muted">Nenhuma fonte encontrada para este curso.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SourceCard({
  source,
  onApprove,
  onReject,
  disabled,
}: {
  source: EnrichmentSource
  onApprove: (id: string, action: "incorporate" | "reference") => void
  onReject: (id: string) => void
  disabled: boolean
}) {
  const scorePercent = Math.round((source.relevance_score ?? 0) * 100)

  const statusBadge = () => {
    if (source.status === "approved") {
      const actionLabel = source.action === "incorporate" ? "Incorporar" : "Referencia"
      return (
        <Badge variant="success" badgeSize="sm">
          {actionLabel}
        </Badge>
      )
    }
    if (source.status === "rejected") {
      return (
        <Badge variant="archived" badgeSize="sm">
          Rejeitada
        </Badge>
      )
    }
    return null
  }

  return (
    <Card className="border-border-medium/50">
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate font-medium text-cerrado-600 hover:underline"
              >
                {source.title}
              </a>
              <ExternalLink className="h-3 w-3 shrink-0 text-text-muted" />
              {statusBadge()}
            </div>
            <p className="text-xs text-text-muted truncate">{source.url}</p>
          </div>
          <Badge
            variant={scorePercent >= 70 ? "success" : scorePercent >= 40 ? "warning" : "draft"}
            badgeSize="sm"
          >
            {scorePercent}%
          </Badge>
        </div>

        {source.snippet && (
          <p className="text-sm text-text-secondary line-clamp-3">{source.snippet}</p>
        )}

        {source.ai_rationale && (
          <p className="text-xs text-text-muted italic">{source.ai_rationale}</p>
        )}

        {source.status === "pending" && (
          <div className="flex gap-2 pt-1">
            <Button
              variant="default"
              onClick={() => onApprove(source.id, "incorporate")}
              disabled={disabled}
              className="text-xs"
            >
              Incorporar
            </Button>
            <Button
              variant="outline"
              onClick={() => onApprove(source.id, "reference")}
              disabled={disabled}
              className="text-xs"
            >
              Referencia
            </Button>
            <Button
              variant="outline"
              onClick={() => onReject(source.id)}
              disabled={disabled}
              className="text-xs text-semantic-error"
            >
              <X className="mr-1 h-3 w-3" />
              Rejeitar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
