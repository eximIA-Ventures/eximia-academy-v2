"use client"

import { Button, Input, Textarea, useToast } from "@eximia/ui"
import { useState } from "react"

interface TextPasteInputProps {
  onSubmit: (ingestionId: string) => void
  courseId?: string
}

export function TextPasteInput({ onSubmit, courseId }: TextPasteInputProps) {
  const [text, setText] = useState("")
  const [title, setTitle] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const charCount = text.length
  const isValid = charCount >= 200 && charCount <= 200000

  async function handleSubmit() {
    if (!isValid) return
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/ingestion/paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          title: title || undefined,
          ...(courseId ? { course_id: courseId } : {}),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Erro ao enviar texto.")
        toast({ variant: "error", title: data.error || "Erro ao enviar." })
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
        <label htmlFor="paste-title" className="mb-1 block text-sm font-medium text-text-secondary">
          Titulo (opcional)
        </label>
        <Input
          id="paste-title"
          placeholder="Ex: Aula de Machine Learning"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
        />
      </div>

      <div>
        <label htmlFor="paste-text" className="mb-1 block text-sm font-medium text-text-secondary">
          Conteúdo
        </label>
        <Textarea
          id="paste-text"
          placeholder="Cole aqui o conteúdo da aula, transcricao, ou texto do material didatico..."
          rows={12}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={200000}
        />
        <div className="mt-1 flex justify-between text-xs">
          <span className={charCount < 200 ? "text-semantic-error" : "text-text-muted"}>
            {charCount < 200 ? `Minimo 200 caracteres (faltam ${200 - charCount})` : ""}
          </span>
          <span
            className={
              charCount > 200000
                ? "text-semantic-error"
                : charCount >= 200
                  ? "text-semantic-success"
                  : "text-text-muted"
            }
          >
            {charCount.toLocaleString("pt-BR")} / 200.000
          </span>
        </div>
      </div>

      {error && <p className="text-sm text-semantic-error">{error}</p>}

      <Button onClick={handleSubmit} disabled={!isValid || isSubmitting} className="w-full">
        {isSubmitting ? "Enviando..." : "Processar com IA"}
      </Button>
    </div>
  )
}
