"use client"

import type { ChapterSlide } from "@eximia/shared"
import { SlideEditorCard } from "./slide-editor-card"

interface SlideListProps {
  slides: ChapterSlide[]
  onRefresh: () => void
}

export function SlideList({ slides, onRefresh }: SlideListProps) {
  if (!slides.length) return null

  return (
    <div className="space-y-2">
      {slides.map((slide) => (
        <SlideEditorCard key={slide.id} slide={slide} onDelete={onRefresh} />
      ))}
    </div>
  )
}
