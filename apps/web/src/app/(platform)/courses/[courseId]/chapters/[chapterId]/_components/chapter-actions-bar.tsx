"use client"

import { Button } from "@eximia/ui"
import { ArrowRight, CheckCircle, Circle } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { markChapterComplete } from "../actions"

interface ChapterActionsBarProps {
  courseId: string
  chapterId: string
  isCompleted: boolean
  nextChapter: { id: string; title: string } | null
  chapterNumber: number
  totalChapters: number
}

export function ChapterActionsBar({
  courseId,
  chapterId,
  isCompleted,
  nextChapter,
  chapterNumber,
  totalChapters,
}: ChapterActionsBarProps) {
  const slug = useTenantSlug(); const p = slug ? `/${slug}` : ""
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleMarkComplete() {
    startTransition(async () => {
      await markChapterComplete(chapterId, courseId)
      router.refresh()
    })
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border-subtle bg-bg-app/90 backdrop-blur-lg md:left-[var(--sidebar-width,230px)]">
      <div className="mx-auto flex max-w-[820px] items-center justify-between gap-4 px-5 py-3 md:px-8">
        {/* Left: completion status + action */}
        <div className="flex items-center gap-3">
          {isCompleted ? (
            <div className="flex items-center gap-2 text-semantic-success">
              <CheckCircle size={18} />
              <span className="text-sm font-medium">Concluído</span>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkComplete}
              disabled={pending}
              className="gap-1.5"
            >
              <Circle size={14} />
              {pending ? "Marcando..." : "Marcar como concluído"}
            </Button>
          )}
        </div>

        {/* Center: pip progress */}
        <div className="hidden flex-1 items-center gap-1 px-6 sm:flex">
          {Array.from({ length: totalChapters }).map((_, i) => (
            <div
              key={`bar-pip-${courseId}-${i}`}
              className={`h-1 flex-1 rounded-full ${
                i < chapterNumber
                  ? "bg-accent-blue-mid"
                  : i === chapterNumber
                    ? "bg-accent-blue-mid/30"
                    : "bg-bg-elevated"
              }`}
            />
          ))}
        </div>

        {/* Right: next chapter */}
        <div className="shrink-0">
          {nextChapter ? (
            <Link href={`${p}/courses/${courseId}/chapters/${nextChapter.id}`}>
              <Button size="sm" className="gap-1.5">
                Próximo
                <ArrowRight size={14} />
              </Button>
            </Link>
          ) : (
            <Link href={`${p}/courses/${courseId}`}>
              <Button variant="outline" size="sm">
                Voltar ao curso
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
