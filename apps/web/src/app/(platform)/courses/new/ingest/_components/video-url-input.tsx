"use client"

import { Button, Input, useToast } from "@eximia/ui"
import { useState } from "react"

interface VideoUrlInputProps {
  onSubmit: (ingestionId: string) => void
  courseId?: string
}

const YOUTUBE_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/

export function VideoUrlInput({ onSubmit, courseId }: VideoUrlInputProps) {
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const isValidUrl = YOUTUBE_REGEX.test(url)
  const videoId = url.match(YOUTUBE_REGEX)?.[1]

  async function handleSubmit() {
    if (!isValidUrl) return
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/ingestion/video-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          title: title || undefined,
          ...(courseId ? { course_id: courseId } : {}),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Erro ao processar vídeo.")
        toast({ variant: "error", title: data.error || "Erro ao processar." })
        return
      }

      onSubmit(data.ingestionId)
    } catch {
      setError("Erro de conexão. Tente novamente.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="video-title" className="mb-1 block text-sm font-medium text-text-secondary">
          Titulo (opcional)
        </label>
        <Input
          id="video-title"
          placeholder="Ex: Aula sobre Deep Learning"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
        />
      </div>

      <div>
        <label htmlFor="video-url" className="mb-1 block text-sm font-medium text-text-secondary">
          URL do YouTube
        </label>
        <Input
          id="video-url"
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        {url && !isValidUrl && (
          <p className="mt-1 text-xs text-semantic-error">
            URL invalida. Use um link do YouTube (youtube.com ou youtu.be).
          </p>
        )}
      </div>

      {videoId && (
        <div className="overflow-hidden rounded-md">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            title="Preview do video"
            className="aspect-vídeo w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {error && <p className="text-sm text-semantic-error">{error}</p>}

      <Button onClick={handleSubmit} disabled={!isValidUrl || isSubmitting} className="w-full">
        {isSubmitting ? "Extraindo legendas..." : "Processar com IA"}
      </Button>
    </div>
  )
}
