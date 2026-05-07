"use client"

import { Button, useToast } from "@eximia/ui"
import { FileUp, Loader2 } from "lucide-react"
import { useCallback, useRef, useState } from "react"

const ACCEPTED = ".pdf,.pptx,.png,.jpg,.jpeg,.webp"
const ACCEPTED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
  "image/webp",
]

interface SlideUploadZoneProps {
  chapterId: string
  onUploadComplete: () => void
}

export function SlideUploadZone({ chapterId, onUploadComplete }: SlideUploadZoneProps) {
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleUpload = useCallback(
    async (files: FileList | File[]) => {
      const validFiles = Array.from(files).filter((f) => ACCEPTED_MIME.includes(f.type))
      if (!validFiles.length) {
        toast({ variant: "error", title: "Formato não suportado. Use PDF, PPTX ou imagens." })
        return
      }

      setUploading(true)
      try {
        const formData = new FormData()
        for (const file of validFiles) {
          formData.append("files", file)
        }

        const response = await fetch(`/api/chapters/${chapterId}/slides/upload`, {
          method: "POST",
          body: formData,
        })

        const result = await response.json()
        if (!response.ok) {
          toast({ variant: "error", title: result.error ?? "Erro no upload" })
          return
        }

        toast({
          variant: "success",
          title: `${result.slideCount} slides extraídos com sucesso`,
        })
        onUploadComplete()
      } catch {
        toast({ variant: "error", title: "Erro inesperado no upload" })
      } finally {
        setUploading(false)
        if (fileRef.current) fileRef.current.value = ""
      }
    },
    [chapterId, onUploadComplete, toast],
  )

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files) handleUpload(e.dataTransfer.files)
  }

  return (
    <div
      className={`relative rounded-md border-2 border-dashed p-6 text-center transition-colors ${
        dragActive
          ? "border-cerrado-600 bg-cerrado-600/5"
          : "border-border-primary hover:border-border-medium"
      }`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragActive(true)
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED}
        multiple
        onChange={(e) => e.target.files && handleUpload(e.target.files)}
        className="hidden"
      />

      {uploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-cerrado-600" />
          <p className="text-sm text-text-muted">Processando slides...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <FileUp className="h-8 w-8 text-text-muted" />
          <p className="text-sm text-text-primary">
            Arraste um arquivo ou{" "}
            <button
              type="button"
              className="text-cerrado-600 underline"
              onClick={() => fileRef.current?.click()}
            >
              selecione
            </button>
          </p>
          <p className="text-xs text-text-muted">PDF, PPTX ou imagens (PNG, JPG, WebP)</p>
        </div>
      )}
    </div>
  )
}
