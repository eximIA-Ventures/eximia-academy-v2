"use client"

import { createClient } from "@/lib/supabase/client"
import { Button, Label } from "@eximia/ui"
import { ImageIcon, Trash2, Upload } from "lucide-react"
import Image from "next/image"
import { useCallback, useRef, useState } from "react"

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/svg+xml"]

interface LogoUploadProps {
  tenantId: string
  currentUrl?: string
  onUpload: (url: string) => void
}

export function LogoUpload({ tenantId, currentUrl, onUpload }: LogoUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentUrl || null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      setError(null)

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError("Tipo inválido. Use PNG, JPG ou SVG.")
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        setError("Arquivo muito grande. Maximo 2MB.")
        return
      }

      // Show local preview immediately
      const objectUrl = URL.createObjectURL(file)
      setPreview(objectUrl)

      setUploading(true)
      try {
        const supabase = createClient()
        const path = `${tenantId}/logo.png`

        const { error: uploadError } = await supabase.storage
          .from("tenant-assets")
          .upload(path, file, { cacheControl: "3600", upsert: true })

        if (uploadError) {
          setError(uploadError.message)
          setPreview(currentUrl || null)
          return
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("tenant-assets").getPublicUrl(path)

        // Bust cache with timestamp
        const finalUrl = `${publicUrl}?t=${Date.now()}`
        setPreview(finalUrl)
        onUpload(finalUrl)
      } catch {
        setError("Falha ao enviar logo.")
        setPreview(currentUrl || null)
      } finally {
        setUploading(false)
      }
    },
    [tenantId, currentUrl, onUpload],
  )

  const handleRemove = useCallback(() => {
    setPreview(null)
    onUpload("")
    if (inputRef.current) inputRef.current.value = ""
  }, [onUpload])

  return (
    <div className="space-y-2">
      <Label>Logo</Label>
      <div className="flex items-center gap-4">
        {/* Preview */}
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg shadow-card bg-bg-surface">
          {preview ? (
            <Image
              src={preview}
              alt="Logo preview"
              width={80}
              height={80}
              className="h-full w-full object-contain"
              unoptimized
            />
          ) : (
            <ImageIcon size={24} className="text-text-muted" />
          )}
        </div>

        {/* Controls */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              <Upload size={14} />
              {uploading ? "Enviando..." : "Upload"}
            </Button>
            {preview && (
              <Button type="button" variant="ghost" size="sm" onClick={handleRemove}>
                <Trash2 size={14} />
              </Button>
            )}
          </div>
          <p className="text-xs text-text-muted">PNG, JPG ou SVG. Max 2MB.</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={handleFileChange}
        className="hidden"
        aria-label="Upload logo"
      />

      {error && <p className="text-xs text-semantic-error">{error}</p>}
    </div>
  )
}
