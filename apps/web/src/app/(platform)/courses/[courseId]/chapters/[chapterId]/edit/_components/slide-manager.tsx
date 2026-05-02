"use client"

import type { ChapterSlide } from "@eximia/shared"
import { Button, useToast } from "@eximia/ui"
import { Bot, CheckCheck, Loader2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { approveSlideTexts } from "../slide-actions"
import { SlideAudioConfig } from "./slide-audio-config"
import { SlideList } from "./slide-list"
import { SlideUploadZone } from "./slide-upload-zone"

interface SlideManagerProps {
  chapterId: string
  tenantId: string
  initialSlides: ChapterSlide[]
  initialSlideAudioUrl: string | null
}

export function SlideManager({
  chapterId,
  tenantId,
  initialSlides,
  initialSlideAudioUrl,
}: SlideManagerProps) {
  const [slides, setSlides] = useState<ChapterSlide[]>(initialSlides)
  const [slideAudioUrl, setSlideAudioUrl] = useState(initialSlideAudioUrl)
  const [generating, setGenerating] = useState(false)
  const [approving, setApproving] = useState(false)
  const { toast } = useToast()

  const fetchSlides = useCallback(async () => {
    const response = await fetch(
      `/api/chapters/${chapterId}/slides/generation-status`,
    )
    if (!response.ok) return

    // Refetch actual slides from the page (reload)
    const slidesResponse = await fetch(
      `/api/chapters/${chapterId}/slides/generation-status`,
    )
    if (slidesResponse.ok) {
      // Force a client-side refetch by reloading slides data
      window.location.reload()
    }
  }, [chapterId])

  const handleUploadComplete = useCallback(() => {
    // Reload to get new slides
    window.location.reload()
  }, [])

  async function handleGenerateTexts() {
    setGenerating(true)
    try {
      const response = await fetch(
        `/api/chapters/${chapterId}/slides/generate-text`,
        { method: "POST" },
      )
      const result = await response.json()

      if (!response.ok) {
        toast({ variant: "error", title: result.error ?? "Erro na geração" })
        return
      }

      toast({
        variant: "success",
        title: `Textos gerados: ${result.processed} slides processados${result.errors > 0 ? `, ${result.errors} erros` : ""}`,
      })

      // Reload to show new texts
      window.location.reload()
    } catch {
      toast({ variant: "error", title: "Erro inesperado" })
    } finally {
      setGenerating(false)
    }
  }

  async function handleApproveAll() {
    setApproving(true)
    const result = await approveSlideTexts(chapterId)
    setApproving(false)

    if (result.error) {
      toast({ variant: "error", title: result.error })
    } else {
      toast({ variant: "success", title: "Todos os textos aprovados" })
      window.location.reload()
    }
  }

  const hasSlides = slides.length > 0
  const pendingCount = slides.filter((s) => s.text_status === "pending").length
  const reviewCount = slides.filter((s) => s.text_status === "review").length

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <SlideUploadZone chapterId={chapterId} onUploadComplete={handleUploadComplete} />

      {/* Slide actions */}
      {hasSlides && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-text-muted">
            {slides.length} slide{slides.length !== 1 ? "s" : ""}
          </span>

          {pendingCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGenerateTexts}
              disabled={generating}
            >
              {generating ? (
                <Loader2 size={12} className="mr-1.5 animate-spin" />
              ) : (
                <Bot size={12} className="mr-1.5" />
              )}
              {generating ? "Gerando textos..." : `Gerar Textos AI (${pendingCount})`}
            </Button>
          )}

          {reviewCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleApproveAll}
              disabled={approving}
            >
              <CheckCheck size={12} className="mr-1.5" />
              {approving ? "Aprovando..." : `Aprovar Todos (${reviewCount})`}
            </Button>
          )}
        </div>
      )}

      {/* Slide list */}
      <SlideList slides={slides} onRefresh={() => window.location.reload()} />

      {/* Audio config */}
      {hasSlides && (
        <SlideAudioConfig
          chapterId={chapterId}
          tenantId={tenantId}
          slideAudioUrl={slideAudioUrl}
          slideCount={slides.length}
          onAudioChange={setSlideAudioUrl}
        />
      )}
    </div>
  )
}
