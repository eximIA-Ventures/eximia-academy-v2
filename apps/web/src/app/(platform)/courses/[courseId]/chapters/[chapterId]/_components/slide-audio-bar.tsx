"use client"

import { Pause, Play, SkipBack, SkipForward } from "lucide-react"

interface SlideAudioBarProps {
  audioRef: React.RefObject<HTMLAudioElement | null>
  audioUrl: string
  isPlaying: boolean
  currentTime: number
  duration: number
  playbackRate: number
  currentSlideIndex: number
  totalSlides: number
  onTogglePlay: () => void
  onSeek: (timeMs: number) => void
  onPlaybackRateChange: (rate: number) => void
  onPrevSlide?: () => void
  onNextSlide?: () => void
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]

export function SlideAudioBar({
  audioRef,
  audioUrl,
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  currentSlideIndex,
  totalSlides,
  onTogglePlay,
  onSeek,
  onPlaybackRateChange,
  onPrevSlide,
  onNextSlide,
}: SlideAudioBarProps) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const timeMs = (Number(e.target.value) / 1000) * duration
    onSeek(timeMs)
  }

  function cyclePlaybackRate() {
    const currentIdx = PLAYBACK_RATES.indexOf(playbackRate)
    const nextRate = PLAYBACK_RATES[(currentIdx + 1) % PLAYBACK_RATES.length]
    onPlaybackRateChange(nextRate)
  }

  return (
    <div className="w-full overflow-hidden rounded-t-2xl md:rounded-t-2xl bg-bg-card/95 backdrop-blur-md  shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Progress bar */}
      <div className="relative h-6 w-full cursor-pointer group flex items-center px-4 sm:px-5 pt-3">
        <div className="relative h-[3px] w-full rounded-full bg-bg-elevated group-hover:h-[5px] transition-all">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-cerrado-600"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-white shadow-[0_0_6px_rgba(42,106,176,0.5)] scale-0 group-hover:scale-100 transition-transform"
            style={{ left: `calc(${progress}% - 7px)` }}
          />
        </div>
        <input
          type="range"
          min="0"
          max="1000"
          value={duration > 0 ? (currentTime / duration) * 1000 : 0}
          onChange={handleSeek}
          className="absolute inset-x-4 sm:inset-x-5 h-full cursor-pointer opacity-0"
          aria-label="Progresso do áudio"
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 px-4 py-3 sm:px-5">
        {/* Left: time */}
        <div className="flex items-center gap-1 text-xs tabular-nums text-text-muted min-w-[60px] sm:min-w-[80px]">
          <span className="text-text-primary font-medium">{formatTime(currentTime)}</span>
          <span className="text-white/20">/</span>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Center: controls */}
        <div className="flex flex-1 items-center justify-center gap-1">
          <button
            type="button"
            onClick={onPrevSlide}
            disabled={currentSlideIndex <= 0}
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:text-white disabled:opacity-30"
            aria-label="Slide anterior"
          >
            <SkipBack size={16} />
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black transition-all hover:scale-105 active:scale-95 shadow-[0_2px_8px_rgba(255,255,255,0.15)]"
            aria-label={isPlaying ? "Pausar" : "Reproduzir"}
          >
            {isPlaying ? (
              <Pause size={18} fill="currentColor" />
            ) : (
              <Play size={18} fill="currentColor" className="ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={onNextSlide}
            disabled={currentSlideIndex >= totalSlides - 1}
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:text-white disabled:opacity-30"
            aria-label="Próximo slide"
          >
            <SkipForward size={16} />
          </button>
        </div>

        {/* Right: meta */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-[50px] sm:min-w-[80px] justify-end">
          <span className="text-[11px] tabular-nums text-text-muted">
            {currentSlideIndex + 1}<span className="text-white/20">/</span>{totalSlides}
          </span>

          <button
            type="button"
            onClick={cyclePlaybackRate}
            className="rounded-full bg-bg-elevated px-2 py-0.5 text-[11px] font-semibold tabular-nums text-text-muted transition-all hover:bg-bg-hover hover:text-text-primary"
            aria-label="Velocidade"
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  )
}
