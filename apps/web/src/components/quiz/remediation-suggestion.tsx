"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import { BookOpen } from "lucide-react"
import Link from "next/link"

interface ChapterSuggestion {
  chapterId: string
  chapterTitle: string
  errorCount: number
}

interface RemediationSuggestionProps {
  courseId: string
  chapters: ChapterSuggestion[]
}

export function RemediationSuggestion({ courseId, chapters }: RemediationSuggestionProps) {
  if (chapters.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <BookOpen size={16} className="text-cerrado-600" />
          Revise estes capítulos antes de tentar novamente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {chapters.map((ch) => (
          <Link
            key={ch.chapterId}
            href={`/courses/${courseId}/chapters/${ch.chapterId}`}
            className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-bg-surface"
          >
            <span className="text-text-primary">{ch.chapterTitle}</span>
            <span className="text-xs text-semantic-error">
              {ch.errorCount} {ch.errorCount === 1 ? "erro" : "erros"}
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
