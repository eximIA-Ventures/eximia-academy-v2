"use client"

import type { ChapterSlide } from "@eximia/shared"
import { useSlideAudioSync } from "@/lib/hooks/use-slide-audio-sync"
import { FileText } from "lucide-react"
import Markdown from "react-markdown"
import { useCallback, useEffect, useState, type MutableRefObject } from "react"
import { SlideAudioBar } from "./slide-audio-bar"
import { SlideImageDisplay } from "./slide-image-display"
import { SlideThumbnailStrip } from "./slide-thumbnail-strip"

interface ChapterSlideViewerProps {
  slides: ChapterSlide[]
  audioUrl: string | null
  chapterId?: string
  /** Callback when the user reaches the last slide */
  onReachEnd?: (isAtEnd: boolean) => void
  goToSlideRef?: MutableRefObject<((index: number) => void) | null>
  onSlideChange?: (index: number) => void
}

export default function ChapterSlideViewer({ slides, audioUrl, chapterId, onReachEnd, goToSlideRef, onSlideChange }: ChapterSlideViewerProps) {
  const {
    currentSlideIndex,
    audioRef,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    togglePlay,
    seekTo,
    setPlaybackRate,
    goToSlide,
  } = useSlideAudioSync({ slides, audioUrl, chapterId })

  const [showNotes, setShowNotes] = useState(true)

  const currentSlide = slides[currentSlideIndex]
  const isLastSlide = currentSlideIndex === slides.length - 1

  // Expose goToSlide to parent via ref
  useEffect(() => {
    if (goToSlideRef) goToSlideRef.current = goToSlide
    return () => { if (goToSlideRef) goToSlideRef.current = null }
  }, [goToSlide, goToSlideRef])

  // Notify parent of slide changes
  useEffect(() => {
    onReachEnd?.(isLastSlide)
  }, [isLastSlide, onReachEnd])

  useEffect(() => {
    onSlideChange?.(currentSlideIndex)
  }, [currentSlideIndex, onSlideChange])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && currentSlideIndex > 0) {
        goToSlide(currentSlideIndex - 1)
      } else if (e.key === "ArrowRight" && currentSlideIndex < slides.length - 1) {
        goToSlide(currentSlideIndex + 1)
      } else if (e.key === " " && audioUrl) {
        e.preventDefault()
        togglePlay()
      } else if (e.key === "n" || e.key === "N") {
        setShowNotes((prev) => !prev)
      }
    },
    [currentSlideIndex, slides.length, goToSlide, audioUrl, togglePlay],
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  if (!slides.length) {
    return (
      <div className="rounded-md bg-bg-card p-8 text-center text-text-muted">
        Nenhum slide disponível para este capítulo.
      </div>
    )
  }

  const hasNotes = !!currentSlide?.text_content

  return (
    <>
      <div className={`overflow-hidden ${audioUrl ? "pb-24 sm:pb-20" : ""}`}>
        {/* Header bar with counter + notes toggle */}
        <div className="mb-3 flex items-center justify-between text-xs text-text-muted">
          <span>
            Slide {currentSlideIndex + 1} de {slides.length}
          </span>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-text-muted/60">
              Setas para navegar · N para notas
            </span>
            {hasNotes && (
              <button
                type="button"
                onClick={() => setShowNotes((prev) => !prev)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  showNotes
                    ? "bg-accent-blue-mid/15 text-accent-blue-mid ring-1 ring-accent-blue-mid/30"
                    : "text-text-muted hover:text-text-secondary hover:bg-bg-surface"
                }`}
              >
                <FileText size={12} />
                Notas
              </button>
            )}
          </div>
        </div>

        {/* Main layout: slide left + notes right */}
        <div className="flex gap-4">
          {/* Left column — thumbnails + slide */}
          <div className={`flex flex-col gap-3 min-w-0 transition-all ${showNotes && hasNotes ? "w-2/3" : "w-full"}`}>
            {/* Thumbnail strip — only above the slide */}
            {slides.length > 1 && (
              <SlideThumbnailStrip
                slides={slides}
                currentIndex={currentSlideIndex}
                onSelect={goToSlide}
              />
            )}

            {/* Main slide image */}
            {currentSlide && (
              <SlideImageDisplay slide={currentSlide} priority />
            )}
          </div>

          {/* Right column — notes panel */}
          {showNotes && hasNotes && currentSlide && (
            <div className="w-1/3 shrink-0 overflow-y-auto max-h-[calc(100vh-220px)] rounded-xl bg-bg-card p-4 sm:p-5 hidden lg:block">
              <div className="text-sm leading-relaxed text-white/70">
                <Markdown
                  components={{
                    h2: ({ children }) => <h2 className="text-base font-bold text-white mb-3 mt-1">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-semibold text-white mb-2 mt-4">{children}</h3>,
                    p: ({ children }) => <p className="text-sm leading-relaxed text-white/70 mb-3">{children}</p>,
                    strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                    blockquote: ({ children }) => <blockquote className="border-l-2 border-accent-blue-mid/40 pl-3 my-3 text-white/50 text-sm">{children}</blockquote>,
                    ul: ({ children }) => <ul className="list-disc pl-4 my-2 space-y-1 text-sm text-white/70">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-4 my-2 space-y-1 text-sm text-white/70">{children}</ol>,
                    li: ({ children }) => <li>{children}</li>,
                  }}
                >
                  {currentSlide.text_content!}
                </Markdown>
              </div>
            </div>
          )}
        </div>

        {/* Text panel below on mobile (no side panel) */}
        {showNotes && hasNotes && currentSlide && (
          <div className="mt-3 lg:hidden rounded-xl bg-bg-card p-4 sm:p-5">
            <div className="text-sm leading-relaxed text-white/70">
              <Markdown
                components={{
                  h2: ({ children }) => <h2 className="text-base font-bold text-white mb-3 mt-1">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-semibold text-white mb-2 mt-4">{children}</h3>,
                  p: ({ children }) => <p className="text-sm leading-relaxed text-white/70 mb-3">{children}</p>,
                  strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                  blockquote: ({ children }) => <blockquote className="border-l-2 border-accent-blue-mid/40 pl-3 my-3 text-white/50 text-sm">{children}</blockquote>,
                  ul: ({ children }) => <ul className="list-disc pl-4 my-2 space-y-1 text-sm text-white/70">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-4 my-2 space-y-1 text-sm text-white/70">{children}</ol>,
                  li: ({ children }) => <li>{children}</li>,
                }}
              >
                {currentSlide.text_content!}
              </Markdown>
            </div>
          </div>
        )}
      </div>

      {/* Sticky audio bar — fixed at bottom */}
      {audioUrl && (
        <div className="fixed bottom-0 left-0 right-0 z-20 md:left-[var(--sidebar-width,230px)]">
          <SlideAudioBar
            audioRef={audioRef}
            audioUrl={audioUrl}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            playbackRate={playbackRate}
            currentSlideIndex={currentSlideIndex}
            totalSlides={slides.length}
            onTogglePlay={togglePlay}
            onSeek={seekTo}
            onPlaybackRateChange={setPlaybackRate}
            onPrevSlide={currentSlideIndex > 0 ? () => goToSlide(currentSlideIndex - 1) : undefined}
            onNextSlide={currentSlideIndex < slides.length - 1 ? () => goToSlide(currentSlideIndex + 1) : undefined}
          />
        </div>
      )}
    </>
  )
}
