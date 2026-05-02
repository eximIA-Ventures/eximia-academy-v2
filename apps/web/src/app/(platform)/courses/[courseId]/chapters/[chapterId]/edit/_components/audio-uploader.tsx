"use client"

import { createClient } from "@/lib/supabase/client"
import { uploadChapterAsset } from "@/lib/utils/chapter-asset-upload"
import { Button, useToast } from "@eximia/ui"
import { Trash2, Upload } from "lucide-react"
import { useRef, useState } from "react"

const ACCEPTED_AUDIO = "audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/x-m4a"

interface AudioUploaderProps {
  currentUrl: string | null
  chapterId: string
  tenantId: string
  onUpload: (url: string) => void
  onRemove: () => void
}

export function AudioUploader({
  currentUrl,
  chapterId,
  tenantId,
  onUpload,
  onRemove,
}: AudioUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const { toast } = useToast()

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setUploading(true)

    try {
      const supabase = createClient()
      const url = await uploadChapterAsset(supabase, file, tenantId, chapterId, "audio")
      onUpload(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao fazer upload")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function handleRemove() {
    if (!confirmRemove) {
      setConfirmRemove(true)
      return
    }
    setConfirmRemove(false)

    // Delete from Storage if URL points to chapter-assets bucket
    if (currentUrl?.includes("/chapter-assets/")) {
      try {
        const supabase = createClient()
        const pathMatch = currentUrl.match(/chapter-assets\/(.+)$/)
        if (pathMatch?.[1]) {
          await supabase.storage.from("chapter-assets").remove([decodeURIComponent(pathMatch[1])])
        }
      } catch {
        // Non-blocking — file remains but URL is cleared
      }
    }

    onRemove()
    toast({ variant: "success", title: "Audio removido" })
  }

  return (
    <div className="space-y-2">
      {currentUrl ? (
        <div className="flex items-center gap-3 rounded-md bg-bg-card p-3">
          <audio src={currentUrl} controls className="flex-1 h-8" preload="metadata" />
          {confirmRemove ? (
            <div className="flex items-center gap-1.5">
              <Button type="button" variant="destructive" size="sm" onClick={handleRemove}>
                Confirmar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmRemove(false)}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={handleRemove}>
              <Trash2 size={14} className="mr-1" /> Remover
            </Button>
          )}
        </div>
      ) : (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_AUDIO}
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Upload size={14} className="mr-1.5" />
            {uploading ? "Enviando..." : "Fazer Upload"}
          </Button>
        </div>
      )}

      {uploading && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border-primary animate-pulse">
          <div className="h-full w-full rounded-full bg-accent-blue-mid/60" />
        </div>
      )}

      {error && <p className="text-xs text-semantic-error">{error}</p>}

      <p className="text-xs text-text-muted">MP3, WAV, OGG ou M4A (max 50MB)</p>
    </div>
  )
}
