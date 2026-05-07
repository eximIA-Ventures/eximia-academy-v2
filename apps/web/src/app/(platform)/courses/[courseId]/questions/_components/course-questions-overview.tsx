"use client"

import { SkillBadge } from "@/components/skill-badge"
import { useSSE } from "@/hooks/use-sse"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
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
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  useToast,
} from "@eximia/ui"
import { Check, CheckCheck, ClipboardList, FileText, MessageCircle, Pencil, RefreshCw, Sparkles, Target, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState, useTransition } from "react"
import { approveAllPending, batchApproveQuestions, batchRejectQuestions } from "../actions"

interface Chapter {
  id: string
  title: string
  order: number
  status: string
  interaction_type: string | null
  bloom_target: string | null
}

interface Question {
  id: string
  chapter_id: string
  text: string
  skill: string
  intention: string
  expected_depth: string | null
  status: string
  job_id: string | null
  created_at: string
}

interface ActiveJob {
  id: string
  status: string
  progress: Record<string, unknown> | null
  questions_generated: number | null
}

interface CourseQuestionsOverviewProps {
  course: { id: string; title: string }
  chapters: Chapter[]
  questions: Question[]
  activeJob: ActiveJob | null
}

export function CourseQuestionsOverview({
  course,
  chapters,
  questions,
  activeJob,
}: CourseQuestionsOverviewProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showApproveAllModal, setShowApproveAllModal] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const router = useRouter()

  // Stats
  const stats = useMemo(() => {
    const total = questions.length
    const pending = questions.filter((q) => q.status === "pending").length
    const active = questions.filter((q) => q.status === "active").length
    const archived = questions.filter((q) => q.status === "archived").length
    return { total, pending, active, archived }
  }, [questions])

  // Group questions by chapter
  const grouped = useMemo(() => {
    const map = new Map<string, Question[]>()
    for (const q of questions) {
      const arr = map.get(q.chapter_id) ?? []
      arr.push(q)
      map.set(q.chapter_id, arr)
    }
    return map
  }, [questions])

  // Selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAllInChapter = useCallback(
    (chapterId: string) => {
      const chapterPending = questions
        .filter((q) => q.chapter_id === chapterId && q.status === "pending")
        .map((q) => q.id)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        const allSelected = chapterPending.every((id) => next.has(id))
        if (allSelected) {
          for (const id of chapterPending) next.delete(id)
        } else {
          for (const id of chapterPending) next.add(id)
        }
        return next
      })
    },
    [questions],
  )

  const selectAllPending = useCallback(() => {
    const pendingIds = questions.filter((q) => q.status === "pending").map((q) => q.id)
    setSelectedIds((prev) => {
      const allSelected = pendingIds.every((id) => prev.has(id))
      return allSelected ? new Set() : new Set(pendingIds)
    })
  }, [questions])

  // Actions
  function handleBatchApprove() {
    startTransition(async () => {
      const result = await batchApproveQuestions([...selectedIds], course.id)
      if (result.error) {
        toast({ variant: "error", title: result.error })
        return
      }
      toast({ variant: "success", title: `${result.count} pergunta(s) aprovada(s)` })
      setSelectedIds(new Set())
      router.refresh()
    })
  }

  function handleBatchReject() {
    startTransition(async () => {
      const result = await batchRejectQuestions([...selectedIds], course.id)
      if (result.error) {
        toast({ variant: "error", title: result.error })
        return
      }
      toast({ variant: "success", title: `${result.count} pergunta(s) rejeitada(s)` })
      setSelectedIds(new Set())
      router.refresh()
    })
  }

  function handleApproveAll() {
    setShowApproveAllModal(false)
    startTransition(async () => {
      const result = await approveAllPending(course.id)
      if (result.error) {
        toast({ variant: "error", title: result.error })
        return
      }
      toast({ variant: "success", title: `${result.count} pergunta(s) aprovada(s)` })
      setSelectedIds(new Set())
      router.refresh()
    })
  }

  function handleGenerateAll() {
    startTransition(async () => {
      const res = await fetch(`/api/courses/${course.id}/generate-questions`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        toast({ variant: "error", title: data.error || "Erro ao gerar" })
        return
      }
      if (data.jobId) {
        toast({ variant: "success", title: data.message })
        router.refresh()
      } else {
        toast({ title: data.message })
      }
    })
  }

  // SSE for real-time progress
  const [sseProgress, setSseProgress] = useState<{
    total?: number
    completed?: number
    failed?: number
    current_chapter?: string
  } | null>(null)
  const [sseStatus, setSseStatus] = useState<string | null>(null)
  const [sseFailed, setSseFailed] = useState(false)

  const sseUrl =
    activeJob && ["pending", "processing"].includes(activeJob.status)
      ? `/api/generation-jobs/${activeJob.id}/status`
      : null

  useSSE(sseUrl, {
    onMessage: useCallback((data: Record<string, unknown>) => {
      if (data.status) setSseStatus(data.status as string)
      if (data.progress) setSseProgress(data.progress as typeof sseProgress)
    }, []),
    onComplete: useCallback(() => {
      router.refresh()
    }, [router]),
    onError: useCallback(() => {
      setSseFailed(true)
    }, []),
  })

  const isGenerating =
    (sseStatus ?? activeJob?.status) === "processing" ||
    (sseStatus ?? activeJob?.status) === "pending"

  return (
    <div className="space-y-6 pb-24">
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
            <BreadcrumbPage>Interações</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Interaction Engine — per-chapter overview */}
      {chapters.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-medium bg-bg-card/50 py-16 px-6 text-center space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cerrado-600/15">
              <ClipboardList size={20} className="text-cerrado-400" />
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15">
              <Target size={20} className="text-amber-400" />
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15">
              <FileText size={20} className="text-purple-400" />
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-varzea/15">
              <MessageCircle size={20} className="text-varzea" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-primary">Nenhum capítulo criado</h3>
            <p className="mt-1 text-sm text-text-muted max-w-md">
              Crie capítulos primeiro para configurar interações — Quiz, Cenários Práticos, Atividades e Diálogo Socrático.
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <Link href={`/courses/${course.id}`}>
              <Button>Gerenciar Curso</Button>
            </Link>
            <Link href={`/courses/${course.id}/chapters/new`}>
              <Button variant="outline">Criar Primeiro Capítulo</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-text-muted">Interações por Capítulo</h2>
            <Link href={`/courses/${course.id}/chapters/new`}>
              <Button variant="outline" size="sm">Adicionar Capítulo</Button>
            </Link>
          </div>
          <div className="grid gap-2">
            {chapters.map((chapter) => {
              const chapterQuestions = grouped.get(chapter.id) ?? []
              return (
                <div
                  key={chapter.id}
                  className="flex items-center justify-between rounded-xl bg-bg-card p-4 shadow-card"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <InteractionIcon type={chapter.interaction_type} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{chapter.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs ${chapter.interaction_type ? "text-text-secondary" : "text-semantic-warning"}`}>
                          {INTERACTION_LABELS[chapter.interaction_type ?? ""] ?? "⚠ Interação não configurada"}
                        </span>
                        {chapter.bloom_target && (
                          <span className="text-2xs text-text-muted/60">
                            Bloom: {chapter.bloom_target}
                          </span>
                        )}
                        {chapterQuestions.length > 0 && (
                          <span className="text-2xs text-text-muted">
                            · {chapterQuestions.length} pergunta{chapterQuestions.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/courses/${course.id}/chapters/${chapter.id}/edit`}
                    className="shrink-0 flex items-center gap-1.5 rounded-lg bg-cerrado-600/10 px-3 py-2 text-xs font-medium text-cerrado-400 hover:bg-cerrado-600/20 transition-colors ring-1 ring-cerrado-600/20"
                  >
                    <Pencil size={12} />
                    Configurar
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Stats Dashboard — Perguntas (only when chapters exist) */}
      {chapters.length > 0 && (
      <>
      <h2 className="text-sm font-semibold uppercase tracking-widest text-text-muted pt-2">Perguntas Geradas</h2>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={stats.total} variant="neutral" />
        <StatCard label="Pendentes" value={stats.pending} variant="warning" />
        <StatCard label="Aprovadas" value={stats.active} variant="success" />
        <StatCard label="Rejeitadas" value={stats.archived} variant="error" />
      </div>

      {/* Generation Progress (SSE-powered) */}
      {isGenerating && activeJob && (
        <div className="rounded-md shadow-card bg-bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 animate-pulse text-semantic-warning" />
              <span className="text-sm font-medium text-text-primary">Gerando perguntas...</span>
            </div>
            {sseProgress?.total && (
              <span className="text-sm font-medium text-text-secondary">
                {Math.round(((sseProgress.completed ?? 0) / sseProgress.total) * 100)}%
              </span>
            )}
          </div>
          {sseProgress && (
            <>
              <div className="h-2 rounded-full bg-bg-surface overflow-hidden">
                <div
                  className="h-full rounded-full bg-cerrado-600 transition-all duration-500"
                  style={{
                    width: `${sseProgress.total ? Math.round(((sseProgress.completed ?? 0) / sseProgress.total) * 100) : 0}%`,
                  }}
                />
              </div>
              <p className="text-xs text-text-muted">
                Capítulo {(sseProgress.completed ?? 0) + 1} de {sseProgress.total}
                {sseProgress.current_chapter ? `: ${sseProgress.current_chapter}` : ""}
              </p>
              {(sseProgress.failed ?? 0) > 0 && (
                <p className="text-xs text-semantic-warning">
                  {sseProgress.failed} capítulo(s) com erro
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* SSE reconnect fallback */}
      {sseFailed && (
        <div className="flex items-center gap-2 rounded-md border border-semantic-warning/30 bg-semantic-warning/5 p-3">
          <span className="text-xs text-text-muted">Conexão perdida.</span>
          <Button variant="ghost" size="sm" onClick={() => router.refresh()}>
            <RefreshCw className="mr-1 h-3 w-3" />
            Atualizar manualmente
          </Button>
        </div>
      )}

      {/* Header Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerateAll}
          disabled={isPending || isGenerating}
        >
          <Sparkles className="mr-1 h-4 w-4" />
          Gerar para todos
        </Button>
        {stats.pending > 0 && (
          <>
            <Button size="sm" onClick={() => setShowApproveAllModal(true)} disabled={isPending}>
              <CheckCheck className="mr-1 h-4 w-4" />
              Aprovar todas pendentes ({stats.pending})
            </Button>
            <Button variant="ghost" size="sm" onClick={selectAllPending} disabled={isPending}>
              Selecionar todas pendentes
            </Button>
          </>
        )}
      </div>

      {/* Chapters + Questions */}
      {chapters.length === 0 ? (
        <p className="text-sm text-text-muted">Nenhum capítulo neste curso.</p>
      ) : (
        <Accordion type="multiple" defaultValue={chapters.map((c) => c.id)}>
          {chapters.map((chapter) => {
            const chapterQuestions = grouped.get(chapter.id) ?? []
            const pendingCount = chapterQuestions.filter((q) => q.status === "pending").length

            return (
              <AccordionItem key={chapter.id} value={chapter.id}>
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{chapter.title}</span>
                    {chapterQuestions.length > 0 ? (
                      <Badge variant={pendingCount > 0 ? "warning" : "success"} badgeSize="sm">
                        {chapterQuestions.length} pergunta{chapterQuestions.length !== 1 ? "s" : ""}
                        {pendingCount > 0
                          ? ` (${pendingCount} pendente${pendingCount !== 1 ? "s" : ""})`
                          : ""}
                      </Badge>
                    ) : (
                      <Badge variant="draft" badgeSize="sm">
                        Sem perguntas
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {chapterQuestions.length === 0 ? (
                    <p className="py-2 text-sm text-text-muted">
                      Nenhuma pergunta gerada para este capítulo.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {pendingCount > 0 && (
                        <button
                          type="button"
                          className="text-xs text-cerrado-400 hover:underline"
                          onClick={() => selectAllInChapter(chapter.id)}
                        >
                          Selecionar todas pendentes deste capítulo
                        </button>
                      )}
                      {chapterQuestions.map((q) => (
                        <QuestionRow
                          key={q.id}
                          question={q}
                          isSelected={selectedIds.has(q.id)}
                          onToggle={() => toggleSelect(q.id)}
                        />
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      )}

      {/* Sticky Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50  bg-bg-surface p-4 shadow-lg">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <span className="text-sm font-medium text-text-primary">
              {selectedIds.size} selecionada{selectedIds.size !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleBatchApprove} disabled={isPending}>
                <Check className="mr-1 h-4 w-4" />
                Aprovar selecionadas
              </Button>
              <Button size="sm" variant="outline" onClick={handleBatchReject} disabled={isPending}>
                <X className="mr-1 h-4 w-4" />
                Rejeitar selecionadas
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
                disabled={isPending}
              >
                Limpar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Approve All Modal */}
      <Modal open={showApproveAllModal} onOpenChange={setShowApproveAllModal}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Aprovar todas pendentes?</ModalTitle>
            <ModalDescription>
              Você ira aprovar {stats.pending} pergunta{stats.pending !== 1 ? "s" : ""} pendente
              {stats.pending !== 1 ? "s" : ""}. Esta acao nao pode ser desfeita facilmente.
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowApproveAllModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleApproveAll} disabled={isPending}>
              {isPending ? "Aprovando..." : "Aprovar todas"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      </>
      )}
    </div>
  )
}

// --- Sub-components ---

function StatCard({
  label,
  value,
  variant,
}: {
  label: string
  value: number
  variant: "neutral" | "warning" | "success" | "error"
}) {
  const colors = {
    neutral: "text-text-primary",
    warning: "text-semantic-warning",
    success: "text-semantic-success",
    error: "text-semantic-error",
  }

  return (
    <Card>
      <CardContent className="p-4 text-center">
        <p className={`text-2xl font-bold ${colors[variant]}`}>{value}</p>
        <p className="text-xs text-text-muted">{label}</p>
      </CardContent>
    </Card>
  )
}

const INTERACTION_LABELS: Record<string, string> = {
  quiz: "Quiz",
  scenario: "Cenário Prático",
  assignment: "Atividade",
  socratic_dialogue: "Diálogo Socrático",
}

const INTERACTION_STYLES: Record<string, { bg: string; text: string }> = {
  quiz: { bg: "bg-cerrado-600/15", text: "text-cerrado-400" },
  scenario: { bg: "bg-amber-500/15", text: "text-amber-400" },
  assignment: { bg: "bg-purple-500/15", text: "text-purple-400" },
  socratic_dialogue: { bg: "bg-varzea/15", text: "text-varzea" },
}

function InteractionIcon({ type }: { type: string | null }) {
  const style = INTERACTION_STYLES[type ?? ""] ?? { bg: "bg-bg-elevated", text: "text-text-muted" }
  const Icon = type === "quiz" ? ClipboardList
    : type === "scenario" ? Target
    : type === "assignment" ? FileText
    : type === "socratic_dialogue" ? MessageCircle
    : ClipboardList

  return (
    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.bg}`}>
      <Icon size={14} className={style.text} />
    </div>
  )
}

const STATUS_BADGE: Record<
  string,
  { label: string; variant: "warning" | "success" | "error" | "draft" }
> = {
  pending: { label: "Pendente", variant: "warning" },
  active: { label: "Aprovada", variant: "success" },
  archived: { label: "Rejeitada", variant: "error" },
  draft: { label: "Rascunho", variant: "draft" },
}

function QuestionRow({
  question,
  isSelected,
  onToggle,
}: {
  question: Question
  isSelected: boolean
  onToggle: () => void
}) {
  const statusConfig = STATUS_BADGE[question.status] ?? STATUS_BADGE.draft

  return (
    <div
      className={`flex items-start gap-3 rounded-md border p-3 ${
        isSelected ? "border-cerrado-600 bg-cerrado-800/10" : "border-border-medium"
      } ${question.status === "archived" ? "opacity-60" : ""}`}
    >
      {question.status === "pending" && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          className="mt-1 h-4 w-4 rounded border-border-medium"
          aria-label={"Selecionar pergunta"}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {question.skill && (
            <SkillBadge
              skill={question.skill as "analise" | "sintese" | "aplicacao" | "reflexao"}
            />
          )}
          <Badge variant={statusConfig.variant} badgeSize="sm">
            {statusConfig.label}
          </Badge>
        </div>
        <p
          className={`text-sm text-text-primary ${question.status === "archived" ? "line-through" : ""}`}
        >
          {question.text}
        </p>
      </div>
    </div>
  )
}
