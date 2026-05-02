"use client"

import { createClient } from "@/lib/supabase/client"
import { Avatar, Button } from "@eximia/ui"
import { Upload, X } from "lucide-react"
import { useCallback, useRef, useState } from "react"

interface StepWelcomeProps {
  tenantName: string
  tenantId: string
  userId: string
  photoUrl?: string
  onChange: (photoUrl: string | undefined) => void
}

const MAX_FILE_SIZE = 1 * 1024 * 1024
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/jpg"]

export function StepWelcome({
  tenantName,
  tenantId,
  userId,
  photoUrl,
  onChange,
}: StepWelcomeProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(photoUrl)

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      setUploadError(null)

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setUploadError("Formato inválido. Use PNG ou JPG.")
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        setUploadError("Arquivo muito grande. Máximo 1MB.")
        return
      }

      setUploading(true)
      try {
        const supabase = createClient()
        const ext = file.type === "image/png" ? "png" : "jpg"
        const filePath = `${tenantId}/avatars/${userId}.${ext}`

        const { error } = await supabase.storage.from("tenant-assets").upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        })

        if (error) { setUploadError(`Erro no upload: ${error.message}`); return }

        const { data: { publicUrl } } = supabase.storage.from("tenant-assets").getPublicUrl(filePath)
        setPreviewUrl(publicUrl)
        onChange(publicUrl)
      } catch (err) {
        setUploadError(`Falha no upload: ${err instanceof Error ? err.message : "Erro desconhecido"}`)
      } finally {
        setUploading(false)
      }
    },
    [tenantId, userId, onChange],
  )

  const handleRemovePhoto = useCallback(() => {
    setPreviewUrl(undefined)
    onChange(undefined)
    setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [onChange])

  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="mb-2 text-2xl font-bold text-text-primary">
        Bem-vindo à plataforma!
      </h1>
      <p className="mb-8 text-text-secondary max-w-md">
        Estamos felizes em ter você aqui. Vamos configurar seu perfil para personalizar sua experiência de aprendizagem.
      </p>

      <div className="relative mb-6">
        <Avatar
          src={previewUrl}
          alt="Foto de perfil"
          fallback={userId.substring(0, 2).toUpperCase()}
          size="lg"
          className="h-24 w-24 text-lg"
        />
        {previewUrl && (
          <button
            type="button"
            onClick={handleRemovePhoto}
            className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-bg-card text-text-muted transition-colors hover:text-text-primary"
            aria-label="Remover foto"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={handleFileSelect}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="mb-2"
      >
        <Upload className="mr-2 h-4 w-4" />
        {uploading ? "Enviando..." : "Escolher foto"}
      </Button>

      <p className="text-xs text-text-muted">PNG ou JPG, max 1MB. Opcional.</p>
      {uploadError && <p className="mt-3 text-sm text-semantic-error">{uploadError}</p>}
    </div>
  )
}
