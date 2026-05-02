"use client"

import { Button, useToast } from "@eximia/ui"
import { Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

interface EnrichButtonProps {
  courseId: string
  hasPublishedChapters: boolean
  disabled?: boolean
}

export function EnrichButton({
  courseId,
  hasPublishedChapters,
  disabled = false,
}: EnrichButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  if (!hasPublishedChapters) return null

  async function handleEnrich() {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/courses/${courseId}/enrich`, { method: "POST" })

      if (response.status === 429) {
        toast({
          variant: "warning",
          title: "Aguarde alguns minutos antes de enriquecer novamente",
        })
        return
      }

      if (response.status === 409) {
        const data = await response.json()
        toast({ variant: "warning", title: data.error ?? "Operacao em andamento" })
        return
      }

      if (!response.ok) {
        const data = await response.json()
        toast({ variant: "error", title: data.error ?? "Erro ao iniciar enriquecimento" })
        return
      }

      const data = await response.json()
      toast({ variant: "success", title: "Enriquecimento iniciado!" })
      router.push(`/courses/${courseId}/enrich/${data.jobId}`)
    } catch {
      toast({ variant: "error", title: "Erro de conexão ao iniciar enriquecimento" })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button variant="outline" onClick={handleEnrich} disabled={isLoading || disabled}>
      <Sparkles className="mr-2 h-4 w-4" />
      {isLoading ? "Iniciando..." : "Enriquecer com IA"}
    </Button>
  )
}
