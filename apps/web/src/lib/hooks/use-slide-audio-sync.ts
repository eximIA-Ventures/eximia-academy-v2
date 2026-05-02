"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { ChapterSlide } from "@eximia/shared"

interface UseSlideAudioSyncOptions {
  slides: ChapterSlide[]
  audioUrl: string | null
  /** Chapter ID for persisting slide position */
  chapterId?: string
}

interface UseSlideAudioSyncReturn {
  currentSlideIndex: number
  setCurrentSlideIndex: (index: number) => void
  audioRef: React.RefObject<HTMLAudioElement | null>
  isPlaying: boolean
  currentTime: number
  duration: number
  playbackRate: number
  togglePlay: () => void
  seekTo: (timeMs: number) => void
  setPlaybackRate: (rate: number) => void
  goToSlide: (index: number) => void
}

function getStorageKey(chapterId?: string) {
  return chapterId ? `eximia:slide:${chapterId}` : null
}

function loadSavedIndex(chapterId?: string, maxIndex = 0): number {
  if (typeof window === "undefined") return 0
  const key = getStorageKey(chapterId)
  if (!key) return 0
  try {
    const saved = localStorage.getItem(key)
    if (saved !== null) {
      const idx = Number.parseInt(saved, 10)
      return idx >= 0 && idx <= maxIndex ? idx : 0
    }
  } catch {}
  return 0
}

export function useSlideAudioSync({
  slides,
  audioUrl,
  chapterId,
}: UseSlideAudioSyncOptions): UseSlideAudioSyncReturn {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(() =>
    loadSavedIndex(chapterId, slides.length - 1),
  )
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRateState] = useState(1)
  const userNavigatedRef = useRef(false)

  // Persist slide position to localStorage
  useEffect(() => {
    const key = getStorageKey(chapterId)
    if (key) {
      try { localStorage.setItem(key, String(currentSlideIndex)) } catch {}
    }
  }, [currentSlideIndex, chapterId])

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime * 1000) // Convert to ms
    }
    const onDurationChange = () => {
      setDuration((audio.duration || 0) * 1000) // Convert to ms
    }
    const onEnded = () => setIsPlaying(false)
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)

    audio.addEventListener("timeupdate", onTimeUpdate)
    audio.addEventListener("durationchange", onDurationChange)
    audio.addEventListener("ended", onEnded)
    audio.addEventListener("play", onPlay)
    audio.addEventListener("pause", onPause)

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate)
      audio.removeEventListener("durationchange", onDurationChange)
      audio.removeEventListener("ended", onEnded)
      audio.removeEventListener("play", onPlay)
      audio.removeEventListener("pause", onPause)
    }
  }, [])

  // Auto-advance slides based on audio timestamps
  useEffect(() => {
    if (userNavigatedRef.current) {
      userNavigatedRef.current = false
      return
    }

    if (!audioUrl || !isPlaying) return

    const hasTimestamps = slides.some(
      (s) => s.audio_start_ms != null && s.audio_end_ms != null,
    )
    if (!hasTimestamps) return

    for (let i = slides.length - 1; i >= 0; i--) {
      const slide = slides[i]
      if (
        slide.audio_start_ms != null &&
        slide.audio_end_ms != null &&
        currentTime >= slide.audio_start_ms &&
        currentTime < slide.audio_end_ms
      ) {
        if (i !== currentSlideIndex) {
          setCurrentSlideIndex(i)
        }
        break
      }
    }
  }, [currentTime, slides, audioUrl, isPlaying, currentSlideIndex])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
  }, [isPlaying])

  const seekTo = useCallback((timeMs: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = timeMs / 1000
    setCurrentTime(timeMs)
  }, [])

  const setPlaybackRate = useCallback((rate: number) => {
    const audio = audioRef.current
    if (audio) audio.playbackRate = rate
    setPlaybackRateState(rate)
  }, [])

  const goToSlide = useCallback(
    (index: number) => {
      userNavigatedRef.current = true
      setCurrentSlideIndex(index)

      // If slide has audio timestamp, seek to it
      const slide = slides[index]
      if (slide?.audio_start_ms != null && audioRef.current) {
        audioRef.current.currentTime = slide.audio_start_ms / 1000
        setCurrentTime(slide.audio_start_ms)
      }
    },
    [slides],
  )

  return {
    currentSlideIndex,
    setCurrentSlideIndex,
    audioRef,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    togglePlay,
    seekTo,
    setPlaybackRate,
    goToSlide,
  }
}
