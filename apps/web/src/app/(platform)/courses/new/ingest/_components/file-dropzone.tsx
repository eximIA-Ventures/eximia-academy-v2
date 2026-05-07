"use client"

import { Button, useToast } from "@eximia/ui"
import { useCallback, useRef, useState } from "react"

const ACCEPTED_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
  "text/plain": "TXT",
  "text/markdown": "TXT",
  "audio/mpeg": "MP3",
  "audio/wav": "WAV",
  "audio/mp4": "M4A",
  "audio/x-m4a": "M4A",
  "audio/ogg": "OGG",
}

const ACCEPT_STRING =
  ".pdf,.docx,.pptx,.txt,.md,.mp3,.wav,.m4a,.ogg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/markdown,audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,audio/ogg"

interface FileDropzoneProps {
  onSubmit: (ingestionId: string) => void
  courseId?: string
}

export function FileDropzone({ onSubmit, courseId }: FileDropzoneProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const validateFile = useCallback((f: File): string | null => {
    if (!ACCEPTED_TYPES[f.type]) {
      return "Formato nao suportado. Use PDF, DOCX, PPTX, TXT, MP3, WAV, M4A ou OGG."
    }
    const isAudio = f.type.startsWith("audio/")
    const isPptx =
      f.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    const maxSize = isAudio ? 50 * 1024 * 1024 : isPptx ? 30 * 1024 * 1024 : 20 * 1024 * 1024
    if (f.size > maxSize) {
      const limitMB = maxSize / (1024 * 1024)
      return `Arquivo muito grande. Limite: ${limitMB}MB`
    }
    return null
  }, [])

  function handleFiles(files: FileList | null) {
    if (!files?.length) return
    const f = files[0]
    const err = validateFile(f)
    if (err) {
      setError(err)
      setFile(null)
      return
    }
    setError(null)
    setFile(f)
  }

  async function handleUpload() {
    if (!file) return
    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      if (courseId) formData.append("course_id", courseId)

      const res = await fetch("/api/ingestion/upload", { method: "POST", body: formData })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Erro no upload.")
        toast({ variant: "error", title: data.error || "Erro no upload." })
        return
      }

      onSubmit(data.ingestionId)
    } catch {
      setError("Erro de conexão. Tente novamente.")
    } finally {
      setIsUploading(false)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
          isDragging
            ? "border-cerrado-600 bg-cerrado-600/5"
            : error
              ? "border-semantic-error/30 bg-semantic-error/5"
              : "border-bg-elevated hover:border-text-muted"
        }`}
      >
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mb-3 text-text-muted"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" x2="12" y1="3" y2="15" />
        </svg>
        <p className="text-sm text-text-secondary">
          Arraste um arquivo ou <span className="text-cerrado-600">clique para selecionar</span>
        </p>
        <p className="mt-1 text-xs text-text-muted">
          PDF, DOCX, PPTX (ate 30MB), TXT (ate 20MB) ou MP3, WAV, M4A, OGG (ate 50MB)
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_STRING}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </button>

      {error && <p className="text-sm text-semantic-error">{error}</p>}

      {file && (
        <div className="flex items-center justify-between rounded-md bg-bg-card p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-bg-elevated text-xs font-medium text-text-secondary">
              {ACCEPTED_TYPES[file.type] || "?"}
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">{file.name}</p>
              <p className="text-xs text-text-muted">{formatSize(file.size)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setFile(null)
              setError(null)
            }}
            className="text-text-muted hover:text-text-secondary"
          >
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      )}

      <Button onClick={handleUpload} disabled={!file || isUploading} className="w-full">
        {isUploading ? "Enviando..." : "Processar com IA"}
      </Button>
    </div>
  )
}
