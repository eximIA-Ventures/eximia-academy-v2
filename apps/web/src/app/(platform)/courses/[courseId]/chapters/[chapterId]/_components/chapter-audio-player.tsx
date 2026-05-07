"use client"

import { useCallback, useEffect, useRef, useState } from "react"

interface ChapterAudioPlayerProps {
  url: string
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

export default function ChapterAudioPlayer({ url }: ChapterAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onDurationChange = () => setDuration(audio.duration || 0)
    const onEnded = () => setIsPlaying(false)

    audio.addEventListener("timeupdate", onTimeUpdate)
    audio.addEventListener("durationchange", onDurationChange)
    audio.addEventListener("ended", onEnded)

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate)
      audio.removeEventListener("durationchange", onDurationChange)
      audio.removeEventListener("ended", onEnded)
    }
  }, [])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying])

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const audio = audioRef.current
      if (!audio) return
      const time = (Number(e.target.value) / 100) * duration
      audio.currentTime = time
      setCurrentTime(time)
    },
    [duration],
  )

  const handleVolume = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return
    const vol = Number(e.target.value) / 100
    audio.volume = vol
    setVolume(vol)
  }, [])

  const [playbackRate, setPlaybackRate] = useState(1)

  const handlePlaybackRate = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    const rates = [0.5, 1, 1.25, 1.5, 2]
    const currentIdx = rates.indexOf(playbackRate)
    const nextRate = rates[(currentIdx + 1) % rates.length]
    audio.playbackRate = nextRate
    setPlaybackRate(nextRate)
  }, [playbackRate])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  // Generate minute markers for audio > 5 min
  const minuteMarkers: number[] = []
  if (duration > 300) {
    for (let i = 60; i < duration; i += 60) {
      minuteMarkers.push(i)
    }
  }

  return (
    <div className="w-full rounded-md bg-bg-card p-4">
      <audio ref={audioRef} src={url} preload="metadata" />

      <div className="flex items-center gap-4">
        {/* Play/Pause */}
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cerrado-600 text-white transition-colors hover:bg-cerrado-600/80"
          aria-label={isPlaying ? "Pausar" : "Reproduzir"}
        >
          {isPlaying ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="3" y="2" width="4" height="12" rx="1" />
              <rect x="9" y="2" width="4" height="12" rx="1" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 2.5v11l9-5.5z" />
            </svg>
          )}
        </button>

        {/* Time + Progress */}
        <div className="flex flex-1 flex-col gap-1">
          <div className="relative">
            {/* Visual progress bar */}
            <div className="absolute top-0 left-0 h-1.5 rounded-full bg-cerrado-600 transition-all" style={{ width: `${progress}%` }} />
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={handleSeek}
              className="relative h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border-primary accent-cerrado-600"
              aria-label="Progresso do audio"
            />
          </div>
          <div className="flex justify-between text-xs text-text-muted">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Playback speed */}
        <button
          type="button"
          onClick={handlePlaybackRate}
          className="shrink-0 rounded-sm px-1.5 py-0.5 text-xs font-medium text-text-muted transition-colors hover:bg-bg-surface hover:text-text-primary"
          aria-label="Velocidade de reprodução"
        >
          {playbackRate}x
        </button>

        {/* Volume */}
        <div className="hidden items-center gap-1.5 sm:flex">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-text-muted"
          >
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
            {volume > 0.5 && <path d="M19.07 4.93a10 10 0 010 14.14" />}
            {volume > 0 && <path d="M15.54 8.46a5 5 0 010 7.07" />}
          </svg>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(volume * 100)}
            onChange={handleVolume}
            className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-border-primary accent-cerrado-600"
            aria-label="Volume"
          />
        </div>
      </div>

      {/* Timestamp markers for long audio (> 5min) */}
      {minuteMarkers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {minuteMarkers.map((time) => (
            <button
              key={time}
              type="button"
              className="rounded-sm bg-bg-surface px-1.5 py-0.5 text-xs text-text-muted transition-colors hover:bg-cerrado-600/20 hover:text-text-primary"
              onClick={() => {
                const audio = audioRef.current
                if (audio) {
                  audio.currentTime = time
                  setCurrentTime(time)
                }
              }}
            >
              {formatTime(time)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
