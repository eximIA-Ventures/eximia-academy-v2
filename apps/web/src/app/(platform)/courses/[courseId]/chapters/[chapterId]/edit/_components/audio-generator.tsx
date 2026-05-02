"use client"

import { Button, useToast } from "@eximia/ui"
import { Loader2, Mic, Podcast } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

interface AudioGeneratorProps {
  chapterId: string
  hasContent: boolean
}

export function AudioGenerator({ chapterId, hasContent }: AudioGeneratorProps) {
  const [generating, setGenerating] = useState<"narration" | "podcast" | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  async function handleGenerate(mode: "narration" | "podcast") {
    if (!hasContent) {
      toast({ variant: "error", title: "Adicione conteúdo ao capítulo antes de gerar áudio" })
      return
    }

    setGenerating(mode)
    try {
      const res = await fetch(`/api/chapters/${chapterId}/generate-audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast({ variant: "error", title: data.error ?? "Erro ao gerar áudio" })
        return
      }

      toast({
        variant: "success",
        title: mode === "podcast" ? "Podcast gerado!" : "Narração gerada!",
        description: "O áudio foi salvo automaticamente no capítulo.",
      })
      router.refresh()
    } catch {
      toast({ variant: "error", title: "Erro de conexão ao gerar áudio" })
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div className="rounded-xl bg-bg-card/50 p-4 ring-1 ring-white/[0.06] space-y-3">
      <div>
        <p className="text-sm font-semibold text-text-primary">Gerar Áudio com IA</p>
        <p className="text-xs text-text-muted mt-0.5">ElevenLabs — vozes naturais em português</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => handleGenerate("narration")}
          disabled={!!generating}
          className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 text-left transition-all hover:bg-white/[0.05] hover:border-white/[0.1] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating === "narration" ? (
            <Loader2 size={20} className="text-accent-blue-light animate-spin shrink-0" />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-blue-mid/15">
              <Mic size={18} className="text-accent-blue-light" />
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-text-primary">Narração</p>
            <p className="text-[11px] text-text-muted">Voz única lendo o conteúdo</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleGenerate("podcast")}
          disabled={!!generating}
          className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 text-left transition-all hover:bg-white/[0.05] hover:border-white/[0.1] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating === "podcast" ? (
            <Loader2 size={20} className="text-accent-teal animate-spin shrink-0" />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-teal/15">
              <Podcast size={18} className="text-accent-teal" />
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-text-primary">Podcast</p>
            <p className="text-[11px] text-text-muted">Dois hosts discutindo o tema</p>
          </div>
        </button>
      </div>

      {generating && (
        <p className="text-xs text-accent-blue-light animate-pulse">
          {generating === "podcast"
            ? "Gerando roteiro e sintetizando vozes... isso pode levar 1-2 min."
            : "Sintetizando narração... aguarde."}
        </p>
      )}
    </div>
  )
}
