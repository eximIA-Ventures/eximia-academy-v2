"use client"

import { buttonVariants } from "@eximia/ui"
import Link from "next/link"
import { useEffect, useMemo, useRef } from "react"
import { updateProgress } from "../actions"

interface SessionCompleteBarProps {
  courseId: string
  chapterId: string
  messages: Array<{ role: string; content: string }>
  sessionCreatedAt: string
  sessionCompletedAt: string | null
  nextChapterId: string | null
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (minutes === 0) return `${secs} seg`
  return `${minutes} min ${secs} seg`
}

export function SessionCompleteBar({
  courseId,
  chapterId,
  messages,
  sessionCreatedAt,
  sessionCompletedAt,
  nextChapterId,
}: SessionCompleteBarProps) {
  const progressUpdated = useRef(false)

  // Client-side metrics (AC10)
  const metrics = useMemo(() => {
    const studentMessages = messages.filter((m) => m.role === "user")
    const totalWords = studentMessages.reduce(
      (sum, m) => sum + m.content.split(/\s+/).filter(Boolean).length,
      0,
    )

    let durationSeconds = 0
    if (sessionCreatedAt) {
      const start = new Date(sessionCreatedAt).getTime()
      const end = sessionCompletedAt ? new Date(sessionCompletedAt).getTime() : Date.now()
      durationSeconds = Math.round((end - start) / 1000)
    }

    const sessionDate = new Date(sessionCreatedAt).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })

    return { totalWords, durationSeconds, sessionDate }
  }, [messages, sessionCreatedAt, sessionCompletedAt])

  // Update enrollment progress once on mount (AC7)
  useEffect(() => {
    if (!progressUpdated.current) {
      progressUpdated.current = true
      updateProgress(courseId).catch(() => {
        // Silently handle — progress will be recalculated on next page load
      })
    }
  }, [courseId])

  return (
    <div className="rounded-lg border border-accent-teal/30 bg-bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-accent-teal" />
        <span className="text-sm font-medium text-text-primary">Sessão concluida</span>
      </div>

      {/* Metrics (AC4) */}
      <div className="mb-4 flex gap-6 text-xs text-text-secondary">
        <span>Duracao: {formatDuration(metrics.durationSeconds)}</span>
        <span>Palavras escritas: {metrics.totalWords}</span>
        <span>{metrics.sessionDate}</span>
      </div>

      {/* CTAs (AC5, AC6) */}
      <div className="flex gap-3">
        <Link
          href={`/courses/${courseId}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Voltar ao Curso
        </Link>
        {nextChapterId && (
          <Link
            href={`/courses/${courseId}/chapters/${nextChapterId}`}
            className={buttonVariants({ size: "sm" })}
          >
            Proximo Capítulo
          </Link>
        )}
      </div>
    </div>
  )
}
