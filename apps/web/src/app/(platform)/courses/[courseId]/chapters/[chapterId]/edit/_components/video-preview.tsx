"use client"

import dynamic from "next/dynamic"
import { useState } from "react"

const ReactPlayer = dynamic(() => import("react-player"), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-vídeo w-full items-center justify-center rounded-md bg-bg-card text-text-muted text-sm">
      Carregando player...
    </div>
  ),
})

interface VideoPreviewProps {
  url: string
}

export function VideoPreview({ url }: VideoPreviewProps) {
  const [error, setError] = useState(false)

  if (error) {
    return (
      <div className="flex aspect-vídeo w-full items-center justify-center rounded-md bg-bg-card text-text-muted text-sm">
        URL de vídeo inválida ou indisponivel
      </div>
    )
  }

  return (
    <div className="mt-2 aspect-vídeo w-full overflow-hidden rounded-md bg-bg-card">
      <ReactPlayer
        src={url}
        controls
        width="100%"
        height="100%"
        light
        onError={() => setError(true)}
      />
    </div>
  )
}
