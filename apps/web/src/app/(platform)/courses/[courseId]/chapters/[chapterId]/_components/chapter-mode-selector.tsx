"use client"

import type { ChapterSlide, LearningMode } from "@eximia/shared"
import dynamic from "next/dynamic"
import { BookOpen, BookOpenText, Headphones, Mic, Monitor, Presentation } from "lucide-react"
import { useState, useTransition } from "react"
import { updateLearningMode } from "../actions"
import { ChapterContent } from "./chapter-content"
import { PlayerSkeleton } from "./player-skeleton"

const ChapterVideoPlayer = dynamic(() => import("./chapter-video-player"), {
  ssr: false,
  loading: () => <PlayerSkeleton type="video" />,
})

const ChapterAudioPlayer = dynamic(() => import("./chapter-audio-player"), {
  ssr: false,
  loading: () => <PlayerSkeleton type="audio" />,
})

const ChapterSlideViewer = dynamic(() => import("./chapter-slide-viewer"), {
  ssr: false,
  loading: () => <PlayerSkeleton type="video" />,
})

interface ChapterModeSelectorProps {
  content: string
  contentBlocks?: Record<string, unknown>[] | null
  videoUrl: string | null
  audioUrl: string | null
  podcastUrl?: string | null
  narrationUrl?: string | null
  userPreference: LearningMode
  slides?: ChapterSlide[]
  hasSlides?: boolean
  slideAudioUrl?: string | null
  onSlideReachEnd?: (isAtEnd: boolean) => void
  goToSlideRef?: React.MutableRefObject<((index: number) => void) | null>
  onSlideChange?: (index: number) => void
}

const MODE_META: Record<string, { icon: typeof Presentation; label: string; description: string }> = {
  slide: { icon: Presentation, label: "Slide", description: "Apresentação" },
  read: { icon: BookOpen, label: "Ler", description: "Texto completo" },
  listen: { icon: Headphones, label: "Ouvir", description: "Audioaula" },
  watch: { icon: Monitor, label: "Ver", description: "Videoaula" },
}

function getAvailableModes(
  content: string,
  contentBlocks: Record<string, unknown>[] | null | undefined,
  videoUrl: string | null,
  audioUrl: string | null,
  hasSlides: boolean,
): LearningMode[] {
  const modes: LearningMode[] = []

  if (hasSlides) {
    modes.push("slide")
  }

  // If has slides: show "watch" (video) always as second tab, even if no video yet
  // Don't show "read" or "listen" — slide replaces both
  if (hasSlides) {
    modes.push("watch")
    return modes
  }

  // No slides: original behavior
  const hasBlocks = contentBlocks && contentBlocks.length > 0
  if (content || hasBlocks) modes.push("read")
  if (audioUrl) modes.push("listen")
  if (videoUrl) modes.push("watch")
  return modes
}

