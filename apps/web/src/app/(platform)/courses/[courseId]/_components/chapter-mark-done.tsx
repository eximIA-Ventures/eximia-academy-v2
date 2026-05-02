"use client"

import { cn } from "@eximia/ui"
import { Check, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { markChapterComplete } from "../chapters/[chapterId]/actions"

interface ChapterMarkDoneProps {
  courseId: string
  chapterId: string
  isCompleted: boolean
}

export function ChapterMarkDone({ courseId, chapterId, isCompleted: initial }: ChapterMarkDoneProps) {
  const [done, setDone] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  if (done) return null

  function handleMark(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    startTransition(async () => {
      try {
        await markChapterComplete(chapterId, courseId)
        setDone(true)
        router.refresh()
      } catch {
        // silent
      }
    })
  }

  return (
    <button
      type="button"
      onClick={handleMark}
      disabled={isPending}
      title="Marcar como concluído"
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all",
        isPending
          ? "border-semantic-success/40 bg-semantic-success/10"
          : "border-border-medium hover:border-semantic-success hover:bg-semantic-success/10",
      )}
    >
      {isPending ? (
        <Loader2 size={12} className="animate-spin text-semantic-success" />
      ) : (
        <Check size={12} className="text-transparent group-hover:text-semantic-success" />
      )}
    </button>
  )
}
