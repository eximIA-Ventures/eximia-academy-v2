"use client"

import { cn } from "@eximia/ui"
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  Clock,
  Layers,
  MessageSquareText,
  Play,
} from "lucide-react"
import Link from "next/link"
import { ChapterMarkDone } from "./chapter-mark-done"

interface Chapter {
  id: string
  title: string
  status: string
  order: number
  content: string | null
}

interface StudentChapterListProps {
  courseId: string
  chapters: Chapter[]
  completedChapterIds?: string[]
  chapterSessionCounts?: Record<string, number>
}

/** Estimate reading time from markdown content length */
function estimateReadingMinutes(content: string | null): number {
  if (!content) return 1
  const words = content.split(/\s+/).length
  return Math.max(1, Math.round(words / 200))
}

type ChapterState = "completed" | "current" | "upcoming"

export function StudentChapterList({
  courseId,
  chapters,
  completedChapterIds = [],
  chapterSessionCounts = {},
}: StudentChapterListProps) {
  const slug = useTenantSlug()
  const p = slug ? `/${slug}` : ""

  if (chapters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-bg-elevated">
          <BookOpenCheck className="h-6 w-6 text-text-muted" />
        </div>
        <p className="text-sm font-medium text-text-secondary">Nenhum capítulo disponível ainda</p>
        <p className="mt-1 text-xs text-text-muted">
          O conteúdo do curso está sendo preparado. Volte em breve.
        </p>
      </div>
    )
  }

  const sorted = [...chapters].sort((a, b) => a.order - b.order)
  const completedSet = new Set(completedChapterIds)
  const completedCount = sorted.filter((ch) => completedSet.has(ch.id)).length
  const progressPct = Math.round((completedCount / sorted.length) * 100)

  // Find the first non-completed chapter (the "current" one)
  const currentChapterId = sorted.find((ch) => !completedSet.has(ch.id))?.id ?? null

  function getState(chapterId: string): ChapterState {
    if (completedSet.has(chapterId)) return "completed"
    if (chapterId === currentChapterId) return "current"
    return "upcoming"
  }

  const totalMinutes = sorted.reduce((acc, ch) => acc + estimateReadingMinutes(ch.content), 0)

  return (
    <div className="space-y-6">
      {/* Header + progress */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-text-muted">
            <Layers size={16} />
            <h2 className="text-sm font-medium">
              Conteúdo do curso &middot; {chapters.length} capítulo
              {chapters.length !== 1 ? "s" : ""}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {totalMinutes > 0 && (
              <span className="flex items-center gap-1 text-xs text-text-muted">
                <Clock size={12} />
                ~{totalMinutes} min
              </span>
            )}
            {completedCount > 0 && (
              <span className="text-xs font-medium text-accent-blue-light">
                {completedCount}/{chapters.length}
              </span>
            )}
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-elevated">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent-blue-mid to-accent-blue-light transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-xs font-medium tabular-nums text-text-muted">{progressPct}%</span>
        </div>
      </div>

      {/* Timeline chapter list */}
      <div className="relative">
        {sorted.map((chapter, idx) => {
          const state = getState(chapter.id)
          const readMin = estimateReadingMinutes(chapter.content)
          const sessionCount = chapterSessionCounts[chapter.id] ?? 0
          const isLast = idx === sorted.length - 1

          return (
            <div key={chapter.id} className="relative flex gap-4">
              {/* Timeline spine */}
              <div className="flex flex-col items-center">
                {/* Node */}
                <div
                  className={cn(
                    "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all",
                    state === "completed" &&
                      "bg-semantic-success/15 text-semantic-success ring-2 ring-semantic-success/20",
                    state === "current" &&
                      "bg-accent-blue-mid/20 text-accent-blue-light ring-2 ring-accent-blue-mid/40 shadow-[0_0_12px_rgba(42,106,176,0.3)]",
                    state === "upcoming" &&
                      "bg-bg-elevated text-text-muted",
                  )}
                >
                  {state === "completed" ? (
                    <Check size={14} strokeWidth={3} />
                  ) : state === "current" ? (
                    <Play size={12} fill="currentColor" />
                  ) : (
                    idx + 1
                  )}
                </div>
                {/* Connector line */}
                {!isLast && (
                  <div
                    className={cn(
                      "w-px flex-1 min-h-[16px]",
                      state === "completed"
                        ? "bg-semantic-success/20"
                        : "bg-border-subtle",
                    )}
                  />
                )}
              </div>

              {/* Chapter card */}
              <div className={cn("flex-1 pb-4", isLast && "pb-0")}>
                <div
                  className={cn(
                    "rounded-xl border transition-all",
                    state === "current"
                      ? "border-accent-blue-mid/30 bg-accent-blue-deep/20 shadow-[0_0_20px_rgba(42,106,176,0.08)]"
                      : "border-border-subtle bg-bg-card hover:border-border-medium",
                    state === "completed" && "opacity-80",
                  )}
                >
                  {/* Chapter main row */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    {/* Title area */}
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`${p}/courses/${courseId}/chapters/${chapter.id}`}
                        className="group block"
                      >
                        <span
                          className={cn(
                            "block text-sm font-medium transition-colors group-hover:text-accent-blue-light",
                            state === "current"
                              ? "text-accent-blue-light"
                              : state === "completed"
                                ? "text-text-secondary"
                                : "text-text-primary",
                          )}
                        >
                          {chapter.title}
                        </span>
                        <span className="mt-1 flex items-center gap-1 text-2xs text-text-muted">
                          <Clock size={10} />
                          {readMin} min
                        </span>
                      </Link>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-1.5">
                      {sessionCount > 0 && (
                        <Link
                          href={`${p}/courses/${courseId}/chapters/${chapter.id}/session`}
                          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:bg-bg-elevated hover:text-accent-blue-light"
                          title="Ver interação socrática"
                        >
                          <MessageSquareText size={14} />
                          <span className="hidden sm:inline">{sessionCount}</span>
                        </Link>
                      )}
                      {state === "current" && (
                        <Link
                          href={`${p}/courses/${courseId}/chapters/${chapter.id}`}
                          className="flex items-center gap-1.5 rounded-lg bg-accent-blue-mid/15 px-3 py-1.5 text-xs font-medium text-accent-blue-light transition-colors hover:bg-accent-blue-mid/25"
                        >
                          Continuar
                          <ArrowRight size={12} />
                        </Link>
                      )}
                      <ChapterMarkDone
                        courseId={courseId}
                        chapterId={chapter.id}
                        isCompleted={state === "completed"}
                      />
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
