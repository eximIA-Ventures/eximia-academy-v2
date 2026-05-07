"use client"

import { useState } from "react"
import ReactPlayer from "react-player"

interface ChapterVideoPlayerProps {
  url: string
}

const SPEEDS = [0.5, 1, 1.25, 1.5, 2]

export default function ChapterVideoPlayer({ url }: ChapterVideoPlayerProps) {
  const [error, setError] = useState(false)
  const [speed, setSpeed] = useState(1)

  if (error) {
    return (
      <div className="flex aspect-vídeo w-full items-center justify-center rounded-md bg-bg-card text-text-muted">
        Video indisponivel
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="aspect-vídeo w-full overflow-hidden rounded-md bg-bg-card">
        <ReactPlayer
          src={url}
          controls
          width="100%"
          height="100%"
          playbackRate={speed}
          onError={() => setError(true)}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-text-muted">Velocidade:</span>
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSpeed(s)}
            className={`rounded-sm px-1.5 py-0.5 text-xs font-medium transition-colors ${
              speed === s
                ? "bg-cerrado-600 text-white"
                : "text-text-muted hover:bg-bg-surface hover:text-text-primary"
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  )
}
