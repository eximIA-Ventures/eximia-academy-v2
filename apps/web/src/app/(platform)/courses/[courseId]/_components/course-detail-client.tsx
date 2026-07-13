"use client"

import { analytics } from "@/lib/analytics"
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  useToast,
} from "@eximia/ui"
import {
  AlertTriangle,
  Award,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Download,
  Layers,
  RotateCcw,
  TrendingUp,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { CourseFormDialog } from "../../_components/course-form-dialog"
import { publishCourse, publishCourseWithSwap, restartCourse } from "../../actions"
import { ChapterList } from "./chapter-list"
import { EnrichButton } from "./enrich-button"
import { QuestionGenerationBadge } from "./question-generation-badge"
import { StudentChapterList } from "./student-chapter-list"

interface Course {
  id: string
  title: string
  description: string | null
  type: string
  status: string
  cover_image_url: string | null
  deadline_days: number | null
}

interface Chapter {
  id: string
  title: string
  status: string
  order: number
  content: string | null
}

interface CourseDetailClientProps {
  course: Course
  chapters: Chapter[]
  userRole: string
  activeJobStatus?: string | null
  pendingQuestionsCount?: number
  pendingPerChapter?: Record<string, number>
  progressPercentage?: number
  completedChapterIds?: string[]
  chapterSessionCounts?: Record<string, number>
  enrollmentStatus?: string
  enrolledAt?: string | null
  enrollmentId?: string | null
  certificateCode?: string | null
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
}

const STATUS_VARIANTS: Record<string, "draft" | "success" | "archived"> = {
  draft: "draft",
  published: "success",
  archived: "archived",
}

export function CourseDetailClient({
  course,
  chapters,
  userRole,
  activeJobStatus,
  pendingQuestionsCount = 0,
  pendingPerChapter = {},
  progressPercentage = 0,
  completedChapterIds = [],
  chapterSessionCounts = {},
  enrollmentStatus,
  enrolledAt,
  enrollmentId,
  certificateCode,
}: CourseDetailClientProps) {
  const [showEdit, setShowEdit] = useState(false)
  const [swapConfirm, setSwapConfirm] = useState<{ existingTitle: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const router = useRouter()
  const isManager = userRole === "manager" || userRole === "admin" || userRole === "instructor"

  function handlePublish() {
    startTransition(async () => {
      const result = await publishCourse(course.id)
      if ("conflict" in result && result.conflict) {
        setSwapConfirm({ existingTitle: result.existingTitle as string })
        return
      }
      if (result.error) {
        toast({ variant: "error", title: result.error })
        return
      }
      toast({ variant: "success", title: "Curso publicado com sucesso!" })
      router.refresh()
    })
  }

  function handleConfirmSwap() {
    setSwapConfirm(null)
    startTransition(async () => {
      const result = await publishCourseWithSwap(course.id)
      if (result.error) {
        toast({ variant: "error", title: result.error })
        return
      }
      toast({
        variant: "success",
        title: "Curso publicado com sucesso! Trilha anterior convertida para regular.",
      })
      router.refresh()
    })
  }

  const hasCover = !!course.cover_image_url

  return (
    <div className="space-y-6">
      {/* Hero — cinematic cover image or gradient fallback */}
      <div
        className="relative min-h-[240px] overflow-hidden rounded-2xl shadow-card md:min-h-[300px]"
        style={{ background: "#1a1a1a" }}
      >
        {hasCover ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={course.cover_image_url!}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top, #1a1a1a 0%, rgba(26,26,26,0.8) 40%, transparent 100%)",
              }}
            />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-cerrado-800 via-bg-card to-bg-surface" />
        )}

        {/* Content overlay */}
        <div className="relative z-10 flex h-full min-h-[240px] flex-col justify-end px-8 pb-7 pt-6 md:min-h-[300px] md:px-10 md:pb-8">
          {/* Breadcrumb */}
          <Breadcrumb className="mb-auto pt-2">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href={"/courses"} className="text-white/60 hover:text-white/80">
                  Cursos
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-white/30" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-white/80">{course.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Title area */}
          <div className="flex items-end justify-between gap-6">
            <div className="max-w-3xl space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={STATUS_VARIANTS[course.status]} badgeSize="sm">
                  {STATUS_LABELS[course.status]}
                </Badge>
                {isManager && (
                  <QuestionGenerationBadge
                    courseId={course.id}
                    activeJobStatus={activeJobStatus}
                    pendingQuestionsCount={pendingQuestionsCount}
                  />
                )}
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
                {course.title}
              </h1>
              {course.description && (
                <p className="max-w-2xl text-sm leading-relaxed text-white/70 md:text-base">
                  {course.description}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-4 text-sm text-white/50">
                <span className="flex items-center gap-1.5">
                  <Layers size={14} />
                  {chapters.length} capítulo{chapters.length !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1.5">
                  <BookOpen size={14} />
                  {course.type === "onboarding" ? "Trilha de Onboarding" : "Curso"}
                </span>
                {course.deadline_days && (
                  <span className="flex items-center gap-1.5">
                    <CalendarClock size={14} />
                    Prazo: {course.deadline_days} dias
                  </span>
                )}
                {/* Pace badge for students */}
                {!isManager &&
                  enrollmentStatus === "active" &&
                  course.deadline_days &&
                  enrolledAt &&
                  (() => {
                    const enrolled = new Date(enrolledAt)
                    const deadlineDate = new Date(
                      enrolled.getTime() + course.deadline_days * 86400000,
                    )
                    const now = new Date()
                    const totalDays = course.deadline_days
                    const elapsed = Math.max(0, (now.getTime() - enrolled.getTime()) / 86400000)
                    const expectedPct = Math.min(100, Math.round((elapsed / totalDays) * 100))
                    const daysLeft = Math.max(
                      0,
                      Math.ceil((deadlineDate.getTime() - now.getTime()) / 86400000),
                    )
                    const isAhead = progressPercentage >= expectedPct
                    const isBehind = progressPercentage < expectedPct - 15

                    return (
                      <span
                        className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          isBehind
                            ? "bg-semantic-error/15 text-red-400"
                            : isAhead
                              ? "bg-semantic-success/15 text-green-400"
                              : "bg-accent-gold/15 text-amber-400"
                        }`}
                      >
                        {isBehind ? (
                          <AlertTriangle size={12} />
                        ) : isAhead ? (
                          <TrendingUp size={12} />
                        ) : (
                          <CalendarClock size={12} />
                        )}
                        {isBehind
                          ? `Atrasado (${daysLeft}d restantes)`
                          : isAhead
                            ? "Adiantado"
                            : `No ritmo (${daysLeft}d restantes)`}
                      </span>
                    )
                  })()}
                {!isManager && enrollmentStatus === "completed" && (
                  <span className="flex items-center gap-1.5 rounded-full bg-semantic-success/15 px-2.5 py-0.5 text-xs font-medium text-green-400">
                    <CheckCircle2 size={12} />
                    Concluído
                  </span>
                )}
              </div>

              {/* Progress bar for students */}
              {!isManager && progressPercentage > 0 && (
                <div className="flex items-center gap-3 pt-1">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${enrollmentStatus === "completed" ? "bg-semantic-success" : "bg-cerrado-600"}`}
                      style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium tabular-nums text-white/60">
                    {enrollmentStatus === "completed"
                      ? "Concluído"
                      : `${Math.round(progressPercentage)}%`}
                  </span>
                </div>
              )}

              {/* Certificate + Restart — only when completed */}
              {!isManager && enrollmentStatus === "completed" && (
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  {enrollmentId && (
                    <Link href={`/certificates/${enrollmentId}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-accent-gold/30 bg-accent-gold/10 text-accent-gold hover:bg-accent-gold/20 hover:text-accent-gold"
                      >
                        <Award size={14} />
                        Ver Certificado
                      </Button>
                    </Link>
                  )}
                </div>
              )}
              {!isManager && enrollmentStatus === "completed" && (
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-white/20 text-white/80 hover:bg-white/10 hover:text-white"
                    onClick={() => {
                      if (
                        !window.confirm(
                          "Deseja refazer o curso? Seu progresso será reiniciado, mas suas interações anteriores ficam salvas.",
                        )
                      )
                        return
                      startTransition(async () => {
                        const result = await restartCourse(course.id)
                        if ("error" in result && result.error) {
                          toast({ variant: "error", title: result.error })
                        } else {
                          analytics.courseRestarted(course.id)
                          toast({ variant: "success", title: "Curso reiniciado! Bom estudo." })
                          router.refresh()
                        }
                      })
                    }}
                    disabled={isPending}
                  >
                    <RotateCcw size={14} />
                    {isPending ? "Reiniciando..." : "Refazer Curso"}
                  </Button>
                </div>
              )}
            </div>

            {isManager && (
              <div className="hidden flex-col gap-2 md:flex">
                <div className="flex gap-2">
                  <EnrichButton
                    courseId={course.id}
                    hasPublishedChapters={chapters.some((ch) => ch.status === "published")}
                  />
                  <Link href={`/courses/${course.id}/questions`}>
                    <Button variant="outline">Interações</Button>
                  </Link>
                  <Button variant="outline" onClick={() => setShowEdit(true)}>
                    Editar
                  </Button>
                  <a href={`/api/courses/${course.id}/export`} download>
                    <Button variant="outline">
                      <Download className="mr-1.5 h-4 w-4" />
                      Exportar
                    </Button>
                  </a>
                  {course.status === "draft" && (
                    <Button onClick={handlePublish} disabled={isPending}>
                      {isPending ? "Publicando..." : "Publicar"}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Manager mobile actions */}
      {isManager && (
        <div className="grid grid-cols-2 gap-2 py-3 md:hidden">
          <EnrichButton
            courseId={course.id}
            hasPublishedChapters={chapters.some((ch) => ch.status === "published")}
          />
          <Link href={`/courses/${course.id}/questions`}>
            <Button variant="outline" className="shrink-0">
              Perguntas
            </Button>
          </Link>
          <Button variant="outline" className="shrink-0" onClick={() => setShowEdit(true)}>
            Editar
          </Button>
          <a href={`/api/courses/${course.id}/export`} download>
            <Button variant="outline" className="shrink-0">
              <Download className="mr-1.5 h-4 w-4" />
              Exportar
            </Button>
          </a>
          {course.status === "draft" && (
            <Button className="shrink-0" onClick={handlePublish} disabled={isPending}>
              {isPending ? "Publicando..." : "Publicar"}
            </Button>
          )}
        </div>
      )}

      {/* Chapter List */}
      <div>
        {isManager ? (
          <ChapterList
            courseId={course.id}
            chapters={chapters}
            pendingPerChapter={pendingPerChapter}
          />
        ) : (
          <StudentChapterList
            courseId={course.id}
            chapters={chapters.filter((ch) => ch.status === "published")}
            completedChapterIds={completedChapterIds}
            chapterSessionCounts={chapterSessionCounts}
            enrollmentStatus={enrollmentStatus}
          />
        )}
      </div>

      {/* Edit Dialog */}
      <CourseFormDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        course={{
          id: course.id,
          title: course.title,
          description: course.description,
          type: course.type,
          cover_image_url: course.cover_image_url,
          deadline_days: course.deadline_days,
        }}
      />

      {/* Swap Confirmation Modal */}
      <Modal open={!!swapConfirm} onOpenChange={() => setSwapConfirm(null)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Substituir trilha de onboarding?</ModalTitle>
            <ModalDescription>
              Já existe uma trilha de onboarding ativa:{" "}
              <strong>{swapConfirm?.existingTitle}</strong>. Ao publicar este curso, a trilha
              anterior será convertida para curso regular.
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button variant="outline" onClick={() => setSwapConfirm(null)} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmSwap} disabled={isPending}>
              {isPending ? "Publicando..." : "Substituir e Publicar"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
