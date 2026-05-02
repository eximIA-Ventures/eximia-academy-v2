"use client"

import { Button, useToast } from "@eximia/ui"
import { useRouter } from "next/navigation"
import { useState } from "react"

interface GenerateQuestionsButtonProps {
  chapterId: string
  chapterStatus: string
  hasExistingQuestions: boolean
  replace?: boolean
  disabled?: boolean
  variant?: "default" | "outline"
}

export function GenerateQuestionsButton({
  chapterId,
  chapterStatus,
  hasExistingQuestions,
  replace = false,
  disabled = false,
  variant = "default",
}: GenerateQuestionsButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  if (chapterStatus !== "published" && chapterStatus !== "draft") return null

  async function handleGenerate() {
    setIsGenerating(true)
    try {
      const url = replace
        ? `/api/chapters/${chapterId}/generate-questions?replace=true`
        : `/api/chapters/${chapterId}/generate-questions`

      const response = await fetch(url, { method: "POST" })

      if (response.status === 429) {
        toast({
          variant: "warning",
          title: "Aguarde alguns minutos antes de gerar novas perguntas",
        })
        return
      }

      if (!response.ok) {
        const data = await response.json()
        toast({ variant: "error", title: data.error ?? "Erro ao gerar perguntas" })
        return
      }

      toast({ variant: "success", title: "Perguntas geradas com sucesso!" })
      router.refresh()
    } catch {
      toast({ variant: "error", title: "Erro de conexão ao gerar perguntas" })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Button variant={variant} onClick={handleGenerate} disabled={isGenerating || disabled}>
      {isGenerating ? "Gerando perguntas..." : replace ? "Gerar novas" : "Gerar Perguntas"}
    </Button>
  )
}
