"use client"

import { Button, useToast } from "@eximia/ui"
import { AudioLines, RefreshCw } from "lucide-react"
import { useState } from "react"
import { AudioUploader } from "./audio-uploader"
import { syncSlideAudio, updateSlideAudioUrl } from "../slide-actions"

interface SlideAudioConfigProps {
  chapterId: string
  tenantId: string
  slideAudioUrl: string | null
  slideCount: number
  onAudioChange: (url: string | null) => void
}

export function SlideAudioConfig({
  chapterId,
  tenantId,
  slideAudioUrl,
  slideCount,
  onAudioChange,
}: SlideAudioConfigProps) {
  const [syncing, setSyncing] = useState(false)
  const { toast } = useToast()

  async function handleAudioUpload(url: string) {
    await updateSlideAudioUrl(chapterId, url)
    onAudioChange(url)
  }

  async function handleAudioRemove() {
    await updateSlideAudioUrl(chapterId, null)
    onAudioChange(null)
  }

  async function handleSync() {
    if (!slideAudioUrl) {
      toast({ variant: "error", title: "Faça upload do áudio primeiro" })
      return
    }

    // Get audio duration from the audio element
    const audio = new Audio(slideAudioUrl)
    await new Promise<void>((resolve) => {
      audio.addEventListener("loadedmetadata", () => resolve())
      audio.addEventListener("error", () => resolve())
    })

    const durationMs = Math.round((audio.duration || 0) * 1000)
    if (durationMs <= 0) {
      toast({ variant: "error", title: "Não foi possível determinar a duração do áudio" })
      return
    }

    setSyncing(true)
    const result = await syncSlideAudio(chapterId, durationMs)
    setSyncing(false)

    if (result.error) {
      toast({ variant: "error", title: result.error })
    } else {
      toast({ variant: "success", title: `Timestamps sincronizados para ${result.slidesUpdated} slides` })
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-border-primary bg-bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
        <AudioLines size={16} />
        Áudio dos Slides
      </div>

      <AudioUploader
        currentUrl={slideAudioUrl}
        chapterId={chapterId}
        tenantId={tenantId}
        onUpload={handleAudioUpload}
        onRemove={handleAudioRemove}
      />

      {slideAudioUrl && slideCount > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
        >
          <RefreshCw size={12} className={`mr-1.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Sincronizando..." : "Sincronizar Timestamps"}
        </Button>
      )}

      <p className="text-xs text-text-muted">
        O áudio será distribuído proporcionalmente pelos slides com base no tamanho do texto.
      </p>
    </div>
  )
}
