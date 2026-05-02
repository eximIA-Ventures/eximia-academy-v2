"use client"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  EmptyState,
  useToast,
} from "@eximia/ui"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { GenerateQuestionsButton } from "../../../../_components/generate-questions-button"
import { approveQuestion, rejectQuestion, updateQuestionText } from "../actions"
import { QuestionReviewCard } from "./question-review-card"

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

interface QuestionsReviewClientProps {
  courseId: string
  courseTitle: string
  chapterId: string
  chapterTitle: string
  chapterStatus: string
  questions: Question[]
}

export function QuestionsReviewClient({
  courseId,
  courseTitle,
  chapterId,
  chapterTitle,
  chapterStatus,
  questions,
}: QuestionsReviewClientProps) {
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const router = useRouter()

  const activeCount = questions.filter((q) => q.status === "active").length
  const allActive = questions.length > 0 && activeCount === questions.length

  function handleApprove(questionId: string) {
    startTransition(async () => {
      const result = await approveQuestion(questionId, courseId, chapterId)
      if (result.error) {
        toast({ variant: "error", title: result.error })
        return
      }
      toast({ variant: "success", title: "Pergunta aprovada" })
      router.refresh()
    })
  }

  function handleReject(questionId: string) {
    startTransition(async () => {
      const result = await rejectQuestion(questionId, courseId, chapterId)
      if (result.error) {
        toast({ variant: "error", title: result.error })
        return
      }
      toast({ variant: "success", title: "Pergunta rejeitada" })
      router.refresh()
    })
  }

  function handleUpdateText(questionId: string, newText: string) {
    startTransition(async () => {
      const result = await updateQuestionText(questionId, newText, courseId, chapterId)
      if (result.error) {
        toast({ variant: "error", title: result.error })
        return
      }
      router.refresh()
    })
  }

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
            <BreadcrumbLink href={`/courses/${courseId}`}>{courseTitle}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Perguntas — {chapterTitle}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-text-primary">
          Perguntas Socraticas — {chapterTitle}
        </h1>
        <div className="flex items-center gap-2">
          <GenerateQuestionsButton
            chapterId={chapterId}
            chapterStatus={chapterStatus}
            hasExistingQuestions={questions.length > 0}
          />
          {questions.length > 0 && !allActive && (
            <GenerateQuestionsButton
              chapterId={chapterId}
              chapterStatus={chapterStatus}
              hasExistingQuestions
              replace
              variant="outline"
              disabled={allActive}
            />
          )}
        </div>
      </div>

      {/* Question list */}
      {questions.length === 0 ? (
        <EmptyState
          title="Nenhuma pergunta gerada"
          description="Gere perguntas socraticas a partir do conteúdo do capítulo publicado."
        />
      ) : (
        <div className="space-y-4">
          {questions.map((question) => (
            <QuestionReviewCard
              key={question.id}
              question={question}
              onApprove={handleApprove}
              onReject={handleReject}
              onUpdateText={handleUpdateText}
              isPending={isPending}
            />
          ))}
        </div>
      )}

      {/* Footer summary */}
      {questions.length > 0 && (
        <div
          className={`text-sm font-medium ${activeCount >= 1 ? "text-semantic-success" : "text-semantic-warning"}`}
        >
          {activeCount}/{questions.length} perguntas ativas — minimo 1 para publicar capítulo
        </div>
      )}
    </div>
  )
}
