"use client"

import { cn } from "@eximia/ui"
import { ChevronRight, LayoutGrid, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

interface SlideEntry {
  order: number
  label: string
}

interface ChapterTocSheetProps {
  courseId: string
  courseTitle: string
  chapters: { id: string; title: string; order: number }[]
  currentChapterId: string
  currentSections: { text: string; slug: string }[]
  slides?: SlideEntry[]
  currentSlideIndex?: number
  onGoToSlide?: (index: number) => void
}

export function ChapterTocSheet({
  courseId,
  courseTitle,
  chapters,
  currentChapterId,
  currentSections,
  slides,
  currentSlideIndex = 0,
  onGoToSlide,
}: ChapterTocSheetProps) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const hasSlides = slides && slides.length > 0

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleEsc)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleEsc)
    }
  }, [open])

  return (
    <>
      {/* Toggle button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed right-3 top-3 z-30 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl ring-1 shadow-lg text-text-muted transition-all hover:text-white hover:scale-105 sm:right-6 sm:top-20",
          open
            ? "bg-accent-blue-mid/15 ring-accent-blue-mid/30 text-accent-blue-mid"
            : "bg-bg-card/90 backdrop-blur-sm ring-white/[0.08] hover:ring-white/[0.15]",
        )}
        aria-label="Índice"
      >
        <LayoutGrid size={16} />
      </button>

      {/* Floating panel — Notion style */}
      {open && (
        <div
          ref={panelRef}
          className="fixed right-3 top-14 z-30 w-[calc(100vw-1.5rem)] sm:w-72 max-h-[60vh] sm:max-h-[70vh] overflow-hidden rounded-xl bg-bg-card ring-1 ring-white/[0.08] shadow-[0_8px_30px_rgba(0,0,0,0.4)] animate-in fade-in zoom-in-95 duration-150 origin-top-right sm:right-6 sm:top-32 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <span className="text-xs font-semibold text-text-primary">Índice</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <X size={12} />
            </button>
          </div>

          {/* Course label */}
          <div className="px-4 pt-3 pb-1">
            <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-text-muted/60">{courseTitle}</p>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            <nav className="flex flex-col gap-px">
              {chapters.map((ch) => {
                const isCurrent = ch.id === currentChapterId

                return (
                  <div key={ch.id}>
                    <Link
                      href={isCurrent ? "#" : `/courses/${courseId}/chapters/${ch.id}`}
                      onClick={() => !isCurrent && setOpen(false)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] transition-all",
                        isCurrent
                          ? "bg-accent-blue-mid/10 text-white font-medium"
                          : "text-text-muted hover:bg-white/[0.04] hover:text-text-secondary",
                      )}
                    >
                      <span className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold",
                        isCurrent ? "bg-accent-blue-mid text-white" : "bg-white/[0.06] text-text-muted",
                      )}>
                        {ch.order + 1}
                      </span>
                      <span className="flex-1 truncate">{ch.title}</span>
                      {isCurrent && <ChevronRight size={10} className="text-accent-blue-mid shrink-0" />}
                    </Link>

                    {/* Slide sub-items */}
                    {isCurrent && hasSlides && (
                      <div className="ml-4 mt-0.5 mb-1 flex flex-col border-l border-white/[0.06] pl-2">
                        {slides.map((slide) => {
                          const isActiveSlide = slide.order === currentSlideIndex
                          return (
                            <button
                              key={slide.order}
                              type="button"
                              onClick={() => onGoToSlide?.(slide.order)}
                              className={cn(
                                "flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition-colors text-left",
                                isActiveSlide
                                  ? "bg-accent-blue-mid/10 text-accent-blue-mid font-medium"
                                  : "text-text-muted hover:text-accent-blue-mid hover:bg-white/[0.03]",
                              )}
                            >
                              <span className={cn(
                                "shrink-0 tabular-nums text-[9px] w-3",
                                isActiveSlide ? "text-accent-blue-mid" : "text-text-muted/50",
                              )}>{slide.order + 1}</span>
                              <span className="truncate">{slide.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* Text section sub-items */}
                    {isCurrent && !hasSlides && currentSections.length > 0 && (
                      <div className="ml-4 mt-0.5 mb-1 flex flex-col border-l border-white/[0.06] pl-2">
                        {currentSections.map((section) => (
                          <a
                            key={section.slug}
                            href={`#${section.slug}`}
                            onClick={() => setOpen(false)}
                            className="block rounded-md px-2 py-1 text-[11px] text-text-muted transition-colors hover:text-accent-blue-mid hover:bg-white/[0.03]"
                          >
                            {section.text}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
