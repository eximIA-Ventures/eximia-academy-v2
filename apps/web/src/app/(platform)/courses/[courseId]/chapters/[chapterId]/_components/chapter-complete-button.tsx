"use client"

import { Button } from "@eximia/ui"
import { Check, CheckCircle, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { markChapterComplete } from "../actions"

interface ChapterCompleteButtonProps {
  courseId: string
  chapterId: string
  isCompleted: boolean
}

export function ChapterCompleteButton({
  courseId,
  chapterId,
  isCompleted: initialCompleted,
}: ChapterCompleteButtonProps) {
  const [isCompleted, setIsCompleted] = useState(initialCompleted)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  if (isCompleted) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-semantic-success/20 bg-semantic-success/5 px-6 py-3">
        <CheckCircle size={18} className="text-semantic-success" />
        <span className="text-sm font-medium text-semantic-success">
          Módulo Concluído
        </span>
      </div>
    )
  }

  function handleComplete() {
    startTransition(async () => {
      try {
        await markChapterComplete(chapterId, courseId)
        setIsCompleted(true)
        router.refresh()
      } catch {
        // silently fail — user can retry
      }
    })
  }

  return (
    <Button
      onClick={handleComplete}
      disabled={isPending}
      variant="outline"
      className="gap-2 border-semantic-success/30 text-semantic-success hover:bg-semantic-success/10 hover:text-semantic-success"
    >
      {isPending ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Check size={16} />
      )}
      {isPending ? "Salvando..." : "Concluir Módulo"}
    </Button>
  )
}
