"use client"

import type { ChapterSlide } from "@eximia/shared"
import Image from "next/image"
import { useEffect, useRef } from "react"

interface SlideThumbnailStripProps {
  slides: ChapterSlide[]
  currentIndex: number
  onSelect: (index: number) => void
}

export function SlideThumbnailStrip({ slides, currentIndex, onSelect }: SlideThumbnailStripProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  // Auto-scroll to active thumbnail
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      })
    }
  }, [currentIndex])

  return (
    <div
      ref={containerRef}
      className="flex gap-2 overflow-x-auto py-2 px-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border-primary"
    >
      {slides.map((slide, index) => {
        const isActive = index === currentIndex

        return (
          <button
            key={slide.id}
            ref={isActive ? activeRef : undefined}
            type="button"
            onClick={() => onSelect(index)}
            className={`relative flex-shrink-0 w-[72px] h-[40px] sm:w-24 sm:h-[54px] rounded-md overflow-hidden transition-all ${
              isActive
                ? "ring-[3px] ring-accent-blue-mid shadow-[0_0_0_1px_rgba(42,106,176,0.15),0_0_8px_rgba(42,106,176,0.25)] scale-105"
                : "ring-1 ring-border-subtle hover:ring-border-primary opacity-70 hover:opacity-100"
            }`}
            aria-label={`Slide ${index + 1}`}
            aria-current={isActive ? "true" : undefined}
          >
            {slide.image_url ? (
              <Image
                src={slide.image_url}
                alt={`Slide ${index + 1}`}
                fill
                className="object-cover"
                sizes="96px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-bg-surface text-xs text-text-muted">
                {index + 1}
              </div>
            )}
            {/* Slide number badge */}
            <span className="absolute bottom-0.5 right-0.5 rounded-sm bg-bg-primary/80 px-1 text-[10px] text-text-muted">
              {index + 1}
            </span>
          </button>
        )
      })}
    </div>
  )
}