export function ChapterModeSelector({
  content,
  contentBlocks,
  videoUrl,
  audioUrl,
  podcastUrl,
  narrationUrl,
  userPreference,
  slides = [],
  hasSlides = false,
  slideAudioUrl,
  onSlideReachEnd,
  goToSlideRef,
  onSlideChange,
}: ChapterModeSelectorProps) {
  const modes = getAvailableModes(content, contentBlocks, videoUrl, audioUrl, hasSlides)
  const [, startTransition] = useTransition()

  const initialMode = modes.includes(userPreference) ? userPreference : (modes[0] ?? "read")
  const [activeMode, setActiveMode] = useState<string>(initialMode)
  const [audioType, setAudioType] = useState<"podcast" | "narration">(podcastUrl ? "podcast" : "narration")
  const hasBothAudios = !!(podcastUrl && (narrationUrl || audioUrl))
  const activeAudioUrl = audioType === "podcast" ? (podcastUrl ?? narrationUrl ?? audioUrl) : (narrationUrl ?? audioUrl ?? podcastUrl)

  // If only one mode, render directly — no tabs
  if (modes.length <= 1) {
    if (hasSlides && slides.length > 0) {
      return <ChapterSlideViewer slides={slides} audioUrl={slideAudioUrl ?? audioUrl} podcastUrl={podcastUrl} narrationUrl={narrationUrl} chapterId={slides[0]?.chapter_id} onReachEnd={onSlideReachEnd} goToSlideRef={goToSlideRef} onSlideChange={onSlideChange} />
    }
    return <ChapterContent content={content} contentBlocks={contentBlocks} />
  }

  function handleModeChange(mode: string) {
    setActiveMode(mode)
    startTransition(async () => {
      await updateLearningMode(mode as LearningMode)
    })
  }

  return (
    <div className="space-y-4">
      {/* Mode tabs */}
      <div className="flex rounded-xl bg-bg-card p-1.5 shadow-card">
        {modes.map((mode) => {
          const meta = MODE_META[mode]
          if (!meta) return null
          const Icon = meta.icon
          const isActive = activeMode === mode

          return (
            <button
              key={mode}
              type="button"
              onClick={() => handleModeChange(mode)}
              className={`relative flex flex-1 items-center justify-center gap-1.5 sm:gap-2 rounded-lg px-2.5 py-2.5 sm:px-4 sm:py-3 text-sm transition-all ${
                isActive
                  ? "bg-cerrado-600/10 text-cerrado-600 ring-1 ring-cerrado-600/30 shadow-sm"
                  : "text-text-muted hover:text-text-secondary hover:bg-bg-surface"
              }`}
            >
              <Icon size={16} className={isActive ? "text-cerrado-600" : ""} />
              <span className="font-semibold">{meta.label}</span>
              <span className={`hidden sm:inline text-xs ${isActive ? "text-cerrado-600/70" : "text-text-muted"}`}>
                {meta.description}
              </span>
            </button>
          )
        })}
      </div>

      {/* Content area */}
      {activeMode === "slide" && hasSlides && slides.length > 0 && (
        <ChapterSlideViewer slides={slides} audioUrl={slideAudioUrl ?? audioUrl} podcastUrl={podcastUrl} narrationUrl={narrationUrl} chapterId={slides[0]?.chapter_id} onReachEnd={onSlideReachEnd} goToSlideRef={goToSlideRef} onSlideChange={onSlideChange} />
      )}
      {activeMode === "read" && (
        <ChapterContent content={content} contentBlocks={contentBlocks} />
      )}
      {activeMode === "listen" && activeAudioUrl && (
        <div className="space-y-3">
          {hasBothAudios && (
            <div className="flex justify-center">
              <div className="relative flex items-center rounded-full bg-bg-surface p-1 shadow-card">
                <div
                  className="absolute top-1 bottom-1 w-1/2 rounded-full bg-cerrado-600/15 transition-transform duration-200 ease-out"
                  style={{ transform: audioType === "narration" ? "translateX(100%)" : "translateX(0)" }}
                />
                <button
                  type="button"
                  onClick={() => setAudioType("podcast")}
                  className={`relative z-10 flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-full transition-colors ${audioType === "podcast" ? "text-cerrado-600" : "text-text-muted"}`}
                >
                  <Mic size={13} /> Podcast
                </button>
                <button
                  type="button"
                  onClick={() => setAudioType("narration")}
                  className={`relative z-10 flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-full transition-colors ${audioType === "narration" ? "text-cerrado-600" : "text-text-muted"}`}
                >
                  <BookOpenText size={13} /> Audiobook
                </button>
              </div>
            </div>
          )}
          <ChapterAudioPlayer key={audioType} url={activeAudioUrl} />
        </div>
      )}
      {activeMode === "watch" && videoUrl && (
        <ChapterVideoPlayer url={videoUrl} />
      )}
      {activeMode === "watch" && !videoUrl && (
        <div className="rounded-md bg-bg-card p-8 text-center text-text-muted">
          Videoaula ainda não disponível para este capítulo.
        </div>
      )}
    </div>
  )
}
